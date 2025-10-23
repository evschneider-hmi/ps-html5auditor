/**
 * Hook for managing parallel file uploads with Web Workers
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { UploadQueue, QueuedFile, QueueState } from '../utils/uploadQueue';
import type { Upload } from '../types';

export interface UseUploadQueueResult {
  queueState: QueueState;
  queuedFiles: QueuedFile[];
  isProcessing: boolean;
  isPaused: boolean;
  progress: {
    completed: number;
    total: number;
    percentage: number;
    errorCount: number;
  };
  addFiles: (files: FileList | File[]) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retryFailed: () => void;
  clearCompleted: () => void;
}

interface UseUploadQueueOptions {
  maxWorkers?: number;
  onComplete?: (uploads: Upload[]) => void;
  onError?: (error: string, fileName: string) => void;
}

export function useUploadQueue(options: UseUploadQueueOptions = {}): UseUploadQueueResult {
  const { maxWorkers = 4, onComplete, onError } = options;

  const [queueState, setQueueState] = useState<QueueState>({
    files: new Map(),
    isProcessing: false,
    isPaused: false,
    completedCount: 0,
    errorCount: 0,
    totalCount: 0,
  });

  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const queueRef = useRef<UploadQueue | null>(null);
  
  // Use refs to store latest callback values without causing re-initialization
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Update queued files whenever queue state changes
  useEffect(() => {
    setQueuedFiles(Array.from(queueState.files.values()));
  }, [queueState]);

  // Update queue state from queue
  const updateQueueState = useCallback(() => {
    if (queueRef.current) {
      setQueueState(queueRef.current.getState());
    }
  }, []);

  // Initialize queue on mount (only once)
  useEffect(() => {
    queueRef.current = new UploadQueue(maxWorkers, {
      onProgress: (file) => {
        updateQueueState();
      },
      onComplete: (file) => {
        console.log('[useUploadQueue] File complete:', file.file.name);
        updateQueueState();
      },
      onError: (file) => {
        console.error('[useUploadQueue] File error:', file.file.name, file.error);
        if (onErrorRef.current) {
          onErrorRef.current(file.error || 'Unknown error', file.file.name);
        }
        updateQueueState();
      },
      onAllComplete: (uploads) => {
        console.log('[useUploadQueue] All complete:', uploads.length);
        if (onCompleteRef.current) {
          onCompleteRef.current(uploads);
        }
        updateQueueState();
      },
    });

    return () => {
      if (queueRef.current) {
        queueRef.current.destroy();
      }
    };
  }, [maxWorkers, updateQueueState]); // Only recreate if maxWorkers changes

  // Add files to queue
  const addFiles = useCallback((files: FileList | File[]) => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Adding files:', files.length);
    queueRef.current.addFiles(files);
    updateQueueState();
  }, [updateQueueState]);

  // Start processing
  const start = useCallback(() => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Starting queue');
    queueRef.current.start();
    updateQueueState();
  }, [updateQueueState]);

  // Pause processing
  const pause = useCallback(() => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Pausing queue');
    queueRef.current.pause();
    updateQueueState();
  }, [updateQueueState]);

  // Resume processing
  const resume = useCallback(() => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Resuming queue');
    queueRef.current.resume();
    updateQueueState();
  }, [updateQueueState]);

  // Cancel all
  const cancel = useCallback(() => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Cancelling queue');
    queueRef.current.cancel();
    updateQueueState();
  }, [updateQueueState]);

  // Retry failed files
  const retryFailed = useCallback(() => {
    if (!queueRef.current) return;
    
    console.log('[useUploadQueue] Retrying failed files');
    queueRef.current.retryFailed();
    updateQueueState();
  }, [updateQueueState]);

  // Clear completed files from queue display
  const clearCompleted = useCallback(() => {
    if (!queueRef.current) return;
    
    const state = queueRef.current.getState();
    const newFiles = new Map(
      Array.from(state.files.entries()).filter(
        ([_, file]) => file.status !== 'complete'
      )
    );
    
    state.files.clear();
    newFiles.forEach((file, id) => state.files.set(id, file));
    
    updateQueueState();
  }, [updateQueueState]);

  // Calculate progress
  const progress = {
    completed: queueState.completedCount,
    total: queueState.totalCount,
    percentage: queueState.totalCount > 0 
      ? Math.round((queueState.completedCount / queueState.totalCount) * 100)
      : 0,
    errorCount: queueState.errorCount,
  };

  return {
    queueState,
    queuedFiles,
    isProcessing: queueState.isProcessing,
    isPaused: queueState.isPaused,
    progress,
    addFiles,
    start,
    pause,
    resume,
    cancel,
    retryFailed,
    clearCompleted,
  };
}
