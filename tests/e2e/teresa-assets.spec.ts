import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const teresaDir = path.resolve(__dirname, '../../SampleZips/Teresa');
const TERESA_ZIPS = [
  '160x600_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '160x600__EYLEA DTC Teresa Animated Banner.zip',
  '300x250_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '300x600_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '728x90_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
].map((name) => path.resolve(teresaDir, name));

test.describe('Teresa sample assets', () => {
  test('render once per bundle and load preview content', async ({ page }) => {
    await page.goto('/');

    const input = page.getByTestId('file-input');
    await expect(input).toBeVisible();

    // Simulate offline Enabler runtime so the in-app stub must activate
    await page.route('https://s0.2mdn.net/ads/studio/Enabler.js', (route) => route.abort());

    await input.setInputFiles(TERESA_ZIPS);

    const packagingHeading = page.getByRole('heading', { name: /Packaging Format/i });
    await expect(packagingHeading).toBeVisible({ timeout: 45_000 });

    // Table rows should match the number of uploaded bundles (no duplicates)
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(TERESA_ZIPS.length, { timeout: 45_000 });

    // Select the first creative to drive the preview pane
    await tableRows.first().click();

    const previewIframe = page.frameLocator('iframe[title="Creative Preview"]');
    const previewHandle = await page.locator('iframe[title="Creative Preview"]').elementHandle();
    const previewFrame = await previewHandle?.contentFrame();
    await previewFrame?.waitForLoadState('load');

    // Container element should become visible once Enabler assets load
    const creativeFrame = previewIframe.frameLocator('iframe#creativeFrame');
    await expect(
      creativeFrame.locator('#container'),
      'Expected runtime container to render inside the creative frame',
    ).toBeVisible({ timeout: 30_000 });
  });
});