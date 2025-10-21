/**
 * useIframeMessaging Hook
 * 
 * Handles postMessage communication with the preview iframe.
 * Sets up message listeners and provides type-safe message sending.
 * 
 * Why This Matters:
 * - Preview iframe needs to send runtime diagnostics back to parent
 * - Click URL detection happens in iframe, needs to be reported
 * - Type-safe messaging prevents communication errors
 * - Proper cleanup prevents memory leaks
 * 
 * Usage:
 * ```typescript
 * const { sendMessage, addListener, removeListener } = useIframeMessaging(iframeRef);
 * 
 * // Listen for messages
 * useEffect(() => {
 *   const handler = (data) => console.log(data);
 *   addListener('tracking-update', handler);
 *   return () => removeListener('tracking-update', handler);
 * }, []);
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';
import type { PreviewMessage, PreviewMessageType } from '../types';

export interface IframeMessagingOptions {
  /** Expected bundle ID for message validation */
  bundleId?: string;
  
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseIframeMessagingReturn {
  /** Send a message to the iframe */
  sendMessage: (type: PreviewMessageType, data?: any) => void;
  
  /** Add a message listener */
  addListener: (type: PreviewMessageType, handler: (data: any) => void) => void;
  
  /** Remove a message listener */
  removeListener: (type: PreviewMessageType, handler: (data: any) => void) => void;
}

/**
 * Hook for managing iframe postMessage communication
 */
export function useIframeMessaging(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  options: IframeMessagingOptions = {}
): UseIframeMessagingReturn {
  const { bundleId, debug = false } = options;
  const listenersRef = useRef<Map<PreviewMessageType, Set<(data: any) => void>>>(new Map());
  
  /**
   * Send a message to the iframe
   */
  const sendMessage = useCallback((type: PreviewMessageType, data?: any) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      if (debug) console.warn('[iframe-messaging] Cannot send message: iframe not ready');
      return;
    }
    
    const message: PreviewMessage = {
      type,
      bundleId,
      data,
    };
    
    try {
      iframe.contentWindow.postMessage(message, '*');
      if (debug) console.log('[iframe-messaging] Sent:', message);
    } catch (err) {
      console.error('[iframe-messaging] Failed to send message:', err);
    }
  }, [iframeRef, bundleId, debug]);
  
  /**
   * Add a message listener
   */
  const addListener = useCallback((type: PreviewMessageType, handler: (data: any) => void) => {
    const listeners = listenersRef.current.get(type) || new Set();
    listeners.add(handler);
    listenersRef.current.set(type, listeners);
    
    if (debug) console.log(`[iframe-messaging] Added listener for ${type}`);
  }, [debug]);
  
  /**
   * Remove a message listener
   */
  const removeListener = useCallback((type: PreviewMessageType, handler: (data: any) => void) => {
    const listeners = listenersRef.current.get(type);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        listenersRef.current.delete(type);
      }
    }
    
    if (debug) console.log(`[iframe-messaging] Removed listener for ${type}`);
  }, [debug]);
  
  /**
   * Handle incoming messages from iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate message structure
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      
      const message = event.data as PreviewMessage;
      
      // Validate bundle ID if specified
      if (bundleId && message.bundleId && message.bundleId !== bundleId) {
        if (debug) console.warn('[iframe-messaging] Bundle ID mismatch, ignoring');
        return;
      }
      
      // Call registered listeners
      const listeners = listenersRef.current.get(message.type);
      if (listeners) {
        listeners.forEach(handler => {
          try {
            handler(message.data);
            if (debug) console.log(`[iframe-messaging] Handled ${message.type}:`, message.data);
          } catch (err) {
            console.error(`[iframe-messaging] Error in ${message.type} handler:`, err);
          }
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [bundleId, debug]);
  
  return {
    sendMessage,
    addListener,
    removeListener,
  };
}
