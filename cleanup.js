const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const distDir = './dist';

const SITE_ORIGINS = [
    'https://www.evcng.com',
    'https://evcng.com',
    'http://www.evcng.com',
    'http://evcng.com',
    'https://magenta-basis-439144.framer.app'
];

function findHtmlFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'assets' && entry.name !== 'node_modules') {
            results = results.concat(findHtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

function fixFile(filePath) {
    const basename = path.basename(filePath);
    console.log(`\nFixing: ${basename}`);
    let content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    let changes = 0;

    // 1. Rewrite canonical link
    $('link[rel="canonical"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
            for (const origin of SITE_ORIGINS) {
                if (href.startsWith(origin)) {
                    // Make it relative or just point to self
                    $(el).remove();
                    changes++;
                    console.log(`  Removed canonical: ${href}`);
                    break;
                }
            }
        }
    });

    // 2. Rewrite og:url
    $('meta[property="og:url"]').each((i, el) => {
        $(el).remove();
        changes++;
        console.log(`  Removed og:url`);
    });

    // 3. Remove alternate/hreflang links pointing to Framer
    $('link[rel="alternate"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
            for (const origin of SITE_ORIGINS) {
                if (href.startsWith(origin)) {
                    $(el).remove();
                    changes++;
                    console.log(`  Removed alternate: ${href}`);
                    break;
                }
            }
        }
    });

    // 4. Remove Cloudflare beacon script
    $('script[src*="cloudflareinsights.com"]').each((i, el) => {
        $(el).remove();
        changes++;
        console.log(`  Removed Cloudflare beacon`);
    });

    // 5. Remove Framer search index meta tags
    $('meta[name="framer-search-index"], meta[name="framer-search-index-fallback"]').each((i, el) => {
        $(el).remove();
        changes++;
        console.log(`  Removed Framer search index meta`);
    });

    // 6. Remove generator meta
    $('meta[name="generator"][content*="Framer"]').each((i, el) => {
        $(el).remove();
        changes++;
        console.log(`  Removed Framer generator meta`);
    });

    // 7. Remove Framer comment
    // This is handled by string replacement below

    if (changes > 0) {
        let html = $.html();
        // Clean up Framer comment in DOCTYPE
        html = html.replace(/<!-- ✨ Built with Framer • https:\/\/www\.framer\.com\/ -->/g, '');
        // Clean any remaining framer.app references in link/meta attributes we might have missed
        fs.writeFileSync(filePath, html);
        console.log(`  ✓ ${changes} fixes applied`);
    } else {
        console.log(`  - No fixes needed`);
    }
}

console.log('=== Cleanup Pass ===\n');
const files = findHtmlFiles(distDir);
console.log(`Processing ${files.length} files...\n`);
files.forEach(fixFile);
console.log('\n=== Cleanup Complete ===');
