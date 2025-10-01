// @ts-nocheck
import type { ZipBundle } from '../../../src/logic/types';
import { createInAppShim, type AdTagEnvironment } from './environment';

export interface ProbeSummary {
	domContentLoaded?: number;
	visualStart?: number;
	frames?: number;
	longTasksMs?: number;
	consoleErrors?: number;
	consoleWarnings?: number;
	dialogs?: number;
	cookies?: number;
	localStorage?: number;
	errors?: number;
	documentWrites?: number;
	jquery?: boolean;
	clickUrl?: string;
	memoryMB?: number;
	// memory sampling (Chromium only: performance.memory)
	memoryMinMB?: number;
	memoryMaxMB?: number;
	cpuScore?: number; // 0..1 (higher is worse)
	network?: number;
	// runtime DOM creations
	runtimeIframes?: number;
	// preview diagnostics
	rewrites?: number;
	imgRewrites?: number;
	mediaRewrites?: number;
	scriptRewrites?: number;
	linkRewrites?: number;
	setAttrRewrites?: number;
	styleUrlRewrites?: number;
	styleAttrRewrites?: number;
	domImages?: number;
	domBgUrls?: number;
	enablerStub?: boolean;
	// creative border detection
	borderSides?: number; // how many sides with visible border
	borderCssRules?: number; // count of elements with non-zero border width
	// animation metrics (CSS animations)
	animMaxDurationS?: number;
	animMaxLoops?: number;
	animInfinite?: boolean;
}

export type ProbeEvent =
	| { __audit_event: 1; type:'console'; level:'log'|'warn'|'error'; message: string }
	| { __audit_event: 1; type:'dialog'; kind:'alert'|'confirm'|'prompt'; text?: string }
	| { __audit_event: 1; type:'cookie'; value: string }
	| { __audit_event: 1; type:'storage'; op:'set'|'remove'|'clear'; key?: string; value?: string }
	| { __audit_event: 1; type:'network'; kind:'fetch'|'xhr'; url: string }
	| { __audit_event: 1; type:'error'; message: string }
	| { __audit_event: 1; type:'summary'; summary: ProbeSummary };

interface PreviewResult { html: string; blobMap: Record<string,string>; originalHtml: string; }

interface PreviewOptions {
	environment?: AdTagEnvironment;
}

export async function buildInstrumentedPreview(bundle: ZipBundle, primaryPath: string, options?: PreviewOptions): Promise<PreviewResult> {
	const decoder = new TextDecoder();
	const blobMap: Record<string, string> = {};
	const sizeByBlobUrl: Record<string, number> = {};
	// Case-insensitive path map to handle zips created on case-insensitive filesystems
	const lowerCaseMap: Record<string, string> = {};
	for (const k of Object.keys(bundle.files)) {
		lowerCaseMap[k.toLowerCase()] = k;
	}
	const ensureBlob = (path: string): string => {
		// ensure using exact existing key
		const exact = bundle.files[path] ? path : lowerCaseMap[path.toLowerCase()] || path;
		if (blobMap[exact]) return blobMap[exact];
		const bytes = bundle.files[exact];
		const arrBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
		const blob = new Blob([arrBuf], { type: guessMime(path) });
		const url = URL.createObjectURL(blob);
		blobMap[exact] = url; sizeByBlobUrl[url] = bytes.byteLength; return url;
	};
	for (const p of Object.keys(bundle.files)) ensureBlob(p);

	const originalHtml = decoder.decode(bundle.files[primaryPath]);
	const doc = new DOMParser().parseFromString(originalHtml, 'text/html');
	// Ensure GWD containers aren't hidden by default styles in preview
	try {
		const head = doc.querySelector('head');
		if (head) {
			const forceVisible = doc.createElement('style');
			forceVisible.textContent = `
				html, body { margin: 0 !important; overflow: hidden !important; background: transparent !important; }
				gwd-page, gwd-pagedeck, gwd-google-ad, .gwd-page-container, .gwd-page-content {
					visibility: visible !important;
					opacity: 1 !important;
				}
				html, body { min-height: 100%; }
			`;
			head.appendChild(forceVisible);
		}
	} catch {}

	const attrTargets: [string,string][] = [ ['img','src'], ['script','src'], ['link','href'], ['video','src'], ['audio','src'], ['source','src'] ];
	for (const [tag, attr] of attrTargets) {
		doc.querySelectorAll(`${tag}[${attr}]`).forEach(el => {
			const val = el.getAttribute(attr);
			if (!val) return; const local = resolveLocal(primaryPath, val);
			if (local) {
				const exact = bundle.files[local] ? local : lowerCaseMap[local.toLowerCase()];
				if (exact) el.setAttribute(attr, blobMap[exact]);
			}
		});
	}
	// Inline CSS
	doc.querySelectorAll('[style]').forEach(el => {
		const style = el.getAttribute('style')||'';
		el.setAttribute('style', rewriteCss(style, primaryPath, bundle, blobMap, lowerCaseMap));
	});
	doc.querySelectorAll('style').forEach(styleEl => { styleEl.textContent = rewriteCss(styleEl.textContent||'', primaryPath, bundle, blobMap, lowerCaseMap); });
	for (const link of Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))) {
		const href = link.getAttribute('href'); if (!href) continue;
		const local = resolveLocal(primaryPath, href);
		const exact = local ? (bundle.files[local] ? local : lowerCaseMap[local.toLowerCase()]) : undefined;
		if (exact && bundle.files[exact]) {
			const css = new TextDecoder().decode(bundle.files[exact]);
			const rewritten = rewriteCss(css, exact, bundle, blobMap, lowerCaseMap);
			const styleTag = doc.createElement('style'); styleTag.textContent = rewritten; link.replaceWith(styleTag);
		}
	}

	// Also handle srcset attributes (img/picture)
	try {
		doc.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
			const val = el.getAttribute('srcset')||'';
			if (!val) return;
			const rewritten = val.split(',').map(part => {
				const seg = part.trim();
				const sp = seg.split(/\s+/);
				const u = sp[0];
				const rest = sp.slice(1).join(' ');
				const local = resolveLocal(primaryPath, u);
				const exact = local ? (bundle.files[local] ? local : lowerCaseMap[local.toLowerCase()]) : undefined;
				if (exact && bundle.files[exact]) {
					const b = blobMap[exact];
					return rest ? `${b} ${rest}` : b;
				}
				return seg;
			}).join(', ');
			el.setAttribute('srcset', rewritten);
		});
	} catch {}

	const probe = buildProbeScript();
	const body = doc.querySelector('body');
	if (body) {
		const envScript = createInAppShim(options?.environment);
		if (envScript) {
			try {
				const shimBlob = new Blob([envScript], { type: 'text/javascript' });
				const shimUrl = URL.createObjectURL(shimBlob);
				const shimTag = doc.createElement('script');
				shimTag.type = 'text/javascript';
				(shimTag as any).src = shimUrl;
				shimTag.defer = false;
				shimTag.async = false;
				body.insertBefore(shimTag, body.firstChild);
			} catch {}
		}
		// Combine asset map and probe into a single external blob script to avoid inline CSP blocks
		const combined = `window.__AUDIT_ASSET_MAP = ${JSON.stringify({ primary: primaryPath, map: blobMap, sizes: sizeByBlobUrl })};\n;(${probe})()`;
		const blob = new Blob([combined], { type: 'text/javascript' });
		const url = URL.createObjectURL(blob);
		const script = doc.createElement('script'); script.type='text/javascript'; (script as any).src = url; script.defer = false; script.async = false;
		body.appendChild(script);
	}
	const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
	return { html, blobMap, originalHtml };
}

function guessMime(name: string): string {
	const n = name.toLowerCase();
	if (n.endsWith('.png')) return 'image/png';
	if (n.endsWith('.jpg')||n.endsWith('.jpeg')) return 'image/jpeg';
	if (n.endsWith('.gif')) return 'image/gif';
	if (n.endsWith('.webp')) return 'image/webp';
	if (n.endsWith('.svg')) return 'image/svg+xml';
	if (n.endsWith('.mp4')) return 'video/mp4';
	if (n.endsWith('.webm')) return 'video/webm';
	if (n.endsWith('.ogg')) return 'video/ogg';
	if (n.endsWith('.mov')) return 'video/quicktime';
	if (n.endsWith('.mp3')) return 'audio/mpeg';
	if (n.endsWith('.wav')) return 'audio/wav';
	if (n.endsWith('.m4a')) return 'audio/mp4';
	if (n.endsWith('.css')) return 'text/css';
	if (n.endsWith('.js')) return 'text/javascript';
	if (n.endsWith('.html')||n.endsWith('.htm')) return 'text/html';
	return 'application/octet-stream';
}

function rewriteCss(css: string, from: string, bundle: ZipBundle, blobMap: Record<string,string>, lowerCaseMap: Record<string,string>): string {
	return css.replace(/url\(([^)]+)\)/gi, (m, g1) => {
		let raw = String(g1).trim().replace(/^[\'"]|[\'"]$/g, '');
		const local = resolveLocal(from, raw);
		const exact = local ? (bundle.files[local] ? local : lowerCaseMap[local.toLowerCase()]) : undefined;
		if (exact && bundle.files[exact]) return `url(${blobMap[exact]})`;
		return m;
	});
}

function resolveLocal(from: string, url: string): string | undefined {
	if (/^https?:/i.test(url) || /^data:/i.test(url) || url.startsWith('javascript:')) return undefined;
	if (url.startsWith('/')) return url.slice(1);
	if (url.startsWith('./')) url = url.slice(2);
	const fromDir = from.split('/').slice(0, -1).join('/');
	const combined = fromDir ? fromDir + '/' + url : url;
	const norm = combined.split('/').filter(p => p && p !== '.').reduce<string[]>((acc, part) => { if (part==='..') acc.pop(); else acc.push(part); return acc; }, []).join('/');
	return norm;
}

function buildProbeScript(): any {
	// eslint-disable-next-line max-len
	const src = function(){ try { 
		var post = function(m){ try{ parent.postMessage(Object.assign({__audit_event:1},m), '*'); }catch(e){} };
		var summary = { domContentLoaded: undefined, visualStart: undefined, frames: 0, consoleErrors:0, consoleWarnings:0, dialogs:0, cookies:0, localStorage:0, errors:0, documentWrites:0, jquery:false, clickUrl:'', memoryMB: undefined, memoryMinMB: undefined, memoryMaxMB: undefined, cpuScore: undefined, network: 0, runtimeIframes: 0, rewrites:0, imgRewrites:0, mediaRewrites:0, scriptRewrites:0, linkRewrites:0, setAttrRewrites:0, styleUrlRewrites:0, styleAttrRewrites:0, domImages:0, domBgUrls:0, enablerStub:false, animMaxDurationS: undefined, animMaxLoops: undefined, animInfinite: false };
		var summary = { domContentLoaded: undefined, visualStart: undefined, frames: 0, consoleErrors:0, consoleWarnings:0, dialogs:0, cookies:0, localStorage:0, errors:0, documentWrites:0, jquery:false, clickUrl:'', memoryMB: undefined, memoryMinMB: undefined, memoryMaxMB: undefined, cpuScore: undefined, network: 0, runtimeIframes: 0, rewrites:0, imgRewrites:0, mediaRewrites:0, scriptRewrites:0, linkRewrites:0, setAttrRewrites:0, styleUrlRewrites:0, styleAttrRewrites:0, domImages:0, domBgUrls:0, enablerStub:false, animMaxDurationS: undefined, animMaxLoops: undefined, animInfinite: false };
		// Request/weight accounting
		try {
			(summary as any).initialRequests = 0; (summary as any).totalRequests = 0;
			(summary as any).initialBytes = 0; (summary as any).subloadBytes = 0;
		} catch(e){}
		try { window.addEventListener('error', function(e){ try{ summary.errors++; post({type:'error', message: String((e && e.message) || 'error')}); }catch(e2){} }); } catch(e){}
		try { var origErr = console.error; console.error = function(){ try{ summary.consoleErrors++; post({type:'console', level:'error', message: Array.prototype.join.call(arguments, ' ')});}catch(e2){} try{return origErr.apply(this, arguments);}catch(e3){} } } catch(e){}
		try { var origWarn = console.warn; console.warn = function(){ try{ summary.consoleWarnings++; post({type:'console', level:'warn', message: Array.prototype.join.call(arguments, ' ')});}catch(e2){} try{return origWarn.apply(this, arguments);}catch(e3){} } } catch(e){}
		try { var oa = window.alert; window.alert = function(msg){ try{ summary.dialogs++; post({type:'dialog', kind:'alert', text: String(msg) }); }catch(e2){} return oa.apply(this, arguments); }; } catch(e){}
		try { var oc = window.confirm; window.confirm = function(msg){ try{ summary.dialogs++; post({type:'dialog', kind:'confirm', text: String(msg) }); }catch(e2){} return oc.apply(this, arguments); }; } catch(e){}
		try { var op = window.prompt; window.prompt = function(msg, def){ try{ summary.dialogs++; post({type:'dialog', kind:'prompt', text: String(msg) }); }catch(e2){} return op.apply(this, arguments); }; } catch(e){}
		try { Object.defineProperty(Document.prototype, 'cookie', { set: function(v){ try{ summary.cookies++; post({type:'cookie', value: String(v) }); }catch(e2){} } }); } catch(e){}
		try { var ls = window.localStorage; var si = ls.setItem; var ri = ls.removeItem; var cl = ls.clear; ls.setItem = function(k,v){ try{ summary.localStorage++; post({type:'storage', op:'set', key:String(k), value:String(v)});}catch(e2){} return si.apply(this, arguments); }; ls.removeItem = function(k){ try{ post({type:'storage', op:'remove', key:String(k)});}catch(e2){} return ri.apply(this, arguments); }; ls.clear = function(){ try{ post({type:'storage', op:'clear'});}catch(e2){} return cl.apply(this, arguments); }; } catch(e){}
		try { var ofetch = window.fetch; window.fetch = function(u){ try{ summary.network++; post({type:'network', kind:'fetch', url: String(u)});}catch(e2){} return ofetch.apply(this, arguments); } } catch(e){}
		try { var OX = window.XMLHttpRequest; var P = OX && OX.prototype; if (P && P.open) { var o = P.open; P.open = function(m,u){ try{ summary.network++; post({type:'network', kind:'xhr', url: String(u)});}catch(e2){} return o.apply(this, arguments); }; } } catch(e){}
		try { var origWrite = document.write; document.write = function(){ try{ summary.documentWrites++; }catch(e2){} try{ return origWrite.apply(document, arguments);}catch(e3){} } } catch(e){}
		try { var g = window; summary.jquery = !!(g.jQuery || g.$); } catch(e){}
		// Canvas border detection (CreateJS/Animate, etc.): detect edge-hugging stroked rectangles
		try {
			(function(){ try {
				var C = (window as any).CanvasRenderingContext2D; if (!C || !C.prototype) return;
				function visibleColor(c:any){ try{ if(!c) return false; if (typeof c!=='string') return false; if (/transparent/i.test(c)) return false; var m = c.match(/rgba\(([^)]+)\)/i); if (m){ var parts = m[1].split(',').map(function(x){return parseFloat(x.trim());}); if (parts.length>=4 && parts[3]===0) return false; } return true; }catch(e){ return false; } }
				// Track and apply current transform to points so we can detect borders drawn with transforms (CreateJS)
				function ensureMat(ctx:any){ if(!ctx.__probe_mat) ctx.__probe_mat = [1,0,0,1,0,0]; if(!ctx.__probe_stack) ctx.__probe_stack = []; }
				function matMul(a:number[], b:number[]): number[]{ return [ a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5] ]; }
				function matApply(m:number[], x:number, y:number): [number, number]{ return [ m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5] ]; }
				function spansCanvas(ctx:any, minX:number, minY:number, maxX:number, maxY:number){ try{ var tol=6; var canvas = ctx && ctx.canvas; if(!canvas) return false; var cw = canvas.width||0, ch = canvas.height||0; if(cw<=0||ch<=0) return false; return (minX<=tol && minY<=tol && maxX>=cw-tol && maxY>=ch-tol); }catch(e){ return false; } }
				var origStrokeRect = C.prototype.strokeRect; var origRect = C.prototype.rect; var origStroke = C.prototype.stroke;
				var origBeginPath = C.prototype.beginPath; var origMoveTo = C.prototype.moveTo; var origLineTo = C.prototype.lineTo; var origClosePath = C.prototype.closePath;
				var origSave = C.prototype.save, origRestore = C.prototype.restore, origSetTransform = C.prototype.setTransform, origTransform = C.prototype.transform, origTranslate = C.prototype.translate, origScale = C.prototype.scale, origRotate = C.prototype.rotate;
				C.prototype.save = function(){ try{ ensureMat(this); this.__probe_stack.push(this.__probe_mat.slice()); }catch(e){} return origSave.apply(this, arguments as any); };
				C.prototype.restore = function(){ try{ ensureMat(this); var m=this.__probe_stack.pop(); if(m) this.__probe_mat = m; }catch(e){} return origRestore.apply(this, arguments as any); };
				C.prototype.setTransform = function(a:number,b:number,c:number,d:number,e:number,f:number){ try{ ensureMat(this); this.__probe_mat = [a,b,c,d,e,f]; }catch(e){} return origSetTransform.apply(this, arguments as any); };
				C.prototype.transform = function(a:number,b:number,c:number,d:number,e:number,f:number){ try{ ensureMat(this); this.__probe_mat = matMul(this.__probe_mat, [a,b,c,d,e,f]); }catch(e){} return origTransform.apply(this, arguments as any); };
				C.prototype.translate = function(x:number,y:number){ try{ ensureMat(this); this.__probe_mat = matMul(this.__probe_mat, [1,0,0,1,x,y]); }catch(e){} return origTranslate.apply(this, arguments as any); };
				C.prototype.scale = function(x:number,y:number){ try{ ensureMat(this); this.__probe_mat = matMul(this.__probe_mat, [x,0,0,y,0,0]); }catch(e){} return origScale.apply(this, arguments as any); };
				C.prototype.rotate = function(rad:number){ try{ ensureMat(this); var c=Math.cos(rad), s=Math.sin(rad); this.__probe_mat = matMul(this.__probe_mat, [c,s,-s,c,0,0]); }catch(e){} return origRotate.apply(this, arguments as any); };
				C.prototype.strokeRect = function(x:number,y:number,w:number,h:number){ try{
					var lw = (this as any).lineWidth||1; var col = (this as any).strokeStyle; ensureMat(this);
					if (lw>0 && visibleColor(col)) {
						var p1 = matApply(this.__probe_mat, x, y);
						var p2 = matApply(this.__probe_mat, x+w, y);
						var p3 = matApply(this.__probe_mat, x+w, y+h);
						var p4 = matApply(this.__probe_mat, x, y+h);
						var minX = Math.min(p1[0],p2[0],p3[0],p4[0]); var minY = Math.min(p1[1],p2[1],p3[1],p4[1]);
						var maxX = Math.max(p1[0],p2[0],p3[0],p4[0]); var maxY = Math.max(p1[1],p2[1],p3[1],p4[1]);
						if (spansCanvas(this, minX, minY, maxX, maxY)) {
							try { (summary as any).borderSides = Math.max( (summary as any).borderSides||0, 4); } catch(e){}
							try { (summary as any).borderCssRules = Math.max(0, ((summary as any).borderCssRules||0) + 1); } catch(e){}
						}
					}
				} catch(e){} return origStrokeRect.apply(this, arguments as any); };
				C.prototype.rect = function(x:number,y:number,w:number,h:number){ try{ ensureMat(this); var p1 = matApply(this.__probe_mat, x, y); var p2 = matApply(this.__probe_mat, x+w, y); var p3 = matApply(this.__probe_mat, x+w, y+h); var p4 = matApply(this.__probe_mat, x, y+h); var minX = Math.min(p1[0],p2[0],p3[0],p4[0]); var minY = Math.min(p1[1],p2[1],p3[1],p4[1]); var maxX = Math.max(p1[0],p2[0],p3[0],p4[0]); var maxY = Math.max(p1[1],p2[1],p3[1],p4[1]); (this as any).__probe_lastBounds = {minX:minX, minY:minY, maxX:maxX, maxY:maxY}; }catch(e){} return origRect.apply(this, arguments as any); };
				// Track generic path points to detect full-canvas rectangle drawn via moveTo/lineTo (CreateJS path string)
				C.prototype.beginPath = function(){ try{ ensureMat(this); (this as any).__probe_pts = []; }catch(e){} return origBeginPath.apply(this, arguments as any); };
				C.prototype.moveTo = function(x:number,y:number){ try{ ensureMat(this); var a=(this as any).__probe_pts; if (a) { var p=matApply(this.__probe_mat, x,y); a.push([p[0],p[1]]); } }catch(e){} return origMoveTo.apply(this, arguments as any); };
				C.prototype.lineTo = function(x:number,y:number){ try{ ensureMat(this); var a=(this as any).__probe_pts; if (a) { var p=matApply(this.__probe_mat, x,y); a.push([p[0],p[1]]); } }catch(e){} return origLineTo.apply(this, arguments as any); };
				C.prototype.closePath = function(){ try{ var a=(this as any).__probe_pts; if (a) a.closed = true; }catch(e){} return origClosePath.apply(this, arguments as any); };
				C.prototype.stroke = function(){ try{
					var lw = (this as any).lineWidth||1; var col = (this as any).strokeStyle;
					var b = (this as any).__probe_lastBounds;
					if (b && lw>0 && visibleColor(col) && spansCanvas(this, b.minX, b.minY, b.maxX, b.maxY)) {
						try { (summary as any).borderSides = Math.max( (summary as any).borderSides||0, 4); } catch(e){}
						try { (summary as any).borderCssRules = Math.max(0, ((summary as any).borderCssRules||0) + 1); } catch(e){}
					} else {
						// Heuristic: path-based rectangle covering canvas bounds (after transforms)
						try {
							var pts = (this as any).__probe_pts || [];
							var canvas = (this as any).canvas; var cw = canvas && canvas.width || 0; var ch = canvas && canvas.height || 0;
							if (cw>0 && ch>0 && pts && pts.length>=4 && lw>0 && visibleColor(col)){
								var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
								for (var i=0;i<pts.length;i++){ var p=pts[i]; if (!p) continue; if (p[0]<minX) minX=p[0]; if (p[1]<minY) minY=p[1]; if (p[0]>maxX) maxX=p[0]; if (p[1]>maxY) maxY=p[1]; }
								if (spansCanvas(this, minX, minY, maxX, maxY)) {
									try { (summary as any).borderSides = Math.max( (summary as any).borderSides||0, 4); } catch(e){}
									try { (summary as any).borderCssRules = Math.max(0, ((summary as any).borderCssRules||0) + 1); } catch(e){}
								}
							}
						} catch(e){}
					}
				} catch(e){} return origStroke.apply(this, arguments as any); };
			} catch(e){} })();
		} catch(e){}
		// clickthrough signal
		try {
			function send(u,meta){ try { parent.postMessage({ type:'creative-click', url: typeof u==='string'?u:'', meta: meta||{}}, '*'); summary.clickUrl = String(u||''); } catch(e2){} }
			function globalClickTag(){ try { if(typeof window.clickTag==='string') return window.clickTag; if(typeof window.clickTAG==='string') return window.clickTAG; return ''; } catch(e){ return ''; } }
		document.addEventListener('click', function(ev){ try { var t=ev.target; var url=''; while(t && t!==document.body){ if(t.tagName && t.tagName.toUpperCase()==='A' && t.href) { url = t.getAttribute('href')||t.href; break;} t=t.parentElement; } if(!url){ url = globalClickTag(); } if(url) { ev.preventDefault(); send(url, { source:'user' }); } } catch(e2){} }, true);
		var oo = window.open; window.open = function(u){ try{ send(typeof u==='string'?u: globalClickTag(), { source:'window.open' }); } catch(e2){} try { return oo.apply(this, arguments);} catch(e3){ return null; } };
			// Hook Enabler exit APIs if present (GWD/Studio creatives)
			function hookEnabler(){
				try {
					var E = (window as any).Enabler; if (!E) return;
					function openFrom(name:any, url:any, source:string){
						try {
							var hasUrl = (typeof url==='string');
							var u = (hasUrl && url.length)? url : globalClickTag();
							var present = true; // Enabler.* implies a click exit is present
							send(u||'', { source: source, name: String(name||''), present: present });
							// Open provided URL or fall back to a blank window when not set
							try { oo.call(window, (u && u.length) ? u : 'about:blank'); } catch(e){}
						} catch(e){}
					}
					if (typeof E.exit === 'function') {
						var ex = E.exit.bind(E);
						E.exit = function(name:any, url:any){ try { openFrom(name,url,'Enabler.exit'); } catch(e){} try { return ex.apply(E, arguments as any); } catch(e2){} };
					}
					if (typeof (E as any).exitOverride === 'function') {
						var exo = (E as any).exitOverride.bind(E);
						(E as any).exitOverride = function(name:any, url:any){ try { openFrom(name,url,'Enabler.exitOverride'); } catch(e){} try { return exo.apply(E, arguments as any); } catch(e2){} };
					}
					if (typeof (E as any).dynamicExit === 'function') {
						var dx = (E as any).dynamicExit.bind(E);
						(E as any).dynamicExit = function(name:any, url:any){ try { openFrom(name,url,'Enabler.dynamicExit'); } catch(e){} try { return dx.apply(E, arguments as any); } catch(e2){} };
					}
				} catch(e){}
			}
			// Attempt immediate hook and re-try a few times if Enabler loads late
			hookEnabler();
			var enTry = 0; var enTimer = setInterval(function(){ enTry++; try { if ((window as any).Enabler) { hookEnabler(); clearInterval(enTimer); } } catch(e){} if (enTry>20) { try { clearInterval(enTimer); } catch(e2){} } }, 200);
			// If Enabler never appears, install a lightweight stub so GWD creatives can proceed
			setTimeout(function(){ try {
				if (!(window as any).Enabler) {
					var listeners = {} as any;
					(window as any).studio = { events: { StudioEvent: { INIT:'init', PAGE_LOADED:'page_loaded', VISIBLE:'visible', VISIBILITY_CHANGED:'visible' } } };
					(window as any).Enabler = {
						isInitialized: function(){ return true; },
						isPageLoaded: function(){ return true; },
						isVisible: function(){ return true; },
						addEventListener: function(ev, cb){ (listeners[ev]=listeners[ev]||[]).push(cb); },
						removeEventListener: function(ev, cb){ if (!listeners[ev]) return; listeners[ev] = listeners[ev].filter(function(fn){ return fn!==cb; }); },
						dispatch: function(ev){ (listeners[ev]||[]).forEach(function(fn){ try{ fn(); }catch(e){} }); },
						exit: function(name, url){ try { window.open(url || (window as any).clickTag || 'about:blank'); } catch(e){} },
						exitOverride: function(name, url){ try { window.open(url || (window as any).clickTag || 'about:blank'); } catch(e){} },
						dynamicExit: function(name, url){ try { window.open(url || (window as any).clickTag || 'about:blank'); } catch(e){} },
						loadScript: function(u, cb){ try { var s=document.createElement('script'); s.src=String(u); s.onload=function(){ if(cb) cb(); }; document.head.appendChild(s);} catch(e){} }
					};
					summary.enablerStub = true;
					// fire init/page loaded/visible right away
					try { (window as any).Enabler.dispatch((window as any).studio.events.StudioEvent.INIT); } catch(e){}
					try { (window as any).Enabler.dispatch((window as any).studio.events.StudioEvent.PAGE_LOADED); } catch(e){}
					try { (window as any).Enabler.dispatch((window as any).studio.events.StudioEvent.VISIBLE); } catch(e){}
				}
			} catch(e){} }, 1500);
		} catch(e){}
		// Runtime URL rewriter: map relative asset URLs to in-memory blob URLs from the ZIP
		try{
			var MAP = (window as any).__AUDIT_ASSET_MAP || { primary:'', map:{} };
			function stripQuery(s){ return String(s||'').replace(/[?#].*$/, ''); }
			function resolveLocal(from, url){ try {
				if (/^https?:/i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url) || /^javascript:/i.test(url)) return undefined;
				if (url.startsWith('/')) return url.slice(1);
				if (url.startsWith('./')) url = url.slice(2);
				var fromDir = from.split('/').slice(0, -1).join('/');
				var combined = fromDir ? fromDir + '/' + url : url;
				var parts = []; combined.split('/').forEach(function(part){ if(!part || part==='.') return; if (part==='..') parts.pop(); else parts.push(part); });
				return parts.join('/');
			} catch(e){ return undefined; } }
			function toBlob(url){ try{ var loc = resolveLocal(MAP.primary || '', url); if (!loc) return url; var norm = stripQuery(loc); var exact = MAP.map[norm]; if (exact) { try{ summary.rewrites++; }catch(e){} return exact; } var lower = norm.toLowerCase(); for (var k in MAP.map){ if (k.toLowerCase()===lower) { try{ summary.rewrites++; }catch(e){} return MAP.map[k]; } } return url; } catch(e){ return url; } }
			// Patch element src setters for Image and media
			try{
				var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
				if (imgDesc && imgDesc.set){ Object.defineProperty(HTMLImageElement.prototype, 'src', { set: function(v){ try{ var b = toBlob(String(v)); if (b!==v) try{ summary.imgRewrites++; }catch(e){} v = b; }catch(e){} return imgDesc.set.call(this, v); } }); }
			}catch(e){}
			try{
				var mediaDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
				if (mediaDesc && mediaDesc.set){ Object.defineProperty(HTMLMediaElement.prototype, 'src', { set: function(v){ try{ var b = toBlob(String(v)); if (b!==v) try{ summary.mediaRewrites++; }catch(e){} v = b; }catch(e){} return mediaDesc.set.call(this, v); } }); }
			}catch(e){}
			// Patch script/link setters for dynamic loads
			try{
				var scriptDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
				if (scriptDesc && scriptDesc.set){ Object.defineProperty(HTMLScriptElement.prototype, 'src', { set: function(v){ try{ var b = toBlob(String(v)); if (b!==v) try{ summary.scriptRewrites++; }catch(e){} v = b; }catch(e){} return scriptDesc.set.call(this, v); } }); }
			}catch(e){}
			try{
				var linkDesc = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
				if (linkDesc && linkDesc.set){ Object.defineProperty(HTMLLinkElement.prototype, 'href', { set: function(v){ try{ var b = toBlob(String(v)); if (b!==v) try{ summary.linkRewrites++; }catch(e){} v = b; }catch(e){} return linkDesc.set.call(this, v); } }); }
			}catch(e){}
			// Patch setAttribute for src/href across elements (img/video/audio/script/link)
			try{
				var oldSetAttr = Element.prototype.setAttribute;
				Element.prototype.setAttribute = function(name, value){ try {
					var tag = (this && this.tagName) ? String(this.tagName).toUpperCase() : '';
					var n = String(name).toLowerCase();
					if (n==='src' && /^(IMG|VIDEO|AUDIO|SCRIPT|SOURCE)$/i.test(tag)) { var b = toBlob(String(value)); if (b!==value) try{ summary.setAttrRewrites++; }catch(e){} value = b; }
					if (tag==='LINK' && n==='href') { var b2 = toBlob(String(value)); if (b2!==value) try{ summary.setAttrRewrites++; }catch(e){} value = b2; }
					if (n==='style' && typeof value==='string' && /url\(/i.test(String(value))) {
						try { var replaced = String(value).replace(/url\(([^)]+)\)/ig, function(_m,g){ try{ summary.styleAttrRewrites++; }catch(e){} var raw=String(g).trim().replace(/^['"]|['"]$/g,''); return 'url(' + toBlob(raw) + ')'; }); value = replaced; } catch(e){}
					}
				} catch(e){} return oldSetAttr.call(this, name, value); };
			}catch(e){}
			// Rewrite dynamic style backgrounds (setProperty, cssText)
			try{
				var setProp = (CSSStyleDeclaration && CSSStyleDeclaration.prototype && CSSStyleDeclaration.prototype.setProperty) ? CSSStyleDeclaration.prototype.setProperty : null;
				if (setProp) {
					CSSStyleDeclaration.prototype.setProperty = function(prop, val, prio){ try { if (typeof val==='string' && /url\(/i.test(val)) { val = String(val).replace(/url\(([^)]+)\)/ig, function(_m,g){ try{ summary.styleUrlRewrites++; }catch(e){} var raw=String(g).trim().replace(/^['"]|['"]$/g,''); return 'url(' + toBlob(raw) + ')'; }); } } catch(e){} return setProp.call(this, prop, val, prio); };
				}
			}catch(e){}
			// Observe new style tags and rewrite url(...) inside
			try{
				var mo2 = new MutationObserver(function(muts){ try { muts.forEach(function(m){ Array.prototype.slice.call(m.addedNodes||[]).forEach(function(node){ try{ if (node && node.nodeType===1 && String(node.nodeName).toUpperCase()==='STYLE') { var t = node.textContent||''; if (/url\(/i.test(t)) { node.textContent = String(t).replace(/url\(([^)]+)\)/ig, function(_m,g){ var raw=String(g).trim().replace(/^['"]|['"]$/g,''); return 'url(' + toBlob(raw) + ')'; }); } } }catch(e){} }); }); } catch(e){} });
				mo2.observe(document.documentElement, { childList:true, subtree:true });
			}catch(e){}
			try{
				var cssTextDesc = CSSStyleDeclaration && Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
				if (cssTextDesc && cssTextDesc.set) {
					Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', { set: function(v){ try { if (typeof v==='string' && /url\(/i.test(v)) { v = String(v).replace(/url\(([^)]+)\)/ig, function(_m,g){ try{ summary.styleUrlRewrites++; }catch(e){} var raw=String(g).trim().replace(/^['"]|['"]$/g,''); return 'url(' + toBlob(raw) + ')'; }); } } catch(e){} return cssTextDesc.set.call(this, v); } });
			}
			}catch(e){}
			// Periodically scan DOM for debug (image/background presence)
			try{
				function scan(){ try {
					var imgs = Array.prototype.slice.call(document.images||[]);
					var countImgs = imgs.filter(function(im){ return im && im.naturalWidth>0; }).length;
					var bg = 0; try { var all = document.querySelectorAll('*'); for (var i=0;i<all.length;i++){ var cs = getComputedStyle(all[i]); if (cs && cs.backgroundImage && /url\(/i.test(cs.backgroundImage)) { bg++; } } } catch(e){}
					summary.domImages = countImgs; summary.domBgUrls = bg;
				} catch(e){} }
				setInterval(scan, 700);
			}catch(e){}
			// Remap fetch/XHR relative URLs
			try{ var ofetch2 = window.fetch; window.fetch = function(u){ try{ if (typeof u==='string') u = toBlob(u); }catch(e){} return ofetch2.apply(this, arguments); } }catch(e){}
			try{ var OX2 = window.XMLHttpRequest; var P2 = OX2 && OX2.prototype; if (P2 && P2.open) { var o2 = P2.open; P2.open = function(m,u){ try{ if (typeof u==='string') u = toBlob(u); }catch(e){} return o2.apply(this, arguments); }; } }catch(e){}
		}catch(e){}
		// Accept simulation command from parent
		try {
			window.addEventListener('message', function(ev){ try {
				var d = ev && ev.data; if (!d || !d.__audit_event) return;
				if (d.type === 'simulate-click') {
					// Try to click first anchor with href; else click body; else call window.open(clickTag)
					var a = document.querySelector('a[href]');
					if (a) { try { (a as any).dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true })); } catch(e){} }
					else if (document.body) { try { document.body.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true })); } catch(e){} }
					else { try { var ct = globalClickTag(); if (ct) { try{ oo.call(window, ct); }catch(e){} } } catch(e){} }
				}
			} catch(e){} });
		} catch(e){}
		// Timings & CPU jitter via RAF deltas
		try {
			// DCL timing relative to navigation start
			try { document.addEventListener('DOMContentLoaded', function(){ try{ summary.domContentLoaded = Math.max(0, performance.now()); }catch(e2){} }); } catch(e){}
			try {
				if (document.readyState !== 'loading' && (summary.domContentLoaded===undefined)) {
					var nav = (performance as any).getEntriesByType && (performance as any).getEntriesByType('navigation');
					if (nav && nav[0] && nav[0].domContentLoadedEventEnd!=null) {
						try { summary.domContentLoaded = Math.max(0, nav[0].domContentLoadedEventEnd - nav[0].startTime); } catch(e3){}
					} else if ((performance as any).timing) {
						var t = (performance as any).timing; if (t.domContentLoadedEventEnd && t.navigationStart) { try { summary.domContentLoaded = Math.max(0, t.domContentLoadedEventEnd - t.navigationStart); } catch(e4){} }
					}
				}
			} catch(e){}
			// Time to Render (first visible pixels): prefer Paint Timing, then LongTasks, DOM mutation, and RAF fallbacks
			try {
				// Paint Timing API (buffered)
				try {
					var po = new (window as any).PerformanceObserver(function(list:any){ try { var es=list.getEntries?list.getEntries():[]; for(var i=0;i<es.length;i++){ var e=es[i]; if(!summary.visualStart && (e.name==='first-contentful-paint' || e.name==='first-paint')) { summary.visualStart = Math.max(0, e.startTime||0); } } }catch(e2){} });
					if (po && po.observe) po.observe({ type:'paint', buffered:true });
				} catch(e){}
				// Long Task accumulation (CPU usage proxy) during first 3s
				try {
					summary.longTasksMs = 0;
					var lpo = new (window as any).PerformanceObserver(function(list:any){ try { var es=list.getEntries?list.getEntries():[]; for(var i=0;i<es.length;i++){ var e=es[i]; if (e && typeof e.duration==='number') { summary.longTasksMs = Math.max(0, (summary.longTasksMs||0) + e.duration); } } }catch(e2){} });
					if (lpo && lpo.observe) lpo.observe({ type:'longtask', buffered:true });
					setTimeout(function(){ try { if (lpo && lpo.disconnect) lpo.disconnect(); } catch(e2){} }, 3000);
				} catch(e){}
				// Mutation Observer as fallback
				try { var firstMut: number|undefined; var mo = new MutationObserver(function(){ if(firstMut===undefined) firstMut = performance.now(); if (summary.visualStart===undefined && firstMut!==undefined) summary.visualStart = Math.max(0, firstMut); }); mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, characterData:true }); setTimeout(function(){ try{ mo.disconnect(); }catch(e2){} }, 3000); } catch(e){}
				// First RAF as last resort
				try { requestAnimationFrame(function(){ try { if (summary.visualStart===undefined) summary.visualStart = Math.max(0, performance.now()); } catch(e2){} }); } catch(e){}
			} catch(e){}
		} catch(e){}
		try {
			var last = performance.now(); var over=0; var count=0; function loop(){ var now = performance.now(); var dt = now-last; last=now; if (dt>50) over++; count++; summary.frames = count; requestAnimationFrame(loop); } requestAnimationFrame(loop); setTimeout(function(){ try{ summary.cpuScore = Math.min(1, over / Math.max(1, summary.frames||1)); }catch(e2){} }, 3000);
		} catch(e){}
		try {
			var mem = performance && (performance as any).memory;
			if (mem && mem.usedJSHeapSize) {
				var mb = mem.usedJSHeapSize/1048576;
				summary.memoryMB = mb;
				// sample over ~5s to capture a min/max range
				try {
					summary.memoryMinMB = mb; summary.memoryMaxMB = mb;
					var mCount = 0; var mTimer = setInterval(function(){ try {
						var m2 = (performance as any).memory; if (m2 && m2.usedJSHeapSize) {
							var mb2 = m2.usedJSHeapSize/1048576;
							summary.memoryMB = mb2;
							if (summary.memoryMinMB===undefined || mb2 < (summary.memoryMinMB as any)) summary.memoryMinMB = mb2;
							if (summary.memoryMaxMB===undefined || mb2 > (summary.memoryMaxMB as any)) summary.memoryMaxMB = mb2;
						}
					} catch(e){} mCount++; if (mCount>10) { try{ clearInterval(mTimer); }catch(e){} } }, 500);
				} catch(e){}
			}
		} catch(e){}
		// Track runtime iframe creation
		try {
			function countInitialIframes(){ try { var c = (document && document.querySelectorAll) ? document.querySelectorAll('iframe').length : 0; summary.runtimeIframes = c; } catch(e){} }
			countInitialIframes();
			var mo_ifr = new MutationObserver(function(list){ try { list.forEach(function(m){ try { (m.addedNodes||[]).forEach(function(n){ try { if (n && n.nodeType===1 && String((n as any).nodeName).toUpperCase()==='IFRAME') { summary.runtimeIframes = (summary.runtimeIframes||0)+1; } } catch(e){} }); } catch(e){} }); } catch(e){} });
			mo_ifr.observe(document.documentElement || document.body, { childList:true, subtree:true });
		} catch(e){}
		// Flush summary periodically
		// Creative border detection: check computed styles on body/html and edge bars (1-4px)
		// Mark onload then a 5s post-onload window for subload accounting
		try { window.addEventListener('load', function(){ try{ (window as any).__AUDIT_AFTER_ONLOAD__ = false; setTimeout(function(){ try{ (window as any).__AUDIT_AFTER_ONLOAD__ = true; }catch(e){} }, 0); setTimeout(function(){ try{ (window as any).__AUDIT_AFTER_ONLOAD__ = 'done'; }catch(e){} }, 5000); }catch(e){} }); } catch(e){}
		// Flush summary periodically
		try {
			function visibleColor(c){ try{ if(!c) return false; if (/transparent/i.test(c)) return false; var m = c.match(/rgba\(([^)]+)\)/i); if (m){ var parts = m[1].split(',').map(function(x){return parseFloat(x.trim());}); if (parts.length>=4 && parts[3]===0) return false; } return true; }catch(e){ return false; } }
			function pxToNum(s){ try{ if(!s) return 0; var m = String(s).match(/([\d.]+)/); return m? parseFloat(m[1]) : 0; }catch(e){ return 0; } }
			function scanBorders(){ try {
				var sides = 0; var rules = 0;
				var root = document.body || document.documentElement;
				if (root) {
					var cs = getComputedStyle(root);
					var t = pxToNum(cs.borderTopWidth), r = pxToNum(cs.borderRightWidth), b = pxToNum(cs.borderBottomWidth), l = pxToNum(cs.borderLeftWidth);
					var tc = visibleColor(cs.borderTopColor), rc = visibleColor(cs.borderRightColor), bc = visibleColor(cs.borderBottomColor), lc = visibleColor(cs.borderLeftColor);
					if (t>0 && tc) sides++;
					if (r>0 && rc) sides++;
					if (b>0 && bc) sides++;
					if (l>0 && lc) sides++;
					if (t>0||r>0||b>0||l>0) rules++;
				}
				// Scan for edge bars (absolute 1-4px thickness)
				try {
					var all = document.querySelectorAll('[style]');
					for (var i=0;i<all.length;i++){
						var el = all[i];
						var st = el.getAttribute('style')||'';
						var pos = /position\s*:\s*absolute/i.test(st);
						if (!pos) continue;
						var mH = st.match(/height\s*:\s*([\d.]+)px/i);
						var mW = st.match(/width\s*:\s*([\d.]+)px/i);
						var h = mH ? parseFloat(mH[1]) : NaN;
						var w = mW ? parseFloat(mW[1]) : NaN;
						var top = /top\s*:\s*0(px|)/i.test(st);
						var left = /left\s*:\s*0(px|)/i.test(st);
						var right = /right\s*:\s*0(px|)/i.test(st);
						var bottom = /bottom\s*:\s*0(px|)/i.test(st);
						var fullW = /width\s*:\s*100%/i.test(st);
						var fullH = /height\s*:\s*100%/i.test(st);
						var bg = (st.match(/background(?:-color)?\s*:\s*([^;]+)/i)||[])[1]||'';
						var vis = visibleColor(bg);
						if (!vis) continue;
						if (top && left && fullW && h>=1 && h<=16) sides = Math.max(sides, (sides|1));
						if (bottom && left && fullW && h>=1 && h<=16) sides = Math.max(sides, (sides|2));
						if (left && top && fullH && w>=1 && w<=16) sides = Math.max(sides, (sides|4));
						if (right && top && fullH && w>=1 && w<=16) sides = Math.max(sides, (sides|8));
					}
					// Rectangle-based pass: class-driven bars without inline styles
					try {
						var cw = document.documentElement ? document.documentElement.clientWidth : 0;
						var ch = document.documentElement ? document.documentElement.clientHeight : 0;
						var els = (document.body ? document.body : document).getElementsByTagName('*');
						var maxScan = Math.min(els.length, 2000);
						for (var j=0; j<maxScan; j++){
							var e2 = els[j] as any;
							var cs2 = getComputedStyle(e2);
							var rect = e2.getBoundingClientRect();
							if (!rect) continue;
							var near = function(a:number,b:number,t:number){ return Math.abs(a-b) <= t; };
							// Background bar detection (class-based edge bars)
							var bgc = cs2 && cs2.backgroundColor || '';
							if (visibleColor(bgc)) {
								// top bar
								if (near(rect.top, 0, 1) && rect.height>=1 && rect.height<=16 && rect.width >= Math.max(0, cw-2)) sides = (sides|1);
								// bottom bar
								if (ch>0 && near(rect.bottom, ch, 1) && rect.height>=1 && rect.height<=16 && rect.width >= Math.max(0, cw-2)) sides = (sides|2);
								// left bar
								if (near(rect.left, 0, 1) && rect.width>=1 && rect.width<=16 && rect.height >= Math.max(0, ch-2)) sides = (sides|4);
								// right bar
								if (cw>0 && near(rect.right, cw, 1) && rect.width>=1 && rect.width<=16 && rect.height >= Math.max(0, ch-2)) sides = (sides|8);
							}
							// CSS border on container aligned with edges
							var bt = pxToNum(cs2 && cs2.borderTopWidth), br = pxToNum(cs2 && cs2.borderRightWidth), bb = pxToNum(cs2 && cs2.borderBottomWidth), bl = pxToNum(cs2 && cs2.borderLeftWidth);
							var btc = cs2 && visibleColor(cs2.borderTopColor), brc = cs2 && visibleColor(cs2.borderRightColor), bbc = cs2 && visibleColor(cs2.borderBottomColor), blc = cs2 && visibleColor(cs2.borderLeftColor);
							if ((bt>0&&btc)||(br>0&&brc)||(bb>0&&bbc)||(bl>0&&blc)) rules++;
							if (bt>=1 && bt<=16 && btc && near(rect.top, 0, 1) && rect.width >= Math.max(0, cw-2)) sides = (sides|1);
							if (bb>=1 && bb<=16 && bbc && ch>0 && near(rect.bottom, ch, 1) && rect.width >= Math.max(0, cw-2)) sides = (sides|2);
							if (bl>=1 && bl<=16 && blc && near(rect.left, 0, 1) && rect.height >= Math.max(0, ch-2)) sides = (sides|4);
							if (br>=1 && br<=16 && brc && cw>0 && near(rect.right, cw, 1) && rect.height >= Math.max(0, ch-2)) sides = (sides|8);
						}
					} catch(e){}
					// convert bitset-ish to count
					var count = 0; if (sides&1) count++; if (sides&2) count++; if (sides&4) count++; if (sides&8) count++;
					(summary as any).borderSides = count;
					(summary as any).borderCssRules = rules;
				} catch(e){}
			} catch(e){}
			} // end function scanBorders
			function parseDurationToS(token){ try { if(!token) return 0; var s = String(token).trim(); var m1 = s.match(/^([\d.]+)\s*s$/i); if (m1) return parseFloat(m1[1])||0; var m2 = s.match(/^([\d.]+)\s*ms$/i); if (m2) return (parseFloat(m2[1])||0)/1000; var n = parseFloat(s); return isFinite(n)? n : 0; } catch(e){ return 0; } }
			function scanAnimations(){ try {
				var maxDur = 0; var maxLoops = 1; var infinite = false;
				var root = document.body || document.documentElement; if (!root) return;
				var els = root.getElementsByTagName('*'); var lim = Math.min(els.length, 3000);
				for (var i=0;i<lim;i++){
					var el = els[i] as any; var cs:any = null; try { cs = getComputedStyle(el); } catch(e){}
					if (!cs) continue;
					var dur = (cs.animationDuration || (cs as any).webkitAnimationDuration || '').toString();
					var iter = (cs.animationIterationCount || (cs as any).webkitAnimationIterationCount || '').toString();
					if (dur){ var parts = dur.split(','); for (var d=0; d<parts.length; d++){ var v = parseDurationToS(parts[d]); if (v>maxDur) maxDur = v; } }
					if (iter){ var ps = iter.split(','); for (var j=0;j<ps.length;j++){ var raw = ps[j].trim().toLowerCase(); if (raw==='infinite'){ infinite = true; if (maxLoops<9999) maxLoops = 9999; } else { var n = parseFloat(raw); if (isFinite(n)) { var r = Math.round(n); if (r>maxLoops) maxLoops = r; } } } }
					// parse shorthand as fallback
					try {
						var sh = (cs.animation || (cs as any).webkitAnimation || '').toString();
						if (sh){ var blocks = sh.split(','); for (var b=0;b<blocks.length;b++){ var tk = blocks[b].trim().replace(/\([^)]*\)/g, ''); var toks = tk.split(/\s+/); for (var k=0;k<toks.length;k++){ var t = toks[k]; if (/^([\d.]+)(ms|s)$/i.test(t)) { var val = parseDurationToS(t); if (val>maxDur) maxDur = val; } else if (t.toLowerCase()==='infinite'){ infinite = true; if (maxLoops<9999) maxLoops = 9999; } else if (/^\d+$/.test(t)){ var iv = parseInt(t,10); if (iv>maxLoops) maxLoops = iv; } } } }
					} catch(e){}
				}
				(summary as any).animMaxDurationS = maxDur;
				(summary as any).animMaxLoops = maxLoops;
				(summary as any).animInfinite = !!infinite;
			} catch(e){}
			}
			// run once after first paint heuristic
			setTimeout(scanBorders, 600);
			setTimeout(scanBorders, 1500);
			// animation scan around similar times
			setTimeout(scanAnimations, 600);
			setTimeout(scanAnimations, 1500);
		} catch(e){}

		var pushes=0; function flush(){ try{ parent.postMessage({ __audit_event:1, type:'summary', summary: summary }, '*'); try{ window.__audit_last_summary = summary; }catch(e2){} pushes++; if(pushes<10) setTimeout(flush, 500); } catch(e3){} } flush();
	} catch(e) { try{ parent.postMessage({__audit_event:1, type:'error', message:String(e) }, '*'); } catch(e2){} } };
	return src;
}

