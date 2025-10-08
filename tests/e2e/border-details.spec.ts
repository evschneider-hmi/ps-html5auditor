import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleZip = path.resolve(
	__dirname,
	'../../SampleZips/9.29.25_HTML5/walden_conversion_300x250_animated.zip',
);

test('Border findings surface CSS evidence for PASS creatives', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('file-input').setInputFiles(sampleZip);

	const packagingHeading = page.getByRole('heading', { name: /Packaging Format/i });
	await expect(packagingHeading).toBeVisible({ timeout: 20_000 });

	const borderCard = page
		.locator('.card')
		.filter({ has: page.getByRole('heading', { name: /Border Present/i }) });
	await expect(borderCard).toBeVisible();

	const offenderItems = borderCard.locator('ul.offenders li');
	await expect(offenderItems).toContainText(/border:\s*\d+/i);
	await expect(offenderItems).not.toContainText(/border\s*:\s*0\b/i);
});