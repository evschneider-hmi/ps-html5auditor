import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleZip = path.resolve(
  __dirname,
  '../../SampleZips/HRV_NEW_Spirit of Honda Value_SPRE_279L_ENG_300x600_WDCH_H5_NV_SNW_HRV.zip',
);

const isDebug = !!process.env.PWDEBUG;
test.use({ headless: !isDebug });

test('Investigate HRV 300x600 border detection', async ({ page }, testInfo) => {
  page.on('console', (message) => {
    console.log('[page]', message.type(), message.text());
  });
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(sampleZip);

  const packagingHeading = page.getByRole('heading', { name: /Packaging Format/i });
  await expect(packagingHeading).toBeVisible({ timeout: 30_000 });

  await page.waitForFunction(() => {
    const summary = (window as any).__audit_last_summary;
    if (!summary) return false;
    const sides = Number(summary.borderSides);
    const rules = Number(summary.borderCssRules);
    const detected = summary.borderDetected;
    const hasSides = Number.isFinite(sides) && sides > 0;
    const hasRules = Number.isFinite(rules) && rules > 0;
    return hasSides || hasRules || typeof detected === 'string';
  }, { timeout: 20_000 });
  const runtimeSummary: any = await page.evaluate(
    () => (window as any).__audit_last_summary || null,
  );

  expect(runtimeSummary).toBeTruthy();
  const summaryAny: any = runtimeSummary;
  expect(
    (Number(summaryAny?.borderSides ?? 0) > 0) ||
      (Number(summaryAny?.borderCssRules ?? 0) > 0) ||
      typeof summaryAny?.borderDetected === 'string',
  ).toBeTruthy();

  if (runtimeSummary) {
    await testInfo.attach('runtime-summary.json', {
      body: JSON.stringify(runtimeSummary, null, 2),
      contentType: 'application/json',
    });
  }

  console.log('Runtime summary (border focus):', {
    borderDetected: runtimeSummary?.borderDetected,
    borderSides: runtimeSummary?.borderSides,
    borderCssRules: runtimeSummary?.borderCssRules,
  });
  console.log('Runtime summary types:', {
    borderDetected: typeof runtimeSummary?.borderDetected,
    borderSides: typeof runtimeSummary?.borderSides,
    borderCssRules: typeof runtimeSummary?.borderCssRules,
  });

  const derivedRuntime = await page.evaluate(() => {
    const summary = (window as any).__audit_last_summary || {};
    const toNumber = (value: any): number | undefined =>
      typeof value === 'number' && Number.isFinite(value)
        ? Number(value)
        : undefined;
    const sides = toNumber(summary.borderSides);
    const rules = toNumber(summary.borderCssRules);
    const explicitRaw = summary.borderDetected;
    const explicit = typeof explicitRaw === 'string'
      ? explicitRaw.toLowerCase()
      : '';
    const borderDetectedRuntime = (() => {
      if (explicit === 'explicit' || explicit === 'yes') return true;
      const hasSides = typeof sides === 'number' && sides >= 3;
      const hasRules = typeof rules === 'number' && rules > 0;
      return hasSides || hasRules;
    })();
    return {
      sides,
      rules,
      explicitRaw,
      borderDetectedRuntime,
    };
  });
  console.log('Derived runtime detection:', derivedRuntime);

  const storeIntrospection = await page.evaluate(() => {
    const win = window as any;
    const store = win && win.__EXT_STORE__;
    const useExtStore = win && win.useExtStore;
    return {
      hasWindowStore: !!store,
      hasWindowUseExtStore: typeof useExtStore,
      storeKeys: store ? Object.keys(store) : [],
    };
  });
  console.log('Store introspection:', storeIntrospection);

  const borderFindingState = await page.evaluate(() => {
    const store = (window as any).__EXT_STORE__;
    if (!store || typeof store.getState !== 'function') return null;
    const state = store.getState();
    const results = Array.isArray(state.results) ? state.results : [];
    const bundleId = state.selectedBundleId;
    const res = results.find((r: any) => r?.bundleId === bundleId) || results[0];
    if (!res) return null;
    const border = Array.isArray(res.findings)
      ? res.findings.find((f: any) => f?.id === 'border')
      : null;
    return {
      bundleId: res?.bundleId,
      severity: border?.severity,
      messages: border?.messages,
    };
  });
  console.log('Store border finding:', borderFindingState);

  await page.screenshot({ path: testInfo.outputPath('hrv-preview.png'), fullPage: true });

  const borderCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: /Border/i }) });
  await expect(borderCard).toBeVisible();
  const cardSnapshot = await borderCard.allTextContents();
  const borderLines = await page.getByText(/Border detected:/i).allTextContents();
  console.log('Border card snapshot:', cardSnapshot);
  console.log('All border detected lines:', borderLines);
  await expect(borderCard.getByText(/Border detected:\s*yes/i)).toBeVisible({ timeout: 20_000 });
  await expect(borderCard).toContainText(/PASS/i);
  const borderCardText = await borderCard.innerText();
  await testInfo.attach('border-card.txt', {
    body: borderCardText,
    contentType: 'text/plain',
  });
});
