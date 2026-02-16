const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function analyzeSite() {
    try {
        console.log('Fetching https://www.evcng.com...');
        const response = await axios.get('https://www.evcng.com', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        console.log('\n--- HEADERS ---');
        console.log(JSON.stringify(response.headers, null, 2));

        const $ = cheerio.load(response.data);
        const title = $('title').text();
        const metaDesc = $('meta[name="description"]').attr('content');
        const internalLinks = new Set();
        const externalLinks = new Set();
        const scripts = new Set();
        const stylesheets = new Set();

        $('a').each((i, link) => {
            const href = $(link).attr('href');
            if (href) {
                if (href.startsWith('/') || href.includes('evcng.com')) {
                    internalLinks.add(href);
                } else if (href.startsWith('http')) {
                    externalLinks.add(href);
                }
            }
        });

        $('script').each((i, script) => {
            const src = $(script).attr('src');
            if (src) scripts.add(src);
        });

        $('link[rel="stylesheet"]').each((i, link) => {
            const href = $(link).attr('href');
            if (href) stylesheets.add(href);
        });

        const analysis = {
            title,
            metaDescription: metaDesc,
            headers: response.headers,
            linkCounts: {
                internal: internalLinks.size,
                external: externalLinks.size
            },
            scripts: Array.from(scripts),
            stylesheets: Array.from(stylesheets),
            hasReact: Array.from(scripts).some(s => s && (s.includes('react') || s.includes('next'))) || $('[id^="__next"]').length > 0 || $('[id^="root"]').length > 0
        };

        console.log('\n--- ANALYSIS RESULTS ---');
        console.log(JSON.stringify(analysis, null, 2));
        
        fs.writeFileSync('site_analysis.json', JSON.stringify(analysis, null, 2));
        console.log('\nAnalysis saved to site_analysis.json');

    } catch (error) {
        console.error('Error analyzing site:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

analyzeSite();
