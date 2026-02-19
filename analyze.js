const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TARGET_URL = 'https://www.evcng.com';
const OUTPUT_DIR = __dirname;

async function analyzeSite() {
    console.log(`Starting analysis of ${TARGET_URL}...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport to desktop
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        const response = await page.goto(TARGET_URL, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log(`Page loaded. Status: ${response.status()}`);

        // analyze architecture and stack
        const analysis = await page.evaluate(() => {
            const getMeta = (name) => {
                const el = document.querySelector(`meta[name="${name}"]`);
                return el ? el.content : null;
            };

            // Detect tech stack indicators
            const stack = [];
            if (document.querySelector('#__next') || window.__NEXT_DATA__) stack.push('Next.js');
            if (typeof React !== 'undefined' || document.querySelector('[data-reactroot]')) stack.push('React');
            if (document.querySelector('div[id^="framer-"]')) stack.push('Framer');
            if (typeof jQuery !== 'undefined') stack.push('jQuery');

            // Get all links
            const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
            const internalLinks = links.filter(href => href.startsWith(window.location.origin));
            const externalLinks = links.filter(href => !href.startsWith(window.location.origin) && href.startsWith('http'));

            // Get assets
            const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);

            return {
                title: document.title,
                description: getMeta('description'),
                stack: [...new Set(stack)],
                structure: {
                    internalLinks: [...new Set(internalLinks)],
                    externalLinks: [...new Set(externalLinks)]
                },
                assets: {
                    images: [...new Set(images)],
                    scripts: [...new Set(scripts)],
                    styles: [...new Set(styles)]
                }
            };
        });

        console.log('Analysis complete. Saving results...');

        // Save JSON analysis
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'site_analysis.json'),
            JSON.stringify(analysis, null, 2)
        );

        // Save CSV Inventory
        const csvContent = [
            'Type,URL',
            ...analysis.structure.internalLinks.map(l => `Page,${l}`),
            ...analysis.assets.images.map(l => `Image,${l}`),
            ...analysis.assets.scripts.map(l => `Script,${l}`),
            ...analysis.assets.styles.map(l => `Stylesheet,${l}`)
        ].join('\n');

        fs.writeFileSync(path.join(OUTPUT_DIR, 'asset_inventory.csv'), csvContent);

        console.log(`Found ${analysis.structure.internalLinks.length} pages`);
        console.log(`Found ${analysis.assets.images.length} images`);
        console.log(`Detected Stack: ${analysis.stack.join(', ')}`);

    } catch (error) {
        console.error('Analysis failed:', error);
    } finally {
        await browser.close();
    }
}

analyzeSite();
