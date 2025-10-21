import * as XLSX from 'xlsx';
import { VastEntry } from './types';

const EXPECTED_HEADERS = new Set([
  'placement id', 'placementid', 'placement_id',
  'placement name', 'placementname',
  'platform',
  'start date', 'startdate', 'start_date',
  'end date', 'enddate', 'end_date',
  'tag', 'vast url', 'vast', 'vasturl', 'ad tag', 'adtag',
  'ad tag uri', 'adtaguri', 'ad tag url', 'adtag url',
  'vast tag', 'vasttag', 'vast ad tag uri', 'vast ad tag url',
]);

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeText(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function pickValue(row: any, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return normalizeText(row[key]);
    }
  }
  return '';
}

export async function parseExcelFile(file: File): Promise<VastEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const entries = extractEntriesFromWorkbook(workbook, file.name);
        resolve(entries);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function extractEntriesFromWorkbook(workbook: XLSX.WorkBook, fileName: string): VastEntry[] {
  const collected: VastEntry[] = [];
  let entryCounter = 0;

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as any[][];

    if (!Array.isArray(rows) || rows.length === 0) return;

    // Find header row
    let headerRowIndex = -1;
    let headerMap: Map<number, string> = new Map();

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      let matchCount = 0;
      const tempMap = new Map<number, string>();

      row.forEach((cell: any, colIndex: number) => {
        const cellStr = normalizeText(cell);
        const normalized = normalizeHeader(cellStr);
        if (EXPECTED_HEADERS.has(normalized)) {
          matchCount++;
          tempMap.set(colIndex, normalized);
        }
      });

      if (matchCount >= 2) {
        headerRowIndex = i;
        headerMap = tempMap;
        break;
      }
    }

    if (headerRowIndex === -1) return;

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      // Build object from header map
      const rowObj: any = {};
      headerMap.forEach((headerName, colIndex) => {
        rowObj[headerName] = normalizeText(row[colIndex]);
      });

      // Extract VAST URL
      const vastUrl = pickValue(rowObj, [
        'vast url', 'vasturl', 'vast', 'tag',
        'ad tag', 'adtag', 'ad tag uri', 'adtaguri',
        'ad tag url', 'vast tag', 'vasttag',
      ]);

      if (!vastUrl) continue;

      entryCounter++;

      const entry: VastEntry = {
        id: `entry-${Date.now()}-${entryCounter}`,
        type: 'VAST URL',
        vendor: '',
        host: '',
        placementId: pickValue(rowObj, ['placement id', 'placementid', 'placement_id']),
        placementName: pickValue(rowObj, ['placement name', 'placementname']),
        platform: pickValue(rowObj, ['platform']),
        startDate: pickValue(rowObj, ['start date', 'startdate', 'start_date']),
        endDate: pickValue(rowObj, ['end date', 'enddate', 'end_date']),
        vastUrl,
        creative: '',
        vastVersion: '',
        duration: '',
        impressionVendors: [],
        clickVendors: [],
        otherParams: `${fileName} - ${sheetName} #${i + 1}`,
        alerts: [],
        sourceFile: fileName,
      };

      collected.push(entry);
    }
  });

  return collected;
}
