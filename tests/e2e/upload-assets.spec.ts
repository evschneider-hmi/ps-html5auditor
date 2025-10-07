import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleZip = path.resolve(
  __dirname,
  '../../SampleZips/9.29.25_HTML5/walden_conversion_300x250_animated.zip',
);

test('HTML5 drop zone accepts ZIP uploads', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(sampleZip);

  const resultsPanel = page.getByRole('heading', { name: /Packaging Format/i });
  await expect(resultsPanel).toBeVisible({ timeout: 20_000 });

  expect(consoleErrors, `Console errors encountered: ${consoleErrors.join('\n')}`).toHaveLength(0);
});