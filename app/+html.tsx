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

  #root div[style*="border-color"]:not([aria-label="Special mode"]) {
    border-color: rgba(23, 23, 20, .065) !important;
  }

  #root [data-khav-liquid-tabbar] {
    position: relative !important;
    isolation: isolate;
    overflow: hidden;
    border-color: rgba(255, 255, 255, .24) !important;
    -webkit-backdrop-filter: blur(30px) saturate(1.48) !important;
    backdrop-filter: blur(30px) saturate(1.48) !important;
    box-shadow: 0 14px 34px rgba(0, 0, 0, .115), inset 0 1px 0 rgba(255, 255, 255, .42), inset 0 -1px 0 rgba(255, 255, 255, .08) !important;
  }
  #root [data-khav-liquid-tabbar]::before {
    content: '';
    position: absolute;
    z-index: 0;
    left: 0;
    top: 5px;
    bottom: 5px;
    width: 25%;
    border-radius: 17px;
    pointer-events: none;
    background: rgba(255, 255, 255, .24);
    border: 1px solid rgba(255, 255, 255, .34);
    -webkit-backdrop-filter: blur(18px) saturate(1.62);
    backdrop-filter: blur(18px) saturate(1.62);
    box-shadow: 0 5px 16px rgba(0, 0, 0, .08), inset 0 1px 0 rgba(255, 255, 255, .52);
    transform: translate3d(calc(var(--khav-tab-index, 0) * 100%), 0, 0) scaleX(.88);
    transform-origin: center;
    transition: transform 390ms cubic-bezier(.22, .86, .2, 1), background-color 240ms ease, box-shadow 240ms ease;
    will-change: transform;
  }
  #root [data-khav-liquid-tabbar] > [role="tab"] {
    position: relative;
    z-index: 1;
    transition: transform 330ms cubic-bezier(.22, .86, .2, 1), opacity 220ms ease;
  }
  #root [data-khav-liquid-tabbar] > [role="tab"][aria-selected="true"] {
    transform: translateY(-.5px);
  }
  #root [data-khav-liquid-tabbar] > [role="tab"][aria-selected="true"] > div:first-child {
    background-color: transparent !important;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #11110F; }
    #root div[style*="border-color"]:not([aria-label="Special mode"]) { border-color: rgba(255, 255, 255, .075) !important; }
    #root [data-khav-liquid-tabbar] { border-color: rgba(255, 255, 255, .12) !important; box-shadow: 0 16px 38px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .13) !important; }
    #root [data-khav-liquid-tabbar]::before { background: rgba(255, 255, 255, .085); border-color: rgba(255, 255, 255, .13); box-shadow: 0 5px 18px rgba(0, 0, 0, .18), inset 0 1px 0 rgba(255, 255, 255, .15); }
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

const LIQUID_TAB_BAR = `
  (() => {
    let observer;
    const setup = () => {
      const root = document.getElementById('root');
      if (!root) { requestAnimationFrame(setup); return; }
      const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
      if (tabs.length !== 4) { requestAnimationFrame(setup); return; }
      const bar = tabs[0].parentElement;
      if (!bar || !tabs.every((tab) => tab.parentElement === bar)) return;

      bar.setAttribute('data-khav-liquid-tabbar', 'true');
      const sync = () => {
        const liveTabs = Array.from(bar.querySelectorAll(':scope > [role="tab"]'));
        const index = Math.max(0, liveTabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
        bar.style.setProperty('--khav-tab-index', String(index));
      };

      sync();
      observer?.disconnect();
      observer = new MutationObserver(sync);
      observer.observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
    else setup();
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
      <script dangerouslySetInnerHTML={{ __html: LIQUID_TAB_BAR }} />
      {production && <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />}
    </body>
  </html>;
}
