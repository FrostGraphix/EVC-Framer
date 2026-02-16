const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const config = {
    baseUrl: 'https://www.evcng.com',
    maxDepth: 3, // Initial depth for Framer site
    outputDir: './dist'
};

const visited = new Set();
const resources = new Set();

async function ensureDir(filePath) {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

async function saveResource(url, content) {
    try {
        const u = new URL(url);
        let pathname = u.pathname;
        if (pathname.endsWith('/')) pathname += 'index.html';
        if (!path.extname(pathname)) pathname += '.html';

        const localPath = path.join(config.outputDir, pathname);
        await ensureDir(localPath);
        fs.writeFileSync(localPath, content);
        console.log(`Saved: ${localPath}`);
    } catch (e) {
        console.error(`Failed to save ${url}:`, e.message);
    }
}

async function crawl(browser, url, depth) {
    if (depth > config.maxDepth || visited.has(url)) return;
    visited.add(url);
    console.log(`Crawling (${depth}): ${url}`);

    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for Framer content to hydrate if needed
        await page.waitForSelector('body', { timeout: 5000 }).catch(() => { });

        const content = await page.content();
        await saveResource(url, content);

        // Extract links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.startsWith(window.location.origin));
        });

        await page.close();

        for (const link of links) {
            await crawl(browser, link, depth + 1);
        }

    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        await page.close();
    }
}

(async () => {
    if (!fs.existsSync(config.outputDir)) fs.mkdirSync(config.outputDir);

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    await crawl(browser, config.baseUrl, 1);
    await browser.close();
    console.log('Cloning complete.');
})();
