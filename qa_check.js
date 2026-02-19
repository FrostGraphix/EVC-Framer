const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');

const distDir = './dist';

// ── QA Checks ──────────────────────────────────────────────────────

function checkFile(filePath) {
    const issues = [];
    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    const basename = path.basename(filePath);

    // 1. Check for remaining absolute URLs to external CDNs in src/href
    $('img[src], script[src], link[href]').each((i, el) => {
        const attr = $(el).attr('src') || $(el).attr('href');
        if (attr && attr.startsWith('http') && !attr.includes('fonts.gstatic.com') && !attr.includes('fonts.googleapis.com')) {
            issues.push({ type: 'REMOTE_ASSET', severity: 'WARN', file: basename, detail: `Still remote: ${attr.substring(0, 100)}` });
        }
    });

    // 2. Check for broken local asset references
    $('img[src^="assets/"], script[src^="assets/"], link[href^="assets/"]').each((i, el) => {
        const attr = $(el).attr('src') || $(el).attr('href');
        const fullPath = path.join(distDir, attr);
        if (!fs.existsSync(fullPath)) {
            issues.push({ type: 'MISSING_ASSET', severity: 'ERROR', file: basename, detail: `Missing: ${attr}` });
        }
    });

    // 3. Check internal navigation links point to existing files
    $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.endsWith('.html') && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
            const linkTarget = path.join(distDir, href);
            if (!fs.existsSync(linkTarget)) {
                issues.push({ type: 'BROKEN_LINK', severity: 'ERROR', file: basename, detail: `Broken nav: ${href}` });
            }
        }
    });

    // 4. Check for remaining evcng.com references
    const evcMatches = content.match(/evcng\.com/g);
    if (evcMatches) {
        issues.push({ type: 'ABSOLUTE_REF', severity: 'WARN', file: basename, detail: `${evcMatches.length} remaining evcng.com references` });
    }

    // 5. Check for remaining Framer app references in links
    const framerAppMatches = content.match(/magenta-basis.*?framer\.app/g);
    if (framerAppMatches) {
        issues.push({ type: 'FRAMER_REF', severity: 'INFO', file: basename, detail: `${framerAppMatches.length} Framer app references (canonical/meta)` });
    }

    // 6. Check images have alt text
    let missingAlt = 0;
    $('img').each((i, el) => {
        if (!$(el).attr('alt') && !$(el).attr('aria-hidden')) missingAlt++;
    });
    if (missingAlt > 0) {
        issues.push({ type: 'ACCESSIBILITY', severity: 'INFO', file: basename, detail: `${missingAlt} images missing alt text` });
    }

    // 7. Check CSS url() references in style tags
    $('style').each((i, el) => {
        const css = $(el).html();
        const remoteUrls = css.match(/url\(['"](https?:\/\/[^'"]+)['"]\)/g);
        if (remoteUrls) {
            issues.push({ type: 'CSS_REMOTE', severity: 'WARN', file: basename, detail: `${remoteUrls.length} remote CSS url() refs still present` });
        }
    });

    return issues;
}

// ── Run QA ──────────────────────────────────────────────────────────

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

console.log('=== EVC Clone QA Report ===\n');

const files = findHtmlFiles(distDir);
console.log(`Checking ${files.length} HTML files...\n`);

let allIssues = [];
for (const file of files) {
    const issues = checkFile(file);
    allIssues = allIssues.concat(issues);
}

// Group by severity
const errors = allIssues.filter(i => i.severity === 'ERROR');
const warnings = allIssues.filter(i => i.severity === 'WARN');
const info = allIssues.filter(i => i.severity === 'INFO');

console.log(`\n=== SUMMARY ===`);
console.log(`❌ ERRORS:   ${errors.length}`);
console.log(`⚠️  WARNINGS: ${warnings.length}`);
console.log(`ℹ️  INFO:     ${info.length}`);

if (errors.length > 0) {
    console.log('\n--- ERRORS ---');
    errors.forEach(e => console.log(`  ❌ [${e.file}] ${e.type}: ${e.detail}`));
}

if (warnings.length > 0) {
    console.log('\n--- WARNINGS ---');
    warnings.forEach(w => console.log(`  ⚠️  [${w.file}] ${w.type}: ${w.detail}`));
}

if (info.length > 0) {
    console.log('\n--- INFO ---');
    info.forEach(i => console.log(`  ℹ️  [${i.file}] ${i.type}: ${i.detail}`));
}

// Save report
const report = { timestamp: new Date().toISOString(), files: files.length, errors, warnings, info };
fs.writeFileSync('qa_report.json', JSON.stringify(report, null, 2));
console.log('\nReport saved to qa_report.json');
