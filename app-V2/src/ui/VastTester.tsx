// @ts-nocheck

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ReactDOMClient from 'react-dom/client';

import { useExtStore } from '../state/useStoreExt';

import { parseBulkInput } from '../logic/bulk';

import JSZip from 'jszip';

import {
  classifyVendor,
  classifyPrimaryVendor,
  extractNestedUrl,
} from '../logic/vendorMap';

// Canonical mapping helpers for concise, flexible grouping
const CLICK_LOCAL_NAMES = [
  'ClickTracking',
  'NonLinearClickTracking',
  'CompanionClickTracking',
  'IconClickTracking',
  'ClickThrough',
  'NonLinearClickThrough',
] as const;

// Vendor-specific mappings from Tracking@event -> canonical groups
const VENDOR_EVENT_CANONICAL: Record<string, Record<string, 'impression' | 'click'>> = {
  CM360: { start: 'impression' },
};

let xlsxModulePromise: Promise<any> | null = null;
async function loadXLSX() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx/xlsx.mjs');
  }
  return xlsxModulePromise;
}

type EventRow = { time: string; label: string };

const SHEET_FILE_PATTERN = /(\.xlsx|\.xlsm|\.xlsb|\.xls|\.csv)$/i;

const normalizeText = (value: any): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const normalizeHeader = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const extractRowsFromWorkbook = (
  xlsx: any,
  workbook: any,
  fileLabel: string,
): any[] => {
  const collected: any[] = [];
  const EXPECTED_HEADERS = new Set([
    'placement id',
    'placementid',
    'placement_id',
    'placement name',
    'placementname',
    'platform',
    'start date',
    'startdate',
    'end date',
    'enddate',
    'tag',
    'vast url',
    'vast',
    'vasturl',
    'ad tag',
    'adtag',
    'ad tag uri',
    'adtaguri',
    'ad tag url',
    'adtag url',
    'vast tag',
    'vasttag',
    'vast ad tag uri',
    'vast ad tag url',
  ]);
  workbook.SheetNames.forEach((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (!Array.isArray(rows) || rows.length === 0) return;

    // 1) Find the most likely header row by scanning for expected headings
    let headerRowIndex = 0;
    let bestScore = -1;
    for (let ri = 0; ri < Math.min(rows.length, 50); ri++) {
      const r = rows[ri] as any[];
      if (!Array.isArray(r)) continue;
      const score = r.reduce((acc: number, cell: any) => {
        const norm = normalizeHeader(normalizeText(cell));
        return acc + (EXPECTED_HEADERS.has(norm) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = ri;
      }
      if (score >= 4) break; // good enough
    }

    const headers = (rows[headerRowIndex] as any[]).map((cell: any) =>
      normalizeText(cell),
    );
    const headerMap = new Map<string, number>();
    headers.forEach((cell: string, idx: number) => {
      const norm = normalizeHeader(cell);
      if (norm) headerMap.set(norm, idx);
    });

    const pick = (row: any[], keys: string[]): string | undefined => {
      for (const key of keys) {
        const index = headerMap.get(key);
        if (index === undefined || index >= row.length) continue;
        const text = normalizeText(row[index]);
        if (text) return text;
      }
      return undefined;
    };

    // 2) Iterate data rows after the header row
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!row) continue;
      const textCells = row.map(normalizeText).filter(Boolean);
      // Prefer known header aliases for the VAST URL cell
      let vastUrl = pick(row, [
        'vast url',
        'vast',
        'vasturl',
        'tag',
        'ad tag',
        'adtag',
        'ad tag uri',
        'adtaguri',
        'ad tag url',
        'adtag url',
        'vast tag',
        'vasttag',
        'vast ad tag uri',
        'vast ad tag url',
      ]);
      if (!vastUrl) {
        // Fallback: any URL-like text that looks like a VAST/adtag link
        vastUrl = textCells.find(
          (value) => /https?:\/\//i.test(value) && /(vast|adtag)/i.test(value),
        );
      }
      if (!vastUrl) continue;
      const parsed = parseBulkInput(vastUrl);
      const entry = parsed[0]
        ? { ...parsed[0], raw: vastUrl }
        : {
            i: i,
            type: 'VAST URL',
            raw: vastUrl,
            host: '',
            vendor: '',
            params: {},
          };
      const label = sheetName ? `${fileLabel} - ${sheetName}` : fileLabel;
      const meta = {
        placementId: pick(row, ['placement id', 'placementid', 'placement_id']),
        placementName: pick(row, ['placement name', 'placementname']),
        platform: pick(row, ['platform']),
        startDate: pick(row, ['start date', 'startdate']),
        endDate: pick(row, ['end date', 'enddate']),
        vastUrl,
        sourceLabel: `${label} #${i + 1}`,
      };
      collected.push({
        entry,
        meta,
        source: 'upload',
        key: `${label}|${i + 1}|${vastUrl}`,
      });
    }
  });
  return collected;
};

// Main VAST tester component

export const VastTester: React.FC = () => {
  try {
    // Runtime diagnostic: ensure single React instance
    const idA = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher || React;
    const idB = (ReactDOMClient as any).version || 'react-dom/client';
    // eslint-disable-next-line no-console
    console.debug('[VAST] React diag:', { reactVersion: (React as any).version, domClient: idB, idAType: typeof idA });
  } catch {}
  // UI state

  const [mode, setMode] = useState<'url'>('url');

  const [tagUrl, setTagUrl] = useState<string>('');

  const [xml, setXml] = useState<string>(''); // kept but unused; safe to remove in future refactor

  const [errors, setErrors] = useState<string[]>([]);

  // New: custom alerts box entries (validation and guidance)
  const [alerts, setAlerts] = useState<string[]>([]);

  const [info, setInfo] = useState<string[]>([]);

  const [timeline, setTimeline] = useState<EventRow[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [started, setStarted] = useState(false);

  const [paused, setPaused] = useState(false);

  const [clicked, setClicked] = useState(false);

  const [audioToggled, setAudioToggled] = useState(false);

  const [quartilesDone, setQuartilesDone] = useState({
    q25: false,
    q50: false,
    q75: false,
    complete: false,
  });

  const [duration, setDuration] = useState<number | undefined>(undefined);

  const [requestStart, setRequestStart] = useState<number | undefined>(
    undefined,
  );

  const [impressionTime, setImpressionTime] = useState<number | undefined>(
    undefined,
  );

  const [rawXml, setRawXml] = useState<string>('');

  const [formattedXml, setFormattedXml] = useState<string>('');

  const [xmlQuery, setXmlQuery] = useState<string>('');

  // Search + scrolling state for XML viewer
  const xmlPreRef = useRef<HTMLPreElement | null>(null);
  const [xmlIndex, setXmlIndex] = useState<number>(0);

  const [trackers, setTrackers] = useState<
    Record<
      string,
      { url: string; firedAt?: string; status?: 'requested' | 'ok' | 'error' }[]
    >
  >({});

  // New: keep a few extracted fields for current tag
  const [activeCreative, setActiveCreative] = useState<string>('');
  const [activeVersion, setActiveVersion] = useState<string>('');
  const [activeDurationSec, setActiveDurationSec] = useState<
    number | undefined
  >(undefined);

  const [mediaUrl, setMediaUrl] = useState<string>('');

  const [clickThrough, setClickThrough] = useState<string>('');

  const [clickResolve, setClickResolve] = useState<{
    status: string;
    initial: string;
    final?: string;
    redirected?: boolean;
  } | null>(null);

  const [showCtModal, setShowCtModal] = useState(false);

  // Bulk upload support (sheets/zip)
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);

  const removeVastRow = useCallback((key: string) => {
    setUploadedRows((prev) => prev.filter((r) => computeRowKey(r) !== key));
  }, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New: Upload-first UX; manual entry hidden by default
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);

  // New: track which table row is active for contextual alerts
  const [activeRow, setActiveRow] = useState<any | null>(null);
  const activeRowKey = useMemo(
    () => (activeRow ? computeRowKey(activeRow) : null),
    [activeRow],
  );

  const vastSeed = useExtStore((s) => (s as any).vastSeed);

  const setVastSeed = useExtStore((s) => (s as any).setVastSeed);

  const setTagSeed = useExtStore((s) => (s as any).setTagSeed);

  // Multi-tag detection (URL input only)

  const sourceText = showManualEntry ? tagUrl : '';

  const manualEntries = useMemo(
    () => parseBulkInput(sourceText).filter((e) => e.type === 'VAST URL'),
    [sourceText],
  );

  const manualRows = useMemo(
    () =>
      manualEntries.map((entry, idx) => ({
        entry,
        meta: { vastUrl: entry.raw },
        source: 'manual',
        key: `manual-${idx}-${entry.raw}`,
      })),
    [manualEntries],
  );

  const tableRows = useMemo(
    () => [...manualRows, ...uploadedRows],
    [manualRows, uploadedRows],
  );

  // Per-row vendor scan results for Impression and Click trackers
  const [rowVendorData, setRowVendorData] = useState<
    Record<
      string,
      {
        imp: string[];
        click: string[];
        status: 'pending' | 'ok' | 'error';
        version?: string;
        durationSec?: number;
        creative?: string;
        alerts?: string[];
      }
    >
  >({});

  // Scan a single row for vendors (fetch XML if URL; parse if inline XML)
  const scanRowVendors = useCallback(async (row: any) => {
    const entry = row?.entry || row;
    if (!entry || !(entry.type === 'VAST URL' || entry.type === 'VAST XML'))
      return { imp: [], click: [], status: 'error' };
    let xmlText = '';
    try {
      if (entry.type === 'VAST XML') {
        xmlText = String(entry.raw || '');
      } else {
        const url = String(entry.raw || row?.meta?.vastUrl || '');
        if (!/^https?:\/\//i.test(url)) throw new Error('not a URL');
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        xmlText = await resp.text();
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('parse error');
      // Follow one-level wrapper (if present) and aggregate context
      const docs: Document[] = [doc];
      try {
        const wrapUri = firstTextByLocal(doc, [
          'VASTAdTagURI',
          'AdTagURI',
        ]).trim();
        if (wrapUri && /^https?:\/\//i.test(wrapUri)) {
          const r2 = await fetch(wrapUri, { mode: 'cors' });
          if (r2.ok) {
            const t2 = await r2.text();
            const d2 = parser.parseFromString(t2, 'application/xml');
            if (!d2.querySelector('parsererror')) docs.push(d2);
          }
        }
      } catch {}
      // Aggregate vendors across doc(s)
      const impVendors = new Set<string>();
      const clickVendors = new Set<string>();
      for (const d of docs) {
        elsByLocal(d, 'Impression').forEach((n: any) => {
          const u = (n.textContent || '').trim();
          if (!u) return;
          const { vendor, host } = classifyVendor(u);
          impVendors.add(vendor === 'Other' ? host || 'Other' : vendor);
        });
        // Map vendor-specific Tracking@event to canonical groups
        elsByLocal(d, 'Tracking').forEach((n: any) => {
          const u = (n.textContent || '').trim();
          if (!u) return;
          const ev = (n.getAttribute && n.getAttribute('event'))
            ? n.getAttribute('event').trim().toLowerCase()
            : '';
          const { vendor, host } = classifyVendor(u);
          const v = vendor === 'Other' ? host || 'Other' : vendor;
          const canonical = (VENDOR_EVENT_CANONICAL[v] || {})[ev];
          if (canonical === 'impression') impVendors.add(v);
          if (canonical === 'click') clickVendors.add(v);
        });

        // Fold click-like nodes into click vendors set
        CLICK_LOCAL_NAMES.forEach((local) => {
          elsByLocal(d, local).forEach((n: any) => {
            const u = (n.textContent || '').trim();
            if (!u) return;
            const { vendor, host } = classifyVendor(u);
            clickVendors.add(vendor === 'Other' ? host || 'Other' : vendor);
          });
        });
      }
      // Extract version from root of first doc
      const version =
        (doc.documentElement && doc.documentElement.getAttribute('version')) ||
        '';
      // Extract duration + creative from the deepest doc available (prefer unwrapped if present)
      const metaDoc = docs[docs.length - 1];
      let dur = '';
      const linearEls2 = elsByLocal(metaDoc, 'Linear');
      for (const lin of linearEls2) {
        const d = firstTextByLocal(lin, ['Duration']);
        if (d) {
          dur = d;
          break;
        }
      }
      const durationSec = parseDuration(dur);
      const adTitle =
        firstTextByLocal(metaDoc, ['AdTitle', 'Title', 'Ad Title']) || '';
      // Alerts
      const rowAlerts: string[] = [];
      const hasCM360Imp = Array.from(impVendors).includes('CM360');
      const hasCM360Click = Array.from(clickVendors).includes('CM360');
      const hasInnovidImp = Array.from(impVendors).includes('Innovid');
      const hasInnovidClick = Array.from(clickVendors).includes('Innovid');
      const hasDV =
        Array.from(impVendors).includes('DoubleVerify') ||
        Array.from(clickVendors).includes('DoubleVerify');
      if (!hasCM360Imp) rowAlerts.push('Missing CM360 Impression tracker');
      if (!hasCM360Click) rowAlerts.push('Missing CM360 Click tracker');
      if (!hasInnovidImp) rowAlerts.push('Missing Innovid Impression tracker');
      if (!hasInnovidClick) rowAlerts.push('Missing Innovid Click tracker');
      if (!hasDV) rowAlerts.push('Missing DoubleVerify tracker');
      if (isFinite(durationSec)) {
        const sec = Math.round(durationSec);
        const token = String(sec);
        const pn = String(row?.meta?.placementName || '');
        const cn = adTitle || '';
        const tokenRe = new RegExp(
          `(^|\\D)${token}(s|sec|secs|seconds)?(\\D|$)`,
          'i',
        );
        if (pn && !tokenRe.test(pn))
          rowAlerts.push(`Duration ${sec}s not found in placement name`);
        if (cn && !tokenRe.test(cn))
          rowAlerts.push(`Duration ${sec}s not found in creative name`);
      } else {
        rowAlerts.push('Duration tag missing or invalid');
      }
      try {
        const vastUrl = String(row?.meta?.vastUrl || row?.entry?.raw || '');
        const live =
          /live\s*stream(ing)?/i.test(String(row?.meta?.placementName || '')) &&
          /(^|\.)dvrtr\.com/i.test(vastUrl);
        if (live)
          rowAlerts.push(
            'Live Stream detected with dvrtr.com — consider using DV Universal Monitoring Pixel (viewability not tracked)',
          );
      } catch {}
      return {
        imp: Array.from(impVendors).sort(),
        click: Array.from(clickVendors).sort(),
        status: 'ok' as const,
        version,
        durationSec: isFinite(durationSec) ? durationSec : undefined,
        creative: adTitle,
        alerts: rowAlerts,
      };
    } catch {
      return { imp: [], click: [], status: 'error' as const };
    }
  }, []);

  // Trigger scans for new rows
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const row of tableRows) {
        if (cancelled) return;
        const key = computeRowKey(row);
        if (!key) continue;
        if (!(row.entry?.type === 'VAST URL' || row.entry?.type === 'VAST XML'))
          continue;
        // mark pending and run scan; effect is not dependent on rowVendorData, so this won't cancel itself
        setRowVendorData((prev) =>
          prev[key]
            ? prev
            : { ...prev, [key]: { imp: [], click: [], status: 'pending' } },
        );
        const res = await scanRowVendors(row);
        if (cancelled) return;
        setRowVendorData((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || {}), ...res },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableRows, scanRowVendors]);

  const multi = manualEntries.length > 1;

  const showTable = tableRows.length > 0 || uploadedRows.length > 0;

  const tableRowCount = tableRows.length;

  // Resizable columns for VAST input table
  const vastTableRef = useRef<HTMLTableElement | null>(null);
  type VastColKey =
    | 'idx'
    | 'type'
    | 'vendor'
    | 'host'
    | 'pid'
    | 'pname'
    | 'platform'
    | 'start'
    | 'end'
    | 'url'
    | 'creative'
    | 'ver'
    | 'dur'
    | 'imp'
    | 'click'
    | 'params'
    | 'alerts';
  const VAST_COLS: Array<{
    key: VastColKey;
    label: string;
    min?: number;
    title?: string;
  }> = [
    { key: 'idx', label: '#', min: 50 },
    { key: 'type', label: 'Type', min: 80 },
    { key: 'vendor', label: 'Vendor', min: 100 },
    { key: 'host', label: 'Host', min: 120 },
    { key: 'pid', label: 'Placement ID', min: 120 },
    { key: 'pname', label: 'Placement Name', min: 180 },
    { key: 'platform', label: 'Platform', min: 100 },
    { key: 'start', label: 'Start Date', min: 110 },
    { key: 'end', label: 'End Date', min: 110 },
    { key: 'url', label: 'VAST URL', min: 260 },
    {
      key: 'creative',
      label: 'Creative',
      min: 180,
      title:
        'Creative from <AdTitle> (Note: only one creative shown; rotations not enumerated)',
    },
    { key: 'ver', label: 'VAST Ver', min: 90 },
    { key: 'dur', label: 'Duration', min: 90 },
    { key: 'imp', label: 'Impression Vendors', min: 180 },
    { key: 'click', label: 'Click Vendors', min: 180 },
    { key: 'params', label: 'Other Params', min: 220 },
    { key: 'alerts', label: 'Alerts', min: 80 },
  ];
  const VAST_LS_KEY = 'vast_table_colw_v1';
  function sanitizeVastMap(input: any): Record<string, number> {
    const out: Record<string, number> = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    const minFor = new Map(
      VAST_COLS.map((c) => [c.key, Math.max(c.min || 60, 40)] as const),
    );
    for (const [k, v] of Object.entries(input)) {
      const n = typeof v === 'number' && isFinite(v) ? v : NaN;
      const mk = k as VastColKey;
      if (!isNaN(n) && minFor.has(mk)) out[mk] = Math.max(n, minFor.get(mk)!);
    }
    return out;
  }
  const [vastColW, setVastColW] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(VAST_LS_KEY);
      if (raw) return sanitizeVastMap(JSON.parse(raw));
    } catch {}
    return {};
  });
  const vastDrag = useRef<{
    key: VastColKey;
    startX: number;
    startW: number;
    min: number;
    neighborKey: VastColKey;
    neighborStartW: number;
    neighborMin: number;
  } | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(VAST_LS_KEY, JSON.stringify(vastColW));
    } catch {}
  }, [vastColW]);
  useEffect(() => {
    if (!vastTableRef.current) return;
    let hasAny = false;
    try {
      hasAny =
        vastColW &&
        typeof vastColW === 'object' &&
        Object.keys(vastColW).length > 0;
    } catch {
      hasAny = false;
    }
    if (hasAny) return;
    const ths = vastTableRef.current.querySelectorAll<HTMLTableCellElement>(
      'thead th[data-colkey]',
    );
    const next: Record<string, number> = {};
    ths.forEach((th) => {
      const k = (th.getAttribute('data-colkey') || '') as VastColKey;
      if (!k) return;
      const col = VAST_COLS.find((c) => c.key === k);
      const min = Math.max(col?.min || 60, 40);
      const w = th.getBoundingClientRect().width;
      next[k] = Math.max(w | 0, min);
    });
    if (Object.keys(next).length) setVastColW(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!vastDrag.current) return;
      e.preventDefault();
      const dx = e.clientX - vastDrag.current.startX;
      const startW = vastDrag.current.startW;
      const min = vastDrag.current.min;
      const neighborStart = vastDrag.current.neighborStartW;
      const neighborMin = vastDrag.current.neighborMin;
      let desired = Math.max(startW + dx, min);
      let neighborDesired = neighborStart - dx;
      if (neighborDesired < neighborMin) {
        const allowedDx = neighborStart - neighborMin;
        desired = Math.max(startW + allowedDx, min);
        neighborDesired = neighborMin;
      }
      setVastColW((prev) => ({
        ...prev,
        [vastDrag.current!.key]: desired,
        [vastDrag.current!.neighborKey]: neighborDesired,
      }));
    }
    function onUp() {
      vastDrag.current = null;
      document.body.style.cursor = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);
  const vastTd: React.CSSProperties = {
    padding: 8,
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const handleFileUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const xlsx = await loadXLSX();
      const aggregated: any[] = [];
      const infoMessages: string[] = [];
      const errorMessages: string[] = [];
      for (const file of files) {
        try {
          if (/\.zip$/i.test(file.name)) {
            const zip = await JSZip.loadAsync(await file.arrayBuffer());
            let count = 0;
            const entries = Object.values(zip.files).filter(
              (entry) => !entry.dir && SHEET_FILE_PATTERN.test(entry.name),
            );
            for (const entry of entries) {
              const isCsv = /\.csv$/i.test(entry.name);
              const data = await entry.async(isCsv ? 'string' : 'arraybuffer');
              const workbook = xlsx.read(data, {
                type: isCsv ? 'string' : 'array',
                raw: false,
                cellDates: true,
              });
              const extracted = extractRowsFromWorkbook(
                xlsx,
                workbook,
                `${file.name} - ${entry.name}`,
              );
              count += extracted.length;
              aggregated.push(...extracted);
            }
            infoMessages.push(
              count
                ? `Extracted ${count} VAST tags from ${file.name}`
                : `No VAST tags detected in ${file.name}`,
            );
          } else if (SHEET_FILE_PATTERN.test(file.name)) {
            const isCsv = /\.csv$/i.test(file.name);
            const data = isCsv ? await file.text() : await file.arrayBuffer();
            const workbook = xlsx.read(data, {
              type: isCsv ? 'string' : 'array',
              raw: false,
              cellDates: true,
            });
            const extracted = extractRowsFromWorkbook(
              xlsx,
              workbook,
              file.name,
            );
            aggregated.push(...extracted);
            infoMessages.push(
              extracted.length
                ? `Extracted ${extracted.length} VAST tags from ${file.name}`
                : `No VAST tags detected in ${file.name}`,
            );
          } else {
            errorMessages.push(`Unsupported file type: ${file.name}`);
          }
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          errorMessages.push(`Failed to parse ${file.name}: ${message}`);
        }
      }
      if (aggregated.length) {
        setUploadedRows((prev) => [...prev, ...aggregated]);
      }
      if (infoMessages.length) {
        setInfo((prev) => [...prev, ...infoMessages]);
      }
      if (errorMessages.length) {
        setErrors((prev) => [...prev, ...errorMessages]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [setErrors, setInfo, setUploadedRows],
  );

  const clearUploads = useCallback(() => {
    setUploadedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setUploadedRows]);

  // Auto-parse handed-off ZIP payload from HTML5 tab (Excel/CSV inside ZIP)
  const vastAutoPayload = useExtStore(
    (s) => (s as any).vastAutoPayload as Uint8Array | undefined,
  );
  const setVastAutoPayload = useExtStore(
    (s) => (s as any).setVastAutoPayload as (bytes?: Uint8Array) => void,
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!vastAutoPayload || !(vastAutoPayload instanceof Uint8Array))
          return;
        const xlsx = await loadXLSX();
        const zip = await JSZip.loadAsync(vastAutoPayload);
        const entries = Object.values(zip.files).filter(
          (e) => !e.dir && /\.(xlsx|xlsm|xls|csv)$/i.test(e.name),
        );
        const aggregated: any[] = [];
        for (const e of entries) {
          const isCsv = /\.csv$/i.test(e.name);
          const data = await e.async(isCsv ? 'string' : 'arraybuffer');
          const workbook = xlsx.read(data, {
            type: isCsv ? 'string' : 'array',
            raw: false,
            cellDates: true,
          });
          const extracted = extractRowsFromWorkbook(xlsx, workbook, e.name);
          aggregated.push(...extracted);
        }
        if (!cancelled && aggregated.length) {
          setUploadedRows((prev) => [...prev, ...aggregated]);
        }
        // Keep payload in memory so user can navigate without re-uploading; do not clear automatically
      } catch (e) {
        // ignore; surfaced in UI via manual upload path if needed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vastAutoPayload]);

  const activateRow = (row: any) => {
    const entry = row?.entry || row;
    if (!entry) return;
    setActiveRow(row);
    if (entry.type === 'VAST URL') {
      setMode('url');
      setTagUrl(entry.raw);
      // immediately load the selected tag so details open
      try {
        void loadTag(true, entry.raw);
      } catch {}
      return;
    }
    if (entry.type === 'VAST XML') {
      setMode('xml');
      setXml(entry.raw);
      try {
        void loadTag(true);
      } catch {}
      return;
    }
    if (entry.type === 'Ad Tag') {
      try {
        setTagSeed(entry.raw);
      } catch {}
      try {
        const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(
          (el) => el.textContent?.trim() === 'Ad Tag',
        ) as HTMLButtonElement | undefined;
        btn?.click();
      } catch {}
    }
  };
  // Consume seed from Ad Tag tab if present

  useEffect(() => {
    try {
      const seed = vastSeed as any;

      if (seed && seed.value) {
        if (seed.mode === 'xml') {
          setMode('xml');

          setXml(seed.value);
        } else {
          setMode('url');

          setTagUrl(seed.value);
        }

        setVastSeed(undefined);
      }
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function log(label: string) {
    const now = new Date();

    const s = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}:${pad3(now.getMilliseconds())}`;

    setTimeline((prev) => [...prev, { time: s, label }]);
  }

  function pad2(n: number) {
    return n < 10 ? `0${n}` : String(n);
  }

  function pad3(n: number) {
    return n.toString().padStart(3, '0');
  }

  async function loadTag(force?: boolean, urlOverride?: string) {
    setErrors([]);
    setAlerts([]);
    setInfo([]);
    setTimeline([]);
    setQuartilesDone({ q25: false, q50: false, q75: false, complete: false });
    setStarted(false);
    setPaused(false);
    setClicked(false);
    setAudioToggled(false);

    setMediaUrl('');
    setClickThrough('');
    setClickResolve(null);
    setShowCtModal(false);
    setDuration(undefined);
    setImpressionTime(undefined);
    setRawXml('');
    setFormattedXml('');
    setXmlQuery('');
    setTrackers({});
    setActiveCreative('');
    setActiveVersion('');
    setActiveDurationSec(undefined);

    if (multi && !force) {
      return;
    }

    let xmlText = xml.trim();

    if (mode === 'url') {
      const effectiveUrl = String(urlOverride || tagUrl || '').trim();

      if (!/^https?:\/\//i.test(effectiveUrl)) {
        setErrors(['Please enter a valid http(s) URL']);
        return;
      }

      try {
        setRequestStart(performance.now());

        log('request');

        const resp = await fetch(effectiveUrl, { mode: 'cors' });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        xmlText = await resp.text();

        setRawXml(xmlText);

        setFormattedXml(formatXml(xmlText));
      } catch (e: any) {
        setErrors([
          `Failed to fetch VAST: ${e.message || String(e)} (CORS may block some tags)`,
        ]);

        return;
      }
    }

    if (!xmlText.startsWith('<')) {
      // likely pasted URL in XML box; try fetching

      if (/^https?:\/\//i.test(xmlText)) {
        try {
          setRequestStart(performance.now());

          log('request');

          const resp = await fetch(xmlText, { mode: 'cors' });

          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

          xmlText = await resp.text();

          setRawXml(xmlText);

          setFormattedXml(formatXml(xmlText));
        } catch (e: any) {
          setErrors([
            `Failed to fetch VAST: ${e.message || String(e)} (CORS may block some tags)`,
          ]);

          return;
        }
      } else {
        setErrors([`Input does not look like XML. Start tag '<' not found.`]);

        return;
      }
    }

    try {
      // ensure raw/pretty set even when parsing existing xmlText

      if (!rawXml) {
        setRawXml(xmlText);
      }

      if (!formattedXml) {
        setFormattedXml(formatXml(xmlText));
      }

      const parser = new DOMParser();

      const doc = parser.parseFromString(xmlText, 'application/xml');

      const perr = doc.querySelector('parsererror');

      if (perr) {
        setErrors([perr.textContent || 'XML parse error']);

        return;
      }

      const root = doc.documentElement.nodeName.toLowerCase();

      if (root !== 'vast') info.push(`Root <${root}>`);

      // Handle Wrapper (one level)

      const wrapperUri = doc
        .querySelector('VASTAdTagURI, AdTagURI')
        ?.textContent?.trim();

      if (wrapperUri && /^https?:\/\//i.test(wrapperUri)) {
        try {
          log('request');

          const resp = await fetch(wrapperUri, { mode: 'cors' });

          if (resp.ok) {
            const txt = await resp.text();

            setRawXml(txt);

            setFormattedXml(formatXml(txt));

            const wrapped = parser.parseFromString(txt, 'application/xml');

            const werr = wrapped.querySelector('parsererror');

            if (!werr) {
              extract(wrapped);

              // If clickthrough wasn't in the inline, fall back to wrapper's

              const fallbackCt =
                findClickThrough(wrapped) || findClickThrough(doc) || '';

              setClickThrough((prev) => prev || fallbackCt);
            } else {
              extract(doc);
            }
          } else {
            extract(doc);
          }
        } catch {
          extract(doc);
        }
      } else {
        extract(doc);
      }

      setInfo([...info]);
    } catch (e: any) {
      setErrors([e.message || 'Failed to parse']);
    }
  }

  // Fire an event's trackers (update state, then best-effort ping via <img>)

  function fireEvent(ev: string) {
    setTrackers((s) => {
      const updated = fireTrackersUpdate(s, ev);
      try {
        const urls = (updated[ev] || [])
          .filter((x) => x.status === 'requested')
          .map((x) => x.url);
        fireUrls(urls);
      } catch {}
      return updated;
    });
  }

  function extract(doc: Document) {
    // Impression

    const imp = elsByLocal(doc, 'Impression');

    info.push(`Impressions: ${imp.length}`);

    // Trackers

    const t: Record<string, { url: string }[]> = {};

    function add(ev: string, url?: string | null) {
      if (!url) return;
      const u = url.trim();
      if (!u) return;

      if (!t[ev]) t[ev] = [];

      if (!t[ev].some((x) => x.url === u)) t[ev].push({ url: u });
    }

    // Impression (also creativeView often mirrors impression)

    imp.forEach((n) => add('impression', n.textContent));

    // ClickThrough detection under VideoClicks and others

    const clickThrough = firstTextByLocal(doc, [
      'ClickThrough',
      'NonLinearClickThrough',
    ]);
    if (clickThrough) add('clickThrough', clickThrough);

    // ClickTracking across placements (Linear/NonLinear/Companion/Icon)

    CLICK_LOCAL_NAMES.forEach((local) => {
      elsByLocal(doc, local).forEach((n) => add('click', n.textContent));
    });

    // Tracking events (namespace-agnostic). Filter by @event via attribute regardless of ns.

    elsByLocal(doc, 'Tracking').forEach((n: any) => {
      const ev =
        n.getAttribute && n.getAttribute('event')
          ? n.getAttribute('event').trim()
          : '';

      add(ev || 'tracking', n.textContent);
    });
    // Map vendor-specific event -> canonical trackers (e.g., CM360 start -> impression)
    try {
      Object.entries(t).forEach(([ev, arr]) => {
        arr.forEach(({ url }) => {
          const { vendor, host } = classifyVendor(url);
          const v = vendor === 'Other' ? host || 'Other' : vendor;
          const canonical = (VENDOR_EVENT_CANONICAL[v] || {})[
            String(ev).trim().toLowerCase()
          ];
          if (canonical) add(canonical, url);
        });
      });
    } catch {}

    // Note: Do not create 25%/50%/75% alias events -- we already display quartiles and midpoint

    // Save trackers

    const primed: Record<
      string,
      { url: string; firedAt?: string; status?: 'requested' | 'ok' | 'error' }[]
    > = {};

    Object.keys(t).forEach((k) => {
      primed[k] = t[k].map((x) => ({ url: x.url }));
    });

    setTrackers(primed);

    // Select first linear media file (prefer mp4)

    const mediaFiles = Array.from(
      doc.querySelectorAll('Linear MediaFile'),
    ) as Element[];

    let chosen: string | undefined;

    let typePref = 0;

    for (const mf of mediaFiles) {
      const url = (mf.textContent || '').trim();

      const type = (mf.getAttribute('type') || '').toLowerCase();

      const score = type.includes('mp4') ? 2 : type.includes('webm') ? 1 : 0;

      if (url && (chosen === undefined || score > typePref)) {
        chosen = url;
        typePref = score;
      }
    }

    if (!chosen && mediaFiles.length > 0)
      chosen = (mediaFiles[0].textContent || '').trim();

    if (chosen) setMediaUrl(chosen);

    info.push(`MediaFiles: ${mediaFiles.length}${chosen ? ' (selected)' : ''}`);

    // Duration

    const dur = doc.querySelector('Linear > Duration')?.textContent || '';

    const sec = parseDuration(dur);

    if (isFinite(sec)) {
      setDuration(sec);
      setActiveDurationSec(sec);
    } else {
      // Fallback: namespace-agnostic Duration under any Linear
      let dur2 = '';
      const linearEls2 = elsByLocal(doc, 'Linear');
      for (const lin of linearEls2) {
        const d = firstTextByLocal(lin, ['Duration']);
        if (d) {
          dur2 = d;
          break;
        }
      }
      const sec2 = parseDuration(dur2);
      if (isFinite(sec2)) {
        setDuration(sec2);
        setActiveDurationSec(sec2);
      } else {
        setActiveDurationSec(undefined);
      }
    }

    // ClickThrough: support Linear, NonLinear, Companion, and Icon fallbacks

    const ct = findClickThrough(doc) || '';

    setClickThrough(ct);

    if (ct) {
      info.push(`ClickThrough detected`);

      try {
        resolveClickThrough(ct)
          .then((res) => {
            setClickResolve(res);
          })
          .catch(() => {
            const init = normalizeHref(ct) || ct;

            setClickResolve({ status: 'error', initial: init });
          });
      } catch {}
    }

    // Creative title and VAST version

    try {
      const adTitle =
        firstTextByLocal(doc, ['AdTitle', 'Title', 'Ad Title']) || '';

      if (adTitle) {
        setActiveCreative(adTitle);
        info.push(
          `Creative: ${adTitle} (Note: only one creative shown; rotations not enumerated)`,
        );
      }
    } catch {}

    try {
      const version =
        (doc.documentElement && doc.documentElement.getAttribute('version')) ||
        '';

      if (version) {
        setActiveVersion(version);
        info.push(`VAST version: ${version}`);
      }
    } catch {}

    // Build alerts for active doc using primed trackers + metadata

    try {
      const impVendors = new Set<string>();

      const clickVendors = new Set<string>();

      (primed['impression'] || []).forEach((x) => {
        const { vendor, host } = classifyVendor(x.url);
        impVendors.add(vendor === 'Other' ? host || 'Other' : vendor);
      });

      (primed['click'] || []).forEach((x) => {
        const { vendor, host } = classifyVendor(x.url);
        clickVendors.add(vendor === 'Other' ? host || 'Other' : vendor);
      });

      const a: string[] = [];

      const hasCM360Imp = impVendors.has('CM360');

      const hasCM360Click = clickVendors.has('CM360');

      const hasInnovidImp = impVendors.has('Innovid');

      const hasInnovidClick = clickVendors.has('Innovid');

      const hasDV =
        impVendors.has('DoubleVerify') || clickVendors.has('DoubleVerify');

      if (!hasCM360Imp) a.push('Missing CM360 Impression tracker');

      if (!hasCM360Click) a.push('Missing CM360 Click tracker');

      if (!hasInnovidImp) a.push('Missing Innovid Impression tracker');

      if (!hasInnovidClick) a.push('Missing Innovid Click tracker');

      if (!hasDV) a.push('Missing DoubleVerify tracker');

      if (isFinite(sec)) {
        const d = Math.round(sec);

        const tokenRe = new RegExp(
          `(^|\\D)${d}(s|sec|secs|seconds)?(\\D|$)`,
          'i',
        );

        const pn = String(activeRow?.meta?.placementName || '');

        const cn =
          firstTextByLocal(doc, ['AdTitle', 'Title', 'Ad Title']) || '';

        if (pn && !tokenRe.test(pn))
          a.push(`Duration ${d}s not found in placement name`);

        if (cn && !tokenRe.test(cn))
          a.push(`Duration ${d}s not found in creative name`);
      } else {
        a.push('Duration tag missing or invalid');
      }

      try {
        const vastUrl = String(activeRow?.meta?.vastUrl || tagUrl || '');

        const live =
          /live\s*stream(ing)?/i.test(
            String(activeRow?.meta?.placementName || ''),
          ) && /(^|\.)dvrtr\.com/i.test(vastUrl);

        if (live)
          a.push(
            'Live Stream detected with dvrtr.com — consider using DV Universal Monitoring Pixel (viewability not tracked)',
          );
      } catch {}

      setAlerts(a);

      // Also update the rowVendorData cache for the active row so the table reflects details immediately
      try {
        const key = activeRow ? computeRowKey(activeRow) : '';
        if (key) {
          const versionNow =
            (doc.documentElement &&
              doc.documentElement.getAttribute('version')) ||
            '';
          // Prefer the already parsed numeric seconds; fall back to state if available
          let finalSec: number | undefined = undefined;
          try {
            if (isFinite(sec as any)) finalSec = sec as any;
          } catch {}
          setRowVendorData((prev) => ({
            ...prev,
            [key]: {
              imp: Array.from(impVendors),
              click: Array.from(clickVendors),
              status: 'ok',
              version: versionNow,
              durationSec: finalSec,
              creative:
                firstTextByLocal(doc, ['AdTitle', 'Title', 'Ad Title']) || '',
              alerts: a,
            },
          }));
        }
      } catch {}
    } catch {}
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let q25 = false,
      q50 = false,
      q75 = false,
      comp = false;

    function onPlay() {
      if (!started) {
        setStarted(true);
        log('started');
        fireEvent('start');
      }
    }

    function onPlaying() {
      if (!impressionTime && requestStart !== undefined) {
        setImpressionTime(performance.now());
        log('impression');
        fireEvent('impression');
        fireEvent('creativeView');
      }
    }

    function onPause() {
      setPaused(true);
      log('pause');
      fireEvent('pause');
    }

    function onEnded() {
      comp = true;
      setQuartilesDone((s) => ({ ...s, complete: true }));
      log('complete');
      fireEvent('complete');
    }

    function onTime() {
      try {
        const d = duration || v.duration || 0;

        const t = v.currentTime;

        if (!q25 && d > 0 && t >= d * 0.25) {
          q25 = true;
          setQuartilesDone((s) => ({ ...s, q25: true }));
          log('firstQuartile');
          fireEvent('firstQuartile');
        }

        if (!q50 && d > 0 && t >= d * 0.5) {
          q50 = true;
          setQuartilesDone((s) => ({ ...s, q50: true }));
          log('midpoint');
          fireEvent('midpoint');
        }

        if (!q75 && d > 0 && t >= d * 0.75) {
          q75 = true;
          setQuartilesDone((s) => ({ ...s, q75: true }));
          log('thirdQuartile');
          fireEvent('thirdQuartile');
        }
      } catch {}
    }

    function onVolumeChange() {
      if (!audioToggled) {
        setAudioToggled(true);
        log('audio toggle');
      }
    }

    v.addEventListener('play', onPlay);

    v.addEventListener('playing', onPlaying);

    v.addEventListener('pause', onPause);

    v.addEventListener('ended', onEnded);

    v.addEventListener('timeupdate', onTime);

    v.addEventListener('volumechange', onVolumeChange);

    return () => {
      v.removeEventListener('play', onPlay);

      v.removeEventListener('playing', onPlaying);

      v.removeEventListener('pause', onPause);

      v.removeEventListener('ended', onEnded);

      v.removeEventListener('timeupdate', onTime);

      v.removeEventListener('volumechange', onVolumeChange);
    };
  }, [duration, started, impressionTime, requestStart]);

  const responseMs = useMemo(
    () =>
      requestStart !== undefined && impressionTime !== undefined
        ? Math.round(impressionTime - requestStart)
        : undefined,
    [requestStart, impressionTime],
  );

  // When xmlIndex or query changes, scroll the active match near top with context margin
  useEffect(() => {
    try {
      const pre = xmlPreRef.current;
      if (!pre) return;
      const n = countMatches(formattedXml || rawXml || '', xmlQuery);
      if (n <= 0) return;
      const idx = ((xmlIndex % n) + n) % n; // normalize
      const el = pre.querySelector(`#xml-match-${idx}`) as HTMLElement | null;
      if (el) {
        const root = pre.parentElement || pre;
        const rootRect = (root as HTMLElement).getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const delta = elRect.top - rootRect.top;
        const margin = Math.max(60, Math.round((root as HTMLElement).clientHeight * 0.25));
        (root as HTMLElement).scrollTo({
          top: Math.max((root as HTMLElement).scrollTop + delta - margin, 0),
          behavior: 'smooth',
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlIndex, xmlQuery, formattedXml, rawXml]);

  return (
    <div>
      {/* Upload-first area: mirror HTML5 layout/copy (header text inside the box) */}
      <div className="panel" style={{ padding: 8, marginTop: 8 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--surface-2)';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--surface)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--surface)';
            void handleFileUpload(e.dataTransfer.files);
          }}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 12,
            padding: 32,
            minHeight: 320,
            background: 'var(--surface)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Drop Excel/CSV/Zip or click anywhere to choose files
            </div>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 6 }}>
              Accept: .xlsx, .xlsm, .xls, .csv, .zip (multiple allowed)
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xlsm,.xls,.csv,.zip"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        {/* Always show a button to toggle manual VAST URL entry */}
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowManualEntry((s) => !s)}
          >
            {showManualEntry ? 'Hide VAST URL entry' : 'Enter VAST URL'}
          </button>
        </div>
        {showManualEntry && (
          <div style={{ marginTop: 8 }}>
            <input
              value={tagUrl}
              onChange={(e) => setTagUrl(e.target.value)}
              placeholder="Paste one or more VAST URLs (newline separated)"
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
          </div>
        )}
        {uploadedRows.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                clearUploads();
              }}
            >
              Clear Uploads
            </button>
          </div>
        )}
        {!showTable && errors.length > 0 && (
          <div className="panel" style={{ padding: 8, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Upload Errors
            </div>
            <ul
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {errors.map((e, i) => (
                <li
                  key={`uplerr-${i}`}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    margin: '2px 0',
                    padding: '2px 4px',
                  }}
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showTable && (
        <div className="panel" style={{ padding: 8, marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Detected {tableRowCount} inputs
          </div>
          <div style={{ overflowX: 'auto', paddingLeft: 48 }}>
            <style>{`
          .vast-row td:first-child { position: relative; padding-left: 26px; }
          .vast-row .row-trash {
            opacity: 0.7;
            transition: opacity .14s ease, background-color .14s ease, color .14s ease, border-color .14s ease, transform .14s ease;
            color: #475569;
          }
          .vast-row:hover .row-trash,
          .vast-row.selected .row-trash {
            opacity: 1;
            color: #dc2626;
            border-color: rgba(220, 38, 38, 0.45);
            background: rgba(220, 38, 38, 0.1);
            transform: translateX(-2px);
          }
          .vast-row .row-trash:hover {
            color: #dc2626;
            border-color: rgba(220, 38, 38, 0.6);
          }
        `}</style>
            <table
              ref={vastTableRef}
              className="table"
              style={{
                tableLayout:
                  vastColW &&
                  typeof vastColW === 'object' &&
                  Object.keys(vastColW).length
                    ? ('fixed' as const)
                    : undefined,
              }}
            >
              <colgroup>
                {VAST_COLS.map((c) => (
                  <col
                    key={c.key}
                    style={{
                      width: vastColW[c.key]
                        ? `${vastColW[c.key]}px`
                        : undefined,
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {VAST_COLS.map((col) => (
                    <th
                      key={col.key}
                      data-colkey={col.key}
                      style={{
                        position: 'relative',
                        textAlign: 'left',
                        padding: 8,
                        whiteSpace: 'nowrap',
                      }}
                      title={col.title || undefined}
                      onMouseMove={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        const rect = el.getBoundingClientRect();
                        const near = rect.right - e.clientX <= 8;
                        if (near) {
                          el.classList.add('near-edge');
                          el.style.cursor = 'col-resize';
                        } else {
                          el.classList.remove('near-edge');
                          el.style.cursor = '';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.classList.remove('near-edge');
                        el.style.cursor = '';
                      }}
                    >
                      {col.label}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        title="Drag to resize"
                        onMouseDown={(e) => {
                          const parent = e.currentTarget
                            .parentElement as HTMLElement | null;
                          const idx = VAST_COLS.findIndex(
                            (c) => c.key === col.key,
                          );
                          const neighborIdx =
                            idx >= 0 && idx < VAST_COLS.length - 1
                              ? idx + 1
                              : idx > 0
                                ? idx - 1
                                : -1;
                          if (neighborIdx < 0) return;
                          const neighborKey = VAST_COLS[neighborIdx].key;
                          const table = vastTableRef.current;
                          const startW =
                            (vastColW && vastColW[col.key]) ||
                            (parent
                              ? parent.getBoundingClientRect().width
                              : 120) ||
                            120;
                          let neighborStartW =
                            (vastColW && vastColW[neighborKey]) || 0;
                          if (!neighborStartW && table) {
                            const th = table.querySelector(
                              `thead th[data-colkey="${neighborKey}"]`,
                            ) as HTMLElement | null;
                            neighborStartW = th
                              ? th.getBoundingClientRect().width || 120
                              : 120;
                          }
                          const min = Math.max(VAST_COLS[idx]?.min || 60, 40);
                          const neighborMin = Math.max(
                            VAST_COLS[neighborIdx]?.min || 60,
                            40,
                          );
                          vastDrag.current = {
                            key: col.key,
                            startX: e.clientX,
                            startW,
                            min,
                            neighborKey,
                            neighborStartW,
                            neighborMin,
                          };
                          document.body.style.cursor = 'col-resize';
                          e.preventDefault();
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: 6,
                          cursor: 'col-resize',
                          userSelect: 'none',
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, idx) => {
                  const vastUrl = (
                    row.meta?.vastUrl ||
                    row.entry.raw ||
                    ''
                  ).trim();
                  const otherPairs = Object.entries(row.entry.params || {})
                    .map(([k, v]) => `${k}=${v}`)
                    .slice(0, 6);
                  const otherDisplay = otherPairs.length
                    ? otherPairs.join('  ')
                    : '-';
                  const combinedDisplay = row.meta?.sourceLabel
                    ? otherDisplay === '-'
                      ? row.meta.sourceLabel
                      : `${otherDisplay} | ${row.meta.sourceLabel}`
                    : otherDisplay;
                  const key = computeRowKey(row);
                  const isActive =
                    activeRowKey !== null && key === activeRowKey;
                  const data = rowVendorData[key];
                  const imp = data?.imp?.length
                    ? data.imp.join(', ')
                    : data?.status === 'pending'
                      ? '…'
                      : '-';
                  const click = data?.click?.length
                    ? data.click.join(', ')
                    : data?.status === 'pending'
                      ? '…'
                      : '-';
                  const durationLabel =
                    data?.status === 'pending'
                      ? '…'
                      : isFinite(data?.durationSec as any)
                        ? `${Math.round(data!.durationSec!)}s`
                        : '-';
                  const creativeDisplay =
                    data?.status === 'pending' ? '…' : data?.creative || '-';
                  const versionDisplay =
                    data?.status === 'pending' ? '…' : data?.version || '-';
                  const alertsList = data?.alerts || [];
                  const alertsTitle = alertsList.length
                    ? alertsList.join('\n')
                    : '';
                  return (
                    <tr
                      key={row.key || `${row.source}-${idx}-${vastUrl}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => activateRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          activateRow(row);
                        }
                      }}
                      className={`vast-row${isActive ? ' selected' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <td
                        style={{
                          ...vastTd,
                          position: 'relative',
                          paddingLeft: 26,
                        }}
                      >
                        <span
                          className="row-trash"
                          title="Remove this row"
                          role="button"
                          aria-label="Remove row"
                          onClick={(e) => {
                            e.stopPropagation();
                            const keyNow = computeRowKey(row);
                            if (keyNow) removeVastRow(keyNow);
                          }}
                          style={{
                            position: 'absolute',
                            left: -40,
                            top: '50%',
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: '#475569',
                            opacity: 0.7,
                            pointerEvents: 'auto',
                            transform: 'translateY(-50%)',
                            boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.08)',
                            zIndex: 2,
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="10"
                            height="10"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18v2H3V6zm2 3h14l-1.2 11.1c-.1.9-.8 1.9-1.7 1.9H8c-.9 0-1.6-1-1.7-1.9L5 9zm5-5h4l1 2H9l1-2z" />
                          </svg>
                        </span>
                        {idx + 1}
                      </td>
                      <td style={vastTd}>{row.entry.type}</td>
                      <td style={vastTd}>{row.entry.vendor}</td>
                      <td style={vastTd}>{row.entry.host || '-'}</td>
                      <td style={vastTd}>{row.meta?.placementId || '-'}</td>
                      <td style={vastTd}>{row.meta?.placementName || '-'}</td>
                      <td style={vastTd}>{row.meta?.platform || '-'}</td>
                      <td style={vastTd}>{row.meta?.startDate || '-'}</td>
                      <td style={vastTd}>{row.meta?.endDate || '-'}</td>
                      <td
                        style={{
                          ...vastTd,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={vastUrl || ''}
                      >
                        {vastUrl || '-'}
                      </td>
                      <td
                        style={{
                          ...vastTd,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={data?.creative || ''}
                      >
                        {creativeDisplay}
                      </td>
                      <td style={vastTd}>{versionDisplay}</td>
                      <td style={vastTd}>{durationLabel}</td>
                      <td
                        style={{
                          ...vastTd,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={imp}
                      >
                        {imp}
                      </td>
                      <td
                        style={{
                          ...vastTd,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={click}
                      >
                        {click}
                      </td>
                      <td
                        style={{
                          ...vastTd,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {combinedDisplay}
                      </td>
                      <td style={vastTd} title={alertsTitle}>
                        {alertsList.length || '-'}
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={17}
                      style={{ fontStyle: 'italic', color: '#6b7280' }}
                    >
                      No entries parsed
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Only show Alerts/Info after there are rows (i.e., after an upload or manual entries) */}
      {showTable && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Alerts</div>
            <ul
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                minHeight: 80,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {alerts.map((e, i) => (
                <li
                  key={`a-${i}`}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    margin: '2px 0',
                    padding: '2px 4px',
                  }}
                >
                  {e}
                </li>
              ))}
              {errors.map((e, i) => (
                <li
                  key={`e-${i}`}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    margin: '2px 0',
                    padding: '2px 4px',
                  }}
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Info</div>
            <ul
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                minHeight: 80,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {info.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Preview */}

      {mediaUrl && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <div>
              <video
                ref={videoRef}
                src={mediaUrl}
                controls
                muted
                playsInline
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: clickThrough ? 'pointer' : 'default',
                }}
                title={clickThrough ? 'Open ClickThrough' : undefined}
                onCanPlay={() => {
                  /* allow auto play */ try {
                    videoRef.current?.play().catch(() => {});
                  } catch {}
                }}
                onClick={() => {
                  if (clickThrough) {
                    const ok = openNewTab(clickThrough);
                    setClicked(true);
                    log('click');
                    fireEvent('click');
                    if (!ok) {
                      /* best-effort; anchor fallback below */
                    }
                  }
                }}
              />

              {clickThrough && (
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setShowCtModal(true)}
                  >
                    CTURL Status
                    {clickResolve && clickResolve.status
                      ? ` (Status: ${clickResolve.status})`
                      : ''}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Progression
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 6,
                }}
              >
                <Step label="request" done={requestStart !== undefined} />

                <Step
                  label="impression"
                  done={impressionTime !== undefined}
                  hint={responseMs ? `${responseMs} ms` : undefined}
                />

                <Step label="started" done={started} />

                <Step label="25%" done={quartilesDone.q25} />

                <Step label="50%" done={quartilesDone.q50} />

                <Step label="75%" done={quartilesDone.q75} />

                <Step label="complete" done={quartilesDone.complete} />

                <Step label="pause" done={paused} />

                <Step label="audio toggle" done={audioToggled} />

                <Step label="click" done={clicked} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>
                Events
              </div>

              <div
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: 'var(--table-head)' }}>
                      <th style={th}>Time</th>
                      <th style={th}>Event</th>
                    </tr>
                  </thead>

                  <tbody>
                    {timeline.map((row, i) => (
                      <tr
                        key={i}
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <td style={td}>{row.time}</td>
                        <td style={td}>{row.label}</td>
                      </tr>
                    ))}

                    {timeline.length === 0 && (
                      <tr>
                        <td style={td} colSpan={2}>
                          (no events yet)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>
                Trackers
              </div>

              {/* Grouped tracker view */}

              <GroupedTrackers trackers={trackers} />

              {/* Raw trackers table (collapsed by default) */}

              <details style={{ marginTop: 12 }}>
                <summary
                  style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                >
                  Trackers (raw)
                </summary>

                <div
                  style={{
                    maxHeight: 240,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    marginTop: 8,
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: 'var(--table-head)' }}>
                        <th style={th}>Event</th>

                        <th style={{ ...th, width: '55%' }}>URL</th>

                        <th style={th}>Fired At</th>

                        <th style={th}>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {Object.keys(trackers).length === 0 ? (
                        <tr>
                          <td style={td} colSpan={4}>
                            (none)
                          </td>
                        </tr>
                      ) : (
                        Object.entries(trackers).flatMap(([ev, arr]) =>
                          arr.map((it, i) => (
                            <tr
                              key={`${ev}-${i}`}
                              style={{ borderTop: '1px solid var(--border)' }}
                            >
                              <td style={td}>{ev}</td>

                              <td style={{ ...td, wordBreak: 'break-all' }}>
                                {it.url}
                              </td>

                              <td style={td}>{it.firedAt || ''}</td>

                              <td style={td}>{it.status || ''}</td>
                            </tr>
                          )),
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Raw XML */}

      {(rawXml || formattedXml) && (
        <div style={{ marginTop: 16 }}>
          <details>
            <summary
              style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
            >
              XML Source Code
            </summary>

            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--surface)',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <input
                value={xmlQuery}
                onChange={(e) => {
                  setXmlQuery(e.target.value);
                  setXmlIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const n = countMatches(
                      formattedXml || rawXml || '',
                      xmlQuery,
                    );
                    if (n > 0) {
                      if (e.shiftKey) {
                        setXmlIndex((i) => (i - 1 + n) % n);
                      } else {
                        setXmlIndex((i) => (i + 1) % n);
                      }
                    }
                  }
                }}
                placeholder="Search XML..."
                style={{
                  flex: '0 0 240px',
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />

              <div
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <button
                  className="btn"
                  title="Previous match"
                  onClick={() => {
                    const n = countMatches(
                      formattedXml || rawXml || '',
                      xmlQuery,
                    );
                    if (n <= 0) return;
                    setXmlIndex((i) => (i - 1 + n) % n);
                  }}
                  disabled={countMatches(formattedXml || rawXml, xmlQuery) <= 1}
                  style={{ padding: '2px 6px', fontSize: 12 }}
                >
                  ←
                </button>
                <button
                  className="btn"
                  title="Next match"
                  onClick={() => {
                    const n = countMatches(
                      formattedXml || rawXml || '',
                      xmlQuery,
                    );
                    if (n <= 0) return;
                    setXmlIndex((i) => (i + 1) % n);
                  }}
                  disabled={countMatches(formattedXml || rawXml, xmlQuery) <= 1}
                  style={{ padding: '2px 6px', fontSize: 12 }}
                >
                  →
                </button>
                <span style={{ fontSize: 11, opacity: 0.8 }}>
                  {(() => {
                    const n = countMatches(formattedXml || rawXml, xmlQuery);
                    if (!n) return '0 matches';
                    const idx = ((xmlIndex % n) + n) % n;
                    return `${idx + 1} of ${n}`;
                  })()}
                </span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  className="btn"
                  title="Copy XML"
                  onClick={() => {
                    try {
                      const text = (formattedXml || rawXml || '').toString();
                      navigator.clipboard.writeText(text).catch(() => {});
                    } catch {}
                  }}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Copy
                </button>
              </div>
            </div>

            <pre
              ref={xmlPreRef}
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.3,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {renderHighlighted(formattedXml || rawXml, xmlQuery, xmlIndex)}
            </pre>
          </details>
        </div>
      )}

      {/* CTURL Status modal */}

      {showCtModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCtModal(false);
          }}
        >
          <div
            className="panel"
            style={{ padding: 12, width: 'min(560px, 92vw)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>CTURL Status</div>

              <button
                onClick={() => setShowCtModal(false)}
                className="btn"
                style={{ fontSize: 12, padding: '2px 6px' }}
              >
                Close
              </button>
            </div>

            {!clickThrough && (
              <div
                style={{
                  fontSize: 12,
                  background: 'rgba(245,158,11,0.12)',
                  color: 'var(--text)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                No ClickThrough detected.
              </div>
            )}

            {clickThrough && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12 }}>
                  Status:{' '}
                  <strong>{clickResolve?.status || 'resolving...'}</strong>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {clickResolve
                    ? clickResolve.final &&
                      clickResolve.final !== (clickResolve.initial || '')
                      ? `${clickResolve.initial} -> ${clickResolve.final}`
                      : `${clickResolve.initial}`
                    : normalizeHref(clickThrough) || clickThrough}
                </div>

                <div style={{ fontSize: 12 }}>
                  <a
                    href={normalizeHref(clickThrough) || clickThrough}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open clickthrough
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------- Helpers and UI utilities ----------------

function formatXml(xml: string): string {
  try {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let xmlStr = xml.replace(/\r?\n/g, '').replace(reg, '$1\n$2$3');
    let pad = 0;
    return xmlStr
      .split('\n')
      .map((node) => {
        let indent = 0;
        if (node.match(/.+<\/.*>$/)) {
          indent = 0;
        } else if (node.match(/^<\/.+>/)) {
          if (pad !== 0) pad -= 1;
        } else if (node.match(/^<[^!?].*>$/)) {
          indent = 1;
        }
        const padding = PADDING.repeat(pad);
        pad += indent;
        return padding + node;
      })
      .join('\n');
  } catch {
    return xml;
  }
}

function elsByLocal(doc: Document | Element, local: string): Element[] {
  const ret: Element[] = [];
  const all = (doc as Element).querySelectorAll
    ? (doc as Element).querySelectorAll('*')
    : (doc as Document).getElementsByTagName('*');
  for (const el of Array.from(all)) {
    const ln = (el as any).localName || (el as Element).tagName;
    if (ln && String(ln).toLowerCase() === String(local).toLowerCase())
      ret.push(el as Element);
  }
  return ret;
}

function firstTextByLocal(
  doc: Document | Element,
  locals: string[],
): string | '' {
  for (const name of locals) {
    const els = elsByLocal(doc, name);
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (t) return t;
    }
  }
  return '';
}

function findClickThrough(doc: Document): string | '' {
  return (
    firstTextByLocal(doc, [
      'ClickThrough',
      'NonLinearClickThrough',
      'CompanionClickTracking',
      'IconClickTracking',
    ]) || ''
  );
}

async function resolveClickThrough(ct: string): Promise<{
  status: string;
  initial: string;
  final?: string;
  redirected?: boolean;
}> {
  const initial = normalizeHref(ct) || ct;
  try {
    // Best-effort: attempt a CORS fetch; many will be blocked, but we can still report initial
    const resp = await fetch(initial, {
      method: 'HEAD',
      mode: 'cors',
      redirect: 'follow' as RequestRedirect,
    });
    return { status: resp.ok ? 'ok' : `HTTP ${resp.status}`, initial };
  } catch {
    return { status: 'unknown', initial };
  }
}

function normalizeHref(href: string): string | '' {
  try {
    const u = new URL(href);
    return u.toString();
  } catch {
    try {
      if (href.startsWith('//'))
        return (location.protocol === 'https:' ? 'https:' : 'http:') + href;
      if (/^www\./i.test(href)) return 'https://' + href;
    } catch {}
    return '';
  }
}

function openNewTab(url: string): boolean {
  try {
    const w = window.open(url, '_blank', 'noopener');
    return !!w;
  } catch {
    return false;
  }
}

function countMatches(text: string, q: string): number {
  const s = String(q || '').trim();
  if (!s) return 0;
  const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text.match(re) || []).length; // Count matches of the query in the text
}

function renderHighlighted(
  text: string,
  q: string,
  activeIndex?: number,
): React.ReactNode {
  const s = String(q || '').trim();
  if (!s) return text;
  const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    const i = m.index;
    if (i > lastIndex) parts.push(text.slice(lastIndex, i));
    const isActive =
      typeof activeIndex === 'number' &&
      idx === ((activeIndex % 999999) + 999999) % 999999;
    parts.push(
      <mark
        key={i}
        id={isActive ? `xml-match-${idx}` : undefined}
        style={
          isActive ? { backgroundColor: 'rgba(99,102,241,0.35)' } : undefined
        }
      >
        {m[0]}
      </mark>,
    );
    idx++;
    lastIndex = i + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function parseDuration(hms: string): number {
  const m = hms.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return NaN;
  const hh = parseInt(m[1], 10),
    mm = parseInt(m[2], 10),
    ss = parseInt(m[3], 10),
    ms = m[4] ? parseInt(m[4].padEnd(3, '0'), 10) : 0;
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 6,
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: 6, verticalAlign: 'top' };

const Step: React.FC<{ label: string; done?: boolean; hint?: string }> = ({
  label,
  done,
  hint,
}) => (
  <div
    title={hint}
    style={{
      padding: '6px 8px',
      borderRadius: 6,
      background: done ? 'var(--ok)' : 'var(--btn-bg)',
      color: done ? '#fff' : 'var(--text)',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: 700,
      border: '1px solid var(--btn-border)',
    }}
  >
    {label}
  </div>
);

function timeNow(): string {
  const now = new Date();
  const s = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
  return s;
}

function appendCb(u: string): string {
  try {
    const x = new URL(u);
    x.searchParams.set('cb', String(Date.now()));
    return x.toString();
  } catch {
    return u + (u.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  }
}

function fireUrls(urls: string[]) {
  urls.forEach((u) => {
    try {
      const img = new Image();
      img.onload = () => {};
      img.onerror = () => {};
      img.src = appendCb(u);
    } catch {}
  });
}

function fireTrackersUpdate(
  state: Record<
    string,
    { url: string; firedAt?: string; status?: 'requested' | 'ok' | 'error' }[]
  >,
  ev: string,
): Record<
  string,
  { url: string; firedAt?: string; status?: 'requested' | 'ok' | 'error' }[]
> {
  const copy: typeof state = JSON.parse(JSON.stringify(state || {}));
  if (!copy[ev]) return copy;
  const ts = timeNow();
  copy[ev] = copy[ev].map((it) =>
    it.firedAt ? it : { ...it, firedAt: ts, status: 'requested' },
  );
  return copy;
}

const GroupedTrackers: React.FC<{
  trackers: Record<
    string,
    { url: string; firedAt?: string; status?: 'requested' | 'ok' | 'error' }[]
  >;
}> = ({ trackers }) => {
  // Build groups by vendor -> event
  const rows: Array<{
    vendor: string;
    host: string;
    event: string;
    url: string;
    firedAt?: string;
    status?: string;
  }> = [];
  Object.entries(trackers || {}).forEach(([ev, arr]) => {
    arr.forEach((it) => {
      const { vendor, host } = classifyVendor(it.url);
      rows.push({
        vendor,
        host,
        event: ev,
        url: it.url,
        firedAt: it.firedAt,
        status: it.status,
      });
    });
  });
  const byVendor = new Map<string, Array<(typeof rows)[number]>>();
  rows.forEach((r) => {
    const key = `${r.vendor}|${r.host}`;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(r);
  });
  if (rows.length === 0)
    return <div style={{ fontSize: 12, opacity: 0.8 }}>(no trackers)</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {Array.from(byVendor.entries()).map(([key, list]) => {
        const [vendor, host] = key.split('|');
        return (
          <details key={key} open>
            <summary
              style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
            >
              {vendor} — {host}{' '}
              <span style={{ opacity: 0.7, fontWeight: 400 }}>
                ({list.length})
              </span>
            </summary>
            <div
              style={{
                maxHeight: 220,
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                marginTop: 6,
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--table-head)' }}>
                    <th style={th}>Event</th>
                    <th style={{ ...th, width: '60%' }}>URL</th>
                    <th style={th}>Fired At</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr
                      key={i}
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <td style={td}>{r.event}</td>
                      <td style={{ ...td, wordBreak: 'break-all' }}>{r.url}</td>
                      <td style={td}>{r.firedAt || ''}</td>
                      <td style={td}>{r.status || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
};

function computeRowKey(row: any): string {
  const entry = row?.entry || row;
  const base = String(row?.meta?.vastUrl || entry?.raw || '').trim();
  return row?.key || `${row?.source}-${entry?.i || ''}-${base}`;
}
