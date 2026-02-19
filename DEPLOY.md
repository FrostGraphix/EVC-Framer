# Deployment Guide for EVC Clone

This static site is ready for deployment on Netlify, Vercel, or any static hosting provider.

## Prerequisites
- A GitHub repository (or manual upload).
- No build process required (the `dist` folder is the entire site).

## Deploying to Netlify (Recommended)
1. **Drag and Drop**: Simply drag the `dist` folder into the Netlify "Sites" dashboard.
2. **Git Integration**:
   - Push this project to GitHub.
   - Connect it to Netlify.
   - **Build Command**: `(leave empty)` or `echo "No build needed"`
   - **Publish Directory**: `dist`

## Features Setup
- **Forms**: The contact and inspection forms are pre-configured with `data-netlify="true"`. They will automatically appear in your Netlify dashboard under "Forms".
- **Redirects**: `netlify.toml` is included in `dist` to handle 404s and security headers.
- **Success Page**: Form submissions automatically redirect to key `/success.html`.

## Local Testing
To test locally, run a static server in the project root:
```bash
npx http-server dist
```
Navigate to `http://127.0.0.1:8080/contact.html` to see the forms.

## Customization
- **Forms**: Edit `dist/contact.html` or `dist/book-inspection.html` directly to change fields.
- **Styles**: Edit `dist/assets/forms.css` or `dist/assets/framer-fix.css`.
- **Scripts**: `dist/assets/framer-fix.js` handles animations and mobile nav.
