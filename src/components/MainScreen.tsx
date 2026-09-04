import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SalaryCard } from './SalaryCard';
import { SalarySettingsSheet } from './SalarySettingsSheet';
import { SwipeSurface } from './SwipeSurface';
import { IOSSheet } from './IOSOverlay';
import { exportRosterCalendar } from '@/src/domain/calendar';
import type { Duty, GroundEvent, Sector } from '@/src/domain/types';
import { verifyLovedModeCode } from '@/src/domain/lovedMode';
import { DEFAULT_PROFILE, type CrewProfile } from '@/src/domain/profile';
import { sumReportedBlockMinutes, sumReportedNightMinutes } from '@/src/domain/layovers';
import { formatMinutes, rosterMonthLabel, rosterToDuties, rosterToFlightCardGroups, rosterToGroundEvents } from '@/src/domain/rosterView';
import { stationLocalDateTimeMs } from '@/src/domain/stationTime';
import { pickAndParseRoster } from '@/src/import/pickRoster';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { clearPayData } from '@/src/storage/payStorage';
import { clearStoredRosters, loadStoredRosters, removeStoredRoster, upsertStoredRoster } from '@/src/storage/rosterStorage';
import { activateSpecialPayPreset } from '@/src/storage/specialPayPreset';
import { clearLovedMode, clearSavedTheme, loadLovedMode, loadSavedTheme, saveLovedMode, saveTheme, type SavedTheme } from '@/src/storage/lovedModeStorage';
import { clearCrewProfile, loadCrewProfile, saveCrewProfile } from '@/src/storage/profileStorage';

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
};
type FlightCardRow = { id: string; duty: Duty; sectors: Sector[] };
type RosterRow = { kind: 'flight'; key: string; sortKey: string; card: FlightCardRow } | { kind: 'ground'; key: string; sortKey: string; event: GroundEvent };
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

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={desktopWeb ? ['bottom'] : ['top', 'bottom']}>
    <View style={styles.app}>
      <View style={styles.header}>
        <View>
          {lovedMode
            ? <View style={styles.brandWord} accessibilityLabel="KhaVair special mode">
                <Text style={[styles.brand, { color: palette.text }]}>Kha</Text>
                <View style={styles.vHeartMark}>
                  <Text style={[styles.vHeartGlyph, { color: palette.rose }]}>♥</Text>
                </View>
                <Text style={[styles.brand, { color: palette.text }]}>air</Text>
              </View>
            : <Text style={[styles.brand, { color: palette.text }]}>KhaVair</Text>}
          <Text style={[styles.kicker, { color: palette.muted }]}>CABIN CREW COMPANION</Text>
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

      <SwipeSurface style={styles.viewport} onSwipeLeft={tab === 'More' ? undefined : () => changeTab(1)} onSwipeRight={tab === 'Home' ? undefined : () => changeTab(-1)}>
        {tab === 'Home' && <Home allDuties={allDuties} fallbackRoster={roster} rosters={rosters} palette={palette} onImport={importRoster} importing={importing} />}
        {tab === 'Roster' && <RosterScreen roster={roster} rosters={rosters} duties={duties} selectedSector={selectedSector} palette={palette} profile={crewProfile} importing={importing} error={importError} onImport={importRoster} onSelect={setSelectedFlight} onMonth={changeMonth} />}
        {tab === 'Money' && <MoneyScreen key={`${roster?.period.start ?? 'none'}-${payRevision}`} roster={roster} palette={palette} />}
        {tab === 'More' && <MoreScreen rosters={rosters} profile={crewProfile} palette={palette} onDeleteRoster={deleteRoster} onProfileChange={updateCrewProfile} onErase={eraseAll} onSalarySettings={() => setSalarySettingsOpen(true)} />}
      </SwipeSurface>

      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - tabBarWidth) > 0.5) setTabBarWidth(nextWidth);
        }}
        style={[styles.tabBar, styles.depthSurface, palette.tabGlass ?? WEB_TAB_GLASS, { backgroundColor: palette.surface, borderColor: palette.line }]}
      >
        {tabBarWidth > 0 && <Animated.View pointerEvents="none" style={[styles.tabSelection, { width: Math.max(0, tabStep - 8), backgroundColor: palette.surfaceStrong, transform: [{ translateX: tabIndicatorX }] }]} />}
        {TABS.map((item) => {
          const active = item === tab;
          return <Pressable key={item} onPress={() => { setSelectedFlight(undefined); setTab(item); }} style={styles.tabItem} accessibilityRole="tab" accessibilityState={{ selected: active }}>
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

function Home({ allDuties, fallbackRoster, rosters, palette, onImport, importing }: { allDuties: RosterDuty[]; fallbackRoster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; palette: Palette; onImport: () => void; importing: boolean }) {
  const now = useNow();
  const timeline = useMemo(() => timedDuties(allDuties), [allDuties]);
  const focus = useMemo(() => pickFocusDuty(timeline, now), [timeline, now]);
  const roster = focus?.roster ?? fallbackRoster;
  const duty = focus?.duty;

  if (!roster || !duty) return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Your roster, simplified.</Text>
    <Text style={[styles.intro, { color: palette.muted }]}>Import an Air Astana Personal Crew Schedule Report.</Text>
    <PrimaryButton title="Import roster PDF" onPress={onImport} loading={importing} palette={palette} />
  </View>;

  const first = duty.sectors[0];
  const last = duty.sectors[duty.sectors.length - 1];
  const reportMs = focus?.reportMs;
  const releaseMs = focus?.releaseMs;
  const isUpcoming = reportMs !== undefined && reportMs > now;
  const isActive = reportMs !== undefined && releaseMs !== undefined && reportMs <= now && releaseMs >= now;
  const countdown = reportMs === undefined ? undefined : isUpcoming ? formatCountdown(reportMs - now) : isActive ? formatCountdown(now - reportMs) : undefined;
  const spanMinutes = reportMs !== undefined && releaseMs !== undefined ? Math.round((releaseMs - reportMs) / 60000) : undefined;
  const dutyMinutes = spanMinutes !== undefined && spanMinutes > 0 ? spanMinutes : undefined;

  const year = roster.period.start.slice(0, 4);
  const yearRosters = rosters.filter((item) => item.period.start.startsWith(`${year}-`));
  const block = roster.totals.blockMinutes;
  const night = roster.totals.nightMinutes;
  const nightShare = block && night !== undefined ? Math.round((night / block) * 100) : undefined;
  const neighbours = previousDuties(timeline, focus, now, 6);

  return <View style={styles.screen}>
    <View style={styles.dutyHead}>
      <Text style={[styles.label, { color: isActive ? palette.accent : palette.muted }]}>{isUpcoming ? 'NEXT DUTY' : isActive ? 'ON DUTY NOW' : 'LATEST DUTY'}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>{duty.dateLabel}</Text>
    </View>

    <View style={[styles.heroCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.heroRoute, { color: palette.text }]}>{routeChain(duty)}</Text>
      <View style={[styles.heroMetaRow, countdown ? styles.heroMetaRowTall : undefined]}>
        <Text numberOfLines={1} style={[styles.heroFlight, { color: palette.muted }]}>{duty.sectors.map((sector) => sector.flightNumber).join(' · ')}</Text>
        {countdown && <View style={[styles.countdownPill, { backgroundColor: palette.accentSoft }]}>
          <Text style={[styles.countdown, { color: palette.accent }]}>{countdown}</Text>
          <Text style={[styles.countdownLabel, { color: palette.accent }]}>{isUpcoming ? 'TO REPORT' : 'ON DUTY'}</Text>
        </View>}
      </View>

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
    </View>

    <Text style={[styles.label, { color: palette.muted }]}>{rosterMonthLabel(roster)}</Text>
    <View style={styles.summaryRow}>
      <Summary title="BLOCK HOURS" value={formatMinutes(block)} detail={`${operatingCount(roster)} sectors flown`} palette={palette} />
      <Summary title="NIGHT HOURS" value={formatMinutes(night)} detail={nightShare === undefined ? 'reported by the roster' : `${nightShare}% of block time`} palette={palette} />
    </View>
    {yearRosters.length > 1 && <Text style={[styles.meta, { color: palette.muted }]}>
      {year} to date · {formatMinutes(sumReportedBlockMinutes(yearRosters))} block · {formatMinutes(sumReportedNightMinutes(yearRosters))} night · {yearRosters.length} months imported
    </Text>}

    {neighbours.length > 0 && <View style={styles.upNext}>
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
  </View>;
}

function RosterScreen({ roster, rosters, duties, selectedSector, palette, profile, importing, error, onImport, onSelect, onMonth }: { roster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; duties: Duty[]; selectedSector?: Sector; palette: Palette; profile: CrewProfile; importing: boolean; error?: string; onImport: () => void; onSelect: (id?: string) => void; onMonth: (direction: -1 | 1) => void }) {
  const [calendarState, setCalendarState] = useState<'idle'|'working'|'done'|'error'>('idle');
  const index = roster ? rosters.findIndex((item) => item.period.start === roster.period.start) : -1;
  const flights = useMemo<FlightCardRow[]>(() => rosterToFlightCardGroups(duties), [duties]);
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

  return <View style={styles.screen}>
    <View style={styles.titleRow}>
      <View style={styles.grow}><Text style={[styles.sectionTitle, { color: palette.text }]}>{roster ? rosterMonthLabel(roster) : 'Roster'}</Text>{roster?.subject && <Text style={[styles.meta, { color: palette.muted }]}>{roster.subject.base ?? '—'} · position {profile.contractRank}</Text>}</View>
      <View style={styles.titleActions}>
        {roster && <Pressable onPress={exportCalendar} disabled={calendarState === 'working'} style={[styles.compactButton, { backgroundColor: palette.surface, borderColor: palette.line }]}>{calendarState === 'working' ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: palette.text }]}>{calendarState === 'done' ? 'Added' : calendarState === 'error' ? 'Retry' : 'Calendar'}</Text>}</Pressable>}
        <Pressable onPress={onImport} disabled={importing} style={[styles.compactButton, { backgroundColor: palette.accentSoft, borderColor: palette.accentSoft }]}>{importing ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: palette.accent }]}>{roster ? 'Add PDF' : 'Import'}</Text>}</Pressable>
      </View>
    </View>

    {roster && rosters.length > 1 && <SwipeSurface style={styles.monthNav} onSwipeRight={index > 0 ? () => onMonth(-1) : undefined} onSwipeLeft={index < rosters.length - 1 ? () => onMonth(1) : undefined} threshold={38}>
      <Pressable disabled={index <= 0} onPress={() => onMonth(-1)}><Text style={[styles.monthNavText, { color: index <= 0 ? palette.line : palette.text }]}>‹ Previous</Text></Pressable>
      <Text style={[styles.meta, { color: palette.muted }]}>{index + 1} / {rosters.length}</Text>
      <Pressable disabled={index >= rosters.length - 1} onPress={() => onMonth(1)}><Text style={[styles.monthNavText, { color: index >= rosters.length - 1 ? palette.line : palette.text }]}>Next ›</Text></Pressable>
    </SwipeSurface>}
    {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}

    {!roster ? <View style={[styles.emptyCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster PDF to begin.</Text></View> : <View style={[styles.innerWindow, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <FlatList data={rows} keyExtractor={(row) => row.key} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        renderItem={({ item: row }) => {
          if (row.kind === 'ground') {
            const dateMeta = dateMetaFor(row.event.date, row.event.dateLabel);
            const highlight = row.event.code === 'OFF' ? 'aqua' : row.event.code === 'DOFF' ? 'forest' : undefined;
            return <View style={[styles.rosterCard, palette.cardGlass, { backgroundColor: highlight === 'aqua' ? palette.aquaTint : highlight === 'forest' ? palette.forestTint : palette.surfaceStrong, borderColor: highlight === 'aqua' ? palette.aquaBorder : highlight === 'forest' ? palette.forestBorder : palette.line }]}>
              <View style={styles.flightCardTop}><Text style={[styles.label, { color: dateMeta.weekend ? palette.weekend : palette.muted }]}>{dateMeta.label}</Text></View>
              <Text style={[styles.rosterRoute, { color: highlight === 'aqua' ? palette.aqua : highlight === 'forest' ? palette.forest : palette.text }]}>{row.event.code}</Text>
            </View>;
          }
          const { duty, sectors } = row.card;
          const first = sectors[0]!;
          const last = sectors.at(-1)!;
          const dateMeta = rosterDateMeta(duty);
          const selected = sectors.some((sector) => sector.id === selectedSector?.id);
          return <Pressable onPress={() => onSelect(first.id)} style={[styles.rosterCard, palette.cardGlass, { backgroundColor: selected ? palette.accentSoft : palette.surfaceStrong, borderColor: palette.line }]}>
            <View style={styles.flightCardTop}><Text style={[styles.label, { color: dateMeta.weekend ? palette.weekend : palette.muted }]}>{dateMeta.label}</Text><Text style={[styles.flightNumber, { color: palette.muted }]}>{sectors.map((sector) => sector.flightNumber).join(' · ')}{sectors.some((sector) => sector.deadhead) && <Text style={{ color: palette.accent }}> · DHC</Text>}</Text></View>
            <Text style={[styles.rosterRoute, { color: palette.text }]}>{sectors.map((sector, index) => index === 0 ? sector.departure : sector.arrival).join(' → ')}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>{first.departureTime} – {last.arrivalTime} · Report {duty.reportTime}</Text>
          </Pressable>;
        }} />
    </View>}

    {selectedRow && <FlightDetail sectors={selectedRow.sectors} dateLabel={selectedRow.duty.dateLabel} palette={palette} onClose={() => onSelect(undefined)} onPrevious={selectedIndex > 0 ? () => onSelect(flights[selectedIndex - 1].sectors[0]!.id) : undefined} onNext={selectedIndex < flights.length - 1 ? () => onSelect(flights[selectedIndex + 1].sectors[0]!.id) : undefined} />}
  </View>;
}

function MoneyScreen({ roster, palette }: { roster?: ParsedAirAstanaRoster; palette: Palette }) {
  return <View style={styles.screen}><Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>{roster ? <SalaryCard roster={roster} palette={palette} /> : <View style={[styles.emptyCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster first.</Text></View>}</View>;
}

function MoreScreen({ rosters, profile, palette, onDeleteRoster, onProfileChange, onErase, onSalarySettings }: { rosters: ParsedAirAstanaRoster[]; profile: CrewProfile; palette: Palette; onDeleteRoster: (periodStart: string) => void; onProfileChange: (contractRank: string) => void; onErase: () => void; onSalarySettings: () => void }) {
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

  return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>More</Text>
    <Pressable onPress={() => { setRankDraft(profile.contractRank); setProfileOpen(true); }} style={[styles.settingsCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]} accessibilityRole="button" accessibilityLabel="Edit profile position">
      <View style={styles.grow}><Text style={[styles.cardTitle, { color: palette.text }]}>Profile</Text><Text style={[styles.meta, { color: palette.muted }]}>Position / rank · {profile.contractRank}</Text><Text style={[styles.meta, { color: palette.muted }]}>Display profile only · does not change pay rules</Text></View><Text style={[styles.chevron, { color: palette.accent }]}>›</Text>
    </Pressable>
    <Pressable onPress={onSalarySettings} style={[styles.settingsCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><View style={styles.grow}><Text style={[styles.cardTitle, { color: palette.text }]}>Salary settings</Text><Text style={[styles.meta, { color: palette.muted }]}>Optional customization for another crew member</Text></View><Text style={[styles.chevron, { color: palette.accent }]}>›</Text></Pressable>

    <View style={[styles.libraryCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Imported rosters</Text>
      {rosters.length ? <FlatList
        data={rosters}
        keyExtractor={(item) => item.period.start}
        style={styles.libraryList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <View style={[styles.libraryRow, { borderColor: palette.line }]}>
          <View style={styles.grow}><Text style={[styles.libraryMonth, { color: palette.text }]}>{rosterMonthLabel(item)}</Text><Text style={[styles.meta, { color: palette.muted }]}>{item.subject?.base ?? 'Roster'} · parsed locally</Text></View>
          <Pressable onPress={() => setDeleteCandidate(item)} hitSlop={8} style={[styles.deleteRosterButton, { backgroundColor: palette.surface }]} accessibilityRole="button" accessibilityLabel={`Delete ${rosterMonthLabel(item)} roster`}>
            <Text style={[styles.deleteRosterText, { color: palette.rose }]}>Delete</Text>
          </Pressable>
        </View>}
      /> : <Text style={[styles.meta, { color: palette.muted }]}>No months imported</Text>}
    </View>

    <InfoCard title="Privacy" palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>Roster PDFs are parsed locally and the source PDF bytes are not stored. Crew lists, parsed roster data and salary settings stay on this device.</Text></InfoCard>
    {rosters.length > 0 && <Pressable onPress={onErase} style={[styles.secondaryButton, { borderColor: palette.line }]}><Text style={[styles.secondaryText, { color: palette.text }]}>Erase local roster & pay data</Text></Pressable>}

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
  </View>;
}

function FlightDetail({ sectors, dateLabel, palette, onClose, onPrevious, onNext }: { sectors: Sector[]; dateLabel: string; palette: Palette; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
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
      <View style={styles.sheetHeader}><View style={styles.grow}><Text style={[styles.label, { color: palette.muted }]}>{dateLabel} · {sectors.map((sector) => sector.flightNumber).join(' · ')}</Text><Text style={[styles.sheetRoute, { color: palette.text }]}>{sectors.map((sector, index) => index === 0 ? sector.departure : sector.arrival).join(' → ')}</Text><Text style={[styles.meta, { color: palette.muted }]}>{first.departureTime} – {last.arrivalTime}</Text></View></View>
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
function routeChain(duty: Duty): string { return [duty.sectors[0]?.departure, ...duty.sectors.map((sector) => sector.arrival)].filter(Boolean).join(' → '); }
function TimeCell({ label, value, palette }: { label: string; value: string; palette: Palette }) { return <View style={styles.timeCell}><Text numberOfLines={1} style={[styles.timeLabel, { color: palette.muted }]}>{label}</Text><Text style={[styles.timeValue, { color: palette.text }]}>{value}</Text></View>; }
function PrimaryButton({ title, onPress, loading, palette }: { title: string; onPress: () => void; loading: boolean; palette: Palette }) { return <Pressable onPress={onPress} disabled={loading} style={[styles.primaryButton, { backgroundColor: palette.accent }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{title}</Text>}</Pressable>; }
function Summary({ title, value, detail, palette }: { title: string; value: string; detail: string; palette: Palette }) { return <View style={[styles.summary, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.label, { color: palette.muted }]}>{title}</Text><Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text><Text style={[styles.meta, { color: palette.muted }]}>{detail}</Text></View>; }
function InfoCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: Palette }) { return <View style={[styles.infoCard, styles.depthSurface, palette.cardGlass, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>{children}</View>; }
function operatingCount(roster: ParsedAirAstanaRoster) { return roster.sectors.filter((sector) => !sector.deadhead).length; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, app: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontSize: 27, fontWeight: '700', letterSpacing: -.8 }, brandWord: { flexDirection: 'row', alignItems: 'baseline' }, vHeartMark: { width: 25, height: 31, alignItems: 'center', justifyContent: 'center' }, vHeartGlyph: { fontSize: 25, lineHeight: 31, fontWeight: '700' }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, modeGlyph: { fontSize: 19 }, modeGlyphPair: { fontSize: 13, letterSpacing: -3 },
  viewport: { flex: 1, minHeight: 0 }, screen: { flex: 1, paddingTop: 8, gap: 12 }, grow: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -.8 }, intro: { fontSize: 15, lineHeight: 22 }, label: { fontSize: 11, fontWeight: '700', letterSpacing: .9 }, meta: { fontSize: 13, lineHeight: 18 },
  dutyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCard: { borderWidth: 1, borderRadius: 26, padding: 18 },
  heroRoute: { fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }, heroMetaRowTall: { minHeight: 44 }, heroFlight: { flex: 1, fontSize: 13, fontWeight: '600' },
  countdownPill: { borderRadius: 15, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }, countdown: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }, countdownLabel: { fontSize: 10, fontWeight: '700', letterSpacing: .7, marginTop: 1 },
  timeDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, timeCell: { flex: 1, minWidth: 0 },
  timeLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: .3 }, timeValue: { fontSize: 22, lineHeight: 27, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  heroFoot: { fontSize: 13, fontWeight: '600', marginTop: 14 },
  summaryRow: { flexDirection: 'row', gap: 10 }, summary: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14 }, summaryValue: { fontSize: 28, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  upNext: { flex: 1, minHeight: 0, gap: 2 }, upNextList: { flex: 1 }, upNextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  upNextDate: { fontSize: 12, fontWeight: '700', letterSpacing: .4, width: 54 }, upNextRoute: { flex: 1, fontSize: 15, fontWeight: '600' }, upNextTimeBlock: { minWidth: 72, alignItems: 'flex-end' }, upNextTimeLabel: { fontSize: 8, lineHeight: 10, fontWeight: '700', letterSpacing: .45, marginBottom: 1 }, upNextTime: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  primaryButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#fff', fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, titleActions: { flexDirection: 'row', gap: 7 }, compactButton: { height: 38, minWidth: 72, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, compactText: { fontWeight: '700', fontSize: 12 },
  monthNav: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthNavText: { fontSize: 12, fontWeight: '600' }, error: { fontSize: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 14 }, innerWindow: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 20, overflow: 'hidden' }, listContent: { padding: 8, gap: 7, paddingBottom: 18 }, rosterCard: { borderWidth: 1, borderRadius: 16, padding: 13 }, flightCardTop: { flexDirection: 'row', justifyContent: 'space-between' }, flightNumber: { fontSize: 11, fontWeight: '700' }, rosterRoute: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 3 }, cardTitle: { fontSize: 15, fontWeight: '700' }, settingsCard: { minHeight: 68, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center' }, chevron: { fontSize: 30 }, secondaryButton: { height: 48, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontWeight: '600' },
  libraryCard: { borderWidth: 1, borderRadius: 20, padding: 14, minHeight: 88, maxHeight: 190 }, libraryList: { marginTop: 5 }, libraryRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, libraryMonth: { fontSize: 14, fontWeight: '700' }, deleteRosterButton: { minWidth: 58, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, deleteRosterText: { fontSize: 11, fontWeight: '700' },
  depthSurface: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  tabBar: { height: 68, marginTop: 8, marginBottom: 4, borderWidth: 1, borderRadius: 22, flexDirection: 'row' }, tabSelection: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }, tabItem: { flex: 1, zIndex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIconWrap: { minWidth: 35, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tabIcon: { textAlign: 'center' }, tabText: { fontSize: 11, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end' }, flightSheet: { width: '100%', maxWidth: 620, maxHeight: '78%', alignSelf: 'center', borderTopWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: 12, overflow: 'hidden' }, flightSheetContent: { minHeight: 0, flexShrink: 1 }, sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sheetRoute: { fontSize: 28, lineHeight: 33, fontWeight: '700', marginTop: 5 }, swipeHint: { fontSize: 10, marginTop: 7 }, flyingWith: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 7 }, crewScroll: { minHeight: 0, flexShrink: 1 }, crewList: { paddingBottom: 12 }, flightSegment: { marginTop: 8, marginBottom: 3 }, crewRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, avatarText: { fontSize: 12, fontWeight: '800' }, crewName: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.56)', alignItems: 'center', justifyContent: 'center', padding: 20 }, unlockCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 }, unlockTitle: { fontSize: 26, fontWeight: '700', marginTop: 7 }, codeInput: { height: 54, borderWidth: 1, borderRadius: 15, marginTop: 18, paddingHorizontal: 16, fontSize: 22, letterSpacing: 5, textAlign: 'center' }, codeHint: { fontSize: 11, lineHeight: 15, marginTop: 6 }, codeExample: { fontSize: 11, lineHeight: 15, marginTop: 2 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, action: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 }, confirmTitle: { fontSize: 24, lineHeight: 29, fontWeight: '700', marginTop: 6, marginBottom: 8 }, profileInput: { height: 50, borderWidth: 1, borderRadius: 14, marginTop: 15, paddingHorizontal: 14, fontSize: 17, fontWeight: '600' },
});
