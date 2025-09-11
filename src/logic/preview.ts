import { ZipBundle } from './types';

interface PreviewResult {
  html: string; // rewritten HTML for iframe srcdoc
  blobMap: Record<string, string>; // original path -> blob url
  originalHtml: string;
}

export async function buildPreview(bundle: ZipBundle, primaryPath: string): Promise<PreviewResult> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const blobMap: Record<string, string> = {};
  function ensureBlob(path: string): string {
    if (blobMap[path]) return blobMap[path];
    const bytes = bundle.files[path];
  const arrBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrBuf]);
    const url = URL.createObjectURL(blob);
    blobMap[path] = url;
    return url;
  }
  // create blobs for all files upfront
  for (const path of Object.keys(bundle.files)) ensureBlob(path);

  const originalHtml = decoder.decode(bundle.files[primaryPath]);
  const doc = new DOMParser().parseFromString(originalHtml, 'text/html');

  // rewrite src/href attributes
  const attrTargets = [
    ['img', 'src'],
    ['script', 'src'],
    ['link', 'href'],
    ['video', 'src'],
    ['audio', 'src'],
    ['source', 'src']
  ] as const;
  for (const [tag, attr] of attrTargets) {
    doc.querySelectorAll(`${tag}[${attr}]`).forEach(el => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const local = resolveLocal(primaryPath, val);
      if (local && bundle.files[local]) {
        el.setAttribute(attr, blobMap[local]);
      }
    });
  }
  // inline style url(...) rewrites
  doc.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style');
    if (!style) return;
    el.setAttribute('style', rewriteCss(style, primaryPath, bundle, blobMap));
  });
  // style tag contents
  doc.querySelectorAll('style').forEach(styleEl => {
    styleEl.textContent = rewriteCss(styleEl.textContent || '', primaryPath, bundle, blobMap);
  });
  // linked CSS fetch & rewrite (simple replace)
  await Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]')).map(async link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const local = resolveLocal(primaryPath, href);
    if (local && bundle.files[local]) {
      const css = new TextDecoder().decode(bundle.files[local]);
      const rewritten = rewriteCss(css, local, bundle, blobMap);
      // inline the stylesheet for simplicity in preview
      const styleTag = doc.createElement('style');
      styleTag.textContent = rewritten;
      link.replaceWith(styleTag);
    }
  }));

  // Inject click capture script before </body>
  const capture = `(function(){try{function send(u,meta){ parent.postMessage({type:'creative-click', url:typeof u==='string'?u:'', meta:meta||{}}, '*'); }
function globalClickTag(){var v=''; try { if(typeof window.clickTag==='string') v=window.clickTag; else if(typeof window.clickTAG==='string') v=window.clickTAG; } catch(e){} return v; }
function extract(ev){var url=null; var t=ev.target; while(t && t!==document.body){ if(t.tagName && t.tagName.toUpperCase()==='A' && t.href){ url=t.getAttribute('href')||t.href; break;} t=t.parentElement;} if(url && /^javascript:/i.test(url)) url=null; if(!url){var g=globalClickTag(); if(g) url=g;} return url; }
document.addEventListener('click',function(ev){ try { var u = extract(ev); if(u!==null){ ev.preventDefault(); send(String(u),{source:'handler', empty: !u}); } } catch(e){} }, true);
var originalOpen = window.open; window.open = function(u){ try { var candidate = (typeof u==='string' && u.length)? u : globalClickTag(); send(candidate, {source:'window.open', empty: !candidate}); } catch(e){} try { return originalOpen.apply(this, arguments); } catch(e){ return null; } };
// Initial handshake for debugging including clickTag presence
var ct = globalClickTag(); send(ct,{handshake:true, clickTagPresent: (typeof ct==='string'), clickTagLength: ct.length});
}catch(e){ parent.postMessage({type:'creative-click-debug', error:String(e)}, '*'); }})();`;
  const body = doc.querySelector('body');
  if (body) {
    const script = doc.createElement('script');
    script.type = 'text/javascript';
    script.textContent = capture;
    body.appendChild(script);
  }
  const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
  return { html, blobMap, originalHtml };
}

function rewriteCss(css: string, from: string, bundle: ZipBundle, blobMap: Record<string,string>): string {
  return css.replace(/url\(([^)]+)\)/gi, (m, g1) => {
    let raw = g1.trim().replace(/^['"]|['"]$/g, '');
    const local = resolveLocal(from, raw);
    if (local && bundle.files[local]) {
      return `url(${blobMap[local]})`;
    }
    return m;
  });
}

function resolveLocal(from: string, url: string): string | undefined {
  if (/^https?:/i.test(url) || /^data:/i.test(url) || url.startsWith('javascript:')) return undefined;
  if (url.startsWith('/')) return url.slice(1);
  if (url.startsWith('./')) url = url.slice(2);
  const fromDir = from.split('/').slice(0, -1).join('/');
  const combined = fromDir ? fromDir + '/' + url : url;
  const norm = combined.split('/').filter(p => p && p !== '.').reduce<string[]>((acc, part) => {
    if (part === '..') acc.pop(); else acc.push(part);
    return acc;
  }, []).join('/');
  return norm;
}
