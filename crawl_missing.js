const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const config = {
    baseUrl: 'https://www.evcng.com',
    outputDir: './dist'
};

const missingPages = [
    '/the-providence',
    '/contact',
    '/vision-smart-city'
];

async function crawlPage(browser, pagePath) {
    const url = config.baseUrl + pagePath;
    const filename = pagePath.replace(/^\//, '').replace(/\//g, '-') + '.html';
    const outputPath = path.join(config.outputDir, filename);

    console.log(`\nCrawling: ${url}`);
    const page = await browser.newPage();

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for Framer content to hydrate
        await new Promise(r => setTimeout(r, 3000));

        const html = await page.content();
        fs.writeFileSync(outputPath, html);
        console.log(`  ✓ Saved: ${filename} (${html.length} bytes)`);
    } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
    } finally {
        await page.close();
    }
}

(async () => {
    console.log('=== Crawling Missing Pages ===');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const pagePath of missingPages) {
        await crawlPage(browser, pagePath);
    }

    await browser.close();
    console.log('\n=== Done ===');
})();
