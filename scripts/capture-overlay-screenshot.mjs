import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = resolve('app-V2', 'src', 'assets', 'migration-app-preview.png');
await mkdir(dirname(target), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const distEntry = resolve('app-V2', 'dist', 'index.html');
const url = pathToFileURL(distEntry).href;

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const buffer = await page.screenshot({ fullPage: true });
await browser.close();

await writeFile(target, buffer);

console.log(`Captured screenshot → ${target}`);
