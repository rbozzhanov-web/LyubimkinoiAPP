import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' blob:",
  "connect-src 'self' https://nationalbank.kz https://www.gov.kz",
  "worker-src 'self' blob:",
  "media-src 'none'",
].join('; ');

const APP_SHELL_CSS = `
  html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; touch-action: manipulation; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
  #root { height: calc(100dvh - 2.8mm); min-height: calc(100dvh - 2.8mm); transform: translateY(2.8mm); isolation: isolate; }
  #root * { -webkit-overflow-scrolling: touch; }
  html * { scrollbar-width: none; -ms-overflow-style: none; }
  html *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  body { background: #F4F1EC; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }

  @media (prefers-color-scheme: dark) {
    body { background: #11110F; }

    /*
     * Special Mode dark palette follows the app icon: deep navy, warm ivory,
     * muted champagne/gold, dusty peach and desaturated blue. The body-scoped
     * selectors intentionally include React Native Web modal portals as well as
     * #root, while still requiring Special Mode to be active in the app itself.
     */
    body:has(#root [aria-label="KhaVair special mode"]) { background: #0F1821; }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(27, 17, 20)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(27,17,20)"] {
      background-color: #0F1821 !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgba(36, 23, 26, 0.76)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgba(36,23,26,0.76)"] {
      background-color: rgba(22, 32, 42, .80) !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgba(44, 27, 32, 0.84)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgba(44,27,32,0.84)"] {
      background-color: rgba(29, 40, 52, .88) !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(255, 245, 242)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(255,245,242)"] {
      color: #F4EBDD !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(220, 178, 171)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(220,178,171)"] {
      color: #BFAF99 !important;
    }

    /* PR #10 made separators translucent before the Special Mode palette landed. */
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color: rgba(255, 213, 205, 0.14)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color:rgba(255,213,205,0.14)"] {
      border-color: #334250 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgba(255, 213, 205, 0.14)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgba(255,213,205,0.14)"] {
      background-color: #334250 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgba(255, 213, 205, 0.14)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgba(255,213,205,0.14)"] {
      color: #334250 !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color: rgb(90, 54, 62)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color:rgb(90,54,62)"] {
      border-color: #334250 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(90, 54, 62)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(90,54,62)"] {
      background-color: #334250 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(90, 54, 62)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(90,54,62)"] {
      color: #334250 !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(240, 100, 69)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(240,100,69)"] {
      color: #C6A778 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(240, 100, 69)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(240,100,69)"] {
      background-color: #C6A778 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color: rgb(240, 100, 69)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color:rgb(240,100,69)"] {
      border-color: #C6A778 !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(68, 35, 31)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(68,35,31)"] {
      background-color: rgba(198, 167, 120, .16) !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(222, 70, 109)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(222,70,109)"] {
      color: #D08C79 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(222, 70, 109)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(222,70,109)"] {
      background-color: #D08C79 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color: rgb(222, 70, 109)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color:rgb(222,70,109)"] {
      border-color: #D08C79 !important;
    }

    body:has(#root [aria-label="KhaVair special mode"]) [style*="color: rgb(46, 197, 210)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="color:rgb(46,197,210)"] {
      color: #7FA0A6 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color: rgb(46, 197, 210)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="background-color:rgb(46,197,210)"] {
      background-color: #7FA0A6 !important;
    }
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color: rgb(46, 197, 210)"],
    body:has(#root [aria-label="KhaVair special mode"]) [style*="border-color:rgb(46,197,210)"] {
      border-color: #7FA0A6 !important;
    }
  }
`;

const REGISTER_SW = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      const REVISION_KEY = 'khavair.sw-revision.v1';
      let updateNotified = false;

      const specialModeActive = () => {
        try {
          return window.localStorage.getItem('khavair.loved-mode.v1') === 'active';
        } catch {
          return false;
        }
      };

      const readStoredRevision = () => {
        try { return window.localStorage.getItem(REVISION_KEY); } catch { return null; }
      };

      const showUpdateNotice = (message) => {
        try {
          const loved = specialModeActive();
          let dark = false;
          try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
          if (loved) {
            const savedTheme = window.localStorage.getItem('khavair.theme.v1');
            if (savedTheme === 'dark') dark = true;
            else if (savedTheme === 'light') dark = false;
          }
          const palette = loved
            ? (dark ? { bg: '#3A2A24', text: '#FFF3EC', border: 'rgba(255,230,225,.16)', accent: '#FF6B6A', accentText: '#FFFFFF' }
                    : { bg: '#FFF7F2', text: '#2B1F1B', border: 'rgba(43,31,27,.12)', accent: '#FF6B6A', accentText: '#FFFFFF' })
            : (dark ? { bg: '#242220', text: '#F7F4EF', border: 'rgba(247,244,239,.16)', accent: '#C7BDAE', accentText: '#171714' }
                    : { bg: '#FCFAF7', text: '#171714', border: 'rgba(47,57,52,.14)', accent: '#2F3934', accentText: '#FCFAF7' });

          const backdrop = document.createElement('div');
          backdrop.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.5);';

          const card = document.createElement('div');
          card.style.cssText = 'max-width:340px;width:100%;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
          card.style.background = palette.bg;
          card.style.color = palette.text;
          card.style.border = '1px solid ' + palette.border;

          const body = document.createElement('div');
          body.textContent = message;
          body.style.cssText = 'font-size:16px;line-height:22px;font-weight:600;margin-bottom:18px;';

          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'OK';
          button.style.cssText = 'width:100%;height:46px;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;';
          button.style.background = palette.accent;
          button.style.color = palette.accentText;
          button.onclick = () => backdrop.remove();

          card.appendChild(body);
          card.appendChild(button);
          backdrop.appendChild(card);
          document.body.appendChild(backdrop);
        } catch {
          window.alert(message);
        }
      };

      const storeRevision = (revision) => {
        try { window.localStorage.setItem(REVISION_KEY, revision); } catch {}
      };

      const fetchPublishedRevision = async () => {
        const response = await fetch('sw.js?update-check=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return null;
        const text = await response.text();
        const match = text.match(/const CACHE = 'khavair-([a-f0-9]+)'/);
        return match ? match[1] : null;
      };

      try {
        const registration = await navigator.serviceWorker.register('sw.js', {
          scope: './',
          updateViaCache: 'none',
        });

        const checkForUpdate = async () => {
          if (!navigator.onLine || updateNotified) return;
          try {
            const publishedRevision = await fetchPublishedRevision();
            if (!publishedRevision) return;

            const storedRevision = readStoredRevision();
            if (!storedRevision) {
              // Existing installed PWAs migrate into revision tracking with one notice;
              // a genuinely first-ever install establishes the baseline silently.
              if (navigator.serviceWorker.controller) {
                updateNotified = true;
                showUpdateNotice(specialModeActive()
                  ? 'Lyubimochka, a new version is available for you'
                  : 'A new version of KhaVair is available.');
              }
              storeRevision(publishedRevision);
            } else if (storedRevision !== publishedRevision) {
              updateNotified = true;
              showUpdateNotice(specialModeActive()
                ? 'Lyubimochka, a new version is available for you'
                : 'A new version of KhaVair is available.');
              storeRevision(publishedRevision);
            }

            // Download/activate the new worker in the background. Do not reload the
            // current React tree: the new app version is used on the next natural launch.
            await registration.update();
            const worker = registration.waiting || registration.installing;
            if (worker) {
              if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
              else worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
              });
            }
          } catch {}
        };

        checkForUpdate();
        window.addEventListener('online', checkForUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
      } catch {}
    });
  }
`;

const LOCK_ZOOM = `
  (() => {
    const block = (event) => event.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => document.addEventListener(name, block, { passive: false }));
    document.addEventListener('wheel', (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    }, { passive: false });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
    });
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  })();
`;

export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  const production = process.env.NODE_ENV === 'production';

  return <html lang="en" {...htmlAttributes}>
    <head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F1EC" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#11110F" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="KhaVair" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="referrer" content="no-referrer" />
      <meta name="description" content="Private cabin crew roster, per diem and pay companion." />
      <link rel="manifest" href="manifest.webmanifest" />
      <link rel="apple-touch-icon" href="apple-touch-icon.png" />
      <link rel="icon" type="image/png" href="favicon-64.png" />
      {production && <meta httpEquiv="Content-Security-Policy" content={PRODUCTION_CSP} />}
      <style dangerouslySetInnerHTML={{ __html: APP_SHELL_CSS }} />
      <ScrollViewStyleReset />
      {headNodes}
    </head>
    <body {...bodyAttributes}>
      {children}
      {bodyNodes}
      <script dangerouslySetInnerHTML={{ __html: LOCK_ZOOM }} />
      {production && <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />}
    </body>
  </html>;
}