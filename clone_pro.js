const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');

const CONFIG = {
    baseUrl: 'https://www.evcng.com',
    outputDir: path.join(__dirname, 'dist'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    maxDepth: 5
};

const visited = new Set();
const assetCache = new Set();

// Ensure directory exists
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Download asset helper
async function downloadAsset(url, type) {
    if (!url || url.startsWith('data:') || assetCache.has(url)) return null;

    try {
        const assetUrl = new URL(url, CONFIG.baseUrl);
        const ext = path.extname(assetUrl.pathname) || '.dat';
        const filename = sanitizeFilename(path.basename(assetUrl.pathname)) + (path.extname(assetUrl.pathname) ? '' : ext);
        const relativePath = path.join('assets', type, filename);
        const localPath = path.join(CONFIG.outputDir, relativePath);

        if (fs.existsSync(localPath)) return relativePath;

        ensureDir(path.dirname(localPath));

        console.log(`Downloading ${type}: ${url}`);
        const response = await axios({
            method: 'get',
            url: assetUrl.href,
            responseType: 'stream',
            timeout: 10000,
            validateStatus: (status) => status < 400
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                assetCache.add(url);
                resolve(relativePath);
            });
            writer.on('error', reject);
        });
    } catch (e) {
        console.warn(`Failed to download ${url}: ${e.message}`);
        return url; // Return original URL if download fails
    }
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9\.\-_]/gi, '_').substring(0, 100);
}

async function processPage(page, url, depth) {
    if (visited.has(url) || depth > CONFIG.maxDepth) return;
    visited.add(url);

    console.log(`\nProcessing [Depth ${depth}]: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    } catch (e) {
        console.error(`Failed to load ${url}: ${e.message}`);
        return;
    }

    // 1. Process Assets (Images, Scripts, Styles) in browser context to get robust list
    // We'll extract them, download them in Node, and then use DOM manipulation to rewrite paths.

    // Evaluate page to get all asset URLs
    const assetData = await page.evaluate(() => {
        const getSrc = (els, attr) => Array.from(els).map(el => ({
            tag: el.tagName.toLowerCase(),
            attr,
            url: el[attr] || el.getAttribute(attr)
        })).filter(i => i.url);

        return [
            ...getSrc(document.querySelectorAll('img'), 'src'),
            ...getSrc(document.querySelectorAll('img'), 'srcset'), // Handling srcset is complex, simplifying to src for now or need parser
            ...getSrc(document.querySelectorAll('script[src]'), 'src'),
            ...getSrc(document.querySelectorAll('link[rel="stylesheet"]'), 'href'),
            ...getSrc(document.querySelectorAll('video'), 'src'),
            ...getSrc(document.querySelectorAll('source'), 'src')
        ];
    });

    // 2. Download assets/rewrite maps
    const urlMap = new Map();
    for (const item of assetData) {
        if (!item.url) continue;
        let type = 'misc';
        if (item.tag === 'img') type = 'images';
        if (item.tag === 'script') type = 'scripts';
        if (item.tag === 'link') type = 'styles';
        if (item.tag === 'video' || item.tag === 'source') type = 'media';

        // Handle comma-separated srcset? For now just download single URLs
        if (item.attr === 'srcset') continue;

        const localPath = await downloadAsset(item.url, type);
        if (localPath && localPath !== item.url) {
            urlMap.set(item.url, localPath);
        }
    }

    // 3. Rewrite DOM in Puppeteer
    await page.evaluate((mapArray) => {
        const map = new Map(mapArray);

        // Helper to rewrite
        const rewrite = (selector, attr) => {
            document.querySelectorAll(selector).forEach(el => {
                const val = el[attr] || el.getAttribute(attr);
                if (val && map.has(val)) {
                    // Update to relative path (assuming root-relative for simplest handling first)
                    // We will make them truly relative in post-processing or assume serving from root
                    el.setAttribute(attr, '/' + map.get(val).replace(/\\/g, '/'));
                }
            });
        };

        rewrite('img', 'src');
        rewrite('script', 'src');
        rewrite('link[rel="stylesheet"]', 'href');
        rewrite('video', 'src');
        rewrite('source', 'src');

    }, Array.from(urlMap.entries()));


    // 4. Save HTML
    const u = new URL(url);
    let pathname = u.pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (!path.extname(pathname)) pathname += '.html';

    const localHtmlPath = path.join(CONFIG.outputDir, pathname);
    ensureDir(path.dirname(localHtmlPath));
    const content = await page.content();
    fs.writeFileSync(localHtmlPath, content);
    console.log(`Saved HTML: ${localHtmlPath}`);

    // 5. Discover new links
    const newLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => href.startsWith(window.location.origin) && !href.includes('#'));
    });

    // Recursion
    for (const link of newLinks) {
        await processPage(page, link, depth + 1);
    }
}

(async () => {
    ensureDir(CONFIG.outputDir);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] // Disable web security for CORS assets
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(CONFIG.userAgent);
        await page.setViewport({ width: 1920, height: 1080 });

        await processPage(page, CONFIG.baseUrl, 0);

    } catch (e) {
        console.error('Fatal error:', e);
    } finally {
        await browser.close();
    }
})();
