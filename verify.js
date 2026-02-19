const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = {
    distDir: path.join(__dirname, 'dist'),
    inventoryFile: path.join(__dirname, 'asset_inventory.csv')
};

function performVerification() {
    console.log('Starting Verification Phase...');

    if (!fs.existsSync(CONFIG.inventoryFile)) {
        console.error('Inventory file not found. Run analyze.js first.');
        return;
    }

    const inventory = fs.readFileSync(CONFIG.inventoryFile, 'utf-8')
        .split('\n')
        .slice(1) // Skip header
        .map(line => line.split(','))
        .filter(parts => parts.length >= 2);

    let missingCount = 0;
    let foundCount = 0;

    console.log(`Checking ${inventory.length} items from inventory...`);

    // 1. Check if files exist
    // Note: The inventory has original URLs. We need to check if they were downloaded.
    // clone_pro.js saves them in 'assets/<type>/<filename>'
    // This is tricky because filenames are sanitized. 
    // Ideally verify.js would check the *rewritten* HTML to see if links work.

    // Alternative approach: Check for broken links in the downloaded HTML files.
    const htmlFiles = findHtmlFiles(CONFIG.distDir);
    console.log(`Found ${htmlFiles.length} HTML files to inspect.`);

    const brokenLinks = [];

    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Find local links that don't exist
        // Matches src="..." or href="..."
        const regex = /(?:src|href)=["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const link = match[1];

            // Skip external links, data URIs, anchors
            if (link.startsWith('http') || link.startsWith('//') || link.startsWith('data:') || link.startsWith('#') || link.startsWith('mailto:')) {
                continue;
            }

            // Resolve relative path
            const absolutePath = path.resolve(path.dirname(file), link);

            // Check if file exists
            // Remove query strings/hashes for file check
            const cleanPath = absolutePath.split('?')[0].split('#')[0];

            if (!fs.existsSync(cleanPath)) {
                // Try decoding URI component
                const decodedPath = decodeURIComponent(cleanPath);
                if (!fs.existsSync(decodedPath)) {
                    brokenLinks.push({
                        file: path.relative(CONFIG.distDir, file),
                        link: link,
                        resolved: cleanPath
                    });
                    missingCount++;
                } else {
                    foundCount++;
                }
            } else {
                foundCount++;
            }
        }
    }

    console.log(`\nVerification Complete.`);
    console.log(`Verified Links: ${foundCount}`);
    console.log(`Broken Links: ${missingCount}`);

    if (missingCount > 0) {
        console.log('\nMissing/Broken Resources:');
        brokenLinks.slice(0, 50).forEach(item => {
            console.log(`[${item.file}] -> ${item.link}`);
        });
        if (brokenLinks.length > 50) console.log(`...and ${brokenLinks.length - 50} more.`);

        // Save report
        fs.writeFileSync(path.join(__dirname, 'qa_report.json'), JSON.stringify(brokenLinks, null, 2));
        console.log('\nDetailed report saved to qa_report.json');
    } else {
        console.log('\nSUCCESS: No broken local links found.');
    }
}

function findHtmlFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findHtmlFiles(filePath));
        } else if (file.endsWith('.html')) {
            results.push(filePath);
        }
    });
    return results;
}

performVerification();
