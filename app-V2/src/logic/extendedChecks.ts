import type { ZipBundle, BundleResult, Finding } from '../../../src/logic/types';
import type { Settings } from '../../../src/logic/profiles';
type FindingEx = Finding & { tags?: string[] };

// Heuristic host list for measurement pixels
const MEASUREMENT_HOSTS = [
	'doubleclick.net','googletagmanager.com','google-analytics.com','adsrvr.org','everesttech.net','crwdcntrl.net','impactradius','moatads.com','adroll.com','adnxs.com','demdex.net','omtrdc.net'
];

export async function buildExtendedFindings(bundle: ZipBundle, partial: BundleResult, settings: Settings): Promise<Finding[]> {
	// Use a flexible local array to allow optional debug-only fields, then cast on return
	const out: FindingEx[] = [];
	const files = Object.keys(bundle.files);
	const primary = partial.primary?.path;
	const htmlText = primary ? new TextDecoder().decode(bundle.files[primary]) : '';
	const entryName = primary ? (primary.split('/').pop() || primary) : undefined;
	const profile = settings.profile ?? 'IAB';
	const isIabProfile = profile === 'IAB';

	// CM360 Hard Requirements
	{
		// pkg-format: upload is zip/adz and no nested zips inside
		const mode = (bundle as any).mode as string | undefined;
		const isZipMode = mode === 'zip';
		const nestedArchives = files.filter(p => /(\.zip|\.adz)$/i.test(p));
		// Analyze top-level structure for clearer guidance
		const rootFiles = files.filter(p => !p.includes('/'));
		const topDirs = Array.from(new Set(files.filter(p => p.includes('/')).map(p => p.split('/')[0])));
		// Common wrapper folder names that often indicate double-wrapping
		const WRAPPER_HINTS = [/unzip/i, /for[-_]?delivery/i, /delivery/i, /_zip/i, /_final/i];
		const wrapperDirs = topDirs.filter(d => WRAPPER_HINTS.some(rx => rx.test(d)));
		const singleTopDir = topDirs.length === 1 ? topDirs[0] : undefined;

		const pkgMsgs: string[] = [];
		pkgMsgs.push(`Package: ${isZipMode ? 'ZIP/ADZ' : 'not ZIP/ADZ'}`);
		pkgMsgs.push(`Nested archives: ${nestedArchives.length}`);
		pkgMsgs.push(`Top-level: ${rootFiles.length} file(s), ${topDirs.length} folder(s)`);
		if (wrapperDirs.length) pkgMsgs.push(`Wrapper folders detected: ${wrapperDirs.slice(0,5).join(', ')}`);
		if (singleTopDir && rootFiles.length === 0) pkgMsgs.push(`All content inside single folder: "${singleTopDir}" — zip the folder's contents, not the folder`);

		const pkgOffenders = nestedArchives.map(p => ({ path: p, detail: 'Nested archive (.zip/.adz) — remove inner ZIP and include its files at top level' }));
		out.push({ id: 'pkg-format', title: 'Packaging Format', severity: (!isZipMode || nestedArchives.length>0) ? 'FAIL' : 'PASS', messages: pkgMsgs, offenders: pkgOffenders });

		// entry-html: exactly one HTML entry and all other files referenced by it
		const htmlFiles = files.filter(p=>/\.(html?)$/i.test(p));
		const htmlCount = htmlFiles.length;
		const referenced = new Set<string>();
		if (partial.references && Array.isArray(partial.references)) {
			for (const r of partial.references) {
				if (r.inZip && r.normalized) referenced.add(r.normalized.toLowerCase());
			}
		}
		if (partial.primary?.path) referenced.add(partial.primary.path.toLowerCase());
		const unref: { path:string; detail?:string }[] = [];
		for (const p of files) {
			const pl = p.toLowerCase();
			if (htmlFiles.includes(p)) continue; // HTML allowed to be unreferenced (primary will be counted)
			if (!referenced.has(pl)) unref.push({ path: p, detail: 'Not referenced by entry file' });
		}
		let entryMsgs: string[] = [];
		entryMsgs.push(`Entry HTML files: ${htmlCount} (expected 1)`);
		entryMsgs.push(`Unreferenced files: ${unref.length}`);
		const entrySeverity = (htmlCount !== 1)
			? 'FAIL'
			: (unref.length > 0 ? 'WARN' : 'PASS');
		out.push({ id: 'entry-html', title: 'Single Entry HTML & References', severity: entrySeverity as any, messages: entryMsgs, offenders: unref });

		// file-limits: <=100 files and <=10MB upload (compressed)
		const fileCount = files.length;
		const zipBytes = (partial.zippedBytes || (bundle as any).bytes?.length || 0) as number;
		const overCount = fileCount > 100;
		const overSize = zipBytes > 10 * 1024 * 1024;
		const flMsgs: string[] = [ `Files: ${fileCount} / 100`, `Zip size: ${(zipBytes/1024).toFixed(1)} KB / 10240.0 KB` ];
		out.push({ id: 'file-limits', title: 'File Count and Upload Size', severity: (overCount || overSize) ? 'FAIL' : 'PASS', messages: flMsgs, offenders: [] });

		// allowed-ext: enforce extension allowlist
		const ALLOW = new Set(['.html','.htm','.js','.css','.jpg','.jpeg','.gif','.png','.json','.xml','.svg','.eot','.otf','.ttf','.woff','.woff2']);
		const badExts: any[] = [];
		for (const p of files) {
			const m = p.toLowerCase().match(/\.[a-z0-9]+$/);
			const ext = m? m[0] : '';
			if (!ext || !ALLOW.has(ext)) badExts.push({ path:p, detail: ext||'(no extension)' });
		}
		out.push({ id: 'allowed-ext', title: 'Allowed File Extensions', severity: badExts.length? 'FAIL':'PASS', messages: [ `Disallowed extension files: ${badExts.length}` ], offenders: badExts });

		// iframe-safe: disallow cross-frame DOM access heuristics
		// Only flag true window parent/top access: window.parent.*, window.top.*, or bare parent.* / top.* (global)
		// Do NOT flag object properties like this.parent or foo.parent (CreateJS display list, etc.).
		const cfOff: any[] = [];
		const parentTopGlobal = /(^|[^.$\w])(?:window\.)?(?:parent|top)\.(?!postMessage\b)/i;
		const docDomain = /document\.domain\s*=/i;
		for (const p of files) if (/\.(js|html?)$/i.test(p)) {
			const text = new TextDecoder().decode(bundle.files[p]);
			const lines = text.split(/\r?\n/);
			for (let i=0;i<lines.length;i++){
				const line = lines[i];
				if (docDomain.test(line)) {
					cfOff.push({ path:p, line: i+1, detail: line.trim().slice(0,200) });
					continue;
				}
				const m = parentTopGlobal.exec(line);
				if (m) {
					// If matched via the bare form, ensure not this.parent / foo.parent (guarded by regex pre-char check)
					cfOff.push({ path:p, line: i+1, detail: line.trim().slice(0,200) });
				}
			}
		}
		out.push({ id: 'iframe-safe', title: 'Iframe Safe (No Cross-Frame DOM)', severity: cfOff.length? 'FAIL':'PASS', messages: [ `Cross-frame access references: ${cfOff.length}` ], offenders: cfOff });

		// clicktag: Prefer CM360 pattern, but be less strict and concise in output
		let hasClickTag = false; let hasWindowClickTag = false; let hasOpen = false; let hasEnablerExit = false; const ctOff: any[] = [];
		// Accept common variants of the clickTag variable (case-insensitive)
		const ctVar = /\b(?:window\.)?(clicktag|clickTag|clickTAG)\d*\b/i;
		const ctVarWindow = /\bwindow\.(clicktag|clickTag|clickTAG)\d*\b/i;
		const ctOpen = /window\.open\s*\(\s*(?:window\.)?(clickTAG|clickTag)\d*\b/i;
		const ctOpenLoose = /window\.open\s*\(\s*([^)]*)\)/ig;
		const ctAliasDecl = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*clicktag\d*[^;]*;/ig;
		const ctAliasAssign = /\b([A-Za-z_$][\w$]*)\s*=\s*[^;]*clicktag\d*[^;]*;/ig;
		const enablerExit = /\b(?:studio\.)?Enabler\.(?:exit|dynamicExit)\s*\(/i;
		// Additional usages that count as valid navigation via clickTag variable
		const anchorHrefJs = /<a\b[^>]*\bhref=["']\s*javascript:\s*window\.open\s*\([^"']*(?:window\.)?(clickTAG|clickTag)\d*/i;
		const anchorOnclick = /<a\b[^>]*\bonclick=["'][^"']*(?:window\.)?open\s*\([^"']*(?:window\.)?(clickTAG|clickTag)\d*/i;
		const assignLocationVar = /(window|document|top)\.location\s*=\s*(?:window\.)?(clickTAG|clickTag)\d*/i;
		for (const p of files) if (/(\.(js|html?))$/i.test(p)) {
			const text = new TextDecoder().decode(bundle.files[p]);
			const aliasNames = new Set<string>();
			let aliasMatch: RegExpExecArray | null;
			ctAliasDecl.lastIndex = 0;
			while ((aliasMatch = ctAliasDecl.exec(text))) {
				if (aliasMatch && aliasMatch[1]) aliasNames.add(aliasMatch[1]);
			}
			ctAliasAssign.lastIndex = 0;
			while ((aliasMatch = ctAliasAssign.exec(text))) {
				if (!aliasMatch || !aliasMatch[1]) continue;
				const idx = aliasMatch.index ?? 0;
				const prevChar = idx > 0 ? text[idx - 1] : '';
				if (prevChar === '.' || prevChar === '$' || prevChar === ']') continue;
				aliasNames.add(aliasMatch[1]);
			}
			const lines = text.split(/\r?\n/);
			const seen = new Set<string>();
			for (let i=0;i<lines.length;i++){
				const line = lines[i];
				if (ctVar.test(line)) { hasClickTag = true; const k = `${p}:${i+1}:var`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'var', detail: line.trim().slice(0,200) }); } }
				if (ctVarWindow.test(line)) { hasWindowClickTag = true; const k = `${p}:${i+1}:varw`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'varw', detail: line.trim().slice(0,200) }); } }
				if (ctOpen.test(line)) { hasOpen = true; const k = `${p}:${i+1}:open`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'open', detail: line.trim().slice(0,200) }); } }
				ctOpenLoose.lastIndex = 0;
				let openLoose: RegExpExecArray | null;
				while ((openLoose = ctOpenLoose.exec(line))) {
					const rawArg = (openLoose[1] || '').trim();
					if (!rawArg) continue;
					const includesClickVar = /clicktag/i.test(rawArg);
					let aliasUsed = false;
					let aliasName = '';
					const identMatch = rawArg.match(/^([A-Za-z_$][\w$]*)$/);
					if (identMatch && identMatch[1]) {
						aliasName = identMatch[1];
						if (aliasNames.has(aliasName)) aliasUsed = true;
					}
					if (!includesClickVar && !aliasUsed) continue;
					const key = includesClickVar ? `${p}:${i+1}:open` : `${p}:${i+1}:open-alias:${aliasName || rawArg}`;
					if (seen.has(key)) continue;
					if (includesClickVar && seen.has(`${p}:${i+1}:open`)) continue;
					hasOpen = true;
					seen.add(key);
					ctOff.push({ path: p, line: i+1, kind: includesClickVar ? 'open' : 'open-alias', detail: line.trim().slice(0,200) });
				}
				if (enablerExit.test(line)) { hasEnablerExit = true; const k = `${p}:${i+1}:enabler`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'enabler', detail: line.trim().slice(0,200) }); } }
				if (anchorHrefJs.test(line)) { hasOpen = true; const k = `${p}:${i+1}:ahref`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'ahref', detail: line.trim().slice(0,200) }); } }
				if (anchorOnclick.test(line)) { hasOpen = true; const k = `${p}:${i+1}:aonclick`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'aonclick', detail: line.trim().slice(0,200) }); } }
				if (assignLocationVar.test(line)) { hasOpen = true; const k = `${p}:${i+1}:assign`; if (!seen.has(k)) { seen.add(k); ctOff.push({ path:p, line:i+1, kind:'assign', detail: line.trim().slice(0,200) }); } }
			}
		}
		// Severity rules (less strict):
		// PASS: Enabler exits OR (clickTag var present AND used for navigation via window.open/anchor/onclick/location)
		// WARN: some click handling detected but not fully aligned (var present but not used; or usage present but var not clearly detected)
		// FAIL: no clickTag usage found at all
		const usedForNav = hasOpen; // true if any supported navigation patterns found using clickTag
		const ctPass = hasEnablerExit || (hasClickTag && usedForNav);
		const ctWarn = !ctPass && (hasClickTag || hasWindowClickTag || usedForNav || hasEnablerExit);
		const ctSeverity = ctPass ? 'PASS' : ctWarn ? 'WARN' : 'FAIL';
		const clickMsgs: string[] = [];
		if (hasClickTag || hasWindowClickTag || hasEnablerExit) clickMsgs.push('clickTag detected');
		else clickMsgs.push('clickTag not detected');
		if (ctPass) clickMsgs.push('clickTag referenced for redirect');
		out.push({ id: 'clicktag', title: 'ClickTag Present and Used', severity: ctSeverity as any, messages: clickMsgs, offenders: ctOff });

		// no-webstorage: disallow any mention of storage APIs
		const wsOff: any[] = [];
		const wsPat = /(localStorage|sessionStorage|indexedDB|openDatabase)\b/i;
		for (const p of files) if (/\.(js|html?)$/i.test(p)) {
			const text = new TextDecoder().decode(bundle.files[p]);
			const lines = text.split(/\r?\n/);
			for (let i=0;i<lines.length;i++){
				const line = lines[i]; if (wsPat.test(line)) wsOff.push({ path:p, line:i+1, detail: line.trim().slice(0,200) });
			}
		}
		out.push({ id: 'no-webstorage', title: 'No Web Storage APIs', severity: wsOff.length? 'FAIL':'PASS', messages: [ `Storage API references: ${wsOff.length}` ], offenders: wsOff });

		// https-only: rely on core httpsOnly check; no duplicate here
	}

	// Dedicated CPU/Memory budgets (retain memory advisory only; CPU covered by priority 'cpu-budget')
	{
		const meta = ((window as any).__audit_last_summary as any) || {};
		if (typeof meta.memoryMB === 'number') {
			const current = Number(meta.memoryMB) || 0;
			const min = typeof meta.memoryMinMB === 'number' ? Number(meta.memoryMinMB) : undefined;
			const max = typeof meta.memoryMaxMB === 'number' ? Number(meta.memoryMaxMB) : undefined;
			const fmt = (v?: number) => (typeof v === 'number' && isFinite(v)) ? (Math.round(v*10)/10).toFixed(1) : 'n/a';
			const range = (min!==undefined || max!==undefined) ? `~${fmt(min)} – ${fmt(max)} MB` : `~${fmt(current)} MB`;
			out.push({
				id: 'memoryUsage',
				title: 'Memory Usage',
				severity: 'WARN',
				messages: [`Preview JS heap ${range}`, 'Source: performance.memory (Chromium); advisory only'],
				offenders: [],
			});
		}
	}

	if (isIabProfile) {
		// IAB Global thresholds (Chunk 4)
		{
			// host-requests-initial: cap 10
			const cap = 10;
			const initial = partial.initialRequests ?? 0;
			out.push({
				id: 'host-requests-initial',
				title: 'Initial Host Requests',
				severity: initial > cap ? 'FAIL' : 'PASS',
				messages: [`Initial requests: ${initial} / ${cap}`],
				offenders: [],
			});

			// cpu-budget: ≤ 30% busy in first 3s (based on Long Tasks time)
			try {
				const meta = (window as any).__audit_last_summary as any;
				const longMs = typeof meta?.longTasksMs === 'number' ? Math.max(0, Math.min(3000, Math.round(meta.longTasksMs))) : undefined;
				if (typeof longMs === 'number') {
					const pct = Math.round((longMs / 3000) * 100);
					out.push({ id: 'cpu-budget', title: 'CPU Busy Budget', severity: pct > 30 ? 'FAIL' : 'PASS', messages: [`Main thread busy ~${pct}% (long tasks ${longMs} ms / 3000 ms)`], offenders: [] });
				} else {
					out.push({ id: 'cpu-budget', title: 'CPU Busy Budget', severity: 'PASS', messages: ['Not measured in preview'], offenders: [] });
				}
			} catch {}

			// animation-cap: ≤ 15s OR ≤ 3 loops
			try {
				const cssTexts: string[] = [];
				// Inline <style> blocks
				try {
					const html = htmlText || '';
					const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1] || '');
					cssTexts.push(...styleBlocks);
				} catch {}
				// External CSS files in bundle
				for (const p of files) if (/\.css$/i.test(p)) {
					try { cssTexts.push(new TextDecoder().decode(bundle.files[p])); } catch {}
				}
				// Also scan raw HTML for inline style attributes
				const htmlRaw = htmlText || '';
				cssTexts.push(htmlRaw);

				let maxDurS = 0; let maxLoops = 1; let infinite = false; let offenders: any[] = [];
				const parseDurToken = (tok: string): number => {
					const s = String(tok||'').trim();
					let m = /^([\d.]+)\s*s$/i.exec(s); if (m) return parseFloat(m[1])||0;
					m = /^([\d.]+)\s*ms$/i.exec(s); if (m) return (parseFloat(m[1])||0)/1000;
					const n = parseFloat(s); return isFinite(n) ? n : 0;
				};
				for (const t of cssTexts) {
					// durations (support s/ms)
					const reDur = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation-duration\s*:\s*([^;\n\r]+)[;\n\r]/gi; let m: RegExpExecArray | null;
					reDur.lastIndex = 0; while ((m = reDur.exec(t))) {
						const list = String(m[1]||'').split(',');
						for (const part of list) { const v = parseDurToken(part); if (isFinite(v)) maxDurS = Math.max(maxDurS, v); }
					}
					// iteration counts
					const reIter = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation-iteration-count\s*:\s*([^;\n\r]+)[;\n\r]/gi; let mi: RegExpExecArray | null;
					reIter.lastIndex = 0; while ((mi = reIter.exec(t))) {
						const list = String(mi[1]||'').split(',');
						for (const raw0 of list) {
							const raw = raw0.trim().toLowerCase();
							if (raw === 'infinite') { infinite = true; maxLoops = Math.max(maxLoops, 9999); }
							else { const v = parseFloat(raw); if (isFinite(v)) maxLoops = Math.max(maxLoops, Math.round(v)); }
						}
					}
					// shorthand: animation: <name> <duration> <timing> <delay> <iteration-count> ...
					const reSh = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation\s*:\s*([^;\n\r]+)[;\n\r]/gi; let ms: RegExpExecArray | null;
					reSh.lastIndex = 0; while ((ms = reSh.exec(t))) {
						const blocks = String(ms[1]||'').split(',');
						for (const blk of blocks) {
							const tk = blk.trim().replace(/\([^)]*\)/g, '');
							const toks = tk.split(/\s+/);
							for (const tok of toks) {
								if (/^([\d.]+)(ms|s)$/i.test(tok)) { const v = parseDurToken(tok); if (v>maxDurS) maxDurS = v; }
								else if (tok.toLowerCase()==='infinite') { infinite = true; if (maxLoops<9999) maxLoops = 9999; }
								else if (/^\d+$/.test(tok)) { const iv = parseInt(tok,10); if (iv>maxLoops) maxLoops = iv; }
							}
						}
					}
				}
				// If static detection found nothing meaningful, fall back to runtime probe values
				if (maxDurS === 0 && !infinite && maxLoops <= 1) {
					try {
						const meta = (window as any).__audit_last_summary as any;
						if (meta && (typeof meta.animMaxDurationS === 'number' || typeof meta.animMaxLoops === 'number' || meta.animInfinite)) {
							maxDurS = Math.max(0, Number(meta.animMaxDurationS||0));
							maxLoops = Math.max(1, Number(meta.animMaxLoops||1));
							infinite = !!meta.animInfinite;
						}
					} catch {}
				}
				const violates = (infinite || maxLoops > 3) && maxDurS > 15;
				const messages: string[] = [];
				if (maxDurS===0 && !infinite && maxLoops<=1) {
					messages.push('No CSS animation detected (JS animation or unsupported syntax)');
				} else {
					messages.push(`Max animation duration ~${maxDurS.toFixed(2)} s`);
					messages.push(`Max loops ${infinite ? 'infinite' : maxLoops}`);
				}
				// Policy text removed from bullets; shown on hover of badge
				out.push({ id: 'animation-cap', title: 'Animation Length Cap', severity: violates ? 'FAIL' : 'PASS', messages, offenders });
			} catch {}
		}
	}

	// Single-file validators: image / video / audio metadata
	if (files.length === 1) {
		const only = files[0];
		if (/\.(png|jpe?g|gif|webp)$/i.test(only)) {
			try {
	const src = bundle.files[only];
	const copy = new Uint8Array(src.byteLength);
	copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
	const blob = new Blob([copy.buffer], { type: guessMime(only) });
				const url = URL.createObjectURL(blob); const img = new Image();
				await new Promise<void>((resolve,reject)=>{ img.onload=()=>resolve(); img.onerror=()=>reject(new Error('img load')); img.src=url; });
				out.push({
					id:'imageMeta',
					title:'Image Metadata',
					severity:'PASS',
					messages:[`Dimensions ${img.naturalWidth}x${img.naturalHeight}`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
					offenders: [],
					tags:['debug'],
				});
				URL.revokeObjectURL(url);
			} catch {}
		}
		if (/\.(mp4|webm|ogg|mov)$/i.test(only)) {
			try {
	const src = bundle.files[only];
	const copy = new Uint8Array(src.byteLength);
	copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
	const blob = new Blob([copy.buffer], { type: guessMime(only) });
				const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.preload = 'metadata'; v.src = url;
				await new Promise<void>((resolve)=>{ v.onloadedmetadata = ()=>resolve(); setTimeout(()=>resolve(), 3000); });
				out.push({
					id:'videoMeta',
					title:'Video Metadata',
					severity:'PASS',
					messages:[`Dimensions ${v.videoWidth}x${v.videoHeight}`, `Duration ${isFinite(v.duration)?v.duration.toFixed(2):'n/a'}s`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
					offenders: [],
					tags:['debug'],
				});
				URL.revokeObjectURL(url);
			} catch {}
		}
		if (/\.(mp3|wav|ogg|m4a)$/i.test(only)) {
			try {
	const src = bundle.files[only];
	const copy = new Uint8Array(src.byteLength);
	copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
	const blob = new Blob([copy.buffer], { type: guessMime(only) });
				const url = URL.createObjectURL(blob); const a = new Audio(); a.preload='metadata'; a.src=url;
				await new Promise<void>((resolve)=>{ a.onloadedmetadata=()=>resolve(); setTimeout(()=>resolve(), 3000); });
				out.push({
					id:'audioMeta',
					title:'Audio Metadata',
					severity:'PASS',
					messages:[`Duration ${isFinite((a as any).duration)?(a as any).duration.toFixed(2):'n/a'}s`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
					offenders: [],
					tags:['debug'],
				});
				URL.revokeObjectURL(url);
			} catch {}
		}
	}

	// (Removed) Animation Duration heuristic — covered by priority 'animation-cap'

	// CSS Embedded
	{
		const hasStyleTag = /<style[\s>]/i.test(htmlText);
		const inlineStyles = (htmlText.match(/ style=/gi)||[]).length;
		const severity = (hasStyleTag || inlineStyles>0) ? 'PASS' : 'FAIL';
		out.push({ id:'cssEmbedded', title:'CSS Embedded', severity, messages:[hasStyleTag? 'Style tags present':'', inlineStyles? `${inlineStyles} inline style attributes`:''].filter(Boolean), offenders: []});
	}

		// CSS/JS Minified (heuristic): must be minified (except clickTag snippet)
	{
		let jsMinified=0, cssMinified=0, jsFiles=0, cssFiles=0; const offs:any[]=[];
		for (const p of files) if (/\.(js|css)$/i.test(p)) {
			const t = new TextDecoder().decode(bundle.files[p]);
			const lines = t.split(/\r?\n/);
			const longLines = lines.filter(l => l.length>2000);
			const dense = lines.filter(l => l.length>200 && (l.replace(/\s+/g,'').length/l.length) > 0.98);
			const isMin = longLines.length>0 || dense.length>20;
			if (/\.js$/i.test(p)) jsFiles++; else cssFiles++;
			if (isMin) { (/\.js$/i.test(p)? jsMinified++ : cssMinified++); } else { offs.push({ path:p, detail:'not minified (heuristic)' }); }
		}
		const jsNot = Math.max(0, jsFiles - jsMinified);
		const cssNot = Math.max(0, cssFiles - cssMinified);
		const severity = (jsNot+cssNot)===0 ? 'PASS' : 'FAIL';
		out.push({ id:'minified', title:'CSS/JS Minified', severity, messages:[`JS minified: ${jsMinified}/${jsFiles}`, `CSS minified: ${cssMinified}/${cssFiles}`], offenders: offs });
	}

	// Hosted File Count// Hosted File Count
	{
		const count = files.length; const totalKB = Math.round((partial.totalBytes||0)/102.4)/10;
						out.push({
			id:'hostedCount',
			title:'Hosted File Count',
			severity:'PASS',
			messages:[`Files: ${count}`],
			offenders: [],
			tags:['debug'],
		});
	}
	// Hosted File Size (uncompressed total)
	{
		const totalKB = Math.round((partial.totalBytes||0)/1024);
		const severityHS = totalKB <= 2500 ? 'PASS' : 'FAIL';
		out.push({ id:'hostedSize', title:'Hosted File Size', severity: severityHS as any, messages:[`Uncompressed ${totalKB} KB`, 'Target: <= 2500 KB'], offenders: []});
	}

	// NOTE: Uncompressed/Compressed file size are already reported within the IAB Weight check; omit duplicates here.


	// Dialogs and Modals (alert/confirm/prompt usage)
	{
		const meta = (window as any).__audit_last_summary as any;
		const dcount = meta?.dialogs||0;
				out.push({
			id:'dialogs',
			title:'Dialogs and Modals',
			severity: dcount>0?'FAIL':'PASS',
			messages:[`Count: ${dcount}`],
			offenders: [],
		});
	}

	// Cookies Dropped & Local Storage
	{
		const meta = (window as any).__audit_last_summary as any;
		const cookieSet = meta?.cookies||0; const ls = meta?.localStorage||0;
				out.push({
			id:'cookies',
			title:'Cookies Dropped',
			severity: cookieSet>0?'FAIL':'PASS',
			messages:[`Cookie sets: ${cookieSet}`],
			offenders: [],
		});
				out.push({
			id:'localStorage',
			title:'Local Storage',
			severity: ls>0?'FAIL':'PASS',
			messages:[`setItem calls: ${ls}`],
			offenders: [],
		});
	}

	// DOMContentLoaded & Visual Start timing (preview)
	{
		const meta = (window as any).__audit_last_summary as any;
		const dcl = meta?.domContentLoaded; const visual = meta?.visualStart; const frames = meta?.frames;
	out.push({ id:'timing', title:'Timing Metrics', severity:'PASS', messages:[`DOMContentLoaded ${Math.round(dcl||0)} ms`, `Time to Render ~${Math.round(visual||0)} ms`, `Frames observed ${frames||0}`], offenders: [], tags:['debug']});
		// Ad Start metric (first visible part appears)
		{
			const has = typeof visual === 'number' && isFinite(visual);
			const sev = has && visual < 500 ? 'PASS' : 'WARN';
			const msg = has ? `Render start ~${Math.round(visual)} ms` : 'Not captured';
			out.push({ id:'timeToRender', title:'Time to Render', severity: sev as any, messages:[msg, 'Target: < 500 ms'], offenders: []});
		}
		if (typeof dcl === 'number') {
			out.push({ id:'domContentLoaded', title:'DOMContentLoaded', severity: dcl<1000? 'PASS':'FAIL', messages:[`DCL ${Math.round(dcl)} ms`, 'Target: < 1000 ms'], offenders: []});
		}
		// Preview diagnostics (concise): include only notable values
		const diagLines: string[] = [];
		if (typeof meta?.rewrites==='number' && meta.rewrites>0) diagLines.push(`Rewrites: ${meta.rewrites}`);
		if (typeof meta?.imgRewrites==='number' && meta.imgRewrites>0) diagLines.push(`Image URLs Rewritten: ${meta.imgRewrites}`);
		if (typeof meta?.mediaRewrites==='number' && meta.mediaRewrites>0) diagLines.push(`Media URLs Rewritten: ${meta.mediaRewrites}`);
		if (typeof meta?.scriptRewrites==='number' && meta.scriptRewrites>0) diagLines.push(`Script URLs Rewritten: ${meta.scriptRewrites}`);
		if (typeof meta?.linkRewrites==='number' && meta.linkRewrites>0) diagLines.push(`Link URLs Rewritten: ${meta.linkRewrites}`);
		if (typeof meta?.setAttrRewrites==='number' && meta.setAttrRewrites>0) diagLines.push(`Attributes Rewritten: ${meta.setAttrRewrites}`);
		if (typeof meta?.styleUrlRewrites==='number' && meta.styleUrlRewrites>0) diagLines.push(`Style URLs Rewritten: ${meta.styleUrlRewrites}`);
		if (typeof meta?.domImages==='number' && meta.domImages>0) diagLines.push(`DOM Images: ${meta.domImages}`);
		if (typeof meta?.domBgUrls==='number' && meta.domBgUrls>0) diagLines.push(`DOM Background URLs: ${meta.domBgUrls}`);
		if (typeof meta?.enablerStub==='boolean' && meta.enablerStub) diagLines.push('DoubleClick Enabler stub: active');
		if (diagLines.length) {
			out.push({
				id:'previewDiag',
				title:'Runtime Diagnostics',
				severity:'PASS',
				messages: diagLines,
				offenders: [],
				tags:['debug'],
			});
		}

	}
	// Measurement Pixels (hosts)
	{
		const offenders: any[] = [];
		for (const r of partial.references||[]) {
			if (r.external) {
				try { const u = new URL(r.url, 'https://x'); if (MEASUREMENT_HOSTS.some(h => u.hostname.toLowerCase().includes(h))) offenders.push({ path: r.from, detail: r.url }); } catch {}
			}
		}
		const count = offenders.length;
		const severityM = count >= 5 ? 'FAIL' : count > 0 ? 'WARN' : 'PASS';
				out.push({
			id:'measurement',
			title:'Measurement Pixels',
			severity: severityM as any,
			messages:[`${count} known tracking references`, 'Target: < 5'],
			offenders,
		});
	}

	// HTML5 Library Detection (simple signatures)
	{
		const libs: string[] = [];
		const text = files.filter(p=>/\.(js|html?)$/i.test(p)).map(p=> new TextDecoder().decode(bundle.files[p])).join('\n');
		if (/createjs\./i.test(text)) libs.push('CreateJS');
		if (/gsap\(|TweenMax|TweenLite/i.test(text)) libs.push('GSAP');
		if (/pixi\.js/i.test(text)) libs.push('PixiJS');
		if (/jquery|\$\(/i.test(text)) libs.push('jQuery');
		out.push({ id:'html5lib', title:'HTML5 Library', severity: libs.length? 'FAIL':'PASS', messages:[ libs.length? libs.join(', ') : 'None detected' ], offenders: []});
	}

	// Has Video / Iframe Count / Images Optimized (heuristic by extension and size)
	{
		const exts = (p:string)=> p.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]||'';
		const videos = files.filter(p=>/(\.mp4|\.webm|\.ogg|\.mov)$/i.test(p));
		const iframes = (htmlText.match(/<iframe\b/gi)||[]).length;
		const images = files.filter(p=>/(\.png|\.jpe?g|\.gif|\.webp)$/i.test(p));
		const offenders: any[] = [];
		for (const p of images) {
			const size = bundle.files[p].byteLength;
			if (size > 300*1024 && /\.png$/i.test(p)) offenders.push({ path:p, detail:`PNG ${Math.round(size/1024)} KB — consider JPEG/WebP` });
		}
				out.push({
			id:'video',
			title:'Has Video',
			severity:'PASS',
			messages:[videos.length ? `${videos.length} video file(s)` : 'No'],
			offenders: videos.map(v => ({ path: v })),
			tags:['debug'],
		});
		out.push({ id:'iframes', title:'Iframe Count', severity: iframes>0?'WARN':'PASS', messages:[`iframes (static HTML): ${iframes}`], offenders: []});
				out.push({
			id:'imagesOptimized',
			title:'Images Optimized',
			severity: offenders.length ? 'FAIL' : 'PASS',
			messages:[offenders.length ? `${offenders.length} image(s) could be optimized` : 'OK'],
			offenders,
			tags:['debug'],
		});
	}

	// Index File Check
	if (bundle && bundle.files) {
		const hasIndex = Object.keys(bundle.files).some(p => /^index\.html?$/i.test(p.split('/').pop()||''));
		out.push({ id:'indexFile', title:'Index File Check', severity: hasIndex? 'PASS':'FAIL', messages:[ hasIndex? 'index.html present':'index.html not found at root' ], offenders: []});
	}

	// (Merged into 'bad-filenames') Filename must contain ad size token like 300x250

	// NOTE: Click Tag presence is covered by the built-in 'clickTags' check; omit duplicate static scan here.

	// (Removed) CPU/Memory Heuristics — avoid duplication with cpu-budget; memory advisory retained

	// Syntax Errors — from probe
	{
		const meta = (window as any).__audit_last_summary as any;
		const errors = meta?.errors || 0;
		out.push({ id:'syntaxErrors', title:'Syntax Errors', severity: errors>0?'FAIL':'PASS', messages:[`Uncaught errors: ${errors}`], offenders: []});
	}

	// document.write & jQuery usage
	{
		const meta = (window as any).__audit_last_summary as any;
		const docw = meta?.documentWrites||0; const jq = meta?.jquery||false;
		// CM360 Recommended: Warn on any usage
		out.push({ id:'no-document-write', title:'Avoid document.write()', severity: docw>0?'WARN':'PASS', messages:[ docw>0? `Calls detected: ${docw}` : 'No document.write usage detected' ], offenders: []});
		out.push({ id:'jquery', title:'Uses jQuery', severity: jq?'WARN':'PASS', messages:[jq?'Detected':'Not detected'], offenders: []});
	}

	// Backup Ad Found — heuristic: presence of single image file or a file named backup.*
	{
		const img = Object.keys(bundle.files).filter(p=>/(^|\/)backup\.(png|jpe?g|gif)$/i.test(p));
		// CM360 Recommended: do not pack backup in ZIP (warn if present)
		const severity = img.length ? 'WARN' : 'PASS';
		out.push({ id:'no-backup-in-zip', title:'No Backup Image Inside ZIP', severity, messages:[ img.length? `Found: ${img[0]}` : 'No backup image in ZIP' ], offenders: img.slice(0,5).map(p=>({ path:p }))});
	}

	// (Removed) Meta ad.size advisory — enforced via priority 'primaryAsset'

	// Relative references preferred for packaged assets
	{
		const offenders: any[] = [];
		for (const r of partial.references||[]) {
			if (!r.inZip) continue;
			const u = String(r.url||'');
			if (u.startsWith('/') || /^https?:\/\//i.test(u)) offenders.push({ path: r.from, line: r.line, detail: u });
		}
		out.push({ id:'relative-refs', title:'Relative Paths For Packaged Assets', severity: offenders.length? 'WARN':'PASS', messages:[ offenders.length? `${offenders.length} absolute path reference(s) found` : 'All packaged asset references are relative' ], offenders });
	}

	// (Removed) File Types advisory — covered by priority 'allowed-ext'

	if (isIabProfile) {
		// Creative Border — detect CSS border: ... or four 1px edge lines (common in GWD)
		{
		// 1) Look for CSS border declarations in HTML and linked CSS
		const cssSources: Array<{ path: string; text: string }> = [];
		try {
			const html = htmlText || '';
			const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((m, idx) => ({
				path: primary ? `${primary} <style #${idx + 1}>` : `<style #${idx + 1}>`,
				text: m[1] || '',
			}));
			cssSources.push(...styleBlocks);
			for (const p of files) if (/\.css$/i.test(p)) {
				try {
					const text = new TextDecoder().decode(bundle.files[p]);
					cssSources.push({ path: p, text });
				} catch {}
			}
		} catch {}
		let cssHasBorder = false;
		const cssOffenders: any[] = [];
		for (const source of cssSources) {
			const lines = source.text.split(/\r?\n/);
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (/\bborder(?:-top|-right|-bottom|-left|)\s*:\s*\d+px\s+(solid|dashed|double)/i.test(line)) {
					cssHasBorder = true;
					cssOffenders.push({ path: source.path, line: i + 1, detail: line.trim().slice(0, 200) });
				}
			}
		}

		let hasBorder = cssHasBorder || /\bborder\s*:\s*\d+px\s+(solid|dashed|double)\b/i.test(htmlText);
		let messages: string[] = [];
		const edgeOffenders: any[] = [];
		if (hasBorder) messages.push('Detected via CSS border');

		// 2) Detect absolute edge lines with thickness 1-4px and any visible color
		try {
			const doc = new DOMParser().parseFromString(htmlText, 'text/html');
			const nodes = Array.from(doc.querySelectorAll('[style]')) as HTMLElement[];
			function parseStyle(s: string): Record<string, string> {
				const map: Record<string, string> = {};
				s.split(';').forEach(part => {
					const [k, v] = part.split(':');
					if (!k || !v) return;
					map[k.trim().toLowerCase()] = v.trim().toLowerCase();
				});
				return map;
			}
			function isZero(val?: string){ if(!val) return false; return /^0(px|)$/.test(val) || val === '0'; }
			function isPx1to16(val?: string){ if(!val) return false; const m = /^([1-9]|1[0-6])(px)?$/.exec(val); return !!m; }
			function isFull(val?: string){ if(!val) return false; return /^100%$/.test(val); }
			function isVisibleColor(val?: string){ if(!val) return false; return !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(val) && /#|rgb|hsl|\bblack\b|\bwhite\b|\bred\b|\bblue\b|\bgreen\b|\byellow\b|\bgray\b/i.test(val); }
			let top=false,bottom=false,left=false,right=false;
			for (const el of nodes) {
				const st = parseStyle(el.getAttribute('style') || '');
				const bg = st['background-color'] || st['background'] || '';
				const pos = st['position'] || '';
				if (pos !== 'absolute') continue;
				const id = el.getAttribute('id');
				const cls = el.getAttribute('class');
				const tag = el.tagName.toLowerCase();
				const marker = [tag, id ? `#${id}` : null, cls ? `.${cls.replace(/\s+/g, '.')}` : null].filter(Boolean).join('');
				// top line
				if (isZero(st['top']) && isZero(st['left']) && isFull(st['width']) && isPx1to16(st['height']) && isVisibleColor(bg)) { top = true; edgeOffenders.push({ path: entryName || primary || '(inline)', detail: `${marker || 'element'} top line ${st['height']||''}` }); continue; }
				// bottom line
				if (isZero(st['bottom']) && isZero(st['left']) && isFull(st['width']) && isPx1to16(st['height']) && isVisibleColor(bg)) { bottom = true; edgeOffenders.push({ path: entryName || primary || '(inline)', detail: `${marker || 'element'} bottom line ${st['height']||''}` }); continue; }
				// left line
				if (isZero(st['left']) && isZero(st['top']) && isFull(st['height']) && isPx1to16(st['width']) && isVisibleColor(bg)) { left = true; edgeOffenders.push({ path: entryName || primary || '(inline)', detail: `${marker || 'element'} left line ${st['width']||''}` }); continue; }
				// right line
				if (isZero(st['right']) && isZero(st['top']) && isFull(st['height']) && isPx1to16(st['width']) && isVisibleColor(bg)) { right = true; edgeOffenders.push({ path: entryName || primary || '(inline)', detail: `${marker || 'element'} right line ${st['width']||''}` }); continue; }
			}
			const count = [top,bottom,left,right].filter(Boolean).length;
			if (count >= 3) { hasBorder = true; messages.push(`Detected via ${count} edge lines`); }
		} catch {}

		// 3) Prefer runtime probe signal if available
		try {
			const meta = (window as any).__audit_last_summary as any;
			if (meta && (meta.borderSides || meta.borderCssRules)) {
				if ((meta.borderSides||0) >= 3 || (meta.borderCssRules||0) > 0) {
					hasBorder = true;
					messages.push(`Detected at runtime (${meta.borderSides||0} sides, ${meta.borderCssRules||0} css rule(s))`);
				}
			}
		} catch {}

		const severity = hasBorder ? 'PASS' : 'WARN';
		// (Removed) creativeBorder duplicate — keep standardized IAB 'border' check only
		// IAB Global: border presence
		const meta = (window as any).__audit_last_summary as any;
		const sides = (meta?.borderSides ?? 0) as number;
		const cssRules = (meta?.borderCssRules ?? 0) as number;
		const borderMsgs = [
			`Border detected: ${hasBorder ? 'yes' : 'no'}`,
			`Sides detected: ${sides}`,
			`CSS rules: ${cssRules}`,
		];
		let evidence = hasBorder ? cssOffenders.concat(edgeOffenders) : edgeOffenders.slice(0, 4);
		if (hasBorder && evidence.length === 0 && (sides > 0 || cssRules > 0)) {
			evidence = [{ path: '(runtime)', detail: `Runtime detected ${sides} side(s), ${cssRules} css rule(s)` }];
		}
		out.push({ id:'border', title:'Border Present', severity, messages: borderMsgs, offenders: evidence.slice(0, 100) });
		}
	}

	// Creative Rendered — heuristic using probe frames/mutations + static fallback
	{
		const meta = (window as any).__audit_last_summary as any;
		const okProbe = (meta?.frames||0) > 0 || (typeof meta?.visualStart === 'number');
		const okStatic = !!(htmlText && /<body[\s>]/i.test(htmlText));
		const ok = okProbe || okStatic;
		const messages: string[] = [];
		if (okProbe) messages.push('Rendered (preview)');
		else if (okStatic) messages.push('Rendered (static HTML)');
		else messages.push('No render signal captured');
		out.push({ id:'creativeRendered', title:'Creative Rendered', severity: ok? 'PASS':'FAIL', messages, offenders: []});
	}

	// Network Requests (dynamic at runtime, fetch/xhr)
	{
		const meta = (window as any).__audit_last_summary as any;
		const dyn = meta?.network||0;
		// Runtime iframes (dynamic creations plus initial)
		const rIframes = meta?.runtimeIframes ?? 0;
		out.push({ id:'runtimeIframes', title:'Runtime Iframes', severity: rIframes>0?'WARN':'PASS', messages:[`Iframes created/observed at runtime: ${rIframes}`], offenders: [], tags:['debug']});
		out.push({
			id:'networkDynamic',
			title:'Runtime Network Requests',
			severity: dyn>0 ? 'WARN' : 'PASS',
			messages:[`Runtime requests: ${dyn}`],
			offenders: [],
			tags:['debug'],
		});
	}

	// Legacy H5 Validator–Style Checks (parity/diagnostics)
	{
		// invalid-url-ref: broken/invalid references, including non-packaged absolutes
		const badRefs: any[] = [];
		for (const r of partial.references || []) {
			try {
				const ustr = String(r.url || '');
				// Attempt URL parse relative to dummy origin to validate syntax
				try { new URL(ustr, 'https://x'); } catch { badRefs.push({ path: r.from, line: r.line, detail: `Invalid URL: ${ustr}` }); continue; }
				// In-zip but not resolvable to a file
				if (r.inZip && r.normalized) {
					const key = r.normalized.toLowerCase();
					const real = (bundle as any).lowerCaseIndex?.[key];
					if (!real || !bundle.files[real]) badRefs.push({ path: r.from, line: r.line, detail: `Missing packaged asset: ${ustr}` });
				}
				// Non-packaged absolute paths that point outside the bundle (e.g., "/img/x.png")
				if (!r.external && /^\//.test(ustr)) {
					badRefs.push({ path: r.from, line: r.line, detail: `Absolute path not packaged: ${ustr}` });
				}
			} catch {}
		}
		out.push({ id: 'invalid-url-ref', title: 'Invalid URL References', severity: badRefs.length ? 'FAIL' : 'PASS', messages: [ badRefs.length ? `${badRefs.length} invalid/broken reference(s)` : 'All references valid' ], offenders: badRefs });

		// orphaned-assets: files in ZIP not referenced by entry HTML (advisory)
		{
			const referenced = new Set<string>();
			for (const r of partial.references || []) if (r.inZip && r.normalized) referenced.add(r.normalized.toLowerCase());
			if (partial.primary?.path) referenced.add(partial.primary.path.toLowerCase());
			const orphans: any[] = [];
			for (const p of files) { const pl = p.toLowerCase(); if (!referenced.has(pl)) orphans.push({ path: p }); }
			out.push({ id: 'orphaned-assets', title: 'Orphaned Assets (Not Referenced)', severity: orphans.length ? 'WARN' : 'PASS', messages: [ orphans.length ? (entryName ? `${orphans.length} file(s) not referenced by entry file: ${entryName}` : `${orphans.length} file(s) not referenced by entry`) : 'All files referenced by entry' ], offenders: orphans.slice(0, 50) });
		}

		// bad-filenames: flag truly problematic characters and ensure ZIP name includes the size token
		{
			const disallowedOff: any[] = [];
			const disallowedChar = /[%#?;\\:*"|<>]/g;
			for (const p of files) {
				const base = (p.split('/').pop() || p).toString();
				const issues: string[] = [];
				const matches = base.match(disallowedChar);
				if (matches && matches.length) {
					const uniq = Array.from(new Set(matches));
					issues.push(`illegal character(s): ${uniq.join(' ')}`);
				}
				if (/[ -]/.test(base)) {
					issues.push('control characters present');
				}
				if (issues.length) {
					disallowedOff.push({ path: p, detail: issues.join('; ') });
				}
			}
			const bundleName = String((partial as any).bundleName || bundle.name || '');
			let sizeMessage = '';
			let sizeOk = true;
			const sizeOff: any[] = [];
			const size = (partial as any).adSize;
				if (size && typeof size.width === 'number' && typeof size.height === 'number' && bundleName) {
					const w = Math.round(size.width);
					const h = Math.round(size.height);
					const expected = `${w}x${h}`;
				const sizePattern = new RegExp(`(^|[^0-9])${w}\s*[xX]\s*${h}([^0-9]|$)`);
				if (sizePattern.test(bundleName)) {
						sizeMessage = `Correct dimensions found in file name (${expected})`;
				} else {
					sizeOk = false;
					sizeMessage = `Expected ${expected} in ZIP name "${bundleName}"`;
					sizeOff.push({ path: bundleName, detail: `missing ${expected}` });
				}
			} else {
				sizeMessage = 'Creative dimensions unavailable for filename check';
			}
			const hasDisallowed = disallowedOff.length > 0;
			const severity = hasDisallowed || !sizeOk ? 'FAIL' : 'PASS';
			const messages: string[] = [];
			if (hasDisallowed) messages.push(`Disallowed characters found in ${disallowedOff.length} file(s)`);
			else messages.push('No disallowed characters');
			if (sizeMessage) messages.push(sizeMessage);
			const offenders = disallowedOff.concat(sizeOff).slice(0, 200);
			out.push({ id: 'bad-filenames', title: 'Problematic Filenames', severity: severity as any, messages, offenders });
		}

		// invalid-markup: basic HTML/SVG/CSS syntax checks (heuristic)
		{
			const invalid: any[] = [];
			for (const p of files) {
				const low = p.toLowerCase();
				if (/\.html?$/.test(low)) {
					try {
						const text = new TextDecoder().decode(bundle.files[p]);
						const doc = new DOMParser().parseFromString(text, 'text/html');
						const isErr = doc.querySelector('parsererror');
						if (isErr) invalid.push({ path: p, detail: 'HTML parser error' });
					} catch { invalid.push({ path: p, detail: 'HTML parse exception' }); }
				}
				if (/\.svg$/.test(low)) {
					try {
						const text = new TextDecoder().decode(bundle.files[p]);
						const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
						const isErr = doc.querySelector('parsererror');
						if (isErr) invalid.push({ path: p, detail: 'SVG parser error' });
					} catch { invalid.push({ path: p, detail: 'SVG parse exception' }); }
				}
				if (/\.css$/.test(low)) {
					try {
						const text = new TextDecoder().decode(bundle.files[p]);
						// Heuristic: unmatched braces
						const opens = (text.match(/\{/g) || []).length;
						const closes = (text.match(/\}/g) || []).length;
						if (opens !== closes) invalid.push({ path: p, detail: `Unmatched braces {${opens}} vs }${closes}` });
					} catch { invalid.push({ path: p, detail: 'CSS read exception' }); }
				}
			}
			out.push({ id: 'invalid-markup', title: 'Invalid Markup (HTML/CSS/SVG)', severity: invalid.length ? 'WARN' : 'PASS', messages: [ invalid.length ? `${invalid.length} file(s) with syntax issues (heuristic)` : 'No syntax issues detected' ], offenders: invalid.slice(0, 100) });
		}

		// gwd-env-check: detect Google Web Designer environment indicators
		{
			let detected = false; const offenders: any[] = [];
			for (const p of files) if (/\.(html?|js|css)$/i.test(p)) {
				try {
					const t = new TextDecoder().decode(bundle.files[p]);
					if (/gwd-\w+/i.test(t) || /gwd-events-support\.js/i.test(t) || /google web designer/i.test(t) || /<meta[^>]+name=["']generator["'][^>]+google web designer/i.test(t)) {
						detected = true; offenders.push({ path: p, detail: 'GWD environment markers' });
					}
				} catch {}
			}
			out.push({ id: 'gwd-env-check', title: 'GWD Environment Check', severity: detected ? 'WARN' : 'PASS', messages: [ detected ? 'Google Web Designer environment artifacts detected' : 'No GWD environment markers detected' ], offenders });
		}

		// hardcoded-click: detect hard-coded navigations bypassing clickTag
		{
			const offs: any[] = [];
			const reOpenHttp = /window\.open\s*\(\s*['"]https?:/i;
			const reAssignLoc = /(window|document|top)\.location\s*=\s*['"]https?:/i;
			const reAnchor = /<a\s+[^>]*href=["']https?:[^"']+["'][^>]*>/i;
			for (const p of files) if (/\.(js|html?)$/i.test(p)) {
				try {
					const t = new TextDecoder().decode(bundle.files[p]);
					if (reOpenHttp.test(t)) offs.push({ path: p, detail: 'window.open("http(s)://…")' });
					if (reAssignLoc.test(t)) offs.push({ path: p, detail: 'location = "http(s)://…"' });
					if (/\.html?$/i.test(p) && reAnchor.test(t)) offs.push({ path: p, detail: '<a href="http(s)://…">' });
				} catch {}
			}
			out.push({ id: 'hardcoded-click', title: 'Hard-coded Clickthrough', severity: offs.length ? 'WARN' : 'PASS', messages: [ offs.length ? `${offs.length} potential hard-coded clickthrough(s)` : 'No hard-coded clickthrough detected' ], offenders: offs.slice(0, 100) });
		}
	}

	// Heavy Ad Intervention (Risk) — simple heuristic
	{
		const initialKB = (partial.initialBytes||0)/1024; const cpu = (window as any).__audit_last_summary?.cpuScore||0;
		const risky = initialKB>4000 || cpu>0.5;
				out.push({
			id:'heavyAdRisk',
			title:'Heavy Ad Intervention (Risk)',
			severity: risky ? 'WARN' : 'PASS',
			messages:[`InitialKB ${initialKB.toFixed(1)}, CPU ${cpu.toFixed?cpu.toFixed(2):cpu}`],
			offenders: [],
			tags:['debug'],
		});
	}


	return out as Finding[];
}

function buildPatterns(arr: any): RegExp[] {
	const out: RegExp[] = [];
	if (!Array.isArray(arr)) return out;
	for (const s of arr) {
		if (typeof s !== 'string') continue;
		try {
			if (s.startsWith('/') && s.lastIndexOf('/') > 0) {
				const body = s.slice(1, s.lastIndexOf('/'));
				const flags = s.slice(s.lastIndexOf('/') + 1);
				out.push(new RegExp(body, flags));
			} else {
				out.push(new RegExp(s, 'i'));
			}
		} catch { /* ignore bad patterns */ }
	}
	return out;
}

function guessMime(name: string): string {
	const n = name.toLowerCase();
	if (n.endsWith('.png')) return 'image/png';
	if (n.endsWith('.jpg')||n.endsWith('.jpeg')) return 'image/jpeg';
	if (n.endsWith('.gif')) return 'image/gif';
	if (n.endsWith('.webp')) return 'image/webp';
	if (n.endsWith('.mp4')) return 'video/mp4';
	if (n.endsWith('.webm')) return 'video/webm';
	if (n.endsWith('.ogg')) return 'video/ogg';
	if (n.endsWith('.mov')) return 'video/quicktime';
	if (n.endsWith('.mp3')) return 'audio/mpeg';
	if (n.endsWith('.wav')) return 'audio/wav';
	if (n.endsWith('.m4a')) return 'audio/mp4';
	return 'application/octet-stream';
}

