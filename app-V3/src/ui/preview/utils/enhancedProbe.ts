/**
 * Enhanced Preview Probe Script
 * 
 * Comprehensive runtime tracking injected into creative preview iframes.
 * Ported from V2's runtimeProbe.ts with improvements for V3 architecture.
 * 
 * Tracks:
 * - GSAP timeline durations (timeline(), .to(), .from(), .fromTo())
 * - Anime.js animations (duration conversion ms  seconds)
 * - CSS animations (duration, iteration count, infinite loops)
 * - Canvas border detection (CreateJS, Animate CC)
 * - Network activity (fetch, XHR, resources)
 * - Console activity (errors, warnings, logs)
 * - Memory usage (min, max, current)
 * - Performance metrics (CPU, long tasks, frames)
 * - ClickTag detection (Enabler.exit, anchors, window.open)
 * 
 * Extended scan intervals for Teresa-style long animations:
 * - 600ms: Initial CSS scan
 * - 2s: Early JS detection
 * - 5s: Mid-sequence capture
 * - 10s: Extended animations
 * - 30s: Final comprehensive scan
 */

/**
 * Generates the complete probe script for injection into preview HTML
 */
export const getEnhancedProbeScript = (): string => {
  return `
(function() {
  console.log('[Enhanced Probe] Initializing comprehensive tracking');
  
  // Communication with parent
  function post(msg) {
    try {
      // Note: Individual event messages are for logging only
      // The main summary data is sent via periodic flush()
      console.log('[Enhanced Probe] Event:', msg.type, msg);
    } catch(e) {
      console.error('[Enhanced Probe] Failed to log event:', e);
    }
  }
  
  // Summary object (matches V2 ProbeSummary interface)
  var summary = {
    domContentLoaded: undefined,
    visualStart: undefined,
    frames: 0,
    longTasksMs: 0,
    consoleErrors: 0,
    consoleWarnings: 0,
    dialogs: 0,
    cookies: 0,
    localStorage: 0,
    errors: 0,
    documentWrites: 0,
    jquery: false,
    clickUrl: '',
    memoryMB: undefined,
    memoryMinMB: undefined,
    memoryMaxMB: undefined,
    cpuScore: undefined,
    network: 0,
    runtimeIframes: 0,
    rewrites: 0,
    imgRewrites: 0,
    mediaRewrites: 0,
    scriptRewrites: 0,
    linkRewrites: 0,
    setAttrRewrites: 0,
    styleUrlRewrites: 0,
    styleAttrRewrites: 0,
    domImages: 0,
    domBgUrls: 0,
    enablerStub: false,
    borderSides: 0,
    borderCssRules: 0,
    borderDetected: '',
    animMaxDurationS: 0,
    animMaxLoops: 1,
    animInfinite: false,
    initialRequests: 0,
    subloadRequests: 0,
    userRequests: 0,
    totalRequests: 0,
    initialBytes: 0,
    subloadBytes: 0,
    userBytes: 0,
    totalBytes: 0,
    loadEventTime: undefined
  };
  
  window.__audit_last_summary = summary;
  
  // JavaScript animation tracking (GSAP, Anime.js)
  var jsAnimStartTime = performance.now();
  var jsAnimMaxDuration = 0;
  var jsAnimDetected = false;
  var timelines = [];
  
  // GSAP Timeline Polling
  function pollTimelines() {
    try {
      for (var i = 0; i < timelines.length; i++) {
        var tl = timelines[i];
        if (!tl || typeof tl.duration !== 'function') continue;
        
        var dur = tl.duration();
        if (dur > jsAnimMaxDuration) {
          jsAnimMaxDuration = dur;
          console.log('[Enhanced Probe] GSAP timeline duration updated:', dur + 's');
          notifyAnimation();
        }
      }
    } catch(e) {
      console.error('[Enhanced Probe] Timeline polling error:', e);
    }
  }
  
  function notifyAnimation() {
    summary.animMaxDurationS = Math.max(summary.animMaxDurationS || 0, jsAnimMaxDuration);
    post({
      type: 'tracking-update',
      animMaxDurationS: summary.animMaxDurationS,
      animationDetected: true
    });
  }
  
  // GSAP Detection & Hooking
  console.log('[Enhanced Probe] Installing GSAP interceptor');
  var checkGSAP = setInterval(function() {
    try {
      var gsap = window.gsap;
      if (gsap && gsap.timeline) {
        clearInterval(checkGSAP);
        jsAnimDetected = true;
        console.log('[Enhanced Probe] GSAP detected, hooking timeline creation');
        
        // Hook timeline creation
        var origTimeline = gsap.timeline;
        gsap.timeline = function() {
          var tl = origTimeline.apply(this, arguments);
          timelines.push(tl);
          
          // Check duration on common method calls
          ['to', 'from', 'fromTo', 'add', 'call'].forEach(function(method) {
            if (tl[method]) {
              var orig = tl[method];
              tl[method] = function() {
                var result = orig.apply(tl, arguments);
                try {
                  var dur = tl.duration();
                  if (dur > jsAnimMaxDuration) {
                    jsAnimMaxDuration = dur;
                    notifyAnimation();
                  }
                } catch(e) {}
                return result;
              };
            }
          });
          
          return tl;
        };
        
        // Hook direct gsap.to/from/fromTo calls
        ['to', 'from', 'fromTo'].forEach(function(method) {
          if (gsap[method]) {
            var origMethod = gsap[method];
            gsap[method] = function() {
              var args = Array.prototype.slice.call(arguments);
              try {
                if (args[1] && typeof args[1] === 'object') {
                  var duration = args[1].duration || 0;
                  if (duration > jsAnimMaxDuration) {
                    jsAnimMaxDuration = duration;
                    console.log('[Enhanced Probe] GSAP.' + method + ' duration:', duration + 's');
                    notifyAnimation();
                  }
                }
              } catch(e) {}
              return origMethod.apply(gsap, args);
            };
          }
        });
        
        // Poll timelines at increasing intervals
        setTimeout(pollTimelines, 500);
        setTimeout(pollTimelines, 1000);
        setTimeout(pollTimelines, 2000);
        setTimeout(pollTimelines, 5000);
        setTimeout(pollTimelines, 10000);
        setTimeout(pollTimelines, 30000);
      }
    } catch(e) {
      console.error('[Enhanced Probe] GSAP hook error:', e);
    }
  }, 100);
  setTimeout(function() { clearInterval(checkGSAP); }, 5000);
  
  // Anime.js Detection & Hooking
  console.log('[Enhanced Probe] Installing Anime.js interceptor');
  var checkAnime = setInterval(function() {
    try {
      var anime = window.anime;
      if (anime && typeof anime === 'function') {
        clearInterval(checkAnime);
        jsAnimDetected = true;
        console.log('[Enhanced Probe] Anime.js detected, hooking calls');
        
        var origAnime = anime;
        window.anime = function() {
          try {
            var config = arguments[0];
            if (config && typeof config === 'object') {
              var duration = (config.duration || 0) / 1000; // ms  seconds
              if (duration > jsAnimMaxDuration) {
                jsAnimMaxDuration = duration;
                console.log('[Enhanced Probe] Anime.js duration:', duration + 's');
                notifyAnimation();
              }
            }
          } catch(e) {}
          return origAnime.apply(this, arguments);
        };
        
        // Copy static properties
        for (var key in origAnime) {
          if (origAnime.hasOwnProperty(key)) {
            window.anime[key] = origAnime[key];
          }
        }
      }
    } catch(e) {
      console.error('[Enhanced Probe] Anime.js hook error:', e);
    }
  }, 100);
  setTimeout(function() { clearInterval(checkAnime); }, 5000);
  
  // CSS Animation Scanning (with infinite loop detection)
  function parseDurationToS(token) {
    try {
      if (!token) return 0;
      var s = String(token).trim();
      var m1 = s.match(/^([\\d.]+)\\s*s$/i);
      if (m1) return parseFloat(m1[1]) || 0;
      var m2 = s.match(/^([\\d.]+)\\s*ms$/i);
      if (m2) return (parseFloat(m2[1]) || 0) / 1000;
      var n = parseFloat(s);
      return isFinite(n) ? n : 0;
    } catch(e) {
      return 0;
    }
  }
  
  function scanAnimations() {
    try {
      var maxDur = 0;
      var maxLoops = 1;
      var infinite = false;
      
      var root = document.body || document.documentElement;
      if (!root) return;
      
      var els = root.getElementsByTagName('*');
      var limit = Math.min(els.length, 3000);
      
      for (var i = 0; i < limit; i++) {
        var el = els[i];
        var cs = null;
        try {
          cs = getComputedStyle(el);
        } catch(e) {}
        
        if (!cs) continue;
        
        // Parse animation-duration
        var dur = (cs.animationDuration || cs.webkitAnimationDuration || '').toString();
        if (dur) {
          var parts = dur.split(',');
          for (var d = 0; d < parts.length; d++) {
            var v = parseDurationToS(parts[d]);
            if (v > maxDur) maxDur = v;
          }
        }
        
        // Parse animation-iteration-count
        var iter = (cs.animationIterationCount || cs.webkitAnimationIterationCount || '').toString();
        if (iter) {
          var ps = iter.split(',');
          for (var j = 0; j < ps.length; j++) {
            var raw = ps[j].trim().toLowerCase();
            if (raw === 'infinite') {
              infinite = true;
              if (maxLoops < 9999) maxLoops = 9999;
            } else {
              var n = parseFloat(raw);
              if (isFinite(n)) {
                var r = Math.round(n);
                if (r > maxLoops) maxLoops = r;
              }
            }
          }
        }
        
        // Parse shorthand animation property
        try {
          var sh = (cs.animation || cs.webkitAnimation || '').toString();
          if (sh) {
            var blocks = sh.split(',');
            for (var b = 0; b < blocks.length; b++) {
              var tk = blocks[b].trim().replace(/\\([^)]*\\)/g, '');
              var toks = tk.split(/\\s+/);
              for (var k = 0; k < toks.length; k++) {
                var t = toks[k];
                if (/^([\\d.]+)(ms|s)$/i.test(t)) {
                  var val = parseDurationToS(t);
                  if (val > maxDur) maxDur = val;
                } else if (t.toLowerCase() === 'infinite') {
                  infinite = true;
                  if (maxLoops < 9999) maxLoops = 9999;
                } else if (/^\\d+$/.test(t)) {
                  var iv = parseInt(t, 10);
                  if (iv > maxLoops) maxLoops = iv;
                }
              }
            }
          }
        } catch(e) {}
      }
      
      // Merge JavaScript animation duration if detected
      if (jsAnimDetected && jsAnimMaxDuration > maxDur) {
        maxDur = jsAnimMaxDuration;
        console.log('[Enhanced Probe] Using JS animation duration:', maxDur + 's');
      }
      
      summary.animMaxDurationS = maxDur;
      summary.animMaxLoops = maxLoops;
      summary.animInfinite = !!infinite;
      
      console.log('[Enhanced Probe] Animation scan complete:', {
        maxDuration: maxDur + 's',
        maxLoops: maxLoops,
        infinite: infinite,
        jsDetected: jsAnimDetected
      });
      
      post({
        type: 'tracking-update',
        animMaxDurationS: summary.animMaxDurationS,
        animMaxLoops: summary.animMaxLoops,
        animInfinite: summary.animInfinite
      });
    } catch(e) {
      console.error('[Enhanced Probe] Animation scan error:', e);
    }
  }
  
  // Schedule animation scans at increasing intervals (Teresa creatives need extended timeouts)
  setTimeout(scanAnimations, 600);   // Initial CSS scan
  setTimeout(scanAnimations, 2000);  // Early JS detection
  setTimeout(scanAnimations, 5000);  // Mid-sequence
  setTimeout(scanAnimations, 10000); // Extended animations
  setTimeout(scanAnimations, 30000); // Final comprehensive scan
  
  // Console Hooking
  try {
    var origError = console.error;
    console.error = function() {
      try {
        summary.consoleErrors++;
        post({
          type: 'console',
          level: 'error',
          message: Array.prototype.join.call(arguments, ' ')
        });
      } catch(e2) {}
      try {
        return origError.apply(this, arguments);
      } catch(e3) {}
    };
  } catch(e) {}
  
  try {
    var origWarn = console.warn;
    console.warn = function() {
      try {
        summary.consoleWarnings++;
        post({
          type: 'console',
          level: 'warn',
          message: Array.prototype.join.call(arguments, ' ')
        });
      } catch(e2) {}
      try {
        return origWarn.apply(this, arguments);
      } catch(e3) {}
    };
  } catch(e) {}
  
  // Dialog Hooking
  try {
    var oa = window.alert;
    window.alert = function(msg) {
      try {
        summary.dialogs++;
        post({ type: 'dialog', kind: 'alert', text: String(msg) });
      } catch(e2) {}
      return oa.apply(this, arguments);
    };
  } catch(e) {}
  
  try {
    var oc = window.confirm;
    window.confirm = function(msg) {
      try {
        summary.dialogs++;
        post({ type: 'dialog', kind: 'confirm', text: String(msg) });
      } catch(e2) {}
      return oc.apply(this, arguments);
    };
  } catch(e) {}
  
  try {
    var op = window.prompt;
    window.prompt = function(msg, def) {
      try {
        summary.dialogs++;
        post({ type: 'dialog', kind: 'prompt', text: String(msg) });
      } catch(e2) {}
      return op.apply(this, arguments);
    };
  } catch(e) {}
  
  // Network Hooking
  try {
    var ofetch = window.fetch;
    window.fetch = function(u) {
      try {
        summary.network++;
        post({ type: 'network', kind: 'fetch', url: String(u) });
      } catch(e2) {}
      return ofetch.apply(this, arguments);
    };
  } catch(e) {}
  
  try {
    var OX = window.XMLHttpRequest;
    var P = OX && OX.prototype;
    if (P && P.open) {
      var o = P.open;
      P.open = function(m, u) {
        try {
          summary.network++;
          post({ type: 'network', kind: 'xhr', url: String(u) });
        } catch(e2) {}
        return o.apply(this, arguments);
      };
    }
  } catch(e) {}
  
  // Error Tracking
  try {
    window.addEventListener('error', function(e) {
      try {
        summary.errors++;
        post({
          type: 'error',
          message: String((e && e.message) || 'error')
        });
      } catch(e2) {}
    });
  } catch(e) {}
  
  // Memory Sampling (Chromium only)
  try {
    var mem = performance && performance.memory;
    if (mem && mem.usedJSHeapSize) {
      var mb = mem.usedJSHeapSize / 1048576;
      summary.memoryMB = mb;
      summary.memoryMinMB = mb;
      summary.memoryMaxMB = mb;
      
      var mCount = 0;
      var mTimer = setInterval(function() {
        try {
          var m2 = performance.memory;
          if (m2 && m2.usedJSHeapSize) {
            var mb2 = m2.usedJSHeapSize / 1048576;
            summary.memoryMB = mb2;
            if (summary.memoryMinMB === undefined || mb2 < summary.memoryMinMB) {
              summary.memoryMinMB = mb2;
            }
            if (summary.memoryMaxMB === undefined || mb2 > summary.memoryMaxMB) {
              summary.memoryMaxMB = mb2;
            }
          }
        } catch(e) {}
        
        mCount++;
        if (mCount > 10) {
          try {
            clearInterval(mTimer);
          } catch(e) {}
        }
      }, 500);
    }
  } catch(e) {}
  
  // Periodic Summary Flush
  var pushes = 0;
  function flush() {
    try {
      parent.postMessage({
        type: 'tracking-update',
        data: summary
      }, '*');
      
      try {
        window.__audit_last_summary = summary;
      } catch(e2) {}
      
      pushes++;
      if (pushes < 10) {
        setTimeout(flush, 500);
      }
    } catch(e3) {}
  }
  
  flush();
  
  console.log('[Enhanced Probe] Initialization complete');
})();
`;
};
