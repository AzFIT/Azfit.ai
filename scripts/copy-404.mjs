import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexHtml = resolve(dist, 'index.html');
const notFoundHtml = resolve(dist, '404.html');

await copyFile(indexHtml, notFoundHtml);
console.log('Copied dist/index.html -> dist/404.html (SPA fallback for GitHub Pages)');
