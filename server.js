const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const zlib = require('zlib');

const PORT = 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const startServer = (port) => {
    const server = http.createServer((req, res) => {
        // Basic clean URL handling
        let reqUrl = parse(req.url).pathname;

        // Default to index.html for root
        if (reqUrl === '/') reqUrl = '/index.html';

        // Attempt to map clean URLs to .html files
        let filePath = path.join(DIST_DIR, reqUrl);

        // Check if path exists
        let ext = path.extname(filePath);
        if (!ext) {
            if (fs.existsSync(filePath + '.html')) {
                filePath += '.html';
                ext = '.html';
            } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
                filePath = path.join(filePath, 'index.html');
                ext = '.html';
            }
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // Return 404
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                const acceptEncoding = req.headers['accept-encoding'] || '';

                if ((contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'image/svg+xml') && acceptEncoding.includes('gzip')) {
                    zlib.gzip(content, (err, buffer) => {
                        if (!err) {
                            res.setHeader('Content-Encoding', 'gzip');
                            res.setHeader('Content-Type', contentType);
                            res.writeHead(200);
                            res.end(buffer);
                        } else {
                            res.setHeader('Content-Type', contentType);
                            res.writeHead(200);
                            res.end(content);
                        }
                    });
                } else {
                    res.setHeader('Content-Type', contentType);
                    res.writeHead(200);
                    res.end(content);
                }
            }
        });

        // Mock API endpoints for forms
        if (req.method === 'POST' && req.url.startsWith('/api/')) {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                console.log(`Mock API Call: ${req.url}`, body);
            });
        }
    });

    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
        console.log(`Serving files from: ${DIST_DIR}`);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', e);
        }
    });
};

startServer(PORT);
