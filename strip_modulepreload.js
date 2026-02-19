/**
 * strip_modulepreload.js — Remove leftover <link rel="modulepreload"> tags
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const distDir = './dist';
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));

let total = 0;
console.log('=== Removing modulepreload tags ===\n');

files.forEach(f => {
    const filePath = path.join(distDir, f);
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    const mp = $('link[rel="modulepreload"]');
    if (mp.length) {
        mp.remove();
        fs.writeFileSync(filePath, $.html());
        console.log(`  ✓ ${f}: removed ${mp.length} modulepreload tag(s)`);
        total += mp.length;
    }
});

console.log(`\n=== Done: ${total} modulepreload tags removed ===`);
