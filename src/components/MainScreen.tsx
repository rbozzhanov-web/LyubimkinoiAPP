import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SalaryCard } from './SalaryCard';
import { SalarySettingsSheet } from './SalarySettingsSheet';
import { SwipeSurface } from './SwipeSurface';
import { IOSSheet } from './IOSOverlay';
import { exportRosterCalendar } from '@/src/domain/calendar';
import type { Duty, Sector } from '@/src/domain/types';
import { verifyLovedModeCode } from '@/src/domain/lovedMode';
import { DEFAULT_PROFILE } from '@/src/domain/profile';
import { sumReportedBlockMinutes, sumReportedNightMinutes } from '@/src/domain/layovers';
import { formatMinutes, rosterMonthLabel, rosterToDuties } from '@/src/domain/rosterView';
import { stationLocalDateTimeMs } from '@/src/domain/stationTime';
import { pickAndParseRoster } from '@/src/import/pickRoster';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { clearPayData } from '@/src/storage/payStorage';
import { clearStoredRosters, loadStoredRosters, upsertStoredRoster } from '@/src/storage/rosterStorage';
import { activateSpecialPayPreset } from '@/src/storage/specialPayPreset';
import { clearLovedMode, loadLovedMode, saveLovedMode } from '@/src/storage/lovedModeStorage';

type Tab = 'Home' | 'Roster' | 'Money' | 'More';
const TABS: Tab[] = ['Home', 'Roster', 'Money', 'More'];
// These glyphs are drawn from four different Unicode blocks, so at one font size they do
// not match: the house sits small and light, the tenge sign reads as text, the dots sit low.
// Size and nudge each so the row looks like one set.
const TAB_ICONS: Record<Tab, { glyph: string; size: number; nudge: number; weight: '700' | '800' }> = {
  Home: { glyph: '⌂', size: 25, nudge: -1, weight: '700' },
  Roster: { glyph: '✈︎', size: 18, nudge: 0, weight: '700' },
  Money: { glyph: '₸', size: 19, nudge: 0, weight: '800' },
  More: { glyph: '•••', size: 15, nudge: -3, weight: '700' },
};
type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string>;
type FlightRow = { duty: Duty; sector: Sector };
type RosterDuty = { roster: ParsedAirAstanaRoster; duty: Duty };
type FocusDuty = RosterDuty & { reportMs: number; releaseMs: number };
const WEB_GLASS = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(22px) saturate(1.18)', WebkitBackdropFilter: 'blur(22px) saturate(1.18)' } as any)
  : undefined;
const WEB_TAB_GLASS = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(30px) saturate(1.38)', WebkitBackdropFilter: 'blur(30px) saturate(1.38)' } as any)
  : undefined;

export default function MainScreen() {
  // The web build is prerendered to static HTML with the light palette baked into inline
  // styles. React does not repaint attributes it accepted during hydration, so if the very
  // first client render already said "dark", the page keeps the server's light background
  // for good and only later-mounted subtrees turn dark. Render light once to match the
  // server, then switch: the palette then differs between renders and React patches it.
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 768;
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => { if (!hydrated) setHydrated(true); }, [hydrated]);
  const dark = hydrated && scheme === 'dark';
  const [tab, setTab] = useState<Tab>('Home');
  const [lovedMode, setLovedMode] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [rosters, setRosters] = useState<ParsedAirAstanaRoster[]>([]);
  const [activeMonth, setActiveMonth] = useState<string>();
  const [selectedFlight, setSelectedFlight] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>();
  const [salarySettingsOpen, setSalarySettingsOpen] = useState(false);
  const [payRevision, setPayRevision] = useState(0);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabSelection = useRef(new Animated.Value(0)).current;

  // Defer the local read until after web hydration so the statically rendered page and the
  // first browser render agree. The saved preference then restores on this device only.
  useEffect(() => { setLovedMode(loadLovedMode()); }, []);

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

  const palette = useMemo<Palette>(() => ({
    background: lovedMode ? (dark ? '#1B1114' : '#FFF0E8') : (dark ? '#11110F' : '#F4F1EC'),
    surface: lovedMode ? (dark ? 'rgba(36,23,26,.76)' : 'rgba(255,247,242,.76)') : (dark ? 'rgba(27,26,24,.78)' : 'rgba(252,250,247,.78)'),
    surfaceStrong: lovedMode ? (dark ? 'rgba(44,27,32,.84)' : 'rgba(255,255,255,.84)') : (dark ? 'rgba(37,35,31,.84)' : 'rgba(255,255,255,.84)'),
    text: lovedMode ? (dark ? '#FFF5F2' : '#2B1718') : (dark ? '#F7F4EF' : '#171714'),
    muted: lovedMode ? (dark ? '#DCB2AB' : '#7A4A45') : (dark ? '#B5AFA4' : '#5F5C55'),
    line: lovedMode ? (dark ? 'rgba(255,213,205,.14)' : 'rgba(122,74,69,.12)') : (dark ? 'rgba(247,244,239,.12)' : 'rgba(47,57,52,.10)'),
    accent: lovedMode ? '#F06445' : (dark ? '#C7BDAE' : '#2F3934'),
    accentSoft: lovedMode ? (dark ? '#44231F' : '#FFD8C9') : (dark ? '#222925' : '#E6ECE8'),
    rose: lovedMode ? '#DE466D' : (dark ? '#C7BDAE' : '#2F3934'),
    aqua: lovedMode ? '#2EC5D2' : (dark ? '#B5AFA4' : '#5F5C55'),
  }), [dark, lovedMode]);

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
  const submitCode = () => {
    if (!verifyLovedModeCode(unlockCode)) { setUnlockError(true); return; }
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
    setLovedMode(false);
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
        <Pressable onPress={requestLovedMode} style={[styles.modeButton, { backgroundColor: lovedMode ? palette.accentSoft : palette.surface, borderColor: lovedMode ? palette.rose : 'transparent', borderWidth: lovedMode ? 1 : 0 }]} accessibilityLabel="Special mode">
          <Text style={styles.modeGlyph}>{lovedMode ? '🌹' : '♡'}</Text>
        </Pressable>
      </View>

      <SwipeSurface style={styles.viewport} onSwipeLeft={tab === 'More' ? undefined : () => changeTab(1)} onSwipeRight={tab === 'Home' ? undefined : () => changeTab(-1)}>
        {tab === 'Home' && <Home allDuties={allDuties} fallbackRoster={roster} rosters={rosters} palette={palette} onImport={importRoster} importing={importing} />}
        {tab === 'Roster' && <RosterScreen roster={roster} rosters={rosters} duties={duties} selectedSector={selectedSector} palette={palette} importing={importing} error={importError} onImport={importRoster} onSelect={setSelectedFlight} onMonth={changeMonth} />}
        {tab === 'Money' && <MoneyScreen key={`${roster?.period.start ?? 'none'}-${payRevision}`} roster={roster} palette={palette} />}
        {tab === 'More' && <MoreScreen rosters={rosters} palette={palette} onErase={eraseAll} onSalarySettings={() => setSalarySettingsOpen(true)} />}
      </SwipeSurface>

      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - tabBarWidth) > 0.5) setTabBarWidth(nextWidth);
        }}
        style={[styles.tabBar, styles.depthSurface, WEB_TAB_GLASS, { backgroundColor: palette.surface, borderColor: palette.line }]}
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
        <View style={[styles.unlockCard, styles.depthSurface, WEB_GLASS, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          <Text style={[styles.label, { color: palette.rose }]}>FOR SOMEONE SPECIAL</Text>
          <Text style={[styles.unlockTitle, { color: palette.text }]}>Enter the code</Text>
          <TextInput autoFocus value={unlockCode} secureTextEntry keyboardType="number-pad" maxLength={7}
            onChangeText={(value) => { setUnlockCode(value.replace(/\D/g, '').slice(0, 7)); setUnlockError(false); }}
            onSubmitEditing={submitCode}
            style={[styles.codeInput, { color: palette.text, backgroundColor: palette.surface, borderColor: unlockError ? palette.rose : palette.line }]} />
          <Text style={[styles.codeHint, { color: unlockError ? palette.rose : palette.muted }]}>{unlockError ? 'That code did not unlock the mode.' : '7 digits'}</Text>
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
  // Duty length is the one span the roster does not print but a reader always wants.
  // A misread midnight crossing can put release before report; show nothing rather than
  // a negative clock reading.
  const spanMinutes = reportMs !== undefined && releaseMs !== undefined ? Math.round((releaseMs - reportMs) / 60000) : undefined;
  const dutyMinutes = spanMinutes !== undefined && spanMinutes > 0 ? spanMinutes : undefined;

  const year = roster.period.start.slice(0, 4);
  const yearRosters = rosters.filter((item) => item.period.start.startsWith(`${year}-`));
  const block = roster.totals.blockMinutes;
  const night = roster.totals.nightMinutes;
  const nightShare = block && night !== undefined ? Math.round((night / block) * 100) : undefined;

  // The duties either side of the focus, so the screen answers "and then what?".
  const neighbours = adjacentDuties(timeline, focus, isUpcoming || isActive, 6);

  return <View style={styles.screen}>
    <View style={styles.dutyHead}>
      <Text style={[styles.label, { color: isActive ? palette.accent : palette.muted }]}>{isUpcoming ? 'NEXT DUTY' : isActive ? 'ON DUTY NOW' : 'LATEST DUTY'}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>{duty.dateLabel}</Text>
    </View>

    <View style={[styles.heroCard, styles.depthSurface, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.heroRoute, { color: palette.text }]}>{routeChain(duty)}</Text>
      <View style={[styles.heroMetaRow, countdown ? styles.heroMetaRowTall : undefined]}>
        <Text numberOfLines={1} style={[styles.heroFlight, { color: palette.muted }]}>{duty.sectors.map((sector) => sector.flightNumber).join(' · ')}</Text>
        {countdown && <View style={[styles.countdownPill, { backgroundColor: palette.accentSoft }]}>
          <Text style={[styles.countdown, { color: palette.accent }]}>{countdown}</Text>
          <Text style={[styles.countdownLabel, { color: palette.accent }]}>{isUpcoming ? 'TO REPORT' : 'ON DUTY'}</Text>
        </View>}
      </View>

      <View style={[styles.timeDivider, { backgroundColor: palette.line }]} />

      {/* Four readings of one duty: same size, told apart by their labels rather than by scale. */}
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
      <Text style={[styles.label, { color: palette.muted }]}>{isUpcoming || isActive ? 'THEN' : 'BEFORE THAT'}</Text>
      <FlatList data={neighbours} keyExtractor={(item) => item.duty.id} showsVerticalScrollIndicator={false} style={styles.upNextList}
        renderItem={({ item }) => <View style={[styles.upNextRow, { borderColor: palette.line }]}>
          <Text style={[styles.upNextDate, { color: palette.muted }]}>{item.duty.dateLabel}</Text>
          <Text numberOfLines={1} style={[styles.upNextRoute, { color: palette.text }]}>{routeChain(item.duty)}</Text>
          <Text style={[styles.upNextTime, { color: palette.muted }]}>{isUpcoming || isActive ? item.duty.reportTime : item.duty.releaseTime}</Text>
        </View>} />
    </View>}
  </View>;
}

function RosterScreen({ roster, rosters, duties, selectedSector, palette, importing, error, onImport, onSelect, onMonth }: { roster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; duties: Duty[]; selectedSector?: Sector; palette: Palette; importing: boolean; error?: string; onImport: () => void; onSelect: (id?: string) => void; onMonth: (direction: -1 | 1) => void }) {
  const [calendarState, setCalendarState] = useState<'idle'|'working'|'done'|'error'>('idle');
  const index = roster ? rosters.findIndex((item) => item.period.start === roster.period.start) : -1;
  const flights = useMemo<FlightRow[]>(() => duties.flatMap((duty) => duty.sectors.map((sector) => ({ duty, sector }))), [duties]);
  const selectedIndex = selectedSector ? flights.findIndex(({ sector }) => sector.id === selectedSector.id) : -1;
  const selectedRow = selectedIndex >= 0 ? flights[selectedIndex] : undefined;
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
      <View style={styles.grow}><Text style={[styles.sectionTitle, { color: palette.text }]}>{roster ? rosterMonthLabel(roster) : 'Roster'}</Text>{roster?.subject && <Text style={[styles.meta, { color: palette.muted }]}>{roster.subject.base ?? '—'} · contract {DEFAULT_PROFILE.contractRank}</Text>}</View>
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

    {!roster ? <View style={[styles.emptyCard, styles.depthSurface, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster PDF to begin.</Text></View> : <View style={[styles.innerWindow, styles.depthSurface, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <FlatList data={flights} keyExtractor={({ sector }) => sector.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        renderItem={({ item: { duty, sector } }) => <Pressable onPress={() => onSelect(sector.id)} style={[styles.rosterCard, { backgroundColor: selectedSector?.id === sector.id ? palette.accentSoft : palette.surfaceStrong, borderColor: palette.line }]}>
          <View style={styles.flightCardTop}><Text style={[styles.label, { color: palette.muted }]}>{duty.dateLabel}</Text><Text style={[styles.flightNumber, { color: palette.muted }]}>{sector.flightNumber}{sector.deadhead ? ' · DHC' : ''}</Text></View>
          <Text style={[styles.rosterRoute, { color: palette.text }]}>{sector.departure} → {sector.arrival}</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>{sector.departureTime} – {sector.arrivalTime} · Report {duty.reportTime}</Text>
        </Pressable>} />
    </View>}

    {selectedRow && <FlightDetail sector={selectedRow.sector} dateLabel={selectedRow.duty.dateLabel} palette={palette} onClose={() => onSelect(undefined)} onPrevious={selectedIndex > 0 ? () => onSelect(flights[selectedIndex - 1].sector.id) : undefined} onNext={selectedIndex < flights.length - 1 ? () => onSelect(flights[selectedIndex + 1].sector.id) : undefined} />}
  </View>;
}

function MoneyScreen({ roster, palette }: { roster?: ParsedAirAstanaRoster; palette: Palette }) {
  return <View style={styles.screen}><Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>{roster ? <SalaryCard roster={roster} palette={palette} /> : <View style={[styles.emptyCard, styles.depthSurface, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster first.</Text></View>}</View>;
}

function MoreScreen({ rosters, palette, onErase, onSalarySettings }: { rosters: ParsedAirAstanaRoster[]; palette: Palette; onErase: () => void; onSalarySettings: () => void }) {
  return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>More</Text>
    <InfoCard title="Profile" palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>Contract position · {DEFAULT_PROFILE.contractRank}</Text><Text style={[styles.meta, { color: palette.muted }]}>Roster rank is display-only and never changes pay.</Text></InfoCard>
    <Pressable onPress={onSalarySettings} style={[styles.settingsCard, styles.depthSurface, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><View style={styles.grow}><Text style={[styles.cardTitle, { color: palette.text }]}>Salary settings</Text><Text style={[styles.meta, { color: palette.muted }]}>Optional customization for another crew member</Text></View><Text style={[styles.chevron, { color: palette.accent }]}>›</Text></Pressable>
    <InfoCard title="Local roster library" palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>{rosters.length ? rosters.map(rosterMonthLabel).join(' · ') : 'No months imported'}</Text></InfoCard>
    <InfoCard title="Privacy" palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>Roster PDFs, crew lists and salary settings are processed locally. Only public MRP and USD/KZT values may be requested from official sources.</Text></InfoCard>
    {rosters.length > 0 && <Pressable onPress={onErase} style={[styles.secondaryButton, { borderColor: palette.line }]}><Text style={[styles.secondaryText, { color: palette.text }]}>Erase local roster & pay data</Text></Pressable>}
  </View>;
}

function FlightDetail({ sector, dateLabel, palette, onClose, onPrevious, onNext }: { sector: Sector; dateLabel: string; palette: Palette; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  return <IOSSheet
    visible
    onClose={onClose}
    handleColor={palette.line}
    backdropOpacity={0.42}
    style={[styles.flightSheet, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}
  >
    {(dismiss) => <SwipeSurface style={styles.flightSheetContent} onSwipeLeft={onNext} onSwipeRight={onPrevious} threshold={44}>
      <View style={styles.sheetHeader}><View style={styles.grow}><Text style={[styles.label, { color: palette.muted }]}>{dateLabel} · {sector.flightNumber}{sector.deadhead ? ' · DHC' : ''}</Text><Text style={[styles.sheetRoute, { color: palette.text }]}>{sector.departure} → {sector.arrival}</Text><Text style={[styles.meta, { color: palette.muted }]}>{sector.departureTime} – {sector.arrivalTime}</Text></View><Pressable onPress={dismiss} style={[styles.sheetClose, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.sheetCloseText, { color: palette.text }]}>×</Text></Pressable></View>
      <Text style={[styles.swipeHint, { color: palette.muted }]}>{onPrevious ? '‹ ' : ''}swipe flight{onNext ? ' ›' : ''} · swipe down to close</Text>
      <Text style={[styles.flyingWith, { color: palette.accent }]}>Flying with · {sector.crew.length}</Text>
      {sector.crew.length ? <FlatList data={sector.crew} keyExtractor={(member) => member.id} style={styles.crewScroll} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.crewList} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} renderItem={({ item }) => <View style={styles.crewRow}><View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}><Text style={[styles.avatarText, { color: palette.accent }]}>{item.name[0]}</Text></View><View style={styles.grow}><Text style={[styles.crewName, { color: palette.text }]}>{item.name}</Text><Text style={[styles.meta, { color: palette.muted }]}>{item.position ?? item.rosterRank ?? item.role}</Text></View></View>} /> : <Text style={[styles.meta, { color: palette.muted }]}>Crew is not listed for this flight in the imported report.</Text>}
    </SwipeSurface>}
  </IOSSheet>;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
/** Every duty that can be placed on a real clock, in report order. */
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

/** The duties just after the focus when it is ahead of us, just before it when it is behind. */
function adjacentDuties(timed: FocusDuty[], focus: FocusDuty | undefined, forward: boolean, count = 3): FocusDuty[] {
  if (!focus) return [];
  const index = timed.findIndex((item) => item.duty.id === focus.duty.id);
  if (index < 0) return [];
  return forward
    ? timed.slice(index + 1, index + 1 + count)
    : timed.slice(Math.max(0, index - count), index).reverse();
}
function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400); const hours = Math.floor((total % 86400) / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60;
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
function routeChain(duty: Duty): string { return [duty.sectors[0]?.departure, ...duty.sectors.map((sector) => sector.arrival)].filter(Boolean).join(' → '); }
function TimeCell({ label, value, palette }: { label: string; value: string; palette: Palette }) { return <View style={styles.timeCell}><Text numberOfLines={1} style={[styles.timeLabel, { color: palette.muted }]}>{label}</Text><Text style={[styles.timeValue, { color: palette.text }]}>{value}</Text></View>; }
function PrimaryButton({ title, onPress, loading, palette }: { title: string; onPress: () => void; loading: boolean; palette: Palette }) { return <Pressable onPress={onPress} disabled={loading} style={[styles.primaryButton, { backgroundColor: palette.accent }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{title}</Text>}</Pressable>; }
function Summary({ title, value, detail, palette }: { title: string; value: string; detail: string; palette: Palette }) { return <View style={[styles.summary, styles.depthSurface, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.label, { color: palette.muted }]}>{title}</Text><Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text><Text style={[styles.meta, { color: palette.muted }]}>{detail}</Text></View>; }
function InfoCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: Palette }) { return <View style={[styles.infoCard, styles.depthSurface, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}><Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>{children}</View>; }
function operatingCount(roster: ParsedAirAstanaRoster) { return roster.sectors.filter((sector) => !sector.deadhead).length; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, app: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontSize: 27, fontWeight: '700', letterSpacing: -.8 }, brandWord: { flexDirection: 'row', alignItems: 'baseline' }, vHeartMark: { width: 25, height: 31, alignItems: 'center', justifyContent: 'center' }, vHeartGlyph: { fontSize: 25, lineHeight: 31, fontWeight: '700' }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  modeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, modeGlyph: { fontSize: 19 },
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
  upNextDate: { fontSize: 12, fontWeight: '700', letterSpacing: .4, width: 54 }, upNextRoute: { flex: 1, fontSize: 15, fontWeight: '600' }, upNextTime: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  primaryButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#fff', fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, titleActions: { flexDirection: 'row', gap: 7 }, compactButton: { height: 38, minWidth: 72, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, compactText: { fontWeight: '700', fontSize: 12 },
  monthNav: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthNavText: { fontSize: 12, fontWeight: '600' }, error: { fontSize: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 14 }, innerWindow: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 20, overflow: 'hidden' }, listContent: { padding: 8, gap: 7, paddingBottom: 18 }, rosterCard: { borderWidth: 1, borderRadius: 16, padding: 13 }, flightCardTop: { flexDirection: 'row', justifyContent: 'space-between' }, flightNumber: { fontSize: 11, fontWeight: '700' }, rosterRoute: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 3 }, cardTitle: { fontSize: 15, fontWeight: '700' }, settingsCard: { minHeight: 68, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center' }, chevron: { fontSize: 30 }, secondaryButton: { height: 48, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontWeight: '600' },
  depthSurface: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  tabBar: { height: 68, marginTop: 8, marginBottom: 4, borderWidth: 1, borderRadius: 22, flexDirection: 'row' }, tabSelection: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }, tabItem: { flex: 1, zIndex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIconWrap: { minWidth: 35, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tabIcon: { textAlign: 'center' }, tabText: { fontSize: 11, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end' }, flightSheet: { width: '100%', maxWidth: 620, maxHeight: '78%', alignSelf: 'center', borderTopWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: 12, overflow: 'hidden' }, flightSheetContent: { minHeight: 0, flexShrink: 1 }, sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, sheetRoute: { fontSize: 28, lineHeight: 33, fontWeight: '700', marginTop: 5 }, sheetClose: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, sheetCloseText: { fontSize: 27 }, swipeHint: { fontSize: 10, marginTop: 7 }, flyingWith: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 7 }, crewScroll: { minHeight: 0, flexShrink: 1 }, crewList: { paddingBottom: 12 }, crewRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, avatarText: { fontSize: 12, fontWeight: '800' }, crewName: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.46)', alignItems: 'center', justifyContent: 'center', padding: 20 }, unlockCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 }, unlockTitle: { fontSize: 26, fontWeight: '700', marginTop: 7 }, codeInput: { height: 54, borderWidth: 1, borderRadius: 15, marginTop: 18, paddingHorizontal: 16, fontSize: 22, letterSpacing: 5, textAlign: 'center' }, codeHint: { fontSize: 11, marginTop: 6 }, actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, action: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
