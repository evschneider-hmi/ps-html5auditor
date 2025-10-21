/* eslint-disable no-restricted-globals */
/**
 * Service Worker for V3 Preview System
 * Intercepts fetch requests and serves creative assets from memory
 * Based on V2's sw.js implementation
 */
(() => {
  'use strict';

  const state = {
    baseDir: '',
    indexPath: '',
    entries: new Map(),
    notedMisses: new Set(),
  };

  const scopeUrl = new URL(self.registration.scope);

  const normalizePath = (input) => {
    if (!input) return '';
    let value = String(input);
    const hashIndex = value.indexOf('#');
    if (hashIndex >= 0) value = value.slice(0, hashIndex);
    const queryIndex = value.indexOf('?');
    if (queryIndex >= 0) value = value.slice(0, queryIndex);
    value = value.replace(/\\/g, '/');
    value = value.replace(/^\/+/, '');
    value = value.replace(/\/\/+/, '/');
    // Remove ./ segments
    value = value.replace(/(^|\/)\.\/(?!$)/g, '$1');
    // Resolve ../ segments conservatively
    const parts = [];
    value.split('/').forEach((part) => {
      if (part === '.' || part === '') return;
      if (part === '..') {
        if (parts.length) parts.pop();
      } else {
        parts.push(part);
      }
    });
    return parts.join('/');
  };

  const ensureTrailingSlash = (value) => {
    if (!value) return '';
    return value.endsWith('/') ? value : `${value}/`;
  };

  const joinPaths = (a, b) => {
    if (!a) return normalizePath(b);
    if (!b) return normalizePath(a);
    return normalizePath(`${ensureTrailingSlash(a)}${b}`);
  };

  const distinct = (arr) => {
    const seen = new Set();
    const next = [];
    for (const item of arr) {
      if (!item) continue;
      if (seen.has(item)) continue;
      seen.add(item);
      next.push(item);
    }
    return next;
  };

  const noteMiss = async (url) => {
    if (!url || state.notedMisses.has(url)) return;
    state.notedMisses.add(url);
    try {
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });
      for (const client of clients) {
        client.postMessage({ type: 'V3_SW_FETCH_MISS', url });
      }
    } catch (error) {
      console.warn('[V3 SW] noteMiss failed', error);
    }
  };

  self.addEventListener('install', (event) => {
    console.log('[V3 SW] Installing, will skip waiting');
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    console.log('[V3 SW] Activating, claiming clients');
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('message', (event) => {
    const data = event.data;
    console.log('[V3 SW] Received message:', data?.type, '| entries:', data?.entries?.length || 0);
    if (!data || typeof data !== 'object') return;
    
    if (data.type === 'V3_BUNDLE_ENTRIES') {
      const entries = new Map();
      if (Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          if (!entry || !entry.path || !entry.buffer) continue;
          const normalized = normalizePath(entry.path);
          if (!normalized) continue;
          entries.set(normalized, {
            buffer: entry.buffer,
            type: entry.contentType || 'application/octet-stream',
          });
        }
      }
      state.baseDir = ensureTrailingSlash(normalizePath(data.baseDir || ''));
      state.indexPath = normalizePath(data.indexPath || 'index.html');
      state.entries = entries;
      state.notedMisses = new Set();
      
      console.log('[V3 SW] Stored entries:', entries.size, 'baseDir:', state.baseDir, 'indexPath:', state.indexPath);
      
      // Acknowledge that entries have been stored
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        console.log('[V3 SW] Found clients:', clients.length);
        clients.forEach((client) => {
          console.log('[V3 SW] Posting acknowledgment to client:', client.url);
          client.postMessage({
            type: 'V3_ENTRIES_STORED',
            count: entries.size,
          });
        });
      }).catch((error) => {
        console.error('[V3 SW] clients.matchAll failed:', error);
      });
    }
  });

  self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Only intercept requests within our scope
    if (!requestUrl.href.startsWith(scopeUrl.href)) return;

    event.respondWith(
      (async () => {
        // Extract relative path from the scope
        const relativePath = (() => {
          let path = requestUrl.pathname.slice(scopeUrl.pathname.length);
          if (path.startsWith('/')) path = path.slice(1);
          return path;
        })();

        const normalized = normalizePath(relativePath);
        
        // Try multiple path candidates
        const candidates = distinct([
          normalized,
          joinPaths(state.baseDir, normalized),
          normalized.endsWith('') ? joinPaths(normalized, 'index.html') : '',
          state.baseDir ? joinPaths(state.baseDir, joinPaths(normalized, 'index.html')) : '',
          state.indexPath,
        ]);

        console.log('[V3 SW] Fetch:', requestUrl.pathname, '| candidates:', candidates);

        // Look for matching entry
        for (const candidate of candidates) {
          if (!candidate) continue;
          const entry = state.entries.get(candidate);
          if (entry) {
            console.log('[V3 SW] Serving:', candidate, '| type:', entry.type);
            return new Response(entry.buffer.slice(0), {
              status: 200,
              headers: {
                'Content-Type': entry.type,
                'Cache-Control': 'no-store',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }
        }

        console.warn('[V3 SW] Not found:', requestUrl.pathname, '| tried:', candidates);
        await noteMiss(requestUrl.href);
        return new Response('Not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })(),
    );
  });
})();
