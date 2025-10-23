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
        },
      });
    } catch {
      try {
        window.clickTag = value;
      } catch {}
    }
  };

  const attachAnchorTracking = () => {
    try {
      if (!document || !document.addEventListener) return;
      document.addEventListener(
        'click',
        (event) => {
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
        
        // If this is a clickTag request, return clickTag
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
          
          // Normalize the path
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
          
          console.error('[Enabler.getUrl] ✗✗✗ FAILED TO RESOLVE:', path);
          console.error('[Enabler.getUrl] Available keys:', Array.from(blobMap.keys()));
        } else {
          console.error('[Enabler.getUrl] ✗ NO BLOB MAP');
        }
        
        // Fallback: return the original path
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
      try {
        window.Enabler = shim;
      } catch {}
    }

    return shim;
  };

  const studio = {
    common: {
      Environment: {
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    },
    events: {
      StudioEvent: {
        INIT: 'init',
        VISIBLE: 'visible',
        HIDDEN: 'hidden',
        EXIT: 'exit',
      },
    },
    Enabler: createShim(),
  };

  try {
    Object.defineProperty(window, 'studio', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: studio,
    });
  } catch {
    try {
      window.studio = studio;
    } catch {}
  }

  ensureClickTagHook();
  attachAnchorTracking();

  // CRITICAL: Hijack Image constructor AND document.createElement to intercept all image loading
  // This is necessary for creatives that use CreateJS or other frameworks
  // that load images directly without using Enabler.getUrl()
  const hijackImageLoading = () => {
    const blobMap = window.__CM360_BLOB_MAP__;
    const baseDir = window.__CM360_BASE_DIR__ || '';
    
    console.log('[Enabler Shim] Starting image loading hijack...');
    console.log('[Enabler Shim] Blob map available:', !!blobMap);
    console.log('[Enabler Shim] Base dir:', baseDir);
    
    // Helper function to resolve a path through blob map
    const resolvePath = (path) => {
      if (!path || typeof path !== 'string') return path;
      
      // Skip blob URLs and data URLs
      if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:')) {
        return path;
      }
      
      // Try to resolve from blob map
      if (blobMap && typeof blobMap.get === 'function') {
        let normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
        
        // Try exact match
        let blobUrl = blobMap.get(normalized);
        if (blobUrl) {
          console.log('[Enabler Shim] ✓ RESOLVED (exact):', path, '->', blobUrl.substring(0, 60) + '...');
          return blobUrl;
        }
        
        // Try with base directory
        if (baseDir) {
          const withBase = (baseDir + '/' + normalized).replace(/\/\//g, '/').replace(/^\//, '');
          blobUrl = blobMap.get(withBase);
          if (blobUrl) {
            console.log('[Enabler Shim] ✓ RESOLVED (withBase):', path, '->', blobUrl.substring(0, 60) + '...');
            return blobUrl;
          }
        }
        
        // Try all variations
        const variations = [
          normalized,
          baseDir + '/' + normalized,
          baseDir + normalized,
          '/' + baseDir + '/' + normalized,
        ].map(v => v.replace(/\/\//g, '/').replace(/^\//, ''));
        
        for (const variant of variations) {
          blobUrl = blobMap.get(variant);
          if (blobUrl) {
            console.log('[Enabler Shim] ✓ RESOLVED (variant):', path, '(as', variant, ') ->', blobUrl.substring(0, 60) + '...');
            return blobUrl;
          }
        }
        
        console.error('[Enabler Shim] ✗ FAILED TO RESOLVE:', path);
        console.error('[Enabler Shim] Available keys:', Array.from(blobMap.keys()));
      }
      
      // Fallback: use original path
      console.warn('[Enabler Shim] Fallback: using original path:', path);
      return path;
    };
    
    // 1. Hijack Image constructor
    const OriginalImage = window.Image;
    
    function ResolvedImage() {
      const img = new OriginalImage();
      
      // Hijack src setter
      const descriptor = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'src') || 
                         Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      
      if (descriptor && descriptor.set) {
        const originalSetter = descriptor.set;
        
        Object.defineProperty(img, 'src', {
          configurable: true,
          enumerable: true,
          get: descriptor.get,
          set: function(path) {
            console.log('[Image Hijack] new Image().src =', path);
            const resolved = resolvePath(path);
            return originalSetter.call(this, resolved);
          }
        });
      }
      
      return img;
    }
    
    // Copy static properties
    for (const prop in OriginalImage) {
      if (OriginalImage.hasOwnProperty(prop)) {
        ResolvedImage[prop] = OriginalImage[prop];
      }
    }
    
    // Set up prototype chain
    ResolvedImage.prototype = OriginalImage.prototype;
    
    try {
      window.Image = ResolvedImage;
      console.log('[Enabler Shim] ✓ Image constructor hijacked');
    } catch (e) {
      console.error('[Enabler Shim] Failed to hijack Image constructor:', e);
    }
    
    // 2. Hijack document.createElement for 'img' elements
    const originalCreateElement = document.createElement.bind(document);
    
    document.createElement = function(tagName, options) {
      const element = originalCreateElement(tagName, options);
      
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'img') {
        console.log('[createElement Hijack] Creating IMG element');
        
        // Hijack src attribute
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (descriptor && descriptor.set) {
          const originalSetter = descriptor.set;
          
          Object.defineProperty(element, 'src', {
            configurable: true,
            enumerable: true,
            get: descriptor.get,
            set: function(path) {
              console.log('[createElement Hijack] img.src =', path);
              const resolved = resolvePath(path);
              return originalSetter.call(this, resolved);
            }
          });
        }
      }
      
      return element;
    };
    
    console.log('[Enabler Shim] ✓ document.createElement hijacked');
  };
  
  // Wait for blob map to be injected before hijacking Image
  if (window.__CM360_BLOB_MAP__) {
    hijackImageLoading();
  } else {
    // Watch for blob map injection
    const checkInterval = setInterval(() => {
      if (window.__CM360_BLOB_MAP__) {
        clearInterval(checkInterval);
        hijackImageLoading();
      }
    }, 10);
    
    // Give up after 1 second
    setTimeout(() => clearInterval(checkInterval), 1000);
  }

  postToParent('enabler-ready', {
    source: 'shim',
    timestamp: Date.now(),
  });
})();
