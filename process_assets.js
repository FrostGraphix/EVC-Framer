const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');

const distDir = './dist';
const assetsDir = './dist/assets';

// Track downloads to avoid duplicates
const downloadCache = new Map();

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

async function downloadAsset(url) {
    // Normalize URL
    if (!url || url.startsWith('data:') || url.startsWith('assets/')) return url;
    try {
        // Make sure URL is absolute
        let absoluteUrl = url;
        if (url.startsWith('//')) absoluteUrl = 'https:' + url;
        if (!absoluteUrl.startsWith('http')) return url;

        // Check cache
        if (downloadCache.has(absoluteUrl)) return downloadCache.get(absoluteUrl);

        const u = new URL(absoluteUrl);
        let filename = path.basename(u.pathname) || 'asset_' + Date.now();
        // Add query hash to filename to avoid collisions
        if (u.search) {
            const hash = Buffer.from(u.search).toString('base64url').slice(0, 8);
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            filename = `${base}_${hash}${ext}`;
        }

        const localPath = path.join(assetsDir, filename);
        const relativePath = `assets/${filename}`;

        // If file already exists on disk, use it
        if (fs.existsSync(localPath)) {
            downloadCache.set(absoluteUrl, relativePath);
            return relativePath;
        }

        console.log(`  Downloading: ${absoluteUrl.substring(0, 100)}...`);
        const response = await axios.get(absoluteUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        fs.writeFileSync(localPath, response.data);
        downloadCache.set(absoluteUrl, relativePath);
        return relativePath;
    } catch (error) {
        console.error(`  Failed to download ${url.substring(0, 80)}:`, error.message);
        return url; // Return original URL if download fails
    }
}

// ── CSS url() processing ────────────────────────────────────────────
async function processCssUrls(cssText) {
    const urlRegex = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/g;
    let match;
    const replacements = [];

    while ((match = urlRegex.exec(cssText)) !== null) {
        const originalUrl = match[1];
        replacements.push({ full: match[0], url: originalUrl, index: match.index });
    }

    if (replacements.length === 0) return { text: cssText, changed: false };

    let result = cssText;
    // Process in reverse order to keep indices valid
    for (let i = replacements.length - 1; i >= 0; i--) {
        const r = replacements[i];
        const localPath = await downloadAsset(r.url);
        if (localPath !== r.url) {
            result = result.replace(r.full, `url(${localPath})`);
        }
    }
    return { text: result, changed: result !== cssText };
}

// ── Internal link rewriting ─────────────────────────────────────────
const SITE_ORIGINS = [
    'https://www.evcng.com',
    'https://evcng.com',
    'http://www.evcng.com',
    'http://evcng.com',
    'https://magenta-basis-439144.framer.app'
];

function rewriteInternalLink(href) {
    if (!href) return null;
    for (const origin of SITE_ORIGINS) {
        if (href === origin || href === origin + '/') {
            return 'index.html';
        }
        if (href.startsWith(origin + '/')) {
            let relative = href.slice(origin.length + 1); // strip origin + '/'
            // Remove trailing slash
            if (relative.endsWith('/')) relative = relative.slice(0, -1);
            if (!relative) return 'index.html';
            // Add .html if no extension
            if (!path.extname(relative)) relative += '.html';
            return relative;
        }
    }
    return null; // not an internal link
}

// ── Main file processor ─────────────────────────────────────────────
async function processFile(filePath) {
    console.log(`\nProcessing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    let modified = false;

    // 1. Process <script src>
    const scripts = $('script[src]');
    for (let i = 0; i < scripts.length; i++) {
        const el = $(scripts[i]);
        const src = el.attr('src');
        if (src && (src.includes('framerusercontent') || src.includes('framer.com') || src.includes('events.framer'))) {
            const newSrc = await downloadAsset(src);
            if (newSrc !== src) {
                el.attr('src', newSrc);
                modified = true;
            }
        }
    }

    // 2. Process <link href> (icons, stylesheets, apple-touch-icon)
    const links = $('link[href]');
    for (let i = 0; i < links.length; i++) {
        const el = $(links[i]);
        const href = el.attr('href');
        if (href && (href.includes('framerusercontent') || href.includes('framer.com'))) {
            const newHref = await downloadAsset(href);
            if (newHref !== href) {
                el.attr('href', newHref);
                modified = true;
            }
        }
    }

    // 3. Process <img src> and srcset
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
        if (el.attr('srcset')) {
            el.removeAttr('srcset');
            modified = true;
        }
    }

    // 4. Process OG and Twitter meta images
    const metaImages = $('meta[property="og:image"], meta[name="twitter:image"]');
    for (let i = 0; i < metaImages.length; i++) {
        const el = $(metaImages[i]);
        const imgUrl = el.attr('content');
        if (imgUrl && imgUrl.startsWith('http')) {
            const newUrl = await downloadAsset(imgUrl);
            if (newUrl !== imgUrl) {
                el.attr('content', newUrl);
                modified = true;
            }
        }
    }

    // 5. Process CSS url() in <style> tags
    const styles = $('style');
    for (let i = 0; i < styles.length; i++) {
        const el = $(styles[i]);
        const cssText = el.html();
        if (cssText) {
            const { text, changed } = await processCssUrls(cssText);
            if (changed) {
                el.html(text);
                modified = true;
            }
        }
    }

    // 6. Process inline style attributes with url()
    const styledEls = $('[style]');
    for (let i = 0; i < styledEls.length; i++) {
        const el = $(styledEls[i]);
        const styleAttr = el.attr('style');
        if (styleAttr && styleAttr.includes('url(')) {
            const { text, changed } = await processCssUrls(styleAttr);
            if (changed) {
                el.attr('style', text);
                modified = true;
            }
        }
    }

    // 7. Rewrite internal navigation links
    const anchors = $('a[href]');
    for (let i = 0; i < anchors.length; i++) {
        const el = $(anchors[i]);
        const href = el.attr('href');
        const rewritten = rewriteInternalLink(href);
        if (rewritten !== null) {
            console.log(`  Rewriting link: ${href} -> ${rewritten}`);
            el.attr('href', rewritten);
            modified = true;
        }
    }

    // 8. Remove Framer editor iframe
    const editorIframe = $('#__framer-editorbar');
    if (editorIframe.length) {
        editorIframe.remove();
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, $.html());
        console.log(`  ✓ Updated: ${filePath}`);
    } else {
        console.log(`  - No changes needed.`);
    }
}

// ── Recursively find HTML files ─────────────────────────────────────
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

async function run() {
    console.log('=== Enhanced Asset Processing ===\n');
    const files = findHtmlFiles(distDir);
    console.log(`Found ${files.length} HTML files to process.\n`);

    for (const file of files) {
        await processFile(file);
    }

    console.log(`\n=== Processing Complete ===`);
    console.log(`Downloaded ${downloadCache.size} unique assets.`);
}

run();
