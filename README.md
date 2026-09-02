# KhaVair

Cabin crew companion for roster, crew, flight-hours, per-diem and later pay calculations.

## Product principles

- iOS-first, with Android and web support from one Expo / React Native Web codebase.
- No application-level vertical scrolling on primary screens; long content scrolls inside bounded panels.
- Roster and personal data are designed to remain local to the device.
- Existing Air Astana roster parsing and night-hours logic will be adapted from `FA-Logbook` rather than reimplemented.
- Normal mode stays professional and shareable; Loved One Mode adds restrained peach/rose accents.

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

Real rosters contain personal information and must not be committed to this repository.
