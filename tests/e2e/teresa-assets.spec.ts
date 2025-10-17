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

    // Capture console logs to verify Enabler is working
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
      if (text.includes('Enabler') || text.includes('blob:') || text.includes('getUrl')) {
        console.log(`🔍 Console: ${text}`);
      }
    });

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

    // Verify dimensions are displayed correctly for all Teresa creatives
    const expectedDimensions = ['160x600', '160x600', '300x250', '300x600', '728x90'];
    for (let i = 0; i < expectedDimensions.length; i++) {
      const row = tableRows.nth(i);
      const dimensionCell = row.locator('td').nth(2); // Assuming dimensions are in 3rd column
      await expect(dimensionCell).toContainText(expectedDimensions[i], { timeout: 5_000 });
      console.log(`✅ Dimension detected: ${expectedDimensions[i]} for creative ${i + 1}`);
    }

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

    // Wait additional time for CSS to fully apply and animation to start
    await page.waitForTimeout(5000);

    // Check the container's computed styles to diagnose CSS loading
    const containerOpacity = await creativeFrame.locator('#container').evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
    console.log('📊 Container opacity:', containerOpacity);

    // Check if CSS files are loaded
    const cssLinks = await creativeFrame.locator('link[rel="stylesheet"]').count();
    console.log('📊 CSS link tags found:', cssLinks);

    //Check if JavaScript files are loaded
    const scripts = await creativeFrame.locator('script').count();
    console.log('� Script tags found:', scripts);

    // Log what elements exist
    const bgExists = await creativeFrame.locator('#bg').count();
    const teresaExists = await creativeFrame.locator('#teresa').count();
    const logoExists = await creativeFrame.locator('#logo').count();
    console.log('📊 Elements exist - bg:', bgExists, 'teresa:', teresaExists, 'logo:', logoExists);

    // VISUAL PROOF: Capture screenshot showing Teresa creative rendering
    await page.screenshot({
      path: 'evidence/teresa-visual-proof.png',
      fullPage: true,
    });
    console.log('✅ Visual proof captured: evidence/teresa-visual-proof.png');

    // Capture close-up of just the preview pane
    const previewSection = page.locator('iframe[title="Creative Preview"]');
    await previewSection.screenshot({
      path: 'evidence/teresa-preview-closeup.png',
    });
    console.log('✅ Preview closeup captured: evidence/teresa-preview-closeup.png');

    // Wait a moment for animation to complete
    await page.waitForTimeout(2000);

    // Capture final state
    await page.screenshot({
      path: 'evidence/teresa-final-state.png',
      fullPage: true,
    });
    console.log('✅ Final state captured: evidence/teresa-final-state.png');

    // Verify all sizes render correctly
    for (let i = 0; i < TERESA_ZIPS.length; i++) {
      await tableRows.nth(i).click();
      await page.waitForTimeout(1000); // Allow preview to load

      const creativeFrameCheck = previewIframe.frameLocator('iframe#creativeFrame');
      await expect(
        creativeFrameCheck.locator('#container'),
        `Expected container for creative ${i + 1} to be visible`,
      ).toBeVisible({ timeout: 15_000 });

      console.log(`✅ Creative ${i + 1} (${TERESA_ZIPS[i].split('\\').pop()}) rendered successfully`);
    }
  });
});