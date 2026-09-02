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
  #root { height: calc(100dvh - 2.5mm); min-height: calc(100dvh - 2.5mm); transform: translateY(2.5mm); isolation: isolate; }
  #root * { -webkit-overflow-scrolling: touch; }
  body { background: #F4F1EC; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }

  @media (prefers-color-scheme: dark) {
    body { background: #11110F; }

    /*
     * Special Mode dark palette follows the app icon: deep navy, warm ivory,
     * muted champagne/gold, dusty peach and desaturated blue. The selectors
     * intentionally match only the existing Special Mode dark colors, so the
     * normal dark theme and all light-theme palettes remain untouched.
     */
    body:has(#root [aria-label="KhaVair special mode"]) { background: #0F1821; }

    #root:has([aria-label="KhaVair special mode"]) [style*="#1B1114"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(27, 17, 20)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(27,17,20)"] {
      background-color: #0F1821 !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="rgba(36, 23, 26, 0.76)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgba(36,23,26,0.76)"] {
      background-color: rgba(22, 32, 42, .80) !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="rgba(44, 27, 32, 0.84)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgba(44,27,32,0.84)"] {
      background-color: rgba(29, 40, 52, .88) !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#FFF5F2"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(255, 245, 242)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(255,245,242)"] {
      color: #F4EBDD !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#DCB2AB"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(220, 178, 171)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(220,178,171)"] {
      color: #BFAF99 !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#5A363E"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(90, 54, 62)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(90,54,62)"] {
      border-color: #334250 !important;
      color: #334250 !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#F06445"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(240, 100, 69)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(240,100,69)"] {
      color: #C6A778 !important;
      background-color: #C6A778 !important;
      border-color: #C6A778 !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#44231F"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(68, 35, 31)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(68,35,31)"] {
      background-color: rgba(198, 167, 120, .16) !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#DE466D"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(222, 70, 109)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(222,70,109)"] {
      color: #D08C79 !important;
      background-color: #D08C79 !important;
      border-color: #D08C79 !important;
    }

    #root:has([aria-label="KhaVair special mode"]) [style*="#2EC5D2"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(46, 197, 210)"],
    #root:has([aria-label="KhaVair special mode"]) [style*="rgb(46,197,210)"] {
      color: #7FA0A6 !important;
      background-color: #7FA0A6 !important;
      border-color: #7FA0A6 !important;
    }
  }
`;

const REGISTER_SW = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
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
