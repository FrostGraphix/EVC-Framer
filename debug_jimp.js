const { Jimp } = require('jimp');
const path = require('path');

async function debug() {
    try {
        // Pick a file that exists
        const file = path.join(__dirname, 'dist', 'assets', '5eqGm69BuZHVq1GCk7XxuBW9Ig.png');
        console.log('Reading', file);
        const image = await Jimp.read(file);
        console.log('Image keys:', Object.keys(image));
        console.log('Image proto keys:', Object.keys(Object.getPrototypeOf(image)));

        if (image.writeAsync) console.log('writeAsync exists');
        else console.log('writeAsync MISSING');

        if (image.write) console.log('write exists');
    } catch (e) {
        console.error(e);
    }
}
debug();
