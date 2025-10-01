import { createInAppShim, type AdTagEnvironment } from './environment';

export type { AdTagEnvironment } from './environment';

export interface AdTagDocumentOptions {
  environment?: AdTagEnvironment;
}

export function sanitizeScriptTagSpelling(input: string): string {
  return input
    .replace(/<\s*scr\+ipt/gi, '<script')
    .replace(/<\s*\/\s*scr\+ipt\s*>/gi, '</script>');
}

export function normalizeAdTagMarkup(raw: string): string {
  if (!raw) return '';
  const cleaned = sanitizeScriptTagSpelling(raw);
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return cleaned;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${cleaned}</body>`, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));
    scripts.forEach((node) => {
      const type = (node.getAttribute('type') || '').toLowerCase();
      if (type === 'text/adtag') {
        const template = doc.createElement('template');
        template.innerHTML = node.textContent || '';
        node.replaceWith(template.content.cloneNode(true));
      }
    });
    return doc.body.innerHTML;
  } catch (err) {
    console.warn('tag normalization failed', err);
    return cleaned;
  }
}

function escapeForInlineScript(source: string): string {
  return source.replace(/<\//g, '<\\/');
}

const baseProbe = String.raw`(() => {
  try {
    const post = (payload) => parent.postMessage({ __tag_test: 1, ...payload }, '*');
    const logError = (value) => post({ kind: 'error', text: typeof value === 'string' ? value : String(value) });
    const track = (event, url, meta) => post({
      kind: 'network',
      event,
      url: url ? String(url) : '',
      meta: meta || null,
      ts: Date.now(),
    });

    const previousOnError = window.onerror;
    window.onerror = function errorReporter(msg, source, line, col) {
      const safeLine = typeof line === 'number' ? line : 0;
      const safeCol = typeof col === 'number' ? col : 0;
      const detail = source
        ? msg + ' [' + source + ':' + safeLine + ':' + safeCol + ']'
        : String(msg);
      logError(detail);
      if (previousOnError) {
        try {
          return previousOnError.apply(this, arguments);
        } catch (err) {
          logError(err);
        }
      }
      return false;
    };

    const patchFetch = () => {
      if (typeof window.fetch !== 'function') return;
      const originalFetch = window.fetch.bind(window);
      window.fetch = function patchedFetch() {
        const args = Array.prototype.slice.call(arguments);
        const request = args[0];
        let url = '';
        if (typeof request === 'string') {
          url = request;
        } else if (request && typeof request === 'object') {
          url = request.url || request.href || '';
        }
        track('fetch', url);
        return originalFetch.apply(this, args).then(
          (response) => {
            track('fetch-complete', url, { status: response.status });
            return response;
          },
          (error) => {
            track('fetch-error', url, { message: error && error.message });
            throw error;
          }
        );
      };
    };

    const patchXhr = () => {
      if (typeof window.XMLHttpRequest !== 'function') return;
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
        this.__tag_method = method;
        this.__tag_url = url;
        return open.apply(this, arguments);
      };
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function patchedSend(body) {
        const url = this.__tag_url || '';
        const method = this.__tag_method || 'GET';
        track('xhr', url, { method: method });
        this.addEventListener('load', () => track('xhr-complete', url, { status: this.status }));
        this.addEventListener('error', () => track('xhr-error', url));
        this.addEventListener('abort', () => track('xhr-abort', url));
        return send.apply(this, arguments);
      };
    };

    const interceptSrcProperty = (ctor, kind) => {
      if (!ctor || !ctor.prototype) return;
      const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, 'src');
      if (!descriptor || typeof descriptor.set !== 'function') return;
      Object.defineProperty(ctor.prototype, 'src', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get ? function get() { return descriptor.get.call(this); } : undefined,
        set: function set(value) {
          track(kind, value);
          return descriptor.set.apply(this, arguments);
        },
      });
    };

    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function patchedSetAttribute(name, value) {
      if (name && typeof name === 'string') {
        const lowered = name.toLowerCase();
        if (lowered === 'src' || lowered === 'data-src') {
          const tag = this.tagName ? this.tagName.toLowerCase() : '';
          if (tag === 'img') track('pixel', value, { attr: lowered });
          if (tag === 'script') track('script', value, { attr: lowered });
          if (tag === 'iframe') track('iframe', value, { attr: lowered });
        }
      }
      return originalSetAttribute.apply(this, arguments);
    };

    const observeAttributes = () => {
      if (typeof MutationObserver !== 'function') return;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type !== 'attributes' || !mutation.attributeName) return;
          const name = mutation.attributeName.toLowerCase();
          if (name !== 'src' && name !== 'data-src') return;
          const target = mutation.target;
          if (!target || !target.tagName) return;
          const value = target.getAttribute(mutation.attributeName);
          if (!value) return;
          const tag = target.tagName.toLowerCase();
          if (tag === 'img') track('pixel', value, { attr: name, mutation: true });
          if (tag === 'script') track('script', value, { attr: name, mutation: true });
          if (tag === 'iframe') track('iframe', value, { attr: name, mutation: true });
        });
      });
      observer.observe(document.documentElement, { attributes: true, subtree: true });
    };

    const patchBeacon = () => {
      if (!navigator || typeof navigator.sendBeacon !== 'function') return;
      const original = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function patchedBeacon(url, data) {
        track('beacon', url);
        return original(url, data);
      };
    };

    const patchWindowOpen = () => {
      if (typeof window.open !== 'function') return;
      const original = window.open;
      window.open = function patchedOpen(url) {
        if (url) track('popup', url);
        return original.apply(this, arguments);
      };
    };

    const scanExisting = () => {
      try {
        Array.from(document.querySelectorAll('img[src]')).forEach((node) => track('pixel', node.currentSrc || node.src, { initial: true }));
        Array.from(document.querySelectorAll('script[src]')).forEach((node) => track('script', node.src, { initial: true }));
        Array.from(document.querySelectorAll('iframe[src]')).forEach((node) => track('iframe', node.src, { initial: true }));
      } catch (err) {
        logError(err);
      }
    };

    interceptSrcProperty(window.HTMLImageElement, 'pixel');
    interceptSrcProperty(window.HTMLScriptElement, 'script');
    interceptSrcProperty(window.HTMLIFrameElement, 'iframe');
    patchFetch();
    patchXhr();
    patchBeacon();
    patchWindowOpen();
    observeAttributes();

    document.addEventListener('DOMContentLoaded', () => {
      try {
        const hasClickTag =
          typeof window.clickTag === 'string' || typeof window.clickTAG === 'string';
        post({ kind: 'info', text: 'clickTag present: ' + hasClickTag });
      } catch (err) {
        logError('clickTag probe failed: ' + (err && err.message ? err.message : err));
      }
      scanExisting();
    });

    setTimeout(scanExisting, 150);
  } catch (err) {
    parent.postMessage({ __tag_test: 1, kind: 'error', text: String(err) }, '*');
  }
})();`;

export function buildAdTagDocument(raw: string, options?: AdTagDocumentOptions): string {
  const bodyMarkup = normalizeAdTagMarkup(raw);
  const scripts: string[] = [];
  const envScript = createInAppShim(options?.environment);
  if (envScript) scripts.push(escapeForInlineScript(envScript));
  scripts.push(escapeForInlineScript(baseProbe));
  const scriptTags = scripts.map((code) => `<script>${code}</script>`).join('');
  const body = bodyMarkup || '<div style="padding:24px;font-family:sans-serif;color:#374151;">Tag preview will display here after running.</div>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title><style>body{margin:0;background:#fff;}</style>${scriptTags}</head><body>${body}</body></html>`;
}
