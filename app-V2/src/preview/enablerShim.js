(() => {
  'use strict';

  const context = window.__CM360_CONTEXT__ || {};
  const bundleId = context.bundleId || '';

  const postToParent = (type, payload) => {
    try {
      window.parent?.postMessage(
        Object.assign({ type, bundleId }, payload || {}),
        '*',
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('CM360 shim postMessage failed', error);
    }
  };

  const reportClick = (url, meta) => {
    const detail = Object.assign({
      present: typeof url === 'string' && url.length > 0,
      source: 'unknown',
    }, meta || {});
    postToParent('creative-click', {
      url: typeof url === 'string' ? url : '',
      meta: detail,
    });
  };

  const ensureClickTagHook = () => {
    let value = typeof window.clickTag === 'string' ? window.clickTag : '';
    try {
      Object.defineProperty(window, 'clickTag', {
        configurable: true,
        enumerable: true,
        get() {
          return value;
        },
        set(next) {
          value = typeof next === 'string' ? next : '';
          // Don't automatically send creative-click when clickTag is set
          // Only send when user actually clicks
        },
      });
    } catch {
      // Some creatives seal the descriptor; fall back to assignment
      try {
        window.clickTag = value;
      } catch {}
    }
    // Don't automatically send creative-click on initial value
  };

  const attachAnchorTracking = () => {
    try {
      if (!document || !document.addEventListener) return;
      document.addEventListener(
        'click',
        (event) => {
          // Only track real user clicks, not programmatic ones
          if (!event || !event.isTrusted) return;
          const target = event?.target;
          if (!target) return;
          const el = (typeof target.closest === 'function'
            ? target.closest('a[href]')
            : null);
          if (el && typeof el.href === 'string' && el.href) {
            reportClick(el.href, { source: 'dom' });
          }
        },
        { capture: true },
      );
    } catch {}
  };

  const createShim = () => {
    const listeners = new Map();
    const emit = (type, detail) => {
      const list = listeners.get(type);
      if (!list) return;
      for (const fn of list) {
        try {
          fn(detail);
        } catch {}
      }
    };

    let initialized = true;

    const shim = {
      isVisible: () => true,
      isInitialized: () => initialized,
      initialize: () => {
        initialized = true;
        emit('init', {});
      },
      addEventListener: (type, cb) => {
        if (!type || typeof cb !== 'function') return;
        const key = String(type).toLowerCase();
        const list = listeners.get(key) || [];
        list.push(cb);
        listeners.set(key, list);
      },
      removeEventListener: (type, cb) => {
        const key = String(type || '').toLowerCase();
        const list = listeners.get(key);
        if (!list) return;
        const idx = list.indexOf(cb);
        if (idx >= 0) list.splice(idx, 1);
        listeners.set(key, list);
      },
      dispatchEvent: (type, detail) => emit(type, detail),
      exit: (label, url) => {
        const href = typeof url === 'string' && url ? url : (window.clickTag || '');
        reportClick(href, { source: 'shim' });
        if (href) {
          try {
            window.open(href, '_blank');
          } catch {}
        }
      },
      exitOverride: (label, url) => shim.exit(label, url),
      getUrl: (path) => {
        // Support CM360 Enabler.getUrl() for dynamic asset loading
        if (!path) return window.clickTag || '';
        
        // If this is a clickTag request (no path), return clickTag
        if (typeof path === 'string' && /^clickTag\d*$/i.test(path)) {
          return window.clickTag || '';
        }
        
        // Try to resolve from the blob map injected by the preview system
        const blobMap = window.__CM360_BLOB_MAP__;
        const baseDir = window.__CM360_BASE_DIR__ || '';
        
        console.log('[Enabler.getUrl] === CALLED ===');
        console.log('[Enabler.getUrl] path:', path);
        console.log('[Enabler.getUrl] baseDir:', baseDir);
        console.log('[Enabler.getUrl] blobMap exists:', !!blobMap);
        
        if (blobMap && typeof blobMap.get === 'function') {
          console.log('[Enabler.getUrl] blobMap size:', blobMap.size);
          
          // Normalize the path - remove leading './' and convert backslashes
          let normalized = String(path).replace(/\\/g, '/').replace(/^\.\//, '');
          console.log('[Enabler.getUrl] normalized:', normalized);
          
          // Try exact match first
          let blobUrl = blobMap.get(normalized);
          if (blobUrl) {
            console.log('[Enabler.getUrl] ✓ RESOLVED (exact):', path, '->', blobUrl.substring(0, 60) + '...');
            return blobUrl;
          }
          
          // Try with base directory prepended
          if (baseDir) {
            const withBase = (baseDir + '/' + normalized).replace(/\/\//g, '/').replace(/^\//, '');
            console.log('[Enabler.getUrl] Trying withBase:', withBase);
            blobUrl = blobMap.get(withBase);
            if (blobUrl) {
              console.log('[Enabler.getUrl] ✓ RESOLVED (withBase):', path, '->', blobUrl.substring(0, 60) + '...');
              return blobUrl;
            }
          }
          
          // Try all possible variations
          const variations = [
            normalized,
            baseDir + '/' + normalized,
            baseDir + normalized,
            '/' + baseDir + '/' + normalized,
          ].map(v => v.replace(/\/\//g, '/').replace(/^\//, ''));
          
          console.log('[Enabler.getUrl] Trying variations:', variations);
          for (const variant of variations) {
            blobUrl = blobMap.get(variant);
            if (blobUrl) {
              console.log('[Enabler.getUrl] ✓ RESOLVED (variant):', path, '(as', variant, ') ->', blobUrl.substring(0, 60) + '...');
              return blobUrl;
            }
          }
          
          // Log available keys for debugging
          console.error('[Enabler.getUrl] ✗✗✗ FAILED TO RESOLVE:', path);
          console.error('[Enabler.getUrl] Available keys:', Array.from(blobMap.keys()));
        } else {
          console.error('[Enabler.getUrl] ✗ NO BLOB MAP');
        }
        
        // Fallback: return the original path (will likely fail, but better than nothing)
        console.warn('[Enabler.getUrl] Fallback: returning original path:', path);
        return path;
      },
    };

    try {
      Object.defineProperty(window, 'Enabler', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: shim,
      });
    } catch {
      window.Enabler = shim;
    }
    return shim;
  };

  const wrapExisting = (enabler) => {
    const wrap = (key) => {
      const original = typeof enabler[key] === 'function' ? enabler[key].bind(enabler) : null;
      enabler[key] = function wrapped(label, url, ...rest) {
        const href = typeof url === 'string' && url ? url : (window.clickTag || '');
        reportClick(href, { source: 'creative' });
        if (original) {
          try {
            return original(label, url, ...rest);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Enabler shim wrapper error', error);
          }
        }
        if (href) {
          try {
            window.open(href, '_blank');
          } catch {}
        }
        return undefined;
      };
    };
    wrap('exit');
    wrap('exitOverride');
    return 'cdn';
  };

  ensureClickTagHook();
  attachAnchorTracking();

  const existing = window.Enabler;
  let source = 'unknown';
  if (existing && typeof existing.exit === 'function') {
    source = wrapExisting(existing);
  } else {
    createShim();
    source = 'shim';
  }

  postToParent('CM360_ENABLER_STATUS', { source });
  
  // Initialize tracking states
  if (!window.__audit_last_summary) {
    window.__audit_last_summary = {};
  }
  window.__audit_last_summary.cpuTracking = 'pending';
  window.__audit_last_summary.longTasksMs = 0; // Initialize to 0 (will accumulate long tasks)
  window.__audit_last_summary.animationTracking = window.__audit_last_summary.animationTracking || 'pending';
  
  // Helper to notify parent of CPU tracking state
  function notifyCpuTracking() {
    try {
      parent.postMessage({
        __audit_event: 1,
        type: 'tracking-update',
        cpuTracking: window.__audit_last_summary.cpuTracking,
        longTasksMs: window.__audit_last_summary.longTasksMs
      }, '*');
    } catch(e) {}
  }
  
  // Notify parent immediately that CPU tracking is pending
  notifyCpuTracking();
  
  // Start CPU tracking (Long Tasks API)
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const types = PerformanceObserver.supportedEntryTypes;
      if (Array.isArray(types) && types.includes('longtask')) {
        let totalLongTaskMs = 0;
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration >= 50) {
              totalLongTaskMs += entry.duration;
              window.__audit_last_summary.longTasksMs = totalLongTaskMs;
            }
          }
        });
        obs.observe({ entryTypes: ['longtask'] });
        
        // Finalize CPU tracking after 3 seconds
        setTimeout(() => {
          window.__audit_last_summary.cpuTracking = 'complete';
          notifyCpuTracking();
          obs.disconnect();
        }, 3000);
      } else {
        window.__audit_last_summary.cpuTracking = 'unsupported';
        notifyCpuTracking();
      }
    } else {
      window.__audit_last_summary.cpuTracking = 'unsupported';
      notifyCpuTracking();
    }
  } catch (error) {
    console.warn('CM360: CPU tracking failed', error);
    window.__audit_last_summary.cpuTracking = 'error';
    notifyCpuTracking();
  }
})();
