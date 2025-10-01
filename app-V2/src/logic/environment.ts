export type AdTagEnvironment = 'web' | 'inapp-ios' | 'inapp-android';

export type EnvironmentOption = {
  value: AdTagEnvironment;
  label: string;
  hint: string;
};

export const ENVIRONMENT_OPTIONS: EnvironmentOption[] = [
  {
    value: 'web',
    label: 'Desktop Web',
    hint: 'Standard browser context with default user agent.',
  },
  {
    value: 'inapp-ios',
    label: 'In-App iOS',
    hint: 'Simulated iOS WebView + basic MRAID stub.',
  },
  {
    value: 'inapp-android',
    label: 'In-App Android',
    hint: 'Simulated Android WebView + basic MRAID stub.',
  },
];

export function createInAppShim(environment?: AdTagEnvironment): string | null {
  if (!environment || environment === 'web') return null;

  const configs: Record<'inapp-ios' | 'inapp-android', {
    label: string;
    userAgent: string;
    platform: string;
    appId: string;
    device: string;
    screen: { width: number; height: number; devicePixelRatio: number };
    referrer: string;
  }> = {
    'inapp-ios': {
      label: 'In-App iOS WebView',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 InAppWebView/1.0',
      platform: 'iPhone',
      appId: 'com.example.iosapp',
      device: 'iPhone14,5',
      screen: { width: 375, height: 667, devicePixelRatio: 2 },
      referrer: 'app://in-app-webview/ios',
    },
    'inapp-android': {
      label: 'In-App Android WebView',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 InAppWebView/1.0',
      platform: 'Android',
      appId: 'com.example.androidapp',
      device: 'Pixel 8',
      screen: { width: 360, height: 780, devicePixelRatio: 3 },
      referrer: 'app://in-app-webview/android',
    },
  };

  const cfg = configs[environment];
  const literal = JSON.stringify(cfg);

  return String.raw`(() => {
    try {
      const cfg = ${literal};
      const post = (text) => parent.postMessage({ __tag_test: 1, kind: 'info', text }, '*');
      const override = (obj, key, value) => {
        if (!obj) return;
        try {
          Object.defineProperty(obj, key, { configurable: true, get: () => value });
        } catch (err) {
          try { obj[key] = value; } catch (err2) {}
        }
      };

      if (typeof navigator !== 'undefined') {
        override(navigator, 'userAgent', cfg.userAgent);
        override(navigator, 'appVersion', cfg.userAgent);
        override(navigator, 'platform', cfg.platform);
      }

      if (typeof document !== 'undefined') {
        override(document, 'referrer', cfg.referrer);
      }

      if (typeof window !== 'undefined') {
        override(window, 'innerWidth', cfg.screen.width);
        override(window, 'innerHeight', cfg.screen.height - 64);
        override(window, 'devicePixelRatio', cfg.screen.devicePixelRatio);
      }

      if (typeof window !== 'undefined' && window.screen) {
        const screen = window.screen;
        override(screen, 'width', cfg.screen.width);
        override(screen, 'height', cfg.screen.height);
        override(screen, 'availWidth', cfg.screen.width);
        override(screen, 'availHeight', cfg.screen.height);
      }

      const listeners = Object.create(null);
      const ensureSet = (event) => {
        if (!listeners[event]) listeners[event] = new Set();
        return listeners[event];
      };
      const trigger = (event, arg) => {
        const set = listeners[event];
        if (!set) return;
        set.forEach((cb) => {
          try { cb(arg); } catch (err) { console.error(err); }
        });
      };

      const mraid = {
        getState: () => 'default',
        getPlacementType: () => 'inline',
        isViewable: () => true,
        getVersion: () => '2.0',
        getScreenSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
        getMaxSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
        getDefaultPosition: () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }),
        getCurrentPosition: () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }),
        addEventListener: (event, callback) => {
          if (!event || typeof callback !== 'function') return;
          const set = ensureSet(event);
          set.add(callback);
          if (event === 'ready') {
            setTimeout(() => {
              try { callback(); } catch (err) { console.error(err); }
            }, 0);
          }
          if (event === 'viewableChange') {
            setTimeout(() => {
              try { callback(true); } catch (err) { console.error(err); }
            }, 0);
          }
        },
        removeEventListener: (event, callback) => {
          const set = listeners[event];
          if (!set) return;
          set.delete(callback);
        },
        open: (url) => {
          if (url) {
            try { window.open(url, '_blank'); } catch (err) { console.error(err); }
          }
        },
        close: () => trigger('stateChange', 'hidden'),
        expand: () => trigger('stateChange', 'expanded'),
        useCustomClose: () => {},
        playVideo: (url) => {
          if (url) {
            try { window.open(url, '_blank'); } catch (err) { console.error(err); }
          }
        },
        storePicture: () => {},
      };

      window.mraid = mraid;
      window.MRAID_ENV = {
        version: '2.0',
        sdk: 'CSA Tag Tester',
        sdkVersion: '1.0',
        appId: cfg.appId,
        device: cfg.device,
        platform: cfg.platform,
      };

      setTimeout(() => {
        trigger('ready');
        trigger('viewableChange', true);
        trigger('stateChange', 'default');
      }, 100);

      post('In-app WebView shim active: ' + cfg.label);
    } catch (err) {
      parent.postMessage({ __tag_test: 1, kind: 'error', text: 'In-app shim error: ' + err }, '*');
    }
  })();`;
}
