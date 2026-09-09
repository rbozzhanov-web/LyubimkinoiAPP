import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SalaryCard } from './SalaryCard';
import { SalarySettingsSheet } from './SalarySettingsSheet';
import { SwipeSurface, type SwipeSurfaceHandle } from './SwipeSurface';
import { IOSDialog, IOSSheet } from './IOSOverlay';
import { softHaptic } from './haptics';
import { exportRosterCalendar } from '@/src/domain/calendar';
import type { Duty, GroundEvent, Sector } from '@/src/domain/types';
import { verifyLovedModeCode } from '@/src/domain/lovedMode';
import { detectLoveContext, pickLovePhrase } from '@/src/domain/lovePhrases';
import { DEFAULT_PROFILE, type CrewProfile } from '@/src/domain/profile';
import { sumReportedBlockMinutes, sumReportedNightMinutes } from '@/src/domain/layovers';
import { formatMinutes, rosterMonthLabel, rosterToDuties, rosterToFlightCardGroups, rosterToGroundEvents, sectorRoute, type FlightCardGroup } from '@/src/domain/rosterView';
import { stationLocalDateTimeMs } from '@/src/domain/stationTime';
import { pickAndParseRoster } from '@/src/import/pickRoster';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { clearPayData } from '@/src/storage/payStorage';
import { clearStoredRosters, loadStoredRosters, removeStoredRoster, upsertStoredRoster } from '@/src/storage/rosterStorage';
import { activateSpecialPayPreset } from '@/src/storage/specialPayPreset';
import { clearLovedMode, clearSavedTheme, loadLovedMode, loadSavedTheme, saveLovedMode, saveTheme, type SavedTheme } from '@/src/storage/lovedModeStorage';
import { clearCrewProfile, loadCrewProfile, saveCrewProfile } from '@/src/storage/profileStorage';
import { airportCoords } from '@/src/weather/airports';
import { prefetchStationWeather, useAirportForecastState, useAirportWeather } from '@/src/weather/weatherService';
import { weatherIcon, windDirectionLabel } from '@/src/weather/weatherCodes';

type Tab = 'Home' | 'Roster' | 'Money' | 'More';
const TABS: Tab[] = ['Home', 'Roster', 'Money', 'More'];
const TAB_ICONS: Record<Tab, { glyph: string; size: number; nudge: number; weight: '700' | '800' }> = {
  Home: { glyph: '⌂', size: 24, nudge: 0, weight: '700' },
  Roster: { glyph: '✈︎', size: 22, nudge: 0, weight: '700' },
  Money: { glyph: '₸', size: 22, nudge: 0, weight: '800' },
  More: { glyph: '•••', size: 18, nudge: -2, weight: '700' },
};
type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua'|'aquaTint'|'aquaBorder'|'forest'|'forestTint'|'forestBorder'|'weekend', string> & {
  cardGlass?: any;
  tabGlass?: any;
  sheetGlass?: any;
  backdropPhoto?: any;
};
// Special Mode only, web only: a fixed sky photo behind the whole app -- the frosted glass
// cards (backdrop-filter blur over a translucent surface) were designed for exactly this, so
// showing them over a real photo instead of a flat color is what actually makes the "liquid
// glass" material read as glass. `backgroundColor` stays the plain palette color as a fallback
// for the moment before the image decodes and for anywhere the image doesn't fully cover.
const BACKDROP_PHOTO_LIGHT = Platform.OS === 'web' ? ({
  backgroundImage: 'url(bg-special-light.webp)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
} as any) : undefined;
const BACKDROP_PHOTO_DARK = Platform.OS === 'web' ? ({
  backgroundImage: 'url(bg-special-dark.webp)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
} as any) : undefined;
type RosterRow = { kind: 'flight'; key: string; sortKey: string; card: FlightCardGroup } | { kind: 'ground'; key: string; sortKey: string; event: GroundEvent };
type RosterDuty = { roster: ParsedAirAstanaRoster; duty: Duty };
type FocusDuty = RosterDuty & { reportMs: number; releaseMs: number };
const WEB_GLASS = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(22px) saturate(1.18)', WebkitBackdropFilter: 'blur(22px) saturate(1.18)' } as any)
  : undefined;
const WEB_TAB_GLASS = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(30px) saturate(1.38)', WebkitBackdropFilter: 'blur(30px) saturate(1.38)' } as any)
  : undefined;
// Special Mode glass recipes (card/tab/sheet), matching the Kha♥air glass material spec.
const WEB_CARD_GLASS_LOVED = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)' } as any)
  : undefined;
const WEB_TAB_GLASS_LOVED = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(32px) saturate(1.5)', WebkitBackdropFilter: 'blur(32px) saturate(1.5)' } as any)
  : undefined;
const WEB_SHEET_GLASS_LOVED = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(28px) saturate(1.4)', WebkitBackdropFilter: 'blur(28px) saturate(1.4)' } as any)
  : undefined;

/**
 * "Liquid glass" material -- Special Mode only. Kept within the 12-20px blur band a mid-range
 * phone can hold at 60fps (this file's other, older glass recipes go up to 32px; those predate
 * this budget and are left alone rather than churned as part of this change). The combined
 * inset+outer `boxShadow` is a raw CSS passthrough (same `as any` escape hatch already used
 * above for backdropFilter) -- native platforms just ignore unknown style keys, and this app
 * only ships as a web PWA anyway, so there's no real fallback path to write beyond that.
 *
 * Deliberately no `contain: paint` here even though it would help compositor promotion: Safari
 * clips `contain: paint` to the element's plain rectangular bounds regardless of border-radius.
 * The cards already carry `overflow: 'hidden'`, which clips to the rounded border correctly
 * everywhere else, so this is the one guardrail from the original spec this file skips.
 *
 * `isolation: 'isolate'` and the `WebkitMaskImage` below are two more guardrails for the same
 * family of bug, confirmed to reproduce specifically in iOS's home-screen "Add to Home Screen"
 * standalone container and NOT in a plain Safari tab on the same device: iOS renders a
 * standalone PWA through a different compositing path than a Safari tab, and `backdrop-filter`
 * combined with `border-radius` is known to stop clipping to the rounded corner there even
 * though the identical CSS clips correctly in Safari itself. `isolation: 'isolate'` forces this
 * element to be its own compositing boundary (also guards against the sheen child's
 * `mix-blend-mode` and the hero's `transform`-animated wrapper escaping the rounded clip, a
 * related but separate class of the same bug). The mask-image is the standard, widely-used
 * workaround for the standalone-container case specifically: an opaque mask that changes
 * nothing visually but forces the browser to actually recompute the clip against the rounded
 * shape instead of reusing a stale rectangular one.
 */
const LIQUID_GLASS_BASE = Platform.OS === 'web' ? ({
  backdropFilter: 'blur(18px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.8)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 15px 35px rgba(0,0,0,.25)',
  isolation: 'isolate',
  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
} as any) : undefined;
const LIQUID_GLASS_BORDER = 'rgba(255,255,255,.16)';
const LIQUID_SHEEN_BG = Platform.OS === 'web' ? ({
  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.35) 0%, transparent 65%)',
  mixBlendMode: 'soft-light',
  willChange: 'transform',
} as any) : undefined;
const LIQUID_RIM_BG = Platform.OS === 'web' ? ({
  background: 'linear-gradient(135deg, rgba(255,255,255,.25) 0%, transparent 40%, transparent 70%, rgba(0,0,0,.08) 100%)',
} as any) : undefined;
const LIQUID_SHEEN_LEG_MS = 9000;

/**
 * The moving "fluid" shimmer -- a radial highlight that drifts/rotates/scales in an endless
 * there-and-back loop (Animated.loop around a forward-then-reverse sequence is this codebase's
 * equivalent of CSS's `animation-direction: alternate`, since RN has no such keyword). Driven
 * entirely by `transform` via `useNativeDriver: true` so it never touches layout -- no
 * top/left/width/height in the animated values, matching the spec's own 60fps constraint.
 * `radius` only affects the static rim layer beneath it; the sheen itself is a plain rectangle
 * clipped by the card's own `overflow: 'hidden'`, same as the rim.
 */
function LiquidSheen({ radius, animated = true }: { radius: number; animated?: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  // The sheen's own oversized (180%) box is sized in real px once it's laid out. translateX/Y
  // are keyed off that measured size (in px) rather than percentage strings -- verified via a
  // live DOM check that RN-Web's native-driver transform interpolation silently freezes on a
  // percentage-string translateX/Y output (the static 180%/-40% *sizing* percentages work fine;
  // it's specifically an animated percentage *translate* that never advances past frame one).
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!animated || !size.width || !size.height) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: LIQUID_SHEEN_LEG_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
        Animated.timing(t, { toValue: 0, duration: LIQUID_SHEEN_LEG_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, size.width, size.height, t]);

  return <>
    {animated && <Animated.View pointerEvents="none" onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} style={[styles.liquidSheenLayer, LIQUID_SHEEN_BG, {
      transform: [
        { translateX: t.interpolate({ inputRange: [0, .5, 1], outputRange: [-0.15 * size.width, 0.05 * size.width, 0.15 * size.width] }) },
        { translateY: t.interpolate({ inputRange: [0, .5, 1], outputRange: [-0.15 * size.height, 0.10 * size.height, -0.05 * size.height] }) },
        { rotate: t.interpolate({ inputRange: [0, .5, 1], outputRange: ['0deg', '5deg', '-5deg'] }) },
        { scale: t.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1.05, .95] }) },
      ],
    }]} />}
    <View pointerEvents="none" style={[styles.liquidRimLayer, LIQUID_RIM_BG, { borderRadius: radius }]} />
  </>;
}
/**
 * All shadow* props must live in the same style object — react-native-web derives a single
 * boxShadow per object, so splitting shadowColor into a separate object in the style array
 * (rather than merging shadow properties key-by-key) makes the later object's missing
 * offset/radius/opacity silently zero out the shadow instead of merging with the earlier one.
 */
const todayGlow = (palette: Palette) => ({
  shadowColor: palette.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: .32, shadowRadius: 20, elevation: 8,
});
// Matches styles.listContent (padding:8, gap:7) — used by getItemLayout to compute an
// authoritative scroll offset before rows are actually measured.
const LIST_TOP_PADDING = 8;
const LIST_ROW_GAP = 7;
const ROW_HEIGHT_ESTIMATE = { flight: 108, ground: 70 } as const;
// Two days is the fallback when no complete layover can be resolved; weatherService expands
// this to the actual arrival-through-departure range when the roster provides it.
const FORECAST_DAYS = 2;
function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function MainScreen() {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 768;
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  const [themeOverride, setThemeOverride] = useState<SavedTheme | undefined>(() => loadSavedTheme());
  useEffect(() => { if (!hydrated) setHydrated(true); }, [hydrated]);
  const dark = hydrated && (themeOverride ?? scheme) === 'dark';
  const [tab, setTab] = useState<Tab>('Home');
  const [lovedMode, setLovedMode] = useState(false);
  // Owned here (not inside Home) so the header keeps showing the last-picked note while the
  // viewer browses other tabs -- Home fully unmounts on tab switch, but this state doesn't.
  // Home still does all the actual picking; this just mirrors its result up one level.
  const [headerLovePhrase, setHeaderLovePhrase] = useState<string>();
  const handleLovePhrase = useCallback((phrase: string) => setHeaderLovePhrase(phrase), []);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [codeInputFocused, setCodeInputFocused] = useState(false);
  const [crewProfile, setCrewProfile] = useState<CrewProfile>(DEFAULT_PROFILE);
  const [rosters, setRosters] = useState<ParsedAirAstanaRoster[]>([]);
  const [activeMonth, setActiveMonth] = useState<string>();
  const [selectedFlight, setSelectedFlight] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>();
  const [salarySettingsOpen, setSalarySettingsOpen] = useState(false);
  const [payRevision, setPayRevision] = useState(0);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabSelection = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const tabSwipeRef = useRef<SwipeSurfaceHandle>(null);

  useEffect(() => {
    setLovedMode(loadLovedMode());
    setCrewProfile(loadCrewProfile());
  }, []);

  useEffect(() => {
    const stored = loadStoredRosters();
    setRosters(stored);
    setActiveMonth(stored.at(-1)?.period.start);
  }, []);

  useEffect(() => {
    Animated.spring(tabSelection, {
      toValue: TABS.indexOf(tab),
      stiffness: 380,
      damping: 34,
      mass: 0.72,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [tab, tabSelection]);

  const roster = rosters.find((item) => item.period.start === activeMonth) ?? rosters.at(-1);
  const duties = useMemo(() => roster ? rosterToDuties(roster) : [], [roster]);
  const selectedSector = duties.flatMap((duty) => duty.sectors).find((sector) => sector.id === selectedFlight);
  const allDuties = useMemo<RosterDuty[]>(() => rosters.flatMap((item) => rosterToDuties(item).map((duty) => ({ roster: item, duty }))), [rosters]);
  useEffect(() => {
    // Warms the weather/forecast cache for the next few duties' arrival airports, not just
    // whichever flight happens to be on screen — so the chip and its popup already have
    // data by the time the user gets there.
    const now = Date.now();
    const upcoming = timedDuties(allDuties).filter((item) => item.releaseMs >= now).slice(0, 6);
    const seen = new Set<string>();
    const requests: { code: string; days: number; startDate?: string }[] = [];
    for (const item of upcoming) {
      const last = item.duty.sectors[item.duty.sectors.length - 1];
      if (!last) continue;
      const startDate = arrivalForecastDate(item.duty);
      const requestKey = `${last.arrival}:${startDate ?? ''}`;
      if (seen.has(requestKey)) continue;
      seen.add(requestKey);
      requests.push({ code: last.arrival, days: FORECAST_DAYS, startDate });
    }
    if (requests.length) prefetchStationWeather(requests);
  }, [allDuties]);
  const tabStep = tabBarWidth / TABS.length;
  const tabIndicatorX = Animated.multiply(tabSelection, tabStep);
  const codeShakeX = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-7, 0, 7] });

  const palette = useMemo<Palette>(() => ({
    background: lovedMode ? (dark ? '#2B1F1B' : '#FFE6E1') : (dark ? '#11110F' : '#F4F1EC'),
    surface: lovedMode ? (dark ? 'rgba(58,42,37,.76)' : 'rgba(255,247,242,.76)') : (dark ? 'rgba(27,26,24,.78)' : 'rgba(252,250,247,.78)'),
    surfaceStrong: lovedMode ? (dark ? 'rgba(58,42,37,.90)' : 'rgba(255,247,242,.90)') : (dark ? 'rgba(37,35,31,.84)' : 'rgba(255,255,255,.84)'),
    text: lovedMode ? (dark ? '#FFF3EC' : '#2B1F1B') : (dark ? '#F7F4EF' : '#171714'),
    muted: lovedMode ? (dark ? '#D9AFA0' : '#7A5347') : (dark ? '#B5AFA4' : '#4A4540'),
    line: lovedMode ? (dark ? 'rgba(255,230,225,.14)' : 'rgba(43,31,27,.10)') : (dark ? 'rgba(247,244,239,.12)' : 'rgba(47,57,52,.10)'),
    accent: lovedMode ? '#FF9A7A' : (dark ? '#C7BDAE' : '#2F3934'),
    accentSoft: lovedMode ? (dark ? '#4A2822' : '#FFD9CC') : (dark ? '#222925' : '#E6ECE8'),
    rose: lovedMode ? '#FF6B6A' : (dark ? '#D79A9F' : '#C23B50'),
    aqua: lovedMode ? '#2BD6C6' : (dark ? '#B5AFA4' : '#5F5C55'),
    aquaTint: lovedMode ? (dark ? 'rgba(43,214,198,.16)' : 'rgba(43,214,198,.12)') : (dark ? 'rgba(181,175,164,.14)' : 'rgba(95,92,85,.10)'),
    aquaBorder: lovedMode ? (dark ? 'rgba(43,214,198,.35)' : 'rgba(43,214,198,.32)') : (dark ? 'rgba(181,175,164,.30)' : 'rgba(95,92,85,.26)'),
    forest: lovedMode ? '#2E7D63' : (dark ? '#7CA893' : '#356952'),
    forestTint: lovedMode ? (dark ? 'rgba(46,125,99,.22)' : 'rgba(46,125,99,.14)') : (dark ? 'rgba(124,168,147,.16)' : 'rgba(53,105,82,.10)'),
    forestBorder: lovedMode ? (dark ? 'rgba(46,125,99,.45)' : 'rgba(46,125,99,.34)') : (dark ? 'rgba(124,168,147,.32)' : 'rgba(53,105,82,.26)'),
    weekend: lovedMode ? '#D3916A' : (dark ? '#DE8580' : '#8B3A3F'),
    cardGlass: lovedMode ? WEB_CARD_GLASS_LOVED : undefined,
    tabGlass: lovedMode ? WEB_TAB_GLASS_LOVED : undefined,
    sheetGlass: lovedMode ? WEB_SHEET_GLASS_LOVED : undefined,
    backdropPhoto: lovedMode ? (dark ? BACKDROP_PHOTO_DARK : BACKDROP_PHOTO_LIGHT) : undefined,
  }), [dark, lovedMode]);

  useEffect(() => {
    // The HTML shell's own background (behind #root, e.g. the safe-area/status-bar strip
    // and overscroll bounce) is CSS-only and can only react to the OS color scheme — it
    // has no way to see the manual Special Mode theme override. Once React is up, mirror
    // the resolved palette onto it directly so the whole screen always matches, even when
    // the manual override diverges from the OS scheme.
    if (typeof document === 'undefined') return;
    document.body.style.backgroundColor = palette.background;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', palette.background));
  }, [palette.background]);

  const importRoster = async () => {
    setImportError(undefined);
    setImporting(true);
    try {
      const parsed = await pickAndParseRoster();
      if (!parsed) return;
      const next = upsertStoredRoster(parsed);
      setRosters(next);
      setActiveMonth(parsed.period.start);
      setSelectedFlight(undefined);
      setTab('Roster');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  };

  const deleteRoster = (periodStart: string) => {
    const next = removeStoredRoster(periodStart);
    setRosters(next);
    setSelectedFlight(undefined);
    setActiveMonth((current) => current && current !== periodStart && next.some((item) => item.period.start === current) ? current : next.at(-1)?.period.start);
  };

  const updateCrewProfile = (contractRank: string) => {
    const next = saveCrewProfile({ contractRank });
    setCrewProfile(next);
  };

  const changeMonth = (direction: -1 | 1) => {
    if (!roster) return;
    const index = rosters.findIndex((item) => item.period.start === roster.period.start);
    const next = rosters[index + direction];
    if (!next) return;
    setActiveMonth(next.period.start);
    setSelectedFlight(undefined);
  };
  const changeTab = (direction: -1 | 1) => {
    const next = TABS[TABS.indexOf(tab) + direction];
    if (!next) return;
    setSelectedFlight(undefined);
    setTab(next);
  };
  const goToTab = (target: Tab) => {
    if (target === tab) return;
    const direction = TABS.indexOf(target) > TABS.indexOf(tab) ? -1 : 1;
    setSelectedFlight(undefined);
    tabSwipeRef.current?.play(direction, () => setTab(target));
  };

  const requestLovedMode = () => {
    if (lovedMode) { clearLovedMode(); setLovedMode(false); return; }
    setUnlockCode('');
    setUnlockError(false);
    setUnlockOpen(true);
  };
  const toggleTheme = () => {
    // Cycles Light -> Dark -> System (follows the OS scheme) -> Light...
    const next: SavedTheme | undefined = themeOverride === undefined ? 'light' : themeOverride === 'light' ? 'dark' : undefined;
    if (next === undefined) clearSavedTheme(); else saveTheme(next);
    setThemeOverride(next);
  };
  const submitCode = () => {
    if (!verifyLovedModeCode(unlockCode)) {
      setUnlockError(true);
      shakeAnim.stopAnimation();
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
      return;
    }
    activateSpecialPayPreset();
    saveLovedMode();
    setPayRevision((value) => value + 1);
    setLovedMode(true);
    setUnlockOpen(false);
    setUnlockCode('');
    setUnlockError(false);
  };
  const eraseAll = () => {
    clearStoredRosters();
    clearPayData();
    clearLovedMode();
    clearCrewProfile();
    setLovedMode(false);
    setCrewProfile(DEFAULT_PROFILE);
    setRosters([]);
    setActiveMonth(undefined);
    setSelectedFlight(undefined);
    setPayRevision((value) => value + 1);
    setTab('Home');
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }, palette.backdropPhoto]} edges={desktopWeb ? ['bottom'] : ['top', 'bottom']}>
    <View style={styles.app}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {lovedMode
            ? <View style={styles.brandWord} accessibilityLabel="KhaVair special mode">
                <Text style={[styles.brand, { color: palette.text }]}>Kha</Text>
                <View style={styles.vHeartMark}>
                  <Text style={[styles.vHeartGlyph, { color: palette.rose }]}>♥</Text>
                </View>
                <Text style={[styles.brand, { color: palette.text }]}>air</Text>
              </View>
            : <Text style={[styles.brand, { color: palette.text }]}>KhaVair</Text>}
          {lovedMode && headerLovePhrase
            ? <MarqueeText text={headerLovePhrase} textStyle={styles.headerLoveNote} color={palette.rose} />
            : <Text style={[styles.kicker, { color: palette.muted }]}>CABIN CREW COMPANION</Text>}
        </View>
        <View style={styles.headerActions}>
          {lovedMode && <Pressable onPress={toggleTheme} style={[styles.modeButton, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface }]} accessibilityRole="button" accessibilityLabel={themeOverride === undefined ? 'Switch to light theme' : themeOverride === 'light' ? 'Switch to dark theme' : 'Switch to system theme'}>
            <Text style={[styles.modeGlyph, themeOverride === undefined && styles.modeGlyphPair]}>{themeOverride === undefined ? '🍑🍒' : themeOverride === 'dark' ? '🍑' : '🍒'}</Text>
          </Pressable>}
          <Pressable onPress={requestLovedMode} style={[styles.modeButton, { backgroundColor: lovedMode ? palette.accentSoft : palette.surface, borderColor: lovedMode ? palette.rose : 'transparent', borderWidth: lovedMode ? 1 : 0 }]} accessibilityLabel="Special mode">
            <Text style={styles.modeGlyph}>{lovedMode ? '🌹' : '♡'}</Text>
          </Pressable>
        </View>
      </View>

      <SwipeSurface ref={tabSwipeRef} style={styles.viewport} onSwipeLeft={tab === 'More' ? undefined : () => changeTab(1)} onSwipeRight={tab === 'Home' ? undefined : () => changeTab(-1)}>
        {tab === 'Home' && <Home allDuties={allDuties} fallbackRoster={roster} rosters={rosters} palette={palette} onLovePhrase={handleLovePhrase} onImport={importRoster} importing={importing} />}
        {tab === 'Roster' && <RosterScreen roster={roster} rosters={rosters} duties={duties} selectedSector={selectedSector} palette={palette} profile={crewProfile} importing={importing} error={importError} onImport={importRoster} onSelect={setSelectedFlight} onMonth={changeMonth} />}
        {tab === 'Money' && <MoneyScreen key={`${roster?.period.start ?? 'none'}-${payRevision}`} roster={roster} palette={palette} />}
        {tab === 'More' && <MoreScreen rosters={rosters} roster={roster} profile={crewProfile} palette={palette} onDeleteRoster={deleteRoster} onProfileChange={updateCrewProfile} onErase={eraseAll} onSalarySettings={() => setSalarySettingsOpen(true)} />}
      </SwipeSurface>

      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - tabBarWidth) > 0.5) setTabBarWidth(nextWidth);
        }}
        style={[styles.tabBar, styles.depthSurface, palette.tabGlass ?? WEB_TAB_GLASS, { backgroundColor: palette.surface, borderColor: palette.line }]}
      >
        {/* Rim only, no shimmer -- this bar is interactive chrome the viewer looks at on every
            tab change, not a card to admire; a moving highlight here would just be distracting. */}
        {palette.tabGlass && <LiquidSheen radius={22} animated={false} />}
        {tabBarWidth > 0 && <Animated.View pointerEvents="none" style={[styles.tabSelection, { width: Math.max(0, tabStep - 8), backgroundColor: palette.surfaceStrong, transform: [{ translateX: tabIndicatorX }] }]} />}
        {TABS.map((item) => {
          const active = item === tab;
          return <Pressable key={item} onPress={() => goToTab(item)} style={styles.tabItem} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <View style={styles.tabIconWrap}><Text style={[styles.tabIcon, { color: active ? palette.accent : palette.muted, fontSize: TAB_ICONS[item].size, lineHeight: TAB_ICONS[item].size + 3, marginTop: TAB_ICONS[item].nudge, fontWeight: TAB_ICONS[item].weight }]}>{TAB_ICONS[item].glyph}</Text></View>
            <Text style={[styles.tabText, { color: active ? palette.text : palette.muted }]}>{item}</Text>
          </Pressable>;
        })}
      </View>
    </View>

    <Modal visible={unlockOpen} transparent animationType="fade" onRequestClose={() => setUnlockOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.unlockCard, styles.depthSurface, palette.sheetGlass ?? WEB_GLASS, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          <Text style={[styles.label, { color: palette.rose }]}>FOR SOMEONE SPECIAL</Text>
          <Text style={[styles.unlockTitle, { color: palette.text }]}>Enter the code</Text>
          <Animated.View style={{ transform: [{ translateX: codeShakeX }] }}>
            <TextInput autoFocus value={unlockCode} secureTextEntry keyboardType="number-pad" maxLength={7}
              placeholder="DDMMNNN"
              placeholderTextColor={palette.muted}
              onChangeText={(value) => { setUnlockCode(value.replace(/\D/g, '').slice(0, 7)); setUnlockError(false); }}
              onSubmitEditing={submitCode}
              onFocus={() => setCodeInputFocused(true)}
              onBlur={() => setCodeInputFocused(false)}
              style={[styles.codeInput, {
                color: palette.text,
                backgroundColor: palette.surface,
                borderColor: unlockError ? palette.rose : codeInputFocused ? palette.accent : palette.line,
                borderWidth: codeInputFocused ? 2 : 1,
              }]} />
          </Animated.View>
          <Text style={[styles.codeHint, { color: unlockError ? palette.rose : palette.muted }]}>{unlockError ? 'That code did not unlock the mode.' : 'DD = date · MM = month · NNN = 3-digit flight number'}</Text>
          {!unlockError && <Text style={[styles.codeExample, { color: palette.muted }]}>Example · Phuket in November: 1511123</Text>}
          <View style={styles.actions}>
            <Pressable onPress={() => setUnlockOpen(false)} style={[styles.action, { borderColor: palette.line }]}><Text style={{ color: palette.text }}>Cancel</Text></Pressable>
            <Pressable onPress={submitCode} style={[styles.action, { backgroundColor: palette.accent, borderColor: palette.accent }]}><Text style={styles.actionText}>Unlock</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <SalarySettingsSheet visible={salarySettingsOpen} roster={roster} palette={palette} onClose={() => setSalarySettingsOpen(false)} onSaved={() => setPayRevision((value) => value + 1)} />
  </SafeAreaView>;
}

function Home({ allDuties, fallbackRoster, rosters, palette, onLovePhrase, onImport, importing }: { allDuties: RosterDuty[]; fallbackRoster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; palette: Palette; onLovePhrase: (phrase: string) => void; onImport: () => void; importing: boolean }) {
  const now = useNow();
  const [crewOpen, setCrewOpen] = useState(false);
  const heroPressScale = useRef(new Animated.Value(1)).current;
  const timeline = useMemo(() => timedDuties(allDuties), [allDuties]);
  const focus = useMemo(() => pickFocusDuty(timeline, now), [timeline, now]);
  const roster = focus?.roster ?? fallbackRoster;
  const duty = focus?.duty;
  // Special Mode's little personal note, shown up in the header (not here) so it stays
  // visible while the viewer browses other tabs. Read only when the hero card resolves an
  // arrival station, so this never triggers an extra weather fetch on its own -- WeatherChip
  // below already fetches the same code, and this hook just reads the same cache. The
  // phrase itself is picked once per Home mount (Home fully remounts on every tab visit,
  // since tabs render conditionally rather than staying mounted) so it reads like a fixed
  // note left for this visit, not something that shifts under the viewer while they read it.
  const arrivalWeather = useAirportWeather(duty?.sectors[duty.sectors.length - 1]?.arrival);
  const loveContext = useMemo(() => detectLoveContext({
    now,
    isActive: focus?.reportMs !== undefined && focus?.releaseMs !== undefined && focus.reportMs <= now && focus.releaseMs >= now,
    isUpcoming: focus?.reportMs !== undefined && focus.reportMs > now,
    reportMs: focus?.reportMs,
    releaseMs: focus?.releaseMs,
    arrivalTemp: arrivalWeather?.temp,
    arrivalWeatherCode: arrivalWeather?.weatherCode,
  }), [now, focus, arrivalWeather?.temp, arrivalWeather?.weatherCode]);
  // Picked once per mount, but only once real duty data exists -- MainScreen loads rosters
  // asynchronously, so Home's very first render (right when the app opens, before that
  // load resolves) always has no duty yet. A useState lazy initializer here would lock in
  // that empty, context-less state for the rest of the mount and never correct itself once
  // the real duty arrives a moment later -- exactly wrong, since app-open is the one moment
  // this note matters most.
  const lovePhrasePicked = useRef(false);
  // useAirportWeather's own cache read settles one render after `duty` (and the arrival
  // code derived from it) first becomes available -- picking immediately on that same
  // render would read arrivalTemp/arrivalWeatherCode while they're still momentarily
  // undefined, silently skipping weather_cold/weather_hot/weather_rain even when a cached
  // reading already exists. dutyReady defers the actual pick by exactly one extra render so
  // both signals have settled together, without changing anything about the "pick once"
  // rule. This only helps when the weather cache is already warm (the common case, thanks
  // to prefetchStationWeather) -- a genuinely cold cache needs a real network round trip no
  // render-timing fix can shorten, so that case still falls through to time-of-day/random,
  // same as it always has for weather_cold/weather_hot.
  const [dutyReady, setDutyReady] = useState(false);
  useEffect(() => { if (duty) setDutyReady(true); }, [duty]);
  useEffect(() => {
    if (lovePhrasePicked.current || !dutyReady) return;
    lovePhrasePicked.current = true;
    onLovePhrase(pickLovePhrase(loveContext));
  }, [dutyReady, loveContext, onLovePhrase]);

  if (!roster || !duty) return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Your roster, simplified.</Text>
    <Text style={[styles.intro, { color: palette.muted }]}>Import an Air Astana Personal Crew Schedule Report.</Text>
    <PrimaryButton title="Import roster PDF" onPress={onImport} loading={importing} palette={palette} />
  </View>;

  const first = duty.sectors[0];
  const last = duty.sectors[duty.sectors.length - 1];
  const forecastDate = arrivalForecastDate(duty);
  const reportMs = focus?.reportMs;
  const releaseMs = focus?.releaseMs;
  const isUpcoming = reportMs !== undefined && reportMs > now;
  const isActive = reportMs !== undefined && releaseMs !== undefined && reportMs <= now && releaseMs >= now;
  const countdown = reportMs === undefined ? undefined : isUpcoming ? formatCountdown(reportMs - now) : isActive ? formatCountdown(now - reportMs) : undefined;
  const spanMinutes = reportMs !== undefined && releaseMs !== undefined ? Math.round((releaseMs - reportMs) / 60000) : undefined;
  const dutyMinutes = spanMinutes !== undefined && spanMinutes > 0 ? spanMinutes : undefined;

  const neighbours = previousDuties(timeline, focus, now, 6);
  const dutyStateLabel = isUpcoming ? 'NEXT DUTY' : isActive ? 'ON DUTY NOW' : 'LATEST DUTY';
  const dutyStatusWord = isUpcoming ? 'TO REPORT' : 'ON DUTY';
  const block = roster.totals.blockMinutes;
  const night = roster.totals.nightMinutes;
  const nightShare = block && night !== undefined ? Math.round((night / block) * 100) : undefined;

  return <View style={styles.screen}>
    <Animated.View style={{ transform: [{ scale: heroPressScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View crew for ${routeChain(duty)}`}
        onPressIn={() => Animated.spring(heroPressScale, { toValue: 0.986, stiffness: 560, damping: 34, mass: 0.42, useNativeDriver: true, isInteraction: false }).start()}
        onPressOut={() => Animated.spring(heroPressScale, { toValue: 1, stiffness: 420, damping: 25, mass: 0.52, useNativeDriver: true, isInteraction: false }).start()}
        onPress={() => { softHaptic(); setCrewOpen(true); }}
        style={[styles.heroCard, styles.depthSurface, palette.cardGlass, palette.cardGlass && LIQUID_GLASS_BASE, { backgroundColor: palette.surfaceStrong, borderColor: palette.cardGlass ? LIQUID_GLASS_BORDER : palette.line }]}
      >
        {palette.cardGlass && <LiquidSheen radius={26} />}
        <View style={styles.heroTopRow}>
          <ScrollableRouteText text={routeChain(duty)} textStyle={styles.heroRoute} color={palette.text} cardBackground={palette.surfaceStrong} />
          <View style={[styles.dutyPill, { backgroundColor: palette.accentSoft, borderColor: palette.line }]}>
            <Text numberOfLines={1} style={[styles.dutyPillDate, { color: palette.muted }]}>{dutyStateLabel} · {duty.dateLabel}</Text>
            {countdown && <Text numberOfLines={1} style={[styles.dutyPillValue, { color: palette.text }]}>{countdown}</Text>}
            {countdown && <Text numberOfLines={1} style={[styles.dutyPillLabel, { color: isActive ? palette.accent : palette.muted }]}>{dutyStatusWord}</Text>}
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.heroFlight, { color: palette.muted }]}>{duty.sectors.map((sector) => sector.flightNumber).join(' · ')}</Text>

        <View style={[styles.timeDivider, { backgroundColor: palette.line }]} />
        <View style={styles.timeRow}>
          <TimeCell label="REPORT" value={duty.reportTime} palette={palette} />
          <TimeCell label={`DEP · ${first.departure}`} value={first.departureTime} palette={palette} />
          <TimeCell label={`ARR · ${last.arrival}`} value={last.arrivalTime} palette={palette} />
          <TimeCell label="RELEASE" value={duty.releaseTime} palette={palette} />
        </View>

        <Text style={[styles.heroFoot, { color: palette.muted }]}>
          {dutyMinutes !== undefined ? `Duty ${formatMinutes(dutyMinutes)} · ` : ''}{duty.sectors.length} sector{duty.sectors.length === 1 ? '' : 's'}
        </Text>
        <WeatherChip code={last.arrival} targetDate={forecastDate} palette={palette} />
      </Pressable>
    </Animated.View>

    <Text style={[styles.label, { color: palette.muted }]}>{rosterMonthLabel(roster)}</Text>
    <View style={styles.summaryRow}>
      <Summary title="BLOCK HOURS" value={formatMinutes(block)} detail={`${operatingCount(roster)} sectors flown`} palette={palette} />
      <Summary title="NIGHT HOURS" value={formatMinutes(night)} detail={nightShare === undefined ? 'reported by the roster' : `${nightShare}% of block time`} palette={palette} />
    </View>

    {neighbours.length > 0 && <View style={[styles.upNext, palette.cardGlass && styles.upNextGlassPanel, palette.cardGlass && LIQUID_GLASS_BASE, palette.cardGlass && { backgroundColor: palette.surface, borderColor: LIQUID_GLASS_BORDER }]}>
      {/* Static rim only, not the animated sheen -- a moving shimmer behind several rows of
          read-heavy text (dates, routes, times) would be a distraction, not a highlight. */}
      {palette.cardGlass && <LiquidSheen radius={20} animated={false} />}
      <Text style={[styles.label, { color: palette.muted }]}>PREVIOUS FLIGHTS</Text>
      <FlatList data={neighbours} keyExtractor={(item) => item.duty.id} showsVerticalScrollIndicator={false} style={styles.upNextList}
        renderItem={({ item }) => <View style={[styles.upNextRow, { borderColor: palette.line }]}>
          <Text style={[styles.upNextDate, { color: palette.muted }]}>{item.duty.dateLabel}</Text>
          <Text numberOfLines={1} style={[styles.upNextRoute, { color: palette.text }]}>{routeChain(item.duty)}</Text>
          <View style={styles.upNextTimeBlock}>
            <Text style={[styles.upNextTimeLabel, { color: palette.muted }]}>RELEASED AT</Text>
            <Text style={[styles.upNextTime, { color: palette.muted }]}>{item.duty.releaseTime}</Text>
          </View>
        </View>} />
    </View>}
    {crewOpen && <FlightDetail sectors={duty.sectors} dateLabel={duty.dateLabel} weatherCode={last.arrival} forecastDate={forecastDate} palette={palette} onClose={() => setCrewOpen(false)} />}
  </View>;
}

function RosterScreen({ roster, rosters, duties, selectedSector, palette, profile, importing, error, onImport, onSelect, onMonth }: { roster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; duties: Duty[]; selectedSector?: Sector; palette: Palette; profile: CrewProfile; importing: boolean; error?: string; onImport: () => void; onSelect: (id?: string) => void; onMonth: (direction: -1 | 1) => void }) {
  const [calendarState, setCalendarState] = useState<'idle'|'working'|'done'|'error'>('idle');
  const index = roster ? rosters.findIndex((item) => item.period.start === roster.period.start) : -1;
  const flights = useMemo<FlightCardGroup[]>(() => rosterToFlightCardGroups(duties), [duties]);
  const selectedIndex = selectedSector ? flights.findIndex((card) => card.sectors.some((sector) => sector.id === selectedSector.id)) : -1;
  const selectedRow = selectedIndex >= 0 ? flights[selectedIndex] : undefined;
  const groundEvents = useMemo(() => roster ? rosterToGroundEvents(roster) : [], [roster]);
  const rows = useMemo<RosterRow[]>(() => {
    const flightRows: RosterRow[] = flights.map((card) => ({
      kind: 'flight', key: card.id, card,
      sortKey: `${card.duty.date ?? ''}T${card.sectors[0]?.departureTime !== '—' ? card.sectors[0]?.departureTime : '00:00'}`,
    }));
    const groundRows: RosterRow[] = groundEvents.map((event) => ({
      kind: 'ground', key: event.id, event, sortKey: `${event.date}T00:00`,
    }));
    return [...flightRows, ...groundRows].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [flights, groundEvents]);
  const monthSwipeRef = useRef<SwipeSurfaceHandle>(null);
  const listRef = useRef<FlatList<RosterRow>>(null);
  const rowHeights = useRef(new Map<string, number>()).current;
  const offsetsCache = useRef<{ rows: RosterRow[]; offsets: number[] } | null>(null);
  const today = localTodayIso();
  const todayIndex = useMemo(() => {
    let idx = rows.findIndex((row) => row.sortKey.slice(0, 10) === today);
    if (idx === -1) idx = rows.findIndex((row) => row.sortKey.slice(0, 10) > today);
    return idx;
  }, [rows, today]);
  // Without this, scrollToIndex/initialScrollIndex have to guess an offset (via
  // averageItemLength), render near it, measure, and correct — a multi-step process that
  // reliably lands a few rows short of the target instead of putting it at the top. Caching
  // each row's real measured height (falling back to a per-kind estimate before it's been
  // measured) gives FlatList an authoritative offset up front, so it can jump there in one
  // step, and accuracy only improves as more rows get measured.
  const heightFor = useCallback((row: RosterRow | undefined) => {
    if (!row) return ROW_HEIGHT_ESTIMATE.flight;
    return rowHeights.get(row.key) ?? ROW_HEIGHT_ESTIMATE[row.kind];
  }, [rowHeights]);
  // Offsets are cached per `rows` array and only rebuilt (once, O(n)) when a row's height
  // actually changes — otherwise every one of FlatList's frequent getItemLayout calls would
  // redo the prefix-sum loop from scratch.
  const buildOffsets = useCallback(() => {
    const offsets: number[] = [];
    let offset = LIST_TOP_PADDING;
    for (const row of rows) { offsets.push(offset); offset += heightFor(row) + LIST_ROW_GAP; }
    offsetsCache.current = { rows, offsets };
    return offsets;
  }, [rows, heightFor]);
  const getItemLayout = useCallback((data: ArrayLike<RosterRow> | null | undefined, index: number) => {
    const cached = offsetsCache.current;
    const offsets = cached && cached.rows === rows ? cached.offsets : buildOffsets();
    return { length: heightFor(data?.[index]), offset: offsets[index] ?? 0, index };
  }, [rows, heightFor, buildOffsets]);
  const measureRow = useCallback((key: string, height: number) => {
    if (rowHeights.get(key) === height) return;
    rowHeights.set(key, height);
    offsetsCache.current = null;
  }, [rowHeights]);
  // Measured heights are keyed by row (not by month), so switching months would otherwise
  // keep accumulating entries for every row ever seen across the whole session.
  useEffect(() => {
    rowHeights.clear();
    offsetsCache.current = null;
  }, [roster?.period.start, rowHeights]);
  useEffect(() => setCalendarState('idle'), [roster?.period.start]);

  const exportCalendar = async () => {
    if (!roster || calendarState === 'working') return;
    setCalendarState('working');
    try { await exportRosterCalendar(roster); setCalendarState('done'); }
    catch (exportError) {
      const cancelled = exportError instanceof Error && (exportError.name === 'AbortError' || /cancel/i.test(exportError.message));
      setCalendarState(cancelled ? 'idle' : 'error');
    }
  };
  const goToMonth = (direction: -1 | 1) => {
    if ((direction === -1 && index <= 0) || (direction === 1 && index >= rosters.length - 1)) return;
    monthSwipeRef.current?.play(direction === 1 ? -1 : 1, () => onMonth(direction));
  };

  return <View style={styles.screen}>
    <View style={styles.titleRow}>
      <View style={styles.grow}><Text style={[styles.sectionTitle, { color: palette.text }]}>{roster ? rosterMonthLabel(roster) : 'Roster'}</Text>{roster?.subject && <Text style={[styles.meta, { color: palette.muted }]}>{roster.subject.base ?? '—'} · position {profile.contractRank}</Text>}</View>
      <View style={styles.titleActions}>
        {roster && <Pressable onPress={exportCalendar} disabled={calendarState === 'working'} style={[styles.compactButton, { backgroundColor: palette.surface, borderColor: palette.line }]}>{calendarState === 'working' ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: palette.text }]}>{calendarState === 'done' ? 'Added' : calendarState === 'error' ? 'Retry' : 'Calendar'}</Text>}</Pressable>}
        <Pressable onPress={onImport} disabled={importing} style={[styles.compactButton, { backgroundColor: palette.accentSoft, borderColor: palette.accentSoft }]}>{importing ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: palette.accent }]}>{roster ? 'Add PDF' : 'Import'}</Text>}</Pressable>
      </View>
    </View>

    {roster && rosters.length > 1 && <SwipeSurface ref={monthSwipeRef} style={styles.monthNav} onSwipeRight={index > 0 ? () => onMonth(-1) : undefined} onSwipeLeft={index < rosters.length - 1 ? () => onMonth(1) : undefined} threshold={38}>
      <Pressable disabled={index <= 0} onPress={() => goToMonth(-1)}><Text style={[styles.monthNavText, { color: index <= 0 ? palette.line : palette.text }]}>‹ Previous</Text></Pressable>
      <Text style={[styles.meta, { color: palette.muted }]}>{index + 1} / {rosters.length}</Text>
      <Pressable disabled={index >= rosters.length - 1} onPress={() => goToMonth(1)}><Text style={[styles.monthNavText, { color: index >= rosters.length - 1 ? palette.line : palette.text }]}>Next ›</Text></Pressable>
    </SwipeSurface>}
    {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}

    {!roster ? <View style={[styles.emptyCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster PDF to begin.</Text></View> : <View style={[styles.innerWindow, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={todayIndex > 0 ? todayIndex : undefined}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }));
        }}
        renderItem={({ item: row }) => {
          const isToday = row.sortKey.slice(0, 10) === today;
          const onLayout = (event: LayoutChangeEvent) => measureRow(row.key, event.nativeEvent.layout.height);
          if (row.kind === 'ground') {
            const dateMeta = dateMetaFor(row.event.date, row.event.dateLabel);
            const highlight = row.event.code === 'OFF' ? 'aqua' : row.event.code === 'DOFF' ? 'forest' : undefined;
            return <View onLayout={onLayout} style={[styles.rosterCard, palette.cardGlass, isToday && styles.rosterCardToday, { backgroundColor: isToday ? palette.accentSoft : highlight === 'aqua' ? palette.aquaTint : highlight === 'forest' ? palette.forestTint : palette.surfaceStrong, borderColor: isToday ? palette.accent : highlight === 'aqua' ? palette.aquaBorder : highlight === 'forest' ? palette.forestBorder : palette.line, ...(isToday ? todayGlow(palette) : null) }]}>
              <View style={styles.flightCardTop}><Text style={[styles.label, { color: isToday ? palette.accent : dateMeta.weekend ? palette.weekend : palette.muted }]}>{dateMeta.label}{isToday ? ' · TODAY' : ''}</Text></View>
              <Text style={[styles.rosterRoute, { color: isToday ? palette.accent : highlight === 'aqua' ? palette.aqua : highlight === 'forest' ? palette.forest : palette.text }]}>{row.event.code}</Text>
            </View>;
          }
          const { duty, sectors } = row.card;
          const first = sectors[0]!;
          const last = sectors.at(-1)!;
          const dateMeta = rosterDateMeta(duty);
          const selected = sectors.some((sector) => sector.id === selectedSector?.id);
          return <Pressable onPress={() => onSelect(first.id)} onLayout={onLayout} style={[styles.rosterCard, palette.cardGlass, isToday && styles.rosterCardToday, { backgroundColor: isToday || selected ? palette.accentSoft : palette.surfaceStrong, borderColor: isToday ? palette.accent : palette.line, ...(isToday ? todayGlow(palette) : null) }]}>
            <View style={styles.flightCardTop}><Text style={[styles.label, { color: isToday ? palette.accent : dateMeta.weekend ? palette.weekend : palette.muted }]}>{dateMeta.label}{isToday ? ' · TODAY' : ''}</Text></View>
            <Text style={[styles.flightNumbers, { color: palette.muted }]}>{sectors.map((sector) => `${sector.flightNumber}${sector.deadhead ? ' · DHC' : ''}`).join(' · ')}</Text>
            <Text style={[styles.rosterRoute, { color: palette.text }]}>{sectorRoute(sectors)}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>{first.departureTime} – {last.arrivalTime} · Report {duty.reportTime}</Text>
          </Pressable>;
        }} />
    </View>}

    {selectedRow && <FlightDetail sectors={selectedRow.sectors} dateLabel={selectedRow.duty.dateLabel} weatherCode={selectedRow.sectors.at(-1)?.arrival} forecastDate={arrivalForecastDate(selectedRow.duty)} palette={palette} onClose={() => onSelect(undefined)} onPrevious={selectedIndex > 0 ? () => onSelect(flights[selectedIndex - 1].sectors[0]!.id) : undefined} onNext={selectedIndex < flights.length - 1 ? () => onSelect(flights[selectedIndex + 1].sectors[0]!.id) : undefined} />}
  </View>;
}

function MoneyScreen({ roster, palette }: { roster?: ParsedAirAstanaRoster; palette: Palette }) {
  return <View style={styles.screen}><Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>{roster ? <SalaryCard roster={roster} palette={palette} /> : <View style={[styles.emptyCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster first.</Text></View>}</View>;
}

function MoreScreen({ rosters, roster, profile, palette, onDeleteRoster, onProfileChange, onErase, onSalarySettings }: { rosters: ParsedAirAstanaRoster[]; roster?: ParsedAirAstanaRoster; profile: CrewProfile; palette: Palette; onDeleteRoster: (periodStart: string) => void; onProfileChange: (contractRank: string) => void; onErase: () => void; onSalarySettings: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankDraft, setRankDraft] = useState(profile.contractRank);
  const [deleteCandidate, setDeleteCandidate] = useState<ParsedAirAstanaRoster>();

  useEffect(() => { if (!profileOpen) setRankDraft(profile.contractRank); }, [profile.contractRank, profileOpen]);

  const saveProfile = () => {
    onProfileChange(rankDraft);
    setProfileOpen(false);
  };
  const confirmDelete = () => {
    if (!deleteCandidate) return;
    onDeleteRoster(deleteCandidate.period.start);
    setDeleteCandidate(undefined);
  };

  const year = roster?.period.start.slice(0, 4);
  const yearRosters = year ? rosters.filter((item) => item.period.start.startsWith(`${year}-`)) : [];

  return <>
    <View style={styles.moreViewport} testID="more-viewport">
    <ScrollView
      testID="more-scroll"
      style={styles.moreScroll}
      contentContainerStyle={styles.moreScrollContent}
      showsVerticalScrollIndicator={false}
    >
    <Text style={[styles.sectionTitle, { color: palette.text }]}>More</Text>
    <Pressable onPress={() => { setRankDraft(profile.contractRank); setProfileOpen(true); }} style={[styles.settingsCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]} accessibilityRole="button" accessibilityLabel="Edit profile position">
      <View style={styles.grow}><Text style={[styles.cardTitle, { color: palette.text }]}>Profile</Text><Text style={[styles.meta, { color: palette.muted }]}>Position / rank · {profile.contractRank}</Text><Text style={[styles.meta, { color: palette.muted }]}>Display profile only · does not change pay rules</Text></View><Text style={[styles.chevron, { color: palette.accent }]}>›</Text>
    </Pressable>

    {yearRosters.length > 1 && <View style={[styles.libraryCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Flight hours</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>
        {year} to date · {formatMinutes(sumReportedBlockMinutes(yearRosters))} block · {formatMinutes(sumReportedNightMinutes(yearRosters))} night · {yearRosters.length} months imported
      </Text>
    </View>}

    <Pressable onPress={onSalarySettings} style={[styles.settingsCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><View style={styles.grow}><Text style={[styles.cardTitle, { color: palette.text }]}>Salary settings</Text><Text style={[styles.meta, { color: palette.muted }]}>Optional customization for another crew member</Text></View><Text style={[styles.chevron, { color: palette.accent }]}>›</Text></Pressable>

    <View style={[styles.libraryCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Imported rosters</Text>
      {rosters.length ? <View style={styles.libraryList}>
        {rosters.map((item) => <View key={item.period.start} style={[styles.libraryRow, { borderColor: palette.line }]}>
          <View style={styles.grow}><Text style={[styles.libraryMonth, { color: palette.text }]}>{rosterMonthLabel(item)}</Text><Text style={[styles.meta, { color: palette.muted }]}>{item.subject?.base ?? 'Roster'} · parsed locally</Text></View>
          <Pressable onPress={() => setDeleteCandidate(item)} hitSlop={8} style={[styles.deleteRosterButton, { backgroundColor: palette.surface }]} accessibilityRole="button" accessibilityLabel={`Delete ${rosterMonthLabel(item)} roster`}>
            <Text style={[styles.deleteRosterText, { color: palette.rose }]}>Delete</Text>
          </Pressable>
        </View>)}
      </View> : <Text style={[styles.meta, { color: palette.muted }]}>No months imported</Text>}
    </View>

    <InfoCard title="Privacy" palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>Roster PDFs are parsed locally and the source PDF bytes are not stored. Crew lists, parsed roster data and salary settings stay on this device. Weather sends only an airport code to Open-Meteo — no roster or crew data.</Text></InfoCard>
    {rosters.length > 0 && <Pressable onPress={onErase} style={[styles.secondaryButton, { borderColor: palette.line }]}><Text style={[styles.secondaryText, { color: palette.text }]}>Erase local roster & pay data</Text></Pressable>}
    </ScrollView>
    </View>

    <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.confirmCard, styles.depthSurface, palette.sheetGlass ?? WEB_GLASS, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          <Text style={[styles.label, { color: palette.muted }]}>PROFILE</Text>
          <Text style={[styles.confirmTitle, { color: palette.text }]}>Position / rank</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>This label is stored on this device and shown in your profile. It does not alter salary calculations.</Text>
          <TextInput autoFocus value={rankDraft} onChangeText={setRankDraft} maxLength={24} autoCapitalize="characters" placeholder="e.g. FJ" placeholderTextColor={palette.muted} style={[styles.profileInput, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.line }]} />
          <View style={styles.actions}>
            <Pressable onPress={() => setProfileOpen(false)} style={[styles.action, { borderColor: palette.line }]}><Text style={{ color: palette.text }}>Cancel</Text></Pressable>
            <Pressable onPress={saveProfile} style={[styles.action, { backgroundColor: palette.accent, borderColor: palette.accent }]}><Text style={styles.actionText}>Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={Boolean(deleteCandidate)} transparent animationType="fade" onRequestClose={() => setDeleteCandidate(undefined)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.confirmCard, styles.depthSurface, palette.sheetGlass ?? WEB_GLASS, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          <Text style={[styles.label, { color: palette.rose }]}>DELETE ROSTER</Text>
          <Text style={[styles.confirmTitle, { color: palette.text }]}>{deleteCandidate ? rosterMonthLabel(deleteCandidate) : ''}</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>Remove this imported roster and its parsed crew data from this device? The original PDF file is not stored by KhaVair.</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => setDeleteCandidate(undefined)} style={[styles.action, { borderColor: palette.line }]}><Text style={{ color: palette.text }}>Cancel</Text></Pressable>
            <Pressable onPress={confirmDelete} style={[styles.action, { backgroundColor: palette.rose, borderColor: palette.rose }]}><Text style={styles.actionText}>Delete</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function FlightDetail({ sectors, dateLabel, weatherCode, forecastDate, palette, onClose, onPrevious, onNext }: { sectors: Sector[]; dateLabel: string; weatherCode?: string; forecastDate?: string; palette: Palette; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const first = sectors[0]!;
  const last = sectors.at(-1)!;
  const crewCount = sectors.reduce((total, sector) => total + sector.crew.length, 0);
  useEffect(() => setScrollAtTop(true), [first.id]);

  return <IOSSheet
    visible
    onClose={onClose}
    handleColor={palette.line}
    backdropOpacity={0.42}
    scrollAtTop={scrollAtTop}
    style={[styles.flightSheet, palette.sheetGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}
  >
    <SwipeSurface style={styles.flightSheetContent} onSwipeLeft={onNext} onSwipeRight={onPrevious} threshold={44}>
      <View style={styles.sheetHeader}><View style={styles.grow}><Text style={[styles.label, { color: palette.muted }]}>{dateLabel} · {sectors.map((sector) => sector.flightNumber).join(' · ')}</Text><Text style={[styles.sheetRoute, { color: palette.text }]}>{sectorRoute(sectors)}</Text><Text style={[styles.meta, { color: palette.muted }]}>{first.departureTime} – {last.arrivalTime}</Text><WeatherChip code={weatherCode ?? last.arrival} targetDate={forecastDate} palette={palette} /></View></View>
      <Text style={[styles.swipeHint, { color: palette.muted }]}>{onPrevious ? '‹ ' : ''}swipe flight{onNext ? ' ›' : ''} · swipe down to close</Text>
      <Text style={[styles.flyingWith, { color: palette.accent }]}>{sectors.length > 1 ? `${sectors.length} flights · ` : ''}Flying with · {crewCount}</Text>
      <FlatList
        data={sectors.flatMap((sector) => [{ type: 'sector' as const, sector }, ...sector.crew.map((member) => ({ type: 'crew' as const, sector, member }))])}
        keyExtractor={(item) => item.type === 'sector' ? `sector-${item.sector.id}` : `${item.sector.id}-${item.member.id}`}
        style={styles.crewScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.crewList}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        scrollEventThrottle={16}
        onScroll={(event) => setScrollAtTop(event.nativeEvent.contentOffset.y <= 1)}
        renderItem={({ item }) => item.type === 'sector'
          ? <View style={styles.flightSegment}><Text style={[styles.flightNumber, { color: palette.accent }]}>{item.sector.flightNumber}{item.sector.deadhead && <Text style={{ color: palette.accent }}> · DHC</Text>}</Text><Text style={[styles.meta, { color: palette.muted }]}>{item.sector.departure} → {item.sector.arrival} · {item.sector.departureTime} – {item.sector.arrivalTime}</Text></View>
          : <View style={styles.crewRow}><View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}><Text style={[styles.avatarText, { color: palette.accent }]}>{item.member.name[0]}</Text></View><View style={styles.grow}><Text style={[styles.crewName, { color: palette.text }]}>{item.member.name}</Text><Text style={[styles.meta, { color: palette.muted }]}>{item.member.position ?? item.member.rosterRank ?? item.member.role}</Text></View></View>}
      />
      {crewCount === 0 && <Text style={[styles.meta, { color: palette.muted }]}>Crew is not listed for these flights in the imported report.</Text>}
    </SwipeSurface>
  </IOSSheet>;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
function timedDuties(items: RosterDuty[]): FocusDuty[] {
  return items.flatMap((item) => {
    const duty = item.duty;
    if (!duty.date || !duty.sectors.length) return [];
    const first = duty.sectors[0];
    const last = duty.sectors[duty.sectors.length - 1];
    const reportMs = stationLocalDateTimeMs(first.departure, duty.reportDate ?? duty.date, duty.reportTime);
    const releaseMs = stationLocalDateTimeMs(last.arrival, duty.releaseDate ?? duty.date, duty.releaseTime);
    return reportMs === undefined || releaseMs === undefined ? [] : [{ ...item, reportMs, releaseMs }];
  }).sort((a, b) => a.reportMs - b.reportMs);
}

function pickFocusDuty(timed: FocusDuty[], now: number): FocusDuty | undefined {
  const active = timed.filter((item) => item.reportMs <= now && item.releaseMs >= now).sort((a, b) => b.reportMs - a.reportMs)[0];
  if (active) return active;
  const upcoming = timed.find((item) => item.reportMs > now);
  if (upcoming) return upcoming;
  return timed[timed.length - 1];
}

function previousDuties(timed: FocusDuty[], focus: FocusDuty | undefined, now: number, count = 3): FocusDuty[] {
  return timed
    .filter((item) => item.releaseMs < now && item.duty.id !== focus?.duty.id)
    .sort((a, b) => b.releaseMs - a.releaseMs)
    .slice(0, count);
}
function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400); const hours = Math.floor((total % 86400) / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60;
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
function rosterDateMeta(duty: Duty): { label: string; weekend: boolean } {
  return dateMetaFor(duty.date, duty.dateLabel);
}
function dateMetaFor(isoDate: string | undefined, dateLabel: string): { label: string; weekend: boolean } {
  if (!isoDate) return { label: dateLabel, weekend: false };
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { label: dateLabel, weekend: false };
  }
  const weekdayIndex = date.getUTCDay();
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][weekdayIndex];
  return { label: `${dateLabel} · ${weekday}`, weekend: weekdayIndex === 0 || weekdayIndex === 6 };
}
function routeChain(duty: Duty): string { return sectorRoute(duty.sectors); }

// Pixels per second the marquee scrolls at, and the gap between the looped repeat.
const MARQUEE_PX_PER_SEC = 55;
const MARQUEE_GAP = 36;

/**
 * A single-line note that, if it doesn't fit, scrolls continuously instead of wrapping or
 * truncating -- nothing is ever cut off, it just takes a few seconds to read. A short note
 * that already fits renders as a perfectly static Text with no animation at all. The loop is
 * seamless: a second copy of the text sits MARQUEE_GAP past the first, so by the time the
 * first copy has scrolled its own width + the gap off-screen, the second copy is exactly
 * where the first one started -- Animated.loop's instant reset to 0 is invisible.
 */
function MarqueeText({ text, textStyle, color }: { text: string; textStyle: object; color: string }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const overflowing = containerWidth > 0 && contentWidth > containerWidth + 1;

  useEffect(() => {
    if (!overflowing) return;
    const distance = contentWidth + MARQUEE_GAP;
    translateX.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(translateX, { toValue: -distance, duration: (distance / MARQUEE_PX_PER_SEC) * 1000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [overflowing, contentWidth, translateX]);

  return <View style={styles.marqueeWrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
    <Animated.View style={[styles.marqueeRow, overflowing ? { transform: [{ translateX }] } : undefined]}>
      <Text numberOfLines={1} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)} style={[textStyle, { color, flexShrink: 0 }]}>{text}</Text>
      {overflowing && <Text numberOfLines={1} style={[textStyle, { color, flexShrink: 0, marginLeft: MARQUEE_GAP }]}>{text}</Text>}
    </Animated.View>
  </View>;
}
function arrivalForecastDate(duty: Duty): string | undefined {
  const last = duty.sectors.at(-1);
  return duty.releaseDate ?? last?.date ?? duty.date;
}
function TimeCell({ label, value, palette }: { label: string; value: string; palette: Palette }) { return <View style={styles.timeCell}><Text numberOfLines={1} style={[styles.timeLabel, { color: palette.muted }]}>{label}</Text><Text style={[styles.timeValue, { color: palette.text }]}>{value}</Text></View>; }

/**
 * Most routes fit comfortably next to the duty pill, so this behaves like a plain Text. When
 * one doesn't (a long multi-sector chain), it scrolls horizontally at full size instead of
 * shrinking to fit -- with a fade on whichever edge still has more to reveal, as a hint that
 * there's more. Nothing here persists a scroll offset, so a fresh Home mount (Home fully
 * remounts on every tab visit) always starts back at the beginning.
 */
function ScrollableRouteText({ text, textStyle, color, cardBackground }: { text: string; textStyle: object; color: string; cardBackground: string }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const overflowing = containerWidth > 0 && contentWidth > containerWidth + 1;
  // Only fade the edge that actually still hides text -- at scroll 0 there is nothing to the
  // left, and at the far end there is nothing to the right, so showing both unconditionally
  // (as long as the text overflows at all) dimmed the route's own first letters at rest.
  const showLeftFade = overflowing && scrollX > 1;
  const showRightFade = overflowing && scrollX < contentWidth - containerWidth - 1;
  return <View style={styles.routeScrollWrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.routeScroll} contentContainerStyle={styles.routeScrollContent}
      onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)} scrollEventThrottle={16}>
      <Text numberOfLines={1} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)} style={[textStyle, { color, flexShrink: 0 }]}>{text}</Text>
    </ScrollView>
    {Platform.OS === 'web' && <>
      {showLeftFade && <View pointerEvents="none" style={[styles.routeFadeLeft, { background: `linear-gradient(to right, ${cardBackground}, transparent)` } as any]} />}
      {showRightFade && <View pointerEvents="none" style={[styles.routeFadeRight, { background: `linear-gradient(to left, ${cardBackground}, transparent)` } as any]} />}
    </>}
  </View>;
}
function WeatherChip({ code, targetDate, palette }: { code: string; targetDate?: string; palette: Palette }) {
  const weather = useAirportWeather(code);
  const { forecast, status: forecastStatus, startDate: forecastStartDate, retry } = useAirportForecastState(code, FORECAST_DAYS, targetDate);
  const [open, setOpen] = useState(false);
  // This component instance persists across a flight-detail swipe (no `key` on
  // FlightDetail/WeatherChip ties them to the selected flight) and across Home's own
  // duty-focus flipping as time passes, so `code`/`targetDate` can change under an
  // already-open popup. Close it instead of silently relabeling itself for a station or
  // date the viewer never asked to see.
  useEffect(() => setOpen(false), [code, targetDate]);
  // Gate on whether the station is one we can ever show weather for, not on whether data
  // happens to be cached yet — a known airport with no cache still shows the row with a
  // fallback, rather than vanishing outright.
  if (!airportCoords(code)) return null;
  const currentConditions = weather ? weatherIcon(weather.weatherCode, weather.isDay) : undefined;
  const displayDate = forecastStartDate ?? targetDate;
  const futureTarget = Boolean(displayDate && displayDate > localTodayIso());
  const targetForecast = displayDate ? forecast?.find((day) => day.date === displayDate) : undefined;
  const targetConditions = targetForecast ? weatherIcon(targetForecast.weatherCode, true) : undefined;
  return <>
    <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Weather forecast at ${code}`} style={styles.weatherRow}>
      {futureTarget ? <>
        <Text style={styles.weatherIcon}>{targetConditions?.icon ?? '✈︎'}</Text>
        {targetForecast && <Text style={[styles.weatherTemp, { color: palette.text }]}>{targetForecast.tempMax}°/{targetForecast.tempMin}°</Text>}
        <Text numberOfLines={1} style={[styles.weatherMeta, { color: palette.muted }]}>{code} · {displayDate ? forecastDayLabel(displayDate) : ''}{targetConditions ? ` · ${targetConditions.label}` : forecastStatus === 'loading' ? ' · Loading forecast' : ' · Forecast unavailable'}</Text>
      </> : <>
        <Text style={styles.weatherIcon}>{currentConditions?.icon ?? '✈︎'}</Text>
        {weather ? <>
          <Text style={[styles.weatherTemp, { color: palette.text }]}>{weather.temp}°</Text>
          <Text numberOfLines={1} style={[styles.weatherMeta, { color: palette.muted }]}>{code} · {currentConditions!.label} · {windDirectionLabel(weather.windDeg)} {weather.windSpeed}kt · {weather.pressure}hPa</Text>
        </> : (
          <Text numberOfLines={1} style={[styles.weatherMeta, { color: palette.muted }]}>{code} · Weather unavailable</Text>
        )}
      </>}
    </Pressable>
    <IOSDialog visible={open} onClose={() => setOpen(false)} style={[styles.forecastPopup, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text style={[styles.label, { color: palette.muted }]}>FORECAST · {code}{displayDate ? ` · FROM ${forecastDayLabel(displayDate)}` : ''}</Text>
      {forecast && forecast.length > 0
        ? <View style={styles.forecastList}>
            {forecast.map((day) => {
              const conditions = weatherIcon(day.weatherCode, true);
              return <View key={day.date} style={styles.forecastLine}>
                <Text style={[styles.meta, styles.forecastDay, { color: palette.muted }]}>{forecastDayLabel(day.date)}</Text>
                <Text style={styles.weatherIcon}>{conditions.icon}</Text>
                <Text numberOfLines={1} style={[styles.meta, styles.forecastLabel, { color: palette.text }]}>{conditions.label}</Text>
                <Text style={[styles.meta, styles.forecastTemp, { color: palette.text }]}>{day.tempMax}°/{day.tempMin}°</Text>
              </View>;
            })}
          </View>
        : forecastStatus === 'loading'
          ? <View style={styles.forecastStateRow}><ActivityIndicator size="small" /><Text style={[styles.meta, { color: palette.muted }]}>Loading forecast…</Text></View>
          : forecastStatus === 'offline'
            ? <Text style={[styles.meta, { color: palette.muted, marginTop: 6 }]}>Forecast unavailable while offline.</Text>
            : <Pressable onPress={retry} accessibilityRole="button" style={styles.forecastRetry}><Text style={[styles.meta, { color: palette.accent }]}>Forecast unavailable. Tap to retry.</Text></Pressable>}
    </IOSDialog>
  </>;
}
function forecastDayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getUTCDay()];
  return `${weekday} ${day}`;
}
function PrimaryButton({ title, onPress, loading, palette }: { title: string; onPress: () => void; loading: boolean; palette: Palette }) { return <Pressable onPress={onPress} disabled={loading} style={[styles.primaryButton, { backgroundColor: palette.accent }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{title}</Text>}</Pressable>; }
function Summary({ title, value, detail, palette }: { title: string; value: string; detail: string; palette: Palette }) {
  return <View style={[styles.summary, styles.depthSurface, palette.cardGlass, palette.cardGlass && LIQUID_GLASS_BASE, { backgroundColor: palette.surface, borderColor: palette.cardGlass ? LIQUID_GLASS_BORDER : palette.line }]}>
    {palette.cardGlass && <LiquidSheen radius={20} />}
    <Text style={[styles.label, { color: palette.muted }]}>{title}</Text>
    <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    <Text style={[styles.meta, { color: palette.muted }]}>{detail}</Text>
  </View>;
}
function InfoCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: Palette }) { return <View style={[styles.infoCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>{children}</View>; }
function operatingCount(roster: ParsedAirAstanaRoster) { return roster.sectors.filter((sector) => !sector.deadhead).length; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, app: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerText: { flex: 1, minWidth: 0, marginRight: 10 }, brand: { fontSize: 27, fontWeight: '700', letterSpacing: -.8 }, brandWord: { flexDirection: 'row', alignItems: 'baseline' }, vHeartMark: { width: 25, height: 31, alignItems: 'center', justifyContent: 'center' }, vHeartGlyph: { fontSize: 25, lineHeight: 31, fontWeight: '700' }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  // Wraps to a 2nd line instead of single-line-ellipsis: CSS ellipsis truncates by raw
  // character count regardless of word boundaries, which reads sloppily on a random phrase
  // ("...ЛЮБИМЫМ ТОБ…"). Wrapping breaks at spaces like any normal text flow, so the rare
  // phrase too long even for 2 lines still only ever loses whole words, never half of one.
  headerLoveNote: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: .9, textTransform: 'uppercase' },
  marqueeWrap: { overflow: 'hidden', alignItems: 'flex-start' }, marqueeRow: { flexDirection: 'row' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, modeGlyph: { fontSize: 19 }, modeGlyphPair: { fontSize: 13, letterSpacing: -3 },
  viewport: { flex: 1, minHeight: 0 }, screen: { flex: 1, paddingTop: 8, gap: 12 },
  // A separate clipped viewport keeps the scroller bounded inside the animated tab
  // surface. Its content must not size the viewport or paint beneath the tab bar.
  moreViewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  moreScroll: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  moreScrollContent: { paddingTop: 8, paddingBottom: 16, gap: 12 }, grow: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -.8 }, intro: { fontSize: 15, lineHeight: 22 }, label: { fontSize: 11, fontWeight: '700', letterSpacing: .9 }, meta: { fontSize: 13, lineHeight: 18 },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 16, overflow: 'hidden' },
  liquidSheenLayer: { position: 'absolute', left: '-40%', top: '-40%', width: '180%', height: '180%' },
  liquidRimLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroRoute: { fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -.7 },
  routeScrollWrap: { flex: 1, minWidth: 0, overflow: 'hidden' }, routeScroll: { flexGrow: 0 }, routeScrollContent: { flexGrow: 0 },
  routeFadeLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 20 }, routeFadeRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 20 },
  heroFlight: { fontSize: 15.6, fontWeight: '600', marginTop: 6 },
  dutyPill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', minWidth: 0 }, dutyPillDate: { fontSize: 9, fontWeight: '600', letterSpacing: .3 }, dutyPillValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 }, dutyPillLabel: { fontSize: 9, fontWeight: '700', letterSpacing: .5, marginTop: 1 },
  timeDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, timeCell: { flex: 1, minWidth: 0 },
  timeLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: .3 }, timeValue: { fontSize: 22, lineHeight: 27, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  heroFoot: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }, weatherIcon: { fontSize: 16 }, weatherTemp: { fontSize: 14, fontWeight: '800' }, weatherMeta: { flex: 1, fontSize: 11.5, fontWeight: '600' },
  forecastPopup: { width: '88%', maxWidth: 340, borderWidth: 1, borderRadius: 22, padding: 18 }, forecastList: { marginTop: 10, gap: 6 }, forecastLine: { flexDirection: 'row', alignItems: 'center', gap: 8 }, forecastDay: { width: 42, fontWeight: '700' }, forecastLabel: { flex: 1 }, forecastTemp: { fontWeight: '700', fontVariant: ['tabular-nums'] }, forecastStateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, forecastRetry: { marginTop: 6, paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', gap: 10 }, summary: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, overflow: 'hidden' }, summaryValue: { fontSize: 28, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  upNext: { flex: 1, minHeight: 0, gap: 2 }, upNextGlassPanel: { borderWidth: 1, borderRadius: 20, padding: 14, overflow: 'hidden' }, upNextList: { flex: 1 }, upNextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  upNextDate: { fontSize: 12, fontWeight: '700', letterSpacing: .4, width: 54 }, upNextRoute: { flex: 1, fontSize: 15, fontWeight: '600' }, upNextTimeBlock: { minWidth: 72, alignItems: 'flex-end' }, upNextTimeLabel: { fontSize: 8, lineHeight: 10, fontWeight: '700', letterSpacing: .45, marginBottom: 1 }, upNextTime: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  primaryButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#fff', fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, titleActions: { flexDirection: 'row', gap: 7 }, compactButton: { height: 38, minWidth: 72, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, compactText: { fontWeight: '700', fontSize: 12 },
  monthNav: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthNavText: { fontSize: 12, fontWeight: '600' }, error: { fontSize: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 14 }, innerWindow: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 20, overflow: 'hidden' }, listContent: { padding: 8, gap: 7, paddingBottom: 18 }, rosterCard: { borderWidth: 1, borderRadius: 16, padding: 13 }, rosterCardToday: { borderWidth: 1.5 }, flightCardTop: { flexDirection: 'row', justifyContent: 'space-between' }, flightNumber: { fontSize: 11, fontWeight: '700' }, flightNumbers: { fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 4, flexShrink: 1 }, rosterRoute: { fontSize: 20, lineHeight: 25, fontWeight: '700', marginTop: 5 },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 3 }, cardTitle: { fontSize: 15, fontWeight: '700' }, settingsCard: { minHeight: 68, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center' }, chevron: { fontSize: 30 }, secondaryButton: { height: 48, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontWeight: '600' },
  libraryCard: { borderWidth: 1, borderRadius: 20, padding: 14, minHeight: 88 }, libraryList: { marginTop: 5 }, libraryRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, libraryMonth: { fontSize: 14, fontWeight: '700' }, deleteRosterButton: { minWidth: 58, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, deleteRosterText: { fontSize: 11, fontWeight: '700' },
  depthSurface: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  tabBar: { height: 68, marginTop: 8, marginBottom: 4, borderWidth: 1, borderRadius: 22, flexDirection: 'row' }, tabSelection: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }, tabItem: { flex: 1, zIndex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIconWrap: { minWidth: 35, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tabIcon: { textAlign: 'center' }, tabText: { fontSize: 11, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end' }, flightSheet: { width: '100%', maxWidth: 620, maxHeight: '78%', alignSelf: 'center', borderTopWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: 12, overflow: 'hidden' }, flightSheetContent: { minHeight: 0, flexShrink: 1 }, sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sheetRoute: { fontSize: 28, lineHeight: 33, fontWeight: '700', marginTop: 5 }, swipeHint: { fontSize: 10, marginTop: 7 }, flyingWith: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 7 }, crewScroll: { minHeight: 0, flexShrink: 1 }, crewList: { paddingBottom: 12 }, flightSegment: { marginTop: 8, marginBottom: 3 }, crewRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, avatarText: { fontSize: 12, fontWeight: '800' }, crewName: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.56)', alignItems: 'center', justifyContent: 'center', padding: 20 }, unlockCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 }, unlockTitle: { fontSize: 26, fontWeight: '700', marginTop: 7 }, codeInput: { height: 54, borderWidth: 1, borderRadius: 15, marginTop: 18, paddingHorizontal: 16, fontSize: 22, letterSpacing: 5, textAlign: 'center' }, codeHint: { fontSize: 11, lineHeight: 15, marginTop: 6 }, codeExample: { fontSize: 11, lineHeight: 15, marginTop: 2 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, action: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 }, confirmTitle: { fontSize: 24, lineHeight: 29, fontWeight: '700', marginTop: 6, marginBottom: 8 }, profileInput: { height: 50, borderWidth: 1, borderRadius: 14, marginTop: 15, paddingHorizontal: 14, fontSize: 17, fontWeight: '600' },
});
