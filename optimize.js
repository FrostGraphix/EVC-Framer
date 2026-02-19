const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const ASSETS_DIR = path.join(__dirname, 'dist', 'assets');
const MAX_SIZE_BYTES = 500 * 1024; // 500KB thresholds
const MAX_WIDTH = 1920; // Resize if wider than this (optional but good for 5MB file)

async function optimizeImage(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size < MAX_SIZE_BYTES) return; // Skip small files

        const ext = path.extname(filePath).toLowerCase();
        if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;

        console.log(`Optimizing ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

        const image = await Jimp.read(filePath);

        // Resize if too huge
        if (image.bitmap.width > MAX_WIDTH) {
            console.log(`  Resizing from ${image.bitmap.width}px width to ${MAX_WIDTH}px`);
            image.resize(MAX_WIDTH, Jimp.AUTO);
        }

        // Compress
        if (ext === '.jpg' || ext === '.jpeg') {
            image.quality(80);
        } else if (ext === '.png') {
            // PNG compression in Jimp is via deflate level, usually automatic
            // but we can try to re-save to strip metadata/palette optimizations
            // Jimp doesn't have a direct "quality" for PNG like JPEG, but 'deflateLevel'
            // or effectively just re-encoding often helps.
        }

        // await image.writeAsync(filePath); // Removed in v1?
        await new Promise((resolve, reject) => {
            image.write(filePath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        const newStats = fs.statSync(filePath);
        const savings = stats.size - newStats.size;
        const savingsPercent = (savings / stats.size * 100).toFixed(1);

        console.log(`  Done. New size: ${(newStats.size / 1024 / 1024).toFixed(2)} MB (Saved ${savingsPercent}%)`);

    } catch (error) {
        console.error(`  Error optimizing ${path.basename(filePath)}:`, error.message);
    }
}

async function main() {
    if (!fs.existsSync(ASSETS_DIR)) {
        console.error('Assets directory not found!');
        return;
    }

    const files = fs.readdirSync(ASSETS_DIR); // This is likely flat if we look at previous ls output (Wait, list_dir showed direct files)
    // Actually list_dir output showed files directly in dist/assets, and also 'images' subdir?
    // Let's check the listing again.
    // "images" isDir: true

    // We should check both root assets and images subdir if exists

    const checkDir = async (dir) => {
        const list = fs.readdirSync(dir);
        for (const file of list) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                await checkDir(fullPath);
            } else {
                await optimizeImage(fullPath);
            }
        }
    };

    console.log('Starting Asset Optimization...');
    await checkDir(ASSETS_DIR);
    console.log('Optimization Complete.');
}

main();
