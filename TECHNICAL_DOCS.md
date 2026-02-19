# Technical Documentation

## Overview
This project is a static reconstruction of a dynamic React/Framer website. It was created using a custom "recursive cloning" approach to handle the complex JavaScript-driven content that traditional tools like `wget` or `HTTrack` often miss.

## 1. Cloning Methodology

### The Challenge
The original site uses Framer, which relies heavily on JavaScript to render content and load assets dynamically. Traditional scrapers often capture empty "skeleton" HTML or fail to trigger the necessary JS execution.

### The Solution: `clone_pro.js`
We built a custom scraper using **Puppeteer** (Headless Chrome):
1.  **Render**: Loads each page in a real browser environment to execute React hydration.
2.  **Wait**: Waits for network idle state to ensure all dynamic assets (images, fonts) are requested.
3.  **Capture**: Serializes the final DOM to HTML.
4.  **Rewrite**: intercepts resource requests to download assets locally and rewrites HTML references to relative paths (`./assets/...`).

## 2. Asset Pipeline

### Path Correction (`fix_paths.js`)
-   **Absolute to Relative**: Converted root-relative paths (e.g., `/assets/img.png`) to document-relative paths to support subfolder hosting.
-   **CSS Urls**: Parsed CSS files to find `url(...)` declarations, downloaded the referenced files, and updated the paths.
-   **Google Fonts**: Detected `fonts.googleapis.com` links, downloaded the CSS and the `.woff2` files, and served them from `dist/assets/fonts/`.

### Optimization (`optimize.js`)
-   **Identification**: Scans `dist/assets` for images > 500KB.
-   **Compression**: Uses `jimp` to resize (max width 1920px) and compress (JPEG 80%) large files.
-   **Result**: Significant reduction in `dist` folder size without visual degradation.

## 3. Server Architecture (`server.js`)

A lightweight Node.js server designed to mimic a production environment:

-   **Static Serving**: Maps URL paths (e.g., `/contact`) to `.html` files (`contact.html`).
-   **Compression**: Implements `zlib` Gzip compression for text-based assets (HTML, CSS, JS, SVG, JSON).
-   **Mock API**:
    -   Intercepts POST requests to `/api/*`.
    -   Logs the payload to the console.
    -   Returns a `200 OK` JSON success response to satisfy the frontend form logic.

## 4. Quality Assurance (`qa_check.js`)

A static analysis tool built with `cheerio`:
-   **Link Checking**: Verifies that every internal link (`<a href>`) points to a file that actually exists.
-   **Asset Verification**: Checks that every `<img src>` and `<link href>` resolves to a local file.
-   **Security/Privacy**: Flags any remaining connection to external domains (excluding allowed analytics/CDNs).
