/**
 * inject_forms.js — Inject missing forms into contact.html and book-inspection.html
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const formsCss = '<link rel="stylesheet" href="assets/forms.css">';

// --- Contact Form HTML ---
const contactFormHtml = `
<div class="evc-form-container">
    <form name="contact" method="POST" data-netlify="true" action="/success.html">
        <input type="hidden" name="form-name" value="contact">
        <div class="evc-form-group">
            <label class="evc-form-label" for="name">Name</label>
            <input class="evc-form-input" type="text" id="name" name="name" required placeholder="Your Full Name">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="email">Email</label>
            <input class="evc-form-input" type="email" id="email" name="email" required placeholder="name@example.com">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="phone">Phone Number</label>
            <input class="evc-form-input" type="tel" id="phone" name="phone" placeholder="+234...">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="message">Message</label>
            <textarea class="evc-form-textarea" id="message" name="message" required placeholder="How can we help you?"></textarea>
        </div>
        <button class="evc-form-submit" type="submit">Send Message</button>
    </form>
</div>
`;

// --- Inspection Form HTML ---
const inspectionFormHtml = `
<div class="evc-form-container">
    <form name="inspection" method="POST" data-netlify="true" action="/success.html">
        <input type="hidden" name="form-name" value="inspection">
        <div class="evc-form-group">
            <label class="evc-form-label" for="name">Full Name</label>
            <input class="evc-form-input" type="text" id="name" name="name" required placeholder="Your Name">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="email">Email Address</label>
            <input class="evc-form-input" type="email" id="email" name="email" required placeholder="email@example.com">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="phone">Phone Number</label>
            <input class="evc-form-input" type="tel" id="phone" name="phone" required placeholder="Phone Number">
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="date">Preferred Date</label>
            <input class="evc-form-input" type="date" id="date" name="date" required>
        </div>
        <div class="evc-form-group">
            <label class="evc-form-label" for="location">Property Location</label>
            <select class="evc-form-select" id="location" name="location">
                <option value="General">General Inquiry</option>
                <option value="Alabata">Alabata</option>
                <option value="The Providence">The Providence</option>
                <option value="Vision Smart City">Vision Smart City</option>
            </select>
        </div>
        <button class="evc-form-submit" type="submit">Book Inspection</button>
    </form>
</div>
`;

function injectForm(file, selectorKeywords, formHtml) {
    const filePath = path.join('./dist', file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file} - not found`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content, { decodeEntities: false });

    // Inject CSS if missing
    if (!$('link[href="assets/forms.css"]').length) {
        $('head').append(formsCss);
    }

    // Heuristic to find the container
    // We look for a container that has "Email" or "Contact" text but isn't the footer
    // Based on inspection, 'body > main > ...'
    // We will look for the specific section identified earlier or a robust fallback

    let targetContainer = null;

    // Strategy: Find a div containing "Get in touch" or "Book Inspection" that is empty or has minimal content
    // Or just append to the main content area after the header

    $('div').each((i, el) => {
        const text = $(el).text();
        if (text.includes(selectorKeywords) && !targetContainer) {
            // Check if it's a leaf node or close to it
            // We want the parent container that held the form
            targetContainer = $(el).parent();
        }
    });

    if (targetContainer) {
        targetContainer.append(formHtml);
        fs.writeFileSync(filePath, $.html());
        console.log(`✓ Injected form into ${file}`);
    } else {
        console.log(`✗ Could not find injection point for ${file}`);
        // Fallback: Append to main
        const main = $('#main') || $('body');
        main.append(formHtml);
        fs.writeFileSync(filePath, $.html());
        console.log(`  ⚠ Appended to main/body as fallback for ${file}`);

    }
}

console.log('=== Injecting Forms ===');
injectForm('contact.html', 'Get in touch', contactFormHtml);
injectForm('book-inspection.html', 'so we can schedule', inspectionFormHtml);
console.log('=== Done ===');
