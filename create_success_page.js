/**
 * create_success_page.js — Replace form in success.html with confirmation message
 */
const fs = require('fs');
const cheerio = require('cheerio');

const successHtmlPath = './dist/success.html';
if (!fs.existsSync(successHtmlPath)) {
    console.error('success.html not found!');
    process.exit(1);
}

const html = fs.readFileSync(successHtmlPath, 'utf8');
const $ = cheerio.load(html, { decodeEntities: false });

// Find the form container we injected (or the fallback container)
const formContainer = $('.evc-form-container');

if (formContainer.length) {
    formContainer.html(`
        <div style="text-align: center; padding: 4rem 2rem;">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem; color: #2c803e;">Success!</h2>
            <p style="font-size: 1.25rem; color: #555;">Thank you for getting in touch. We will get back to you shortly.</p>
            <a href="index.html" style="display: inline-block; margin-top: 2rem; padding: 12px 24px; background: #f57f25; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Return Home</a>
        </div>
    `);
    fs.writeFileSync(successHtmlPath, $.html());
    console.log('✓ Updated success.html with confirmation message');
} else {
    // Maybe we haven't injected the form yet? Or looking at wrong file?
    // Try finding the main content area
    console.log('⚠ Could not find form container, appending success message to body/main');
    const target = $('main').length ? $('main') : $('body');
    target.append(`
        <div class="evc-form-container" style="text-align: center; padding: 4rem 2rem;">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem; color: #2c803e;">Success!</h2>
            <p style="font-size: 1.25rem; color: #555;">Thank you for getting in touch. We will get back to you shortly.</p>
            <a href="index.html" style="display: inline-block; margin-top: 2rem; padding: 12px 24px; background: #f57f25; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Return Home</a>
        </div>
    `);
    fs.writeFileSync(successHtmlPath, $.html());
}
