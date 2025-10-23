/**
 * Web Worker for parallel file processing
 * Handles ZIP reading, discovery, parsing, and check execution off the main thread
 */

import { readZip } from '../logic/zipReader';
import { discoverPrimary } from '../logic/discovery';
import { parsePrimary } from '../logic/parse';
import { runAllChecks } from '../logic/creatives';
import { defaultSettings } from '../logic/profiles';
import { detectCreativeMetadata } from '../utils/creativeMetadataDetector';
import type { Upload, CreativeSubtype } from '../types';
import type { BundleResult } from '../logic/types';

export interface WorkerRequest {
  id: string;
  file: File;
  index: number;
  total: number;
}

export interface WorkerProgress {
  id: string;
  step: string;
  progress: number; // 0-100
  message: string;
}

export interface WorkerSuccess {
  id: string;
  upload: Upload;
}

export interface WorkerError {
  id: string;
  error: string;
  fileName: string;
}

export type WorkerMessage = 
  | { type: 'progress'; data: WorkerProgress }
  | { type: 'success'; data: WorkerSuccess }
  | { type: 'error'; data: WorkerError };

// Worker message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, file, index, total } = e.data;

  const sendProgress = (step: string, progress: number, message: string) => {
    const progressMsg: WorkerMessage = {
      type: 'progress',
      data: { id, step, progress, message },
    };
    self.postMessage(progressMsg);
  };

  const sendSuccess = (upload: Upload) => {
    const successMsg: WorkerMessage = {
      type: 'success',
      data: { id, upload },
    };
    self.postMessage(successMsg);
  };

  const sendError = (error: string) => {
    const errorMsg: WorkerMessage = {
      type: 'error',
      data: { id, error, fileName: file.name },
    };
    self.postMessage(errorMsg);
  };

  try {
    console.log(`[Worker ${id}] Processing file ${index + 1}/${total}:`, file.name);

    // Step 1: Read ZIP file (20%)
    sendProgress('reading', 10, 'Reading ZIP file...');
    const zipBundle = await readZip(file);
    sendProgress('reading', 20, `ZIP read complete (${Object.keys(zipBundle.files).length} files)`);

    // Step 2: Discover primary HTML (40%)
    sendProgress('discovering', 30, 'Discovering primary HTML...');
    const discovery = discoverPrimary(zipBundle);
    
    if (!discovery.primary) {
      throw new Error(`No HTML files found in ${file.name}`);
    }
    sendProgress('discovering', 40, `Found primary: ${discovery.primary.path}`);

    // Step 3: Parse primary HTML (60%)
    sendProgress('parsing', 50, 'Parsing HTML and extracting metadata...');
    const parseResult = await parsePrimary(zipBundle, discovery.primary);
    sendProgress('parsing', 60, `Parse complete (${parseResult.references.length} references)`);

    // Step 4: Build BundleResult
    const partial: BundleResult = {
      bundleId: zipBundle.id,
      bundleName: zipBundle.name,
      primary: discovery.primary,
      adSize: parseResult.adSize,
      adSizeSource: parseResult.adSizeSource,
      findings: [],
      references: parseResult.references,
      summary: {
        status: 'PASS',
        totalFindings: 0,
        fails: 0,
        warns: 0,
        pass: 0,
        orphanCount: 0,
        missingAssetCount: 0,
      },
      totalBytes: zipBundle.bytes.length,
      zippedBytes: zipBundle.bytes.length,
    };

    // Step 5: Build CheckContext (70%)
    sendProgress('preparing', 65, 'Preparing check context...');
    const primaryPath = discovery.primary.path;
    const htmlText = new TextDecoder().decode(zipBundle.files[primaryPath]);
    const bundleFiles = Object.keys(zipBundle.files);

    const context = {
      bundle: zipBundle,
      partial,
      settings: { ...defaultSettings, profile: 'CM360' as const },
      files: bundleFiles,
      primary: primaryPath,
      htmlText,
      entryName: primaryPath.split('/').pop(),
      isIabProfile: false,
    };
    sendProgress('preparing', 70, 'Context ready');

    // Step 6: Run checks (90%)
    sendProgress('checking', 75, 'Running quality checks...');
    const results = await runAllChecks(context, {
      profile: 'CM360',
    });
    sendProgress('checking', 90, `Checks complete (${results.length} results)`);

    // Step 7: Detect creative metadata (95%)
    sendProgress('finalizing', 93, 'Detecting creative metadata...');
    const creativeMetadata = detectCreativeMetadata(file.name);
    const subtype: CreativeSubtype = 'html5';
    sendProgress('finalizing', 95, 'Finalizing upload...');

    // Step 8: Create upload record
    const upload: Upload = {
      id: zipBundle.id,
      timestamp: Date.now(),
      type: 'creative',
      subtype,
      bundle: zipBundle,
      bundleResult: partial,
      findings: results,
      creativeMetadata,
    };

    sendProgress('complete', 100, 'Processing complete');
    sendSuccess(upload);

    console.log(`[Worker ${id}] Complete:`, {
      uploadId: upload.id,
      findings: results.length,
      creativeName: creativeMetadata.creativeName,
    });
  } catch (err) {
    console.error(`[Worker ${id}] Error:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    sendError(errorMessage);
  }
};
