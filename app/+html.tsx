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
  "connect-src 'self' https://nationalbank.kz https://www.gov.kz https://api.open-meteo.com",
  "worker-src 'self' blob:",
  "media-src 'none'",
].join('; ');

const APP_SHELL_CSS = `
  html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; touch-action: manipulation; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
  /*
   * This nudge was tuned by hand over several commits (1mm -> 2mm -> 2.5mm -> 2.8mm) as a
   * fixed, device-independent constant. That undershoots on Dynamic Island phones, where the
   * status bar is drawn as glass reaching lower than env(safe-area-inset-top) reports -- the
   * same effect the OFP viewer app documents and fixes with a ~24px cushion on top of the
   * inset for exactly this reason. SafeAreaView already applies the raw inset as padding, so
   * this is that same extra cushion, expressed in px instead of a fixed physical unit.
   *
   * The !important on height is load-bearing: expo-router's own ScrollViewStyleReset renders
   * after this block and also sets #root's height to 100% at equal specificity, so without it
   * the height reduction below silently loses the cascade (verified via computed styles) and
   * #root overflows the viewport by the translateY amount, relying on the parent's
   * overflow:hidden to hide it instead of actually being sized to fit.
   */
  #root { height: calc(100dvh - 24px) !important; min-height: calc(100dvh - 24px); transform: translateY(24px); isolation: isolate; }
  #root * { -webkit-overflow-scrolling: touch; }
  html * { scrollbar-width: none; -ms-overflow-style: none; }
  html *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  body { background: #F4F1EC; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
  @media (prefers-color-scheme: dark) { body { background: #11110F; } }

  /*
   * Special Mode's sunset-clouds wallpaper (see assets/backgrounds/README.md), rendered as a
   * true DOM sibling of #root -- NOT a background on any element inside it, and NOT inside the
   * React tree at all. #root carries a "transform: translateY(24px)" for the Dynamic Island
   * cushion above; a CSS transform on an ancestor creates a new containing block for any
   * "position: fixed" descendant, so a wallpaper placed inside #root can only ever be fixed
   * relative to #root's own (24px-short, 24px-shifted) box, never the true physical viewport --
   * that mismatch was the root cause of the flat peach strip this replaces. Living outside
   * #root, "inset: 0" here really does mean the four physical screen edges on every device,
   * with no hardcoded height or safe-area math and no reliance on document height.
   *
   * Special Mode detection is pure CSS: MainScreen's root View carries
   * aria-label="KhaVair special mode" only while Special Mode is unlocked, and :has() is a
   * live pseudo-class that re-evaluates as the DOM changes -- no JS wiring needed here, and it
   * degrades to nothing (no image, fully transparent) the instant Special Mode turns off.
   *
   * Three background-image layers (first listed = topmost): an edge-darkening gradient keeps
   * the header text and tab bar icons -- and the iOS status bar sitting directly on the photo
   * now -- readable; a flat-color wash in the app's own Blush/Espresso tone mutes the photo's
   * saturated sunset colors so it reads as a tinted backdrop instead of competing with the
   * glass cards; the photo itself is bottom-most.
   */
  /*
   * The base rule (Normal Mode, no photo) still carries a faint top-edge darkening: the status
   * bar meta tag below is a single global value, so making it translucent for Special Mode's
   * photo also switches Normal Mode's status bar icons to the light/white style everywhere,
   * including over Normal Mode's own light cream background where white icons would otherwise
   * be unreadable. This is the minimum fix for that, not a Normal Mode redesign.
   */
  #khavair-wallpaper { position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: -1; pointer-events: none; background-image: linear-gradient(to bottom, rgba(0,0,0,.32) 0%, rgba(0,0,0,0) 10%); background-size: cover; background-position: center top; background-repeat: no-repeat; }
  body:has(#root [aria-label="KhaVair special mode"]) #khavair-wallpaper {
    background-image:
      linear-gradient(to bottom, rgba(43,31,27,.22) 0%, rgba(43,31,27,0) 14%, rgba(43,31,27,0) 84%, rgba(43,31,27,.24) 100%),
      linear-gradient(rgba(255,230,225,.6), rgba(255,230,225,.6)),
      url('backgrounds/light/khavair-bg-light-base_852x1847.webp');
    background-size: cover, cover, cover;
    background-position: center top, center top, center top;
    background-repeat: no-repeat, no-repeat, no-repeat;
  }

  @media (prefers-color-scheme: dark) {
    body:has(#root [aria-label="KhaVair special mode"]) #khavair-wallpaper {
      background-image:
        linear-gradient(to bottom, rgba(0,0,0,.32) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 84%, rgba(0,0,0,.34) 100%),
        linear-gradient(rgba(43,31,27,.65), rgba(43,31,27,.65)),
        url('backgrounds/dark/khavair-bg-dark-base_853x1844.webp');
      background-size: cover, cover, cover;
      background-position: center top, center top, center top;
      background-repeat: no-repeat, no-repeat, no-repeat;
    }
  }
`;

const REGISTER_SW = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      const REVISION_KEY = 'khavair.sw-revision.v1';
      let updateNotified = false;
      // The personal title is Special Mode only -- it must never show before the mode is
      // unlocked, since Special Mode's whole point is staying invisible until then.
      const UPDATE_TITLE_SPECIAL = 'Lyubimkina there is a new version available for you';
      const UPDATE_TITLE_NORMAL = 'A new version of KhaVair is available.';
      // Keep this short and update it with each published version.
      const UPDATE_NOTICE = 'More: the scrolling area is now bounded above the navigation bar so Privacy and the erase-data button can be reached.';

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

      const showUpdateNotice = (title, message) => {
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

          const heading = document.createElement('div');
          heading.textContent = title;
          heading.style.cssText = 'font-size:16px;line-height:22px;font-weight:700;margin-bottom:7px;';

          const body = document.createElement('div');
          body.textContent = message;
          body.style.cssText = 'font-size:14px;line-height:20px;font-weight:500;margin-bottom:18px;';

          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'OK';
          button.style.cssText = 'width:100%;height:46px;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;';
          button.style.background = palette.accent;
          button.style.color = palette.accentText;
          button.onclick = () => backdrop.remove();

          card.appendChild(heading);
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
                showUpdateNotice(specialModeActive() ? UPDATE_TITLE_SPECIAL : UPDATE_TITLE_NORMAL, UPDATE_NOTICE);
              }
              storeRevision(publishedRevision);
            } else if (storedRevision !== publishedRevision) {
              updateNotified = true;
              showUpdateNotice(specialModeActive() ? UPDATE_TITLE_SPECIAL : UPDATE_TITLE_NORMAL, UPDATE_NOTICE);
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
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
      {/*
        A true sibling of #root, not a descendant -- see the #khavair-wallpaper comment in
        APP_SHELL_CSS above for why that placement is load-bearing. Empty/transparent (no
        background-image, so nothing paints) outside Special Mode.
      */}
      <div id="khavair-wallpaper" aria-hidden="true" />
      {children}
      {bodyNodes}
      <script dangerouslySetInnerHTML={{ __html: LOCK_ZOOM }} />
      {production && <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />}
    </body>
  </html>;
}
