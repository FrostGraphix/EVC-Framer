const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');

const distDir = './dist';
const assetsDir = './dist/assets';

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

async function downloadAsset(url) {
    try {
        const u = new URL(url);
        const filename = path.basename(u.pathname) || 'asset_' + Date.now();
        const localPath = path.join(assetsDir, filename);

        // If file exists, return relative path
        if (fs.existsSync(localPath)) {
            return `assets/${filename}`;
        }

        console.log(`Downloading: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(localPath, response.data);
        return `assets/${filename}`;
    } catch (error) {
        console.error(`Failed to download ${url}:`, error.message);
        return url; // Return original URL if download fails
    }
}

async function processFile(filePath) {
    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    let modified = false;

    // Process Scripts
    const scripts = $('script[src]');
    for (let i = 0; i < scripts.length; i++) {
        const el = $(scripts[i]);
        const src = el.attr('src');
        if (src && (src.includes('framerusercontent') || src.includes('framer.com'))) {
            const newSrc = await downloadAsset(src);
            if (newSrc !== src) {
                el.attr('src', newSrc);
                modified = true;
            }
        }
    }

    // Process Links (Icons, CSS if any external)
    const links = $('link[href]');
    for (let i = 0; i < links.length; i++) {
        const el = $(links[i]);
        const href = el.attr('href');
        const rel = el.attr('rel');
        if (href && (href.includes('framerusercontent') || href.includes('framer.com'))) {
            // Prioritize icons and stylesheets
            if (rel && (rel.includes('icon') || rel.includes('stylesheet'))) {
                const newHref = await downloadAsset(href);
                if (newHref !== href) {
                    el.attr('href', newHref);
                    modified = true;
                }
            }
        }
    }

    // Process Images
    const images = $('img[src]');
    for (let i = 0; i < images.length; i++) {
        const el = $(images[i]);
        const src = el.attr('src');
        if (src && (src.includes('framerusercontent') || src.includes('framer.com'))) {
            const newSrc = await downloadAsset(src);
            if (newSrc !== src) {
                el.attr('src', newSrc);
                modified = true;
            }
        }
        // Handle srcset? For now, skip to avoid complexity, or just clear it to force src usage
        if (el.attr('srcset')) {
            el.removeAttr('srcset');
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, $.html());
        console.log(`Updated: ${filePath}`);
    }
}

async function run() {
    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));
    for (const file of files) {
        await processFile(path.join(distDir, file));
    }
    console.log('Asset processing complete.');
}

run();
