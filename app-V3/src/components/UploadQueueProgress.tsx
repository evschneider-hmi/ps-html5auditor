/**
 * Upload Queue Progress Display
 * Shows individual progress bars for each file being processed
 */

import React from 'react';
import type { QueuedFile } from '../utils/uploadQueue';
import { Icon, type IconName } from './Icon';
import './UploadQueueProgress.css';

interface UploadQueueProgressProps {
  files: QueuedFile[];
  isProcessing: boolean;
  isPaused: boolean;
  progress: {
    completed: number;
    total: number;
    percentage: number;
    errorCount: number;
  };
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onClearCompleted: () => void;
}

export function UploadQueueProgress({
  files,
  isProcessing,
  isPaused,
  progress,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  onClearCompleted,
}: UploadQueueProgressProps) {
  if (files.length === 0) return null;

  const processingFiles = files.filter(f => f.status === 'processing' || f.status === 'pending');
  const completedFiles = files.filter(f => f.status === 'complete');
  const errorFiles = files.filter(f => f.status === 'error');
  const showDetails = processingFiles.length > 0 || errorFiles.length > 0;

  return (
    <div className="upload-queue-progress">
      {/* Overall Progress Header */}
      <div className="queue-header">
        <div className="queue-header-left">
          <div className="queue-title">
            {isProcessing && !isPaused && (
              <>
                <Icon name="spinner" className="spinning" />
                <span>Processing {progress.total} file{progress.total !== 1 ? 's' : ''}...</span>
              </>
            )}
            {isPaused && (
              <>
                <Icon name="pause" />
                <span>Paused ({progress.completed}/{progress.total})</span>
              </>
            )}
            {!isProcessing && progress.completed === progress.total && (
              <>
                <Icon name="check-circle" />
                <span>Complete ({progress.completed}/{progress.total})</span>
              </>
            )}
          </div>
          <div className="queue-stats">
            <span className="stat-item">
              <Icon name="check" className="stat-icon success" />
              {progress.completed} completed
            </span>
            {progress.errorCount > 0 && (
              <span className="stat-item">
                <Icon name="x" className="stat-icon error" />
                {progress.errorCount} failed
              </span>
            )}
          </div>
        </div>

        <div className="queue-actions">
          {isProcessing && !isPaused && (
            <button onClick={onPause} className="btn-sm btn-secondary" title="Pause processing">
              <Icon name="pause" />
              Pause
            </button>
          )}
          {isPaused && (
            <button onClick={onResume} className="btn-sm btn-primary" title="Resume processing">
              <Icon name="play" />
              Resume
            </button>
          )}
          {(isProcessing || isPaused) && (
            <button onClick={onCancel} className="btn-sm btn-secondary" title="Cancel all">
              <Icon name="x" />
              Cancel
            </button>
          )}
          {errorFiles.length > 0 && (
            <button onClick={onRetryFailed} className="btn-sm btn-warning" title="Retry failed uploads">
              <Icon name="refresh" />
              Retry Failed
            </button>
          )}
          {completedFiles.length > 0 && processingFiles.length === 0 && (
            <button onClick={onClearCompleted} className="btn-sm btn-secondary" title="Clear completed">
              <Icon name="check" />
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="queue-progress-bar">
        <div 
          className="queue-progress-fill"
          style={{ width: `${progress.percentage}%` }}
        />
        <span className="queue-progress-text">
          {progress.percentage}%
        </span>
      </div>

      {/* Individual File Progress */}
      {showDetails && (
        <div className="queue-files">
          {files.map(file => (
            <FileProgress key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileProgressProps {
  file: QueuedFile;
}

function FileProgress({ file }: FileProgressProps) {
  const { status, progress, message, file: fileData, error } = file;

  // Calculate processing time
  const processingTime = file.startTime && file.endTime 
    ? ((file.endTime - file.startTime) / 1000).toFixed(1) 
    : null;

  const statusIcon: IconName = {
    pending: 'clock',
    processing: 'spinner',
    complete: 'check-circle',
    error: 'alert-circle',
    paused: 'pause',
  }[status] as IconName;

  const statusClass = {
    pending: 'status-pending',
    processing: 'status-processing',
    complete: 'status-complete',
    error: 'status-error',
    paused: 'status-paused',
  }[status];

  return (
    <div className={`file-progress ${statusClass}`}>
      <div className="file-info">
        <Icon 
          name={statusIcon} 
          className={status === 'processing' ? 'spinning' : ''}
        />
        <div className="file-details">
          <div className="file-name">{fileData.name}</div>
          <div className="file-status">
            {status === 'error' && error ? (
              <span className="error-message">{error}</span>
            ) : (
              <span className="status-message">{message}</span>
            )}
            {processingTime && (
              <span className="processing-time">({processingTime}s)</span>
            )}
          </div>
        </div>
      </div>
      
      {(status === 'processing' || status === 'pending') && (
        <div className="file-progress-bar">
          <div 
            className="file-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
