/**
 * inject_fixes.js — Strip Framer runtime and inject lightweight replacement
 * 
 * 1. Removes all <script src="assets/*.mjs"> tags
 * 2. Removes inline <script> blocks containing Framer runtime bootstrap code  
 * 3. Injects <link> to framer-fix.css in <head>
 * 4. Injects <script> to framer-fix.js before </body>
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const distDir = './dist';

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content, { decodeEntities: false });
    let fixes = 0;

    // 1. Remove external .mjs script tags
    $('script[src]').each(function () {
        const src = $(this).attr('src') || '';
        if (src.endsWith('.mjs') || src.includes('framer.com') || src.includes('framerusercontent')) {
            $(this).remove();
            fixes++;
        }
    });

    // 2. Remove inline scripts containing Framer bootstrap/runtime code
    $('script:not([src])').each(function () {
        const text = $(this).html() || '';
        if (text.includes('__framer') || text.includes('framer.com') ||
            text.includes('window.__framer') || text.includes('__FRAMER__') ||
            text.includes('events.framer') ||
            // Remove tiny analytics/tracking scripts
            (text.length < 500 && (text.includes('gtag') || text.includes('analytics') || text.includes('_paq')))) {
            $(this).remove();
            fixes++;
        }
    });

    // 3. Remove the Framer badge container
    $('#__framer-badge-container').remove();

    // 4. Remove framer edit iframe
    $('iframe[src*="framer.com"]').remove();

    // 5. Inject our CSS in <head> (if not already present)
    if (!$('link[href="assets/framer-fix.css"]').length) {
        $('head').append('\n    <link rel="stylesheet" href="assets/framer-fix.css">');
        fixes++;
    }

    // 6. Inject our JS before </body> (if not already present)
    if (!$('script[src="assets/framer-fix.js"]').length) {
        $('body').append('\n    <script src="assets/framer-fix.js"></script>');
        fixes++;
    }

    if (fixes > 0) {
        fs.writeFileSync(filePath, $.html());
        console.log(`  ✓ ${path.basename(filePath)}: ${fixes} fixes applied`);
    } else {
        console.log(`  ○ ${path.basename(filePath)}: no changes needed`);
    }

    return fixes;
}

// --- Main ---
console.log('=== Framer Fix Injection ===\n');

const files = [];
function findHtml(dir) {
    fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory() && f !== 'assets') {
            findHtml(full);
        } else if (f.endsWith('.html')) {
            files.push(full);
        }
    });
}
findHtml(distDir);

console.log(`Processing ${files.length} HTML files...\n`);

let totalFixes = 0;
files.forEach(f => {
    totalFixes += processFile(f);
});

console.log(`\n=== Done: ${totalFixes} total fixes across ${files.length} files ===`);
