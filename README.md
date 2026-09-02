# KhaVair

Cabin crew companion for roster, crew, flight-hours, per-diem and later pay calculations.

## Product principles

- iOS-first, with Android and web support from one Expo / React Native Web codebase.
- No application-level vertical scrolling on primary screens; long content scrolls inside bounded panels.
- Roster and personal data are designed to remain local to the device.
- Existing Air Astana roster parsing and night-hours logic will be adapted from `FA-Logbook` rather than reimplemented.
- Normal mode stays professional and shareable; Loved One Mode adds restrained peach/rose accents derived from the supplied reference photo.
- Loved One Mode is an Easter egg: enabling it requires a local numeric code. The code itself is not stored in plaintext in the repository. This gate is intentionally not treated as a security boundary.

## Current foundation

The first shell includes Home, Roster, Money and More views, a next-duty card, cumulative month placeholders, a crew (`Flying with`) view and the initial per-diem rule configuration.

### Per-diem rules captured so far

- Kazakhstan: station other than ALA, more than 6 hours; amount TBD. Midnight/UTC counting details still need to be finalized against examples.
- Asia: more than 2 hours; USD 50.
- EU + UK: more than 2 hours; USD 60.

## Development

```bash
npm install
npm run web
npm run typecheck
```

### App icons

Every icon slot is generated, never copied. `assets/icon-source.png` is the master artwork;
`npm run icons` rescales it into the Expo app icon (1024), the iOS home-screen icon (180), the
two manifest icons (512, 192) and the favicon (64). `npm run verify:icons` — which CI runs
before the build — fails if any file is not the size it claims to be, or is a truncated PNG.
Both have shipped before: one 64x64 image once stood in for all five, and installability
depends on the real pixel size rather than the filename.

The current master is only 64x64, so the larger icons are upscales. Replacing
`assets/icon-source.png` with the full-resolution export and re-running `npm run icons` is all
that is needed to sharpen them.

Real rosters contain personal information and must not be committed to this repository.
