import { test, expect } from '@playwright/test';

test('live view + network logs', async ({ page }) => {
  page.on('request', (request) => {
    const url = request.url();
    if (/doubleclick|doubleverify|pubads|adservice|adserver/i.test(url)) {
      console.log('[REQ]', request.method(), url);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (/doubleclick|doubleverify|pubads|adservice|adserver/i.test(url)) {
      console.log('[RES]', response.status(), url);
    }
  });

  await page.goto('https://example.com');
  await page.waitForTimeout(3000);
  await expect(page).toHaveTitle(/Example/i);
});
