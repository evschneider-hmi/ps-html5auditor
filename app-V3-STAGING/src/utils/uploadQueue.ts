/**
 * Upload Queue Manager
 * Manages parallel file processing with Web Workers
 */

import type { Upload } from '../types';

export interface QueuedFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'complete' | 'error' | 'paused';
  progress: number; // 0-100
  currentStep: string;
  message: string;
  upload?: Upload;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface QueueState {
  files: Map<string, QueuedFile>;
  isProcessing: boolean;
  isPaused: boolean;
  completedCount: number;
  errorCount: number;
  totalCount: number;
}

export interface QueueCallbacks {
  onProgress: (file: QueuedFile) => void;
  onComplete: (file: QueuedFile) => void;
  onError: (file: QueuedFile) => void;
  onAllComplete: (uploads: Upload[]) => void;
}

export class UploadQueue {
  private files = new Map<string, QueuedFile>();
  private workers: Worker[] = [];
  private maxWorkers: number;
  private callbacks: QueueCallbacks;
  private isPaused = false;
  private isProcessing = false;
  private processingIds = new Set<string>();

  constructor(maxWorkers: number = 4, callbacks: QueueCallbacks) {
    this.maxWorkers = maxWorkers;
    this.callbacks = callbacks;
  }

  /**
   * Add files to the queue
   */
  addFiles(fileList: FileList | File[]): string[] {
    const ids: string[] = [];
    const filesArray = Array.from(fileList);

    filesArray.forEach((file, index) => {
      const id = `upload_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedFile: QueuedFile = {
        id,
        file,
        status: 'pending',
        progress: 0,
        currentStep: 'queued',
        message: 'Waiting to process...',
      };

      this.files.set(id, queuedFile);
      ids.push(id);
    });

    return ids;
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      console.warn('[Queue] Already processing');
      return;
    }

    this.isProcessing = true;
    this.isPaused = false;

    console.log(`[Queue] Starting with ${this.files.size} files, ${this.maxWorkers} workers`);

    // Create worker pool
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.processNext();
    }
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isPaused = true;
    console.log('[Queue] Paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    console.log('[Queue] Resumed');
    
    // Restart processing for pending files
    for (let i = 0; i < this.maxWorkers; i++) {
      this.processNext();
    }
  }

  /**
   * Cancel all processing
   */
  cancel(): void {
    this.isPaused = true;
    this.isProcessing = false;
    
    // Terminate all workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.processingIds.clear();
    
    // Mark all pending/processing files as paused
    this.files.forEach(file => {
      if (file.status === 'pending' || file.status === 'processing') {
        file.status = 'paused';
        file.message = 'Processing cancelled';
      }
    });

    console.log('[Queue] Cancelled');
  }

  /**
   * Retry failed files
   */
  retryFailed(): void {
    this.files.forEach(file => {
      if (file.status === 'error') {
        file.status = 'pending';
        file.progress = 0;
        file.message = 'Retrying...';
        file.error = undefined;
        this.callbacks.onProgress(file);
      }
    });

    if (!this.isProcessing) {
      this.start();
    } else {
      // Trigger processing of newly pending files
      for (let i = 0; i < this.maxWorkers; i++) {
        this.processNext();
      }
    }
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    const filesArray = Array.from(this.files.values());
    
    return {
      files: this.files,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      completedCount: filesArray.filter(f => f.status === 'complete').length,
      errorCount: filesArray.filter(f => f.status === 'error').length,
      totalCount: this.files.size,
    };
  }

  /**
   * Get file by ID
   */
  getFile(id: string): QueuedFile | undefined {
    return this.files.get(id);
  }

  /**
   * Process next pending file
   */
  private async processNext(): Promise<void> {
    if (this.isPaused) return;

    // Find next pending file
    const pendingFile = Array.from(this.files.values()).find(
      f => f.status === 'pending'
    );

    if (!pendingFile) {
      // No more pending files - check if we're done
      if (this.processingIds.size === 0) {
        this.onAllFilesProcessed();
      }
      return;
    }

    // Mark as processing
    pendingFile.status = 'processing';
    pendingFile.startTime = Date.now();
    this.processingIds.add(pendingFile.id);
    this.callbacks.onProgress(pendingFile);

    // Create worker
    const worker = new Worker(
      new URL('../workers/fileProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.workers.push(worker);

    // Set up worker message handler
    worker.onmessage = (e: MessageEvent) => {
      const message = e.data;

      if (message.type === 'progress') {
        pendingFile.progress = message.data.progress;
        pendingFile.currentStep = message.data.step;
        pendingFile.message = message.data.message;
        this.callbacks.onProgress(pendingFile);
      } else if (message.type === 'success') {
        pendingFile.status = 'complete';
        pendingFile.progress = 100;
        pendingFile.message = 'Complete';
        pendingFile.upload = message.data.upload;
        pendingFile.endTime = Date.now();
        this.callbacks.onComplete(pendingFile);
        this.onFileComplete(worker, pendingFile.id);
      } else if (message.type === 'error') {
        pendingFile.status = 'error';
        pendingFile.message = 'Error';
        pendingFile.error = message.data.error;
        pendingFile.endTime = Date.now();
        this.callbacks.onError(pendingFile);
        this.onFileComplete(worker, pendingFile.id);
      }
    };

    worker.onerror = (error) => {
      console.error('[Queue] Worker error:', error);
      pendingFile.status = 'error';
      pendingFile.error = 'Worker crashed';
      pendingFile.endTime = Date.now();
      this.callbacks.onError(pendingFile);
      this.onFileComplete(worker, pendingFile.id);
    };

    // Start processing
    const totalFiles = this.files.size;
    const index = Array.from(this.files.values()).indexOf(pendingFile);
    
    worker.postMessage({
      id: pendingFile.id,
      file: pendingFile.file,
      index,
      total: totalFiles,
    });
  }

  /**
   * Handle file completion
   */
  private onFileComplete(worker: Worker, fileId: string): void {
    // Remove from processing set
    this.processingIds.delete(fileId);

    // Terminate worker
    worker.terminate();
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex > -1) {
      this.workers.splice(workerIndex, 1);
    }

    // Process next file
    this.processNext();
  }

  /**
   * Handle all files processed
   */
  private onAllFilesProcessed(): void {
    this.isProcessing = false;
    
    const completedUploads = Array.from(this.files.values())
      .filter(f => f.status === 'complete' && f.upload)
      .map(f => f.upload!);

    console.log('[Queue] All files processed:', {
      total: this.files.size,
      completed: completedUploads.length,
      errors: Array.from(this.files.values()).filter(f => f.status === 'error').length,
    });

    this.callbacks.onAllComplete(completedUploads);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancel();
    this.files.clear();
  }
}
