# Khavair — background image assets (light + dark)

Sunset-clouds plane-window photo, used as the base background for the Khavair
app (pink/peach glassmorphism UI over this backdrop). Two variants of the same
composition: a bright pastel version for light mode, and a deeper, more
saturated dusk version for dark mode. Same crop/framing, same processing, so
they swap cleanly on a `prefers-color-scheme` toggle.

## Files

```
assets/backgrounds/light/
  khavair-bg-light-base_852x1847.webp     ~38 KB  — native ratio (~19.5:9), default choice
  khavair-bg-light-base_852x1847.jpg      ~90 KB  — JPEG fallback
  khavair-bg-light-large_1278x2771.webp   ~65 KB  — 1.5x upscale, Pro Max-class / high-DPI
  khavair-bg-light-large_1278x2771.jpg    ~166 KB — JPEG fallback
  khavair-bg-light-compact_828x1472.webp  ~31 KB  — 16:9 crop, older/smaller-aspect screens
  khavair-bg-light-compact_828x1472.jpg   ~74 KB  — JPEG fallback

assets/backgrounds/dark/
  khavair-bg-dark-base_853x1844.webp      ~69 KB  — native ratio, default choice
  khavair-bg-dark-base_853x1844.jpg       ~139 KB — JPEG fallback
  khavair-bg-dark-large_1280x2766.webp    ~114 KB — 1.5x upscale, Pro Max-class / high-DPI
  khavair-bg-dark-large_1280x2766.jpg     ~247 KB — JPEG fallback
  khavair-bg-dark-compact_828x1472.webp   ~61 KB  — 16:9 crop, older/smaller-aspect screens
  khavair-bg-dark-compact_828x1472.jpg    ~118 KB — JPEG fallback
```

Each mode has the same three sizes, built the same way:
- **base** — native resolution, matches the standard modern iPhone screen ratio
  (~19.5:9). Use this as the default; the photo is soft/cloud-heavy so it
  scales via `background-size: cover` fine on most screens without needing
  the larger variant.
- **large** — 1.5x Lanczos upscale, only needed for extra headroom on
  bigger/denser displays.
- **compact** — cropped to 16:9 for older/smaller-aspect screens (e.g. iPhone
  SE), trimmed from the bottom so the window + wing + sun focal point stays
  fully in frame.

The dark set is noticeably heavier per file (deeper tonal range compresses
less efficiently than the light pastel version) but every file is still well
under 300 KB.

## HTML — required meta tags (iOS full-bleed / standalone PWA)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

## CSS — light/dark swap

```css
body {
  margin: 0;
  min-height: 100vh;
  background: url('/assets/backgrounds/light/khavair-bg-light-base_852x1847.webp') center / cover no-repeat;
}

@media (prefers-color-scheme: dark) {
  body {
    background-image: url('/assets/backgrounds/dark/khavair-bg-dark-base_853x1844.webp');
  }
}

.app-content {
  /* keep real UI clear of the notch/Dynamic Island and home indicator */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  min-height: 100vh;
  box-sizing: border-box;
}
```

If Khavair has an in-app manual theme toggle (rather than relying purely on
system preference), swap the `background-image` the same way based on the
app's theme state instead of/in addition to the media query.

## Notes

- Prefer `.webp` with a `.jpg` fallback (via `<picture>` or a
  `background-image` feature query) for browsers without WebP support.
- `background-attachment: fixed` is unreliable in iOS standalone PWAs. If the
  image jumps/resets on scroll, use a `position: fixed; inset: 0; z-index: -1`
  element instead of attaching the background to `body`.
- `manifest.json` should have `"display": "standalone"` — iOS ignores
  `"fullscreen"` and falls back to it anyway.
- Glassmorphism cards: in light mode, watch contrast near the bright sun/sky
  area; in dark mode, the base tone is already dark, so panels can lean on
  lighter translucent fills to stand out rather than shadow/blur alone.

## Source

Two uploads, same composition (window, wing, sunset clouds), ~852×1847 and
853×1844 respectively. All variants derived via Lanczos resampling.
