import { test, expect, Page, Route } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const ARTSAI_TAG =
  `<script type="text/adtag"><div style="width:160px; height:600px; overflow:hidden"><script type="text/javascript" src="//cf.artsai.com/campaigns/claritas/regeneron/amd/680780.js?nature=dfp&cb=%%TTD_CACHEBUSTER%%&dfp_creative_id=%%TTD_CREATIVEID%%&dfp_order_id=%%TTD_CAMPAIGNID%%&dfp_ad_id=%%TTD_ADGROUPID%%&ctp=%%TTD_CLK_ESC%%&device_id=%%TTD_DEVICEID%%&adv_name=adxcel"></script></div></script><script src="//cdn.doubleverify.com/dvbm.js#ctx=17520798&cmp=51299&sid=10543&plc=680780&advid=17520798&mon=1&blk=1&gdpr=\${GDPR}&gdpr_consent=\${GDPR_CONSENT_126}&unit=160x600&advwf=1"></script>`;

const EVIDENCE_DIR = path.join('evidence');

async function ensureEvidenceDir() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
}

async function waitForNetworkEntry(page: Page, text: string) {
  const networkList = page.getByTestId('network-list');
  await expect(networkList.locator('li', { hasText: text }).first()).toBeVisible({ timeout: 10000 });
}

async function capturePreview(page: Page, fileName: string, expectedText: string) {
  const frame = page.frameLocator('iframe[title="Tag Preview"]');
  const creative = frame.locator('#artsai-creative');
  await expect(creative).toContainText(expectedText, { timeout: 10000 });
  const previewFrame = page.locator('iframe[title="Tag Preview"]');
  await previewFrame.screenshot({ path: path.join(EVIDENCE_DIR, fileName) });
}

async function captureNetworkLog(page: Page, fileName: string) {
  const networkList = page.getByTestId('network-list');
  await networkList.screenshot({ path: path.join(EVIDENCE_DIR, fileName) });
}

test.beforeAll(async () => {
  await ensureEvidenceDir();
});

async function waitForScriptRequest(getRequestCount: () => number, previousCount?: number) {
  const before = previousCount ?? getRequestCount();
  await expect
    .poll(() => getRequestCount(), { timeout: 10000, message: 'ArtsAI script request not observed' })
    .toBeGreaterThan(before);
}

async function runTagAndWaitForScript(page: Page, getRequestCount: () => number) {
  const before = getRequestCount();
  await page.getByTestId('tag-run').click();
  await waitForScriptRequest(getRequestCount, before);
}

test('capture previews and network logs for iOS and Android', async ({ page }) => {
  let scriptRequestCount = 0;
  page.on('request', (request) => {
    if (request.url().includes('cf.artsai.com')) {
      scriptRequestCount += 1;
    }
  });
  const handleArtsAiRoute = (route: Route) => {
    scriptRequestCount += 1;
    const body = `(() => {
      const container = document.createElement('div');
      container.id = 'artsai-creative';
      container.style.width = '160px';
      container.style.height = '600px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.gap = '8px';
      container.style.background = '#0f172a';
      container.style.color = '#f8fafc';
      container.style.fontFamily = 'sans-serif';
      container.style.borderRadius = '12px';
      container.textContent = 'ArtsAI Creative';

      const envLabel = document.createElement('div');
      envLabel.id = 'env-indicator';
      envLabel.style.fontSize = '16px';
      envLabel.textContent = 'Env: ' + ((window.MRAID_ENV && window.MRAID_ENV.platform) || 'Web');
      container.appendChild(envLabel);

      const ua = document.createElement('div');
      ua.style.fontSize = '13px';
      ua.textContent = 'UA: ' + (navigator.userAgent || '').slice(0, 60) + '…';
      container.appendChild(ua);

      document.body.appendChild(container);

      const img = new Image();
      img.src = 'https://artsai.test/pixel.gif?cb=' + Date.now();
    })();`;

    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body,
    });
  };

  await page.route('https://cf.artsai.com/**', handleArtsAiRoute);
  await page.route('http://cf.artsai.com/**', handleArtsAiRoute);

  const fulfillDoubleVerify = (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dvbmLoaded = true;' });

  await page.route('https://cdn.doubleverify.com/**', fulfillDoubleVerify);
  await page.route('http://cdn.doubleverify.com/**', fulfillDoubleVerify);

  await page.route('**artsai.test/**', (route) => route.fulfill({ status: 204, body: '' }));

  await page.goto('/?labs=1');
  await page.getByRole('button', { name: 'Ad Tag' }).click();

  const tagInput = page.getByTestId('tag-input');
  await tagInput.fill(ARTSAI_TAG);
  const artsAiRow = page.getByRole('button', { name: /1\s+Ad Tag\s+artsai\.com/i });
  if (await artsAiRow.isVisible().catch(() => false)) {
    const beforeRowClick = scriptRequestCount;
    await artsAiRow.click();
    await waitForScriptRequest(() => scriptRequestCount, beforeRowClick);
  }
  await runTagAndWaitForScript(page, () => scriptRequestCount);
  await waitForNetworkEntry(page, 'artsai.test');
  await capturePreview(page, 'preview-web.png', 'Env: Web');
  await captureNetworkLog(page, 'network-web.png');

  await expect(page.getByTestId('env-inapp-ios')).toHaveCount(0);
  await expect(page.getByTestId('env-inapp-android')).toHaveCount(0);
});
