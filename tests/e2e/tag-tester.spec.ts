import { test, expect } from '@playwright/test';

const SAMPLE_AD_TAG = "<script>window.clickTag='//example.com/landing';(function(){const img=new Image();img.src='https://example.com/pixel.gif?cb='+Date.now();})();</script>";

test('ad tag tester captures clickTag and network activity', async ({ page }) => {
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 204, body: '' }));

  await page.goto('/?labs=1');
  await page.getByRole('button', { name: 'Ad Tag' }).click();

  const tagInput = page.getByTestId('tag-input');
  await tagInput.waitFor();
  await tagInput.fill(SAMPLE_AD_TAG);

  await page.getByTestId('tag-run').click();

  const infoList = page.getByTestId('info-list');
  await expect(infoList).toContainText('clickTag present: true');

  const networkList = page.getByTestId('network-list');
  await expect(networkList).toContainText('PIXEL');
  await expect(networkList).toContainText('https://example.com/pixel.gif');

  const errorList = page.getByTestId('error-list');
  await expect(errorList).toContainText('No errors yet');
});
