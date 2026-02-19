
const fs = require('fs');
const cheerio = require('cheerio');

const files = ['contact.html', 'book-inspection.html'];

files.forEach(file => {
    const filePath = `./dist/${file}`;
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }

    console.log(`\n=== Inspecting ${file} ===`);
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);

    // Look for form-related keywords
    const keywords = ['Contact', 'Get in touch', 'Name', 'Email', 'Message', 'Inspection', 'Book'];

    // Find divs containing these keywords
    $('div').each((i, el) => {
        const text = $(el).text().trim();
        // Check if text matches any keyword
        const match = keywords.find(k => text.includes(k));

        if (match && text.length < 100) { // Only short texts to avoid huge blocks
            // Get attributes
            const cls = $(el).attr('class') || '';
            const id = $(el).attr('id') || '';
            const dataName = $(el).attr('data-framer-name') || '';

            console.log(`Found "${match}":`);
            console.log(`  Text: "${text}"`);
            console.log(`  Class: ${cls}`);
            console.log(`  ID: ${id}`);
            console.log(`  Data-Name: ${dataName}`);
            // Show parent path
            let parent = $(el).parent();
            let path = [];
            while (parent.length && parent[0].name !== 'body') {
                const name = parent.attr('data-framer-name') || parent.attr('id') || parent.attr('class') || parent[0].name;
                path.unshift(name);
                parent = parent.parent();
            }
            console.log(`  Path: body > ${path.join(' > ')}`);
            console.log('---');
        }
    });

    // innovative check: look for empty divs that might be placeholders
    $('div:empty').each((i, el) => {
        const cls = $(el).attr('class') || '';
        const id = $(el).attr('id') || '';
        const dataName = $(el).attr('data-framer-name') || '';
        if (dataName.toLowerCase().includes('form') || dataName.toLowerCase().includes('input')) {
            console.log(`Found Empty Form Placeholder:`);
            console.log(`  Data-Name: ${dataName}`);
            console.log(`  ID: ${id}`);
            console.log('---');
        }
    });
});
