/**
 * useSessionId Hook
 * 
 * React hook for managing shareable session state.
 * Handles:
 * - Session ID generation on upload
 * - URL synchronization
 * - Session persistence
 * - Session loading from URL
 * - Session cleanup
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateSessionId,
  saveSession,
  loadSession,
  getSessionIdFromURL,
  updateURLWithSessionId,
  cleanupExpiredSessions,
  getCurrentSessionId,
  type SessionData,
} from '../utils/sessionStorage';
import type { Upload } from '../types';

interface UseSessionIdResult {
  sessionId: string | null;
  createSession: (uploads: Upload[], selectedUploadId: string | null) => string;
  updateSession: (uploads: Upload[], selectedUploadId: string | null) => void;
  loadSessionFromURL: () => SessionData | null;
  isSessionLoaded: boolean;
}

/**
 * Hook for managing session IDs and shareable URLs
 */
export function useSessionId(): UseSessionIdResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // On mount, check for session in URL or localStorage
  useEffect(() => {
    // Clean up expired sessions on app load
    cleanupExpiredSessions();

    // Check URL for session parameter
    const urlSessionId = getSessionIdFromURL();
    
    if (urlSessionId) {
      // Load session from URL
      const sessionData = loadSession(urlSessionId);
      
      if (sessionData) {
        setSessionId(urlSessionId);
        setIsSessionLoaded(true);
        return;
      }
    }

    // Check for current session in localStorage
    const currentSessionId = getCurrentSessionId();
    
    if (currentSessionId) {
      const sessionData = loadSession(currentSessionId);
      
      if (sessionData) {
        setSessionId(currentSessionId);
        // Update URL to include session ID
        updateURLWithSessionId(currentSessionId);
        setIsSessionLoaded(true);
        return;
      }
    }

    setIsSessionLoaded(false);
  }, []);

  /**
   * Create a new session and update URL
   */
  const createSession = useCallback((uploads: Upload[], selectedUploadId: string | null): string => {
    const newSessionId = generateSessionId();
    
    const saved = saveSession({
      id: newSessionId,
      uploads,
      selectedUploadId,
    });

    if (saved) {
      setSessionId(newSessionId);
      updateURLWithSessionId(newSessionId);
      console.log('✅ Session created:', newSessionId);
    } else {
      console.error('❌ Failed to create session');
    }

    return newSessionId;
  }, []);

  /**
   * Update existing session data
   */
  const updateSession = useCallback((uploads: Upload[], selectedUploadId: string | null): void => {
    if (!sessionId) {
      console.warn('No active session to update');
      return;
    }

    const saved = saveSession({
      id: sessionId,
      uploads,
      selectedUploadId,
    });

    if (saved) {
      console.log('✅ Session updated:', sessionId);
    } else {
      console.error('❌ Failed to update session');
    }
  }, [sessionId]);

  /**
   * Load session data from URL parameter
   */
  const loadSessionFromURL = useCallback((): SessionData | null => {
    const urlSessionId = getSessionIdFromURL();
    
    if (!urlSessionId) {
      return null;
    }

    const sessionData = loadSession(urlSessionId);
    
    if (sessionData) {
      setSessionId(urlSessionId);
      setIsSessionLoaded(true);
      console.log('✅ Session loaded from URL:', urlSessionId);
      return sessionData;
    } else {
      console.warn('❌ Session not found or expired:', urlSessionId);
      return null;
    }
  }, []);

  return {
    sessionId,
    createSession,
    updateSession,
    loadSessionFromURL,
    isSessionLoaded,
  };
}
