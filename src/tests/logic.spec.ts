import { beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { parsePrimary } from '../logic/parse';
import { checkPrimaryAsset } from '../logic/checks/primaryAsset';
import { defaultSettings } from '../logic/profiles';
import type { BundleResult, ZipBundle } from '../logic/types';

const encoder = new TextEncoder();

function makeBundle(html: string): ZipBundle {
	const bytes = encoder.encode(html);
	return {
		id: 'test-bundle',
		name: 'test.zip',
		bytes,
		files: { 'index.html': bytes },
		lowerCaseIndex: { 'index.html': 'index.html' }
	};
}

beforeAll(() => {
	if (typeof DOMParser === 'undefined') {
		const dom = new JSDOM('');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).DOMParser = dom.window.DOMParser;
	}
});

describe('parsePrimary ad size heuristics', () => {
	it('detects dimensions from media query CSS', () => {
		const html = `<!doctype html><html><head>
			<style>
				@media (height: 600px) and (width: 160px) {
					#creative { width: 160px; height: 600px; }
				}
			</style>
		</head><body><div id="creative"></div></body></html>`;
		const bundle = makeBundle(html);
		const result = parsePrimary(bundle, { path: 'index.html' });
		expect(result.adSize).toEqual({ width: 160, height: 600 });
		expect(result.adSizeSource?.method).toBe('css-media');
		expect(result.adSizeSource?.path).toBe('index.html');
		expect(result.adSizeSource?.snippet).toContain('@media');
	});

	it('falls back to largest width/height rule when no meta tag is present', () => {
		const html = `<!doctype html><html><head>
			<style>
				.thumb { width: 50px; height: 50px; }
				#container { width: 300px; height: 250px; }
			</style>
		</head><body><div id="container"></div></body></html>`;
		const bundle = makeBundle(html);
		const result = parsePrimary(bundle, { path: 'index.html' });
		expect(result.adSize).toEqual({ width: 300, height: 250 });
		expect(result.adSizeSource?.method).toBe('css-rule');
		expect(result.adSizeSource?.snippet).toContain('width: 300px');
	});

	it('reads inline style width and height pairs', () => {
		const html = `<!doctype html><html><head></head>
			<body><div style="width: 320px; height: 50px;"></div></body></html>`;
		const bundle = makeBundle(html);
		const result = parsePrimary(bundle, { path: 'index.html' });
		expect(result.adSize).toEqual({ width: 320, height: 50 });
		expect(result.adSizeSource?.method).toBe('inline-style');
		expect(result.adSizeSource?.snippet).toContain('width: 320px');
	});

	it('prefers meta tag when present', () => {
		const html = `<!doctype html><html><head>
			<meta name="ad.size" content="width=728,height=90" />
		</head><body><div style="width: 320px; height: 50px;"></div></body></html>`;
		const bundle = makeBundle(html);
		const result = parsePrimary(bundle, { path: 'index.html' });
		expect(result.adSize).toEqual({ width: 728, height: 90 });
		expect(result.adSizeSource?.method).toBe('meta');
		expect(result.adSizeSource?.snippet).toContain('width=728');
	});
});

describe('checkPrimaryAsset messaging', () => {
	it('includes size detection source when passing', () => {
		const sizeSource = {
			method: 'meta' as const,
			snippet: '<meta name="ad.size" content="width=160,height=600" />',
			path: 'creative/banner_160x600.html',
		};
		const bundleResult: BundleResult = {
			bundleId: 'bundle-1',
			bundleName: 'bundle.zip',
			primary: {
				path: 'creative/banner_160x600.html',
				adSize: { width: 160, height: 600 },
				sizeSource,
			},
			adSize: { width: 160, height: 600 },
			adSizeSource: sizeSource,
			findings: [],
			references: [],
			summary: {
				status: 'PASS',
				totalFindings: 0,
				fails: 0,
				warns: 0,
				pass: 0,
				orphanCount: 0,
				missingAssetCount: 0,
			},
		};
		const finding = checkPrimaryAsset(bundleResult, defaultSettings);
		expect(finding.severity).toBe('PASS');
		expect(finding.messages).toEqual([
			'Primary file detected',
			'Size detected from <meta name="ad.size"> tag',
		]);
		expect(finding.offenders).toHaveLength(0);
	});
});
