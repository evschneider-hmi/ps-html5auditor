import { test, expect } from '@playwright/test';

import { buildSampleZipExpectations } from './utils/sample-metrics.js';

interface StoreEntry {
  bundleName: string;
  displayName: string;
  zippedBytes?: number;
  initialBytes?: number;
  subloadBytes?: number;
  userBytes?: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fmtKB(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  const value = Math.round((bytes / 1024) * 10) / 10;
  return value.toFixed(1) + ' KB';
}

test.describe('Sample ZIP KB metrics', () => {
  test('table displays expected KB values for all sample assets', async ({ page }) => {
    const expectations = await buildSampleZipExpectations();
    expect.soft(expectations.length).toBeGreaterThan(0);

    const files = expectations.map((item) => item.path);

    await page.goto('/');

    const fileInput = page.getByTestId('file-input');
    await expect(fileInput).toBeVisible();

    await fileInput.setInputFiles(files);

    const packagingHeading = page.getByRole('heading', { name: /Packaging Format/i });
    await expect(packagingHeading).toBeVisible({ timeout: 45_000 });

    // Wait until the store reports the expected number of bundles processed
    await page.waitForFunction(
      (expectedCount) => {
        const store = (window as any).__EXT_STORE__;
        if (!store || typeof store.getState !== 'function') return false;
        const state = store.getState();
        if (!Array.isArray(state?.results)) return false;
        return state.results.length >= expectedCount;
      },
      expectations.length,
      { timeout: 45_000 },
    );

    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(expectations.length, { timeout: 45_000 });

    const storeMetrics = (await page.evaluate(() => {
      const store = (window as any).__EXT_STORE__;
      if (!store || typeof store.getState !== 'function') return [];
      const state = store.getState();
      const results = Array.isArray(state?.results) ? state.results : [];
      return results.map((r: any) => {
        const displayName = String(r?.bundleName ?? '').replace(/\.zip$/i, '');
        const runtime = r?.runtime || {};
        const toNumber = (value: any): number | undefined =>
          typeof value === 'number' && Number.isFinite(value) ? Number(value) : undefined;
        const zippedBytesRaw = toNumber(r?.zippedBytes);
        const bundleBytes = toNumber(r?.bytes?.length);
        const runtimeZipped = toNumber(runtime?.zippedBytes);
        const resolvedZipped = zippedBytesRaw ?? runtimeZipped ?? bundleBytes;
        return {
          bundleName: String(r?.bundleName ?? ''),
          displayName,
          zippedBytes: resolvedZipped,
          initialBytes: toNumber(runtime?.initialBytes) ?? toNumber(r?.initialBytes),
          subloadBytes:
            toNumber(runtime?.subloadBytes) ??
            toNumber(r?.subloadBytes) ??
            toNumber(r?.subsequentBytes),
          userBytes: toNumber(runtime?.userBytes) ?? toNumber(r?.userBytes),
        };
      });
    })) as StoreEntry[];

    const storeMap = new Map<string, StoreEntry>(
      storeMetrics.map((entry) => [entry.displayName, entry]),
    );

    for (const expected of expectations) {
      const storeEntry = storeMap.get(expected.displayName);
      expect.soft(storeEntry, `Missing store metrics for ${expected.displayName}`).toBeDefined();
      if (!storeEntry) continue;

      expect.soft(storeEntry.zippedBytes).toBe(expected.zippedBytes);

      const label = page.locator('.creative-label').filter({
        hasText: new RegExp(`^${escapeRegExp(expected.displayName)}$`, 'i'),
      });
      await expect(label, `Creative label for ${expected.displayName}`).toHaveCount(1, {
        timeout: 20_000,
      });
      const row = label.first().locator('xpath=ancestor::tr[1]');
      await expect(row, `Row for ${expected.displayName}`).toBeVisible({ timeout: 20_000 });

      const zipCell = row.locator('td[aria-label="Compressed ZIP size"]');
      const initialCell = row.locator('td[aria-label="Compressed initial load size"]');
      const subloadCell = row.locator('td[aria-label="Compressed subload size"]');
      const userCell = row.locator('td[aria-label="Runtime user-triggered bytes"]');

      const zipText = normalizeWhitespace(await zipCell.innerText());
      const initialText = normalizeWhitespace(await initialCell.innerText());
      const subloadText = normalizeWhitespace(await subloadCell.innerText());
      const userText = normalizeWhitespace(await userCell.innerText());

      const expectedZipDisplay = fmtKB(storeEntry.zippedBytes ?? expected.zippedBytes);
      const expectedInitialDisplay = fmtKB(storeEntry.initialBytes);
      const expectedSubloadDisplay = fmtKB(storeEntry.subloadBytes);
      const expectedUserDisplay = fmtKB(storeEntry.userBytes);

      expect.soft(zipText).toBe(expectedZipDisplay);
      expect.soft(initialText).toBe(expectedInitialDisplay);
      expect.soft(subloadText).toBe(expectedSubloadDisplay);
      expect.soft(userText).toBe(expectedUserDisplay);
    }
  });
});
