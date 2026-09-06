# KhaVair — agent handoff

This file exists so a coding agent working cold on this repo (Codex, Claude Code, or
otherwise) has the context that would normally only live in prior chat history. Read this
before making any change.

## The one rule that matters most

**Do not break anything that already works.** This is a real person's private daily-use app
(cabin crew roster, pay, per-diem), not a demo. Every change here so far has gone through:
branch → implement → validate → PR with a clear description → wait for the owner's
**explicit** "merge" / "мёрж" → merge. Never push straight to `main`. Never merge a PR
yourself, no matter how confident you are — that decision belongs to the human. When in
doubt about scope, do less rather than more: this owner has repeatedly asked for exactly
what was requested and nothing extra ("Ничего не перерисовывать, не добавлять и не удалять
без моего подтверждения и запроса" — don't redesign, add, or remove anything beyond what
was actually asked).

## What this app is

KhaVair is an Expo / React Native Web PWA for an Air Astana cabin crew member: it parses
their monthly roster PDF, shows duties/flights/crew, computes pay and per-diem, and (as of
this writing) shows arrival-airport weather. It's deployed to GitHub Pages via
`.github/workflows/pages.yml` on every push to `main` — **a merge to `main` ships to the
real user within minutes.**

It has a hidden, privacy-preserving personalization feature called **Special Mode** (a.k.a.
"Loved One Mode" in the README, "for my Love" in conversation). See below — it has bitten
this project with a real privacy bug before, so treat it carefully.

## Repo map

```
app/
  +html.tsx          HTML shell: CSP, #root safe-area offset hack, service-worker
                      registration + the update-notice popup (see "Update highlights" below)
  _layout.tsx, index.tsx   Expo Router entry points
src/components/
  MainScreen.tsx      THE app. Tabs (Home/Roster/Money/More), palette, Special Mode
                      unlock, FlightDetail sheet, WeatherChip — almost everything lives
                      in this one large file, by design (see "Conventions" below)
  SwipeSurface.tsx    Tab-swipe / month-swipe gesture + spring-animation primitive
  IOSOverlay.tsx      IOSSheet (bottom sheet) and IOSDialog (centered modal) primitives
  SalaryCard.tsx, SalarySettingsSheet.tsx, haptics.ts
src/domain/           Pure functions, no React, no I/O
  rosterView.ts        Roster PDF data -> UI view-models (duties, sectors, ground events,
                       flight-card grouping/relay-merging)
  stationTime.ts       Station-local time math; has a pinned fix for Kazakhstan's March
                       2024 UTC+6->UTC+5 change (some engines' tzdata is stale on this)
  pay.ts, perDiem.ts, mrp.ts, crewPayNorm.ts, layovers.ts   Payroll rules, calibrated
                       against 4 real issued payslips (see README "Checking pay against a
                       payslip")
  lovedMode.ts, profile.ts, calendar.ts, fx.ts, gesture.ts, types.ts
src/import/            Air Astana roster PDF parsing (grid extraction, tokenizing,
                       pattern matching, crew-record extraction). Real roster PDFs contain
                       personal data and must NEVER be committed to this repo.
src/storage/           Thin localStorage wrappers, one file per concern, all keys
                       namespaced `khavair.<thing>.v<n>`
src/weather/           Open-Meteo integration (airports.ts coord table, weatherCodes.ts
                       icon/label mapping, weatherService.ts hooks+cache)
scripts/               make-icons.mjs/verify-icons.mjs (app icon generation/verification),
                       domain-smoke.ts (fast domain-layer tests), make-sw.mjs (service
                       worker generation), check-payslip.mts (manual payroll verification
                       tool, takes real files that stay outside the repo)
.github/workflows/     ci.yml (runs on every push/PR), pages.yml (deploys main to Pages)
```

## Conventions (do not fight these)

- **`palette` object, one `useMemo`, threaded everywhere.** `MainScreen.tsx` builds a
  single `palette` object from `lovedMode`/`dark` booleans and passes it as a prop through
  every component. **Zero literal hex codes inside component styles** — every color comes
  from `palette.*`. If you need a new color, add it to the palette object, don't inline a
  hex value.
- **One big `MainScreen.tsx`.** This is intentional, not an oversight — don't "refactor" it
  into smaller files unless explicitly asked. `RosterScreen` is deliberately **not** wrapped
  in `memo()`.
- **`SwipeSurface.tsx` / `IOSOverlay.tsx` are a stable, hard-won reference
  implementation** (ported from the sibling app `eScrew`, see below). Springs, timers,
  gesture-disambiguation logic — do not touch these unless a task explicitly asks you to
  change swipe/animation behavior. Multiple past tasks have explicitly called this out:
  "НЕ трогай механику свайпа/анимации табов" (don't touch the swipe/tab-animation
  mechanics).
- **Sibling repo `rbozzhanov-web/eScrew`** is the same author's other app, same lineage,
  richer feature set, kept in sync with KhaVair bidirectionally. Several features here were
  ported from there (today-focus roster scroll, weather, swipe mechanics). When asked to
  port something "like eScrew has," go read eScrew's actual current code first — don't
  guess, and don't copy its file structure 1:1 if KhaVair's own structure differs (e.g.
  KhaVair's `RosterRow`/`kind: 'flight'|'ground'` vs eScrew's `RosterTimelineRow`). Also
  check whether eScrew's feature depends on something KhaVair doesn't have (e.g. eScrew's
  AIMS Web Archive import, which KhaVair has no equivalent of) before porting — don't
  fabricate placeholder data or half-port a feature that needs it.
- **CSP is a real gate, not decoration.** `app/+html.tsx`'s `PRODUCTION_CSP` (`connect-src`
  in particular) only allows a hardcoded list of hosts. **Every time you add a `fetch()` to
  a new external host, add that host to `connect-src`,** or the request is silently blocked
  in the production build with no visible error in the app UI — only a console warning a
  user will never see. This exact bug shipped once (Open-Meteo forgotten from
  `connect-src`) and was only caught by checking Playwright console output, not the app.

## Special Mode — handle with care

A hidden personalization mode, unlocked by a 7-digit code (`DDMMNNN` — a date + flight
number meaningful to the real user) checked against a hash in `src/domain/lovedMode.ts`
(`verifyLovedModeCode`). The code itself is not stored in plaintext anywhere and should
never be.

**The whole point of this feature is that it stays invisible until unlocked.** A real
privacy bug shipped once where the personal update-notice title ("Lyubimkina there is a
new version available for you") showed to *every* user regardless of Special Mode state —
found during a review of some direct-to-main commits and fixed by restoring the
`specialModeActive() ? UPDATE_TITLE_SPECIAL : UPDATE_TITLE_NORMAL` conditional. Any code
that branches on Special Mode should be checked for exactly this failure mode: does it leak
personal content to a user who never unlocked the mode?

## Update highlights — do this on every user-facing change

`app/+html.tsx`'s `REGISTER_SW` script shows a one-time popup when the app updates,
built from three constants:

```js
const UPDATE_TITLE_SPECIAL = 'Lyubimkina there is a new version available for you'; // never change this
const UPDATE_TITLE_NORMAL = 'A new version of KhaVair is available.';
const UPDATE_NOTICE = '...one short sentence describing what changed...';
```

**Whenever you ship a user-facing feature or fix, update `UPDATE_NOTICE` to describe it in
one short sentence, in the same PR (or a follow-up commit to the same PR) as the feature.**
This has been forgotten before and had to be added back after the fact — don't let that
happen again. `UPDATE_TITLE_SPECIAL` is the fixed personal message and must **never** be
edited as part of a feature change; only `UPDATE_NOTICE` (and `UPDATE_TITLE_NORMAL`, in the
rare case the app's own name changes) should move.

## Workflow checklist for every task

1. `git checkout main && git pull origin main`, then `git checkout -b <descriptive-branch>`.
   Never commit to `main` directly.
2. Implement the change, matching the conventions above.
3. Update `UPDATE_NOTICE` in `app/+html.tsx` if the change is user-facing (see above).
4. Validate locally, matching what CI (`.github/workflows/ci.yml`) actually runs:
   ```bash
   npm run typecheck
   npm run test:domain
   npm run verify:icons
   npm run build:web
   ```
   All four must be clean before you push.
5. For UI changes, verify the real rendered behavior — see "Testing" below. Don't claim a
   visual/behavioral fix works from reading the code alone.
6. Push the branch, open a PR with: what changed and why, an explicit "not changed" section
   for anything a reviewer might expect but that's out of scope, a source reference if
   ported from eScrew, and a validation section. End the PR body with
   "Do not merge until explicitly requested."
7. Wait for CI to go green on the PR.
8. **Do not merge without the human explicitly saying so** ("merge" / "мёрж"). A request to
   *build* something is not permission to merge it.
9. After merge: `git checkout main && git pull origin main && git branch -d <branch>`.

If a CI push turns red, root-cause and fix it — don't skip/disable a check, don't force-push
over someone else's work, don't merge around a failure.

## Testing UI changes (this app has no unit-test framework for components)

Verification here means running the actual built app in headless Chromium, because
`npm run typecheck`/`build:web` catch compile errors, not behavior or rendering bugs.
Pattern used throughout this project:

1. `npm run build:web` (outputs to `dist/`).
2. Built asset paths are **absolute** (`/LyubimkinoiAPP/...`), so serve `dist/` from a
   parent directory literally named `LyubimkinoiAPP` (e.g. symlink `dist` to
   `.../LyubimkinoiAPP` and run `python3 -m http.server` from its parent), then browse to
   `http://127.0.0.1:<port>/LyubimkinoiAPP/`.
3. Drive it with `playwright-core` (already a transitive dep; Chromium is at
   `/opt/pw-browsers/chromium` in this environment) — launch with
   `executablePath: '/opt/pw-browsers/chromium'`.
4. Seed state via `page.addInitScript()` writing directly to `localStorage` (roster
   fixtures under `khavair.rosters.v2`, weather cache under `khavair.weather.v1` /
   `khavair.forecast.v1`, etc.) — building a minimal fake `ParsedAirAstanaRoster` object is
   usually easier than parsing a real PDF for a test.
5. Mock external network calls with `page.route()` (e.g. Open-Meteo — distinguish
   `current=` vs `daily=` requests by URL).
6. Prefer `getComputedStyle()` / `getBoundingClientRect()` assertions over screenshots alone
   for anything with a numeric or positional claim (exact scroll offset, exact color, etc.).
   A visual screenshot review is still worth doing for anything a human will look at.
7. Watch out for RN-web `FlatList` quirks: `initialScrollIndex` needs a real
   `getItemLayout` backed by *measured* row heights to land precisely — but even then, a
   target row near the end of a short list can get clamped short of the top simply because
   there isn't enough content left to scroll further (not a bug — verify with a fuller
   dataset before concluding something is broken).
8. Clean up: don't commit scratch test scripts or screenshots to the repo.

## Known project-specific gotchas

- **Kazakhstan's timezone changed** from UTC+6 to UTC+5 on 1 March 2024; pinned explicitly
  in `stationTime.ts` rather than trusted to the runtime's tzdata (some engines, e.g.
  WebKit, ship stale data and get this wrong).
- **The `#root` vertical offset** in `app/+html.tsx` (`translateY(24px)`) is a hand-tuned
  safe-area cushion for Dynamic Island devices; the `!important` on its `height` is
  load-bearing because `expo-router`'s own `ScrollViewStyleReset` sets `#root`'s height at
  equal CSS specificity afterward.
- **Manual theme override** (`khavair.theme.v1`, cycles Light → Dark → System) can diverge
  from the OS `prefers-color-scheme`. The HTML shell's own background (drawn before React
  hydrates) can only react to the OS scheme, so a `useEffect` in `MainScreen.tsx` mirrors
  the resolved palette background onto `document.body` directly once React is up — don't
  remove this without replacing what it fixes.
- **Roster PDFs and payroll data are real personal data.** Never commit a real roster PDF,
  payslip, or anything derived from one to this repository.

## Recent history (most recent first, at time of writing)

- **#45** Column-align the weather-forecast popup (one line per day: day / icon / short
  description / right-aligned temp range).
- **#44** Weather forecast popup (tap the chip to open an `IOSDialog` with a 2-day
  forecast), aggressive prefetch for upcoming duties' arrival airports, and a fix so the
  weather row shows an offline fallback instead of vanishing when nothing is cached yet.
- **#43** Ported "today focus" (Roster tab auto-scrolls to today's row on every entry, with
  an accent-glow highlight) and a basic arrival-airport `WeatherChip`, both from eScrew.
- **#40** Ported motion mechanics from eScrew (button-driven page-turn animations, sheet
  blur, scroll-vs-drag disambiguation) into `SwipeSurface`/`IOSOverlay`.
- **#39** Fixed the Special Mode privacy leak described above; removed dead/misleading
  roster-highlighting code found in the same review.
- **#38** Ground-duty days shown in the Roster list, with OFF/DOFF aqua/forest highlighting.
- **#37** Wired up previously-unused Aqua (deadhead tag) / Forest (weekend label) palette
  colors.
- **#36** Fixed the `#root` vertical safe-area offset (and a hidden `ScrollViewStyleReset`
  CSS-cascade bug found while fixing it).
- **#35** Three-state theme toggle (Light → Dark → System).
- **#34** Fixed a shell-background/status-bar seam bug when the manual theme diverges from
  the OS scheme.
- **#33** Colorschemed update-notice popup.
- **#32** Special Mode's Kha♥air color palette + glass material.

For anything older or more detailed than this list, ask the repo owner — they have the full
history.
