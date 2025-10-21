/**
 * Session Storage Utilities
 * 
 * Enables shareable URL functionality by:
 * - Generating unique session IDs
 * - Persisting session data to localStorage
 * - Loading sessions from URL parameters
 * - Managing session expiration (7-day TTL)
 * - Deep linking to specific tabs/checks
 * 
 * Usage:
 * 1. Upload creative → generateSessionId() → update URL
 * 2. Copy URL → Share with team
 * 3. Team opens URL → loadSession() → restore full state
 */

import type { Upload } from '../types';

// Session expiration: 7 days in milliseconds
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

// Storage key prefix for sessions
const SESSION_PREFIX = 'creative-suite-auditor-session-';

// Current session storage key
const CURRENT_SESSION_KEY = 'creative-suite-auditor-current-session';

export interface SessionData {
  id: string;
  uploads: Upload[];
  selectedUploadId: string | null;
  activeTab?: string;
  activeCheckId?: string;
  timestamp: number;
  expiresAt: number;
}

export interface SessionMetadata {
  id: string;
  uploadCount: number;
  timestamp: number;
  expiresAt: number;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  // Use crypto.randomUUID() for secure, unique IDs
  return crypto.randomUUID();
}

/**
 * Custom JSON replacer to handle Uint8Array serialization
 * Converts Uint8Array to {__uint8array: true, length: number, data: number[]}
 */
function serializeUint8Arrays(key: string, value: any): any {
  if (value instanceof Uint8Array) {
    // Store minimal data: just convert to array for serialization
    // We'll store the length separately for file size calculations
    return {
      __uint8array: true,
      length: value.length,
      data: Array.from(value),
    };
  }
  return value;
}

/**
 * Custom JSON reviver to restore Uint8Array from serialized format
 */
function deserializeUint8Arrays(key: string, value: any): any {
  if (value && typeof value === 'object' && value.__uint8array === true) {
    return new Uint8Array(value.data);
  }
  return value;
}

/**
 * Save session data to localStorage with TTL
 */
export function saveSession(data: Omit<SessionData, 'timestamp' | 'expiresAt'>): boolean {
  try {
    const now = Date.now();
    const sessionData: SessionData = {
      ...data,
      timestamp: now,
      expiresAt: now + SESSION_TTL,
    };

    const key = `${SESSION_PREFIX}${data.id}`;
    localStorage.setItem(key, JSON.stringify(sessionData, serializeUint8Arrays));
    
    // Also save as current session
    localStorage.setItem(CURRENT_SESSION_KEY, data.id);
    
    return true;
  } catch (error) {
    console.error('Failed to save session:', error);
    return false;
  }
}

/**
 * Load session data from localStorage
 */
export function loadSession(sessionId: string): SessionData | null {
  try {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      return null;
    }

    const sessionData: SessionData = JSON.parse(stored, deserializeUint8Arrays);
    
    // Check if session has expired
    if (Date.now() > sessionData.expiresAt) {
      // Clean up expired session
      deleteSession(sessionId);
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

/**
 * Delete a specific session
 */
export function deleteSession(sessionId: string): boolean {
  try {
    const key = `${SESSION_PREFIX}${sessionId}`;
    localStorage.removeItem(key);
    
    // If this was the current session, clear that too
    const currentSession = localStorage.getItem(CURRENT_SESSION_KEY);
    if (currentSession === sessionId) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Get the current session ID
 */
export function getCurrentSessionId(): string | null {
  try {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * List all available sessions with metadata
 */
export function listSessions(): SessionMetadata[] {
  const sessions: SessionMetadata[] = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith(SESSION_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data: SessionData = JSON.parse(stored, deserializeUint8Arrays);
            
            // Skip expired sessions
            if (Date.now() > data.expiresAt) {
              continue;
            }
            
            sessions.push({
              id: data.id,
              uploadCount: data.uploads.length,
              timestamp: data.timestamp,
              expiresAt: data.expiresAt,
            });
          } catch {
            // Skip invalid session data
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to list sessions:', error);
  }
  
  // Sort by timestamp (newest first)
  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  let cleanedCount = 0;
  
  try {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith(SESSION_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data: SessionData = JSON.parse(stored, deserializeUint8Arrays);
            
            if (now > data.expiresAt) {
              keysToDelete.push(key);
            }
          } catch {
            // If we can't parse it, delete it
            keysToDelete.push(key);
          }
        }
      }
    }
    
    // Delete expired sessions
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
      cleanedCount++;
    }
    
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
  
  return cleanedCount;
}

/**
 * Get session ID from URL query parameter
 */
export function getSessionIdFromURL(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
  } catch {
    return null;
  }
}

/**
 * Update URL with session ID (without page reload)
 */
export function updateURLWithSessionId(sessionId: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url.toString());
  } catch (error) {
    console.error('Failed to update URL:', error);
  }
}

/**
 * Get deep link parameters from URL (tab, check)
 */
export function getDeepLinkParams(): { tab?: string; checkId?: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      tab: params.get('tab') || undefined,
      checkId: params.get('check') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Update URL with deep link parameters
 */
export function updateDeepLinkParams(params: { tab?: string; checkId?: string }): void {
  try {
    const url = new URL(window.location.href);
    
    if (params.tab) {
      url.searchParams.set('tab', params.tab);
    } else {
      url.searchParams.delete('tab');
    }
    
    if (params.checkId) {
      url.searchParams.set('check', params.checkId);
    } else {
      url.searchParams.delete('check');
    }
    
    window.history.replaceState({}, '', url.toString());
  } catch (error) {
    console.error('Failed to update deep link params:', error);
  }
}

/**
 * Generate a shareable URL for the current session
 */
export function generateShareableURL(sessionId: string, params?: { tab?: string; checkId?: string }): string {
  try {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('session', sessionId);
    
    if (params?.tab) {
      url.searchParams.set('tab', params.tab);
    }
    
    if (params?.checkId) {
      url.searchParams.set('check', params.checkId);
    }
    
    return url.toString();
  } catch (error) {
    console.error('Failed to generate shareable URL:', error);
    return window.location.href;
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
}
