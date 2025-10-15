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
          if (value) reportClick(value, { source: 'clickTag' });
        },
      });
    } catch {
      // Some creatives seal the descriptor; fall back to assignment
      try {
        window.clickTag = value;
      } catch {}
    }
    if (value) reportClick(value, { source: 'clickTag' });
  };

  const attachAnchorTracking = () => {
    try {
      if (!document || !document.addEventListener) return;
      document.addEventListener(
        'click',
        (event) => {
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
      getUrl: () => window.clickTag || '',
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
})();
