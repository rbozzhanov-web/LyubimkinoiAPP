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

  /*
   * Special Mode now uses the Kha♥air color system directly (Blush/Espresso
   * background, Coral/Peach/Gold accents) via the app's own palette, so the
   * shell only needs to match the app background behind #root/safe-area
   * edges before hydration and during overscroll bounce.
   */
  body:has(#root [aria-label="KhaVair special mode"]) { background: #FFE6E1; }

  @media (prefers-color-scheme: dark) {
    body { background: #11110F; }
    body:has(#root [aria-label="KhaVair special mode"]) { background: #2B1F1B; }
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
                window.alert(specialModeActive()
                  ? 'Lyubimochka, a new version is available for you'
                  : 'A new version of KhaVair is available.');
              }
              storeRevision(publishedRevision);
            } else if (storedRevision !== publishedRevision) {
              updateNotified = true;
              window.alert(specialModeActive()
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