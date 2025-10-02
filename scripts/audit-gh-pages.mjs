#!/usr/bin/env node
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  const url = 'https://evschneider-hmi.github.io/ps-html5auditor/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result = {
    url,
    status: 'unknown',
    issues: [],
    details: {},
  };

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    result.details.status = response?.status();
    result.details.url = response?.url();

    const heading = await page.locator('text=We\u2019ve moved!').first();
    const link = await page.locator('a[href="https://creative.hmi-platformsolutions.com/"]');

    const headingVisible = await heading.isVisible({ timeout: 5_000 }).catch(() => false);
    const linkVisible = await link.isVisible({ timeout: 5_000 }).catch(() => false);

    if (headingVisible && linkVisible) {
      result.status = 'pass';
    } else {
      result.status = 'fail';
      if (!headingVisible) result.issues.push('Overlay heading not visible');
      if (!linkVisible) result.issues.push('CTA link not visible');
  const screenshotPath = join(dirname(fileURLToPath(import.meta.url)), '../test-results/gh-pages-overlay.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  result.details.screenshot = screenshotPath;
    }

    const html = await page.content();
    result.details.preview = html.slice(0, 3000);
  } catch (error) {
    result.status = 'error';
    result.issues.push(error instanceof Error ? error.message : String(error));
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});