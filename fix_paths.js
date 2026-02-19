const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const url = require('url');

const DIST_DIR = path.join(__dirname, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets', 'images'); // centralized images
const FONTS_DIR = path.join(DIST_DIR, 'assets', 'fonts');

// Ensure directories exist
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

async function downloadAsset(remoteUrl, type = 'image') {
    try {
        const parsed = url.parse(remoteUrl);
        const filename = path.basename(parsed.pathname) || `asset_${Date.now()}`;
        // Simple hash or just use basename if unique enough. Framer hashes are usually in filename.
        // clean query params
        const cleanFilename = filename.split('?')[0];

        const saveDir = type === 'font' ? FONTS_DIR : ASSETS_DIR;
        const localPath = path.join(saveDir, cleanFilename);

        if (fs.existsSync(localPath)) {
            return cleanFilename; // Already downloaded
        }

        console.log(`Downloading ${type}: ${remoteUrl}`);
        const response = await axios({
            url: remoteUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(cleanFilename));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Failed to download ${remoteUrl}: ${error.message}`);
        return null;
    }
}

function getRelativePath(fromFile, toAsset, assetType = 'image') {
    const assetsRelDir = assetType === 'font' ? 'assets/fonts' : 'assets/images';
    // Calculate relative path from current HTML file to dist/assets/...
    // fromFile is absolute path of HTML file.
    // We want path to DIST_DIR/assets/...

    const distRelative = path.relative(path.dirname(fromFile), DIST_DIR);
    return path.join(distRelative, assetsRelDir, toAsset).replace(/\\/g, '/');
}

function processCss(cssContent, filePath) {
    // Regex to find url(...)
    // Handle both ' and " and plain
    return cssContent.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, link) => {
        if (link.startsWith('data:')) return match;

        if (link.includes('framerusercontent.com') || link.includes('fonts.gstatic.com')) {
            // It's a remote asset
            // We can't easily await in replace callback, so we might need a different approach or specialized async replace.
            // For simplicity in this synchronous-looking structure, we often gather promises or use a loop.
            // But CSS often has many.
            return match; // Placeholder: we need a sync way or async refactor for CSS processing.
        }

        return match;
    });
}

// Async Processing of File
async function processFile(filePath) {
    console.log(`Processing ${path.relative(DIST_DIR, filePath)}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    let modified = false;

    // 1. Fix Internal Links
    $('a').each((i, el) => {
        let href = $(el).attr('href');
        if (!href) return;

        // Skip protocols
        if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#') ||
            href.startsWith('mailto:') || href.startsWith('tell:') || href.startsWith('sms:') || href.startsWith('data:')) {
            return;
        }

        // Handle root "/" -> "index.html"
        if (href === '/') {
            const relativeIndex = path.relative(path.dirname(filePath), path.join(DIST_DIR, 'index.html'));
            $(el).attr('href', relativeIndex.replace(/\\/g, '/'));
            modified = true;
            return;
        }

        // Handle absolute internal links "/about" -> "about.html" relative
        if (href.startsWith('/') && !path.extname(href)) {
            const pageName = href.substring(1);
            const relative = path.relative(path.dirname(filePath), path.join(DIST_DIR, pageName + '.html'));
            $(el).attr('href', relative.replace(/\\/g, '/'));
            modified = true;
        } else if (path.extname(href) === '') {
            // relative "about" -> "about.html"
            if (href !== '.' && href !== './') {
                $(el).attr('href', href + '.html');
                modified = true;
            }
        }

        // Fix "index" links
        if ($(el).attr('href') === '.html' || $(el).attr('href') === 'index.html') {
            // No change needed usually, or ensure it points to index.html
        }
    });

    // 2. Fix Images & Downloads
    const images = $('img, source, link[rel*="icon"]');
    // We use a regular loop to await
    for (let i = 0; i < images.length; i++) {
        const el = images[i];
        const $el = $(el);
        const srcAttr = $el.is('link') ? 'href' : ($el.is('source') ? 'srcset' : 'src');
        let val = $el.attr(srcAttr);

        if (val) {
            // Clean logic
            if (val.startsWith('/assets/')) {
                // Fix absolute local path to relative
                const relPath = path.relative(path.dirname(filePath), path.join(DIST_DIR, val.substring(1)));
                $el.attr(srcAttr, relPath.replace(/\\/g, '/'));
                modified = true;
            } else if (val.includes('framerusercontent.com')) {
                // Download
                // console.log("Found Framer Image: " + val);
                const savedName = await downloadAsset(val, 'image');
                if (savedName) {
                    const newPath = getRelativePath(filePath, savedName, 'image');
                    $el.attr(srcAttr, newPath);
                    modified = true;
                }
            }
        }
    }

    // 3. Process CSS (Style Tags)
    // We need to parse content, extract URLs, download them, replace them.
    const styles = $('style');
    for (let i = 0; i < styles.length; i++) {
        const style = styles[i];
        let info = $(style).html();

        // Find all URLs
        const regex = /url\((['"]?)(https:\/\/[^'"\)]+)(['"]?)\)/g;
        let match;
        let newCss = info;

        // We can't use replace with async easily.
        // So we collect matches first.
        const replacements = [];
        while ((match = regex.exec(info)) !== null) {
            const fullMatch = match[0];
            const quote = match[1] || '';
            const urlVal = match[2];

            if (urlVal.includes('framerusercontent.com') || urlVal.includes('fonts.gstatic.com')) {
                const type = urlVal.includes('font') ? 'font' : 'image';
                const savedName = await downloadAsset(urlVal, type);
                if (savedName) {
                    const newRel = getRelativePath(filePath, savedName, type);
                    replacements.push({
                        original: fullMatch,
                        newVal: `url(${quote}${newRel}${quote})`
                    });
                }
            }
        }

        // Apply replacements
        for (const rep of replacements) {
            newCss = newCss.replace(rep.original, rep.newVal);
        }

        if (newCss !== info) {
            $(style).html(newCss);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, $.html());
        console.log(`Saved updates to ${path.basename(filePath)}`);
    }
}

async function main() {
    try {
        const files = fs.readdirSync(DIST_DIR);
        const htmlFiles = files.filter(f => f.endsWith('.html')).map(f => path.join(DIST_DIR, f)); // Simple flat level for now

        // Also handle subdir recursions if clone_pro created them?
        // Analyzing qa_report shows dist structure is mostly flat but verify script checked recursively.
        // Let's iterate recursively just in case.

        const getFilesRecursively = (dir) => {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach((file) => {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) {
                    if (path.basename(file) !== 'assets') { // Skip assets dir
                        results = results.concat(getFilesRecursively(file));
                    }
                } else {
                    if (file.endsWith('.html')) results.push(file);
                }
            });
            return results;
        };

        const allHtml = getFilesRecursively(DIST_DIR);

        console.log(`Found ${allHtml.length} HTML files to process.`);

        for (const file of allHtml) {
            await processFile(file);
        }

        console.log('Path correction and asset download complete.');

    } catch (e) {
        console.error('Error in fix_paths:', e);
    }
}

main();
