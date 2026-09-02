import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SalaryCard } from '@/src/components/SalaryCard';
import { exportRosterCalendar } from '@/src/domain/calendar';
import type { Duty, Sector } from '@/src/domain/types';
import { verifyLovedModeCode } from '@/src/domain/lovedMode';
import { DEFAULT_PROFILE } from '@/src/domain/profile';
import { sumReportedBlockMinutes, sumReportedNightMinutes } from '@/src/domain/layovers';
import { formatMinutes, rosterMonthLabel, rosterToDuties } from '@/src/domain/rosterView';
import { pickAndParseRoster } from '@/src/import/pickRoster';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { clearPayData } from '@/src/storage/payStorage';
import { clearStoredRosters, loadStoredRosters, upsertStoredRoster } from '@/src/storage/rosterStorage';

type Tab = 'Home' | 'Roster' | 'Money' | 'More';
const tabs: Tab[] = ['Home', 'Roster', 'Money', 'More'];

type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string>;

export default function IndexScreen() {
  const dark = useColorScheme() === 'dark';
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

  useEffect(() => {
    const stored = loadStoredRosters();
    setRosters(stored);
    setActiveMonth(stored.at(-1)?.period.start);
  }, []);

  const roster = rosters.find((item) => item.period.start === activeMonth) ?? rosters.at(-1);
  const duties = useMemo(() => roster ? rosterToDuties(roster) : [], [roster]);
  const selectedSector = duties.flatMap((duty) => duty.sectors).find((sector) => sector.id === selectedFlight);
  const cumulativeBlock = sumReportedBlockMinutes(rosters);
  const cumulativeNight = sumReportedNightMinutes(rosters);

  const palette = useMemo<Palette>(() => ({
    background: dark ? '#11110F' : '#F4F1EC',
    surface: dark ? '#1B1A18' : '#FCFAF7',
    surfaceStrong: dark ? '#25231F' : '#FFFFFF',
    text: dark ? '#F7F4EF' : '#171714',
    muted: dark ? '#AAA49A' : '#747067',
    line: dark ? '#302E29' : '#E7E1D8',
    accent: lovedMode ? '#D98B74' : (dark ? '#C7BDAE' : '#2F3934'),
    accentSoft: lovedMode ? (dark ? '#34221F' : '#F6E3DC') : (dark ? '#222925' : '#E6ECE8'),
    rose: lovedMode ? '#B96A73' : (dark ? '#C7BDAE' : '#2F3934'),
    aqua: lovedMode ? '#7CC8D6' : (dark ? '#AAA49A' : '#747067'),
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
    if (next) {
      setActiveMonth(next.period.start);
      setSelectedFlight(undefined);
    }
  };

  const requestLovedMode = () => {
    if (lovedMode) {
      setLovedMode(false);
      return;
    }
    setUnlockCode('');
    setUnlockError(false);
    setUnlockOpen(true);
  };

  const submitCode = () => {
    if (!verifyLovedModeCode(unlockCode)) {
      setUnlockError(true);
      return;
    }
    setLovedMode(true);
    setUnlockOpen(false);
    setUnlockCode('');
    setUnlockError(false);
  };

  const eraseAll = () => {
    clearStoredRosters();
    clearPayData();
    setRosters([]);
    setActiveMonth(undefined);
    setSelectedFlight(undefined);
    setTab('Home');
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
    <View style={styles.app}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.brand, { color: palette.text }]}>KhaVair</Text>
          <Text style={[styles.kicker, { color: palette.muted }]}>CABIN CREW COMPANION</Text>
        </View>
        <Pressable onPress={requestLovedMode} style={[styles.modeButton, { backgroundColor: palette.surface }]} accessibilityLabel="Loved One Mode">
          <Text style={styles.modeGlyph}>{lovedMode ? '🌹' : '♡'}</Text>
        </Pressable>
      </View>

      <View style={styles.viewport}>
        {tab === 'Home' && <Home roster={roster} duties={duties} rosters={rosters} cumulativeBlock={cumulativeBlock} cumulativeNight={cumulativeNight} palette={palette} onImport={importRoster} importing={importing} />}
        {tab === 'Roster' && <RosterScreen roster={roster} rosters={rosters} duties={duties} selectedSector={selectedSector} palette={palette} importing={importing} error={importError} onImport={importRoster} onSelect={setSelectedFlight} onMonth={changeMonth} />}
        {tab === 'Money' && <MoneyScreen roster={roster} palette={palette} />}
        {tab === 'More' && <MoreScreen rosters={rosters} palette={palette} onErase={eraseAll} />}
      </View>

      <View style={[styles.tabBar, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
        {tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={styles.tabItem}>
          <View style={[styles.tabDot, tab === item && { backgroundColor: palette.accent }]} />
          <Text style={[styles.tabText, { color: tab === item ? palette.text : palette.muted }]}>{item}</Text>
        </Pressable>)}
      </View>
    </View>

    <Modal visible={unlockOpen} transparent animationType="fade" onRequestClose={() => setUnlockOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.unlockCard, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          <Text style={[styles.label, { color: palette.rose }]}>FOR SOMEONE SPECIAL</Text>
          <Text style={[styles.unlockTitle, { color: palette.text }]}>Enter the code</Text>
          <TextInput
            autoFocus
            value={unlockCode}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={7}
            onChangeText={(value) => { setUnlockCode(value.replace(/\D/g, '').slice(0, 7)); setUnlockError(false); }}
            onSubmitEditing={submitCode}
            style={[styles.codeInput, { color: palette.text, backgroundColor: palette.surface, borderColor: unlockError ? palette.rose : palette.line }]}
          />
          <Text style={[styles.codeHint, { color: unlockError ? palette.rose : palette.muted }]}>{unlockError ? 'That code did not unlock the theme.' : '7 digits'}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => setUnlockOpen(false)} style={[styles.action, { borderColor: palette.line }]}><Text style={{ color: palette.text }}>Cancel</Text></Pressable>
            <Pressable onPress={submitCode} style={[styles.action, { backgroundColor: palette.accent, borderColor: palette.accent }]}><Text style={styles.actionText}>Unlock</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

function Home({ roster, duties, rosters, cumulativeBlock, cumulativeNight, palette, onImport, importing }: { roster?: ParsedAirAstanaRoster; duties: Duty[]; rosters: ParsedAirAstanaRoster[]; cumulativeBlock: number; cumulativeNight: number; palette: Palette; onImport: () => void; importing: boolean }) {
  const duty = duties[0];
  if (!roster || !duty) return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Your roster, simplified.</Text>
    <Text style={[styles.intro, { color: palette.muted }]}>Import an Air Astana Personal Crew Schedule Report. Parsing happens on this device.</Text>
    <PrimaryButton title="Import roster PDF" onPress={onImport} loading={importing} palette={palette} />
    <Privacy palette={palette} />
  </View>;

  const first = duty.sectors[0];
  const last = duty.sectors[duty.sectors.length - 1];
  const monthNight = roster.totals.nightMinutes;
  return <View style={styles.screen}>
    <Text style={[styles.label, { color: palette.muted }]}>LATEST IMPORT · {rosterMonthLabel(roster)}</Text>
    <Card palette={palette}>
      <View style={styles.routeRow}>
        <Text style={[styles.airport, { color: palette.text }]}>{first.departure}</Text>
        <Text style={[styles.routeArrow, { color: palette.muted }]}>→</Text>
        <Text style={[styles.airport, { color: palette.text }]}>{last.arrival}</Text>
      </View>
      <Text style={[styles.meta, { color: palette.muted }]}>Report {duty.reportTime} · Release {duty.releaseTime} · {duty.sectors.length} sector{duty.sectors.length === 1 ? '' : 's'}</Text>
    </Card>
    <View style={styles.summaryRow}>
      <Summary title="THIS MONTH" value={formatMinutes(roster.totals.blockMinutes)} detail={`Night ${formatMinutes(monthNight)} · ${operatingCount(roster)} sectors`} palette={palette} />
      <Summary title="CUMULATIVE" value={formatMinutes(cumulativeBlock)} detail={`Night ${formatMinutes(cumulativeNight)} · ${rosters.length} month${rosters.length === 1 ? '' : 's'}`} palette={palette} />
    </View>
    <Privacy palette={palette} />
  </View>;
}

type FlightRow = { duty: Duty; sector: Sector };

function RosterScreen({ roster, rosters, duties, selectedSector, palette, importing, error, onImport, onSelect, onMonth }: { roster?: ParsedAirAstanaRoster; rosters: ParsedAirAstanaRoster[]; duties: Duty[]; selectedSector?: Sector; palette: Palette; importing: boolean; error?: string; onImport: () => void; onSelect: (id?: string) => void; onMonth: (direction: -1 | 1) => void }) {
  const [calendarState, setCalendarState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const index = roster ? rosters.findIndex((item) => item.period.start === roster.period.start) : -1;
  const flights = useMemo<FlightRow[]>(() => duties.flatMap((duty) => duty.sectors.map((sector) => ({ duty, sector }))), [duties]);
  const selectedRow = selectedSector ? flights.find(({ sector }) => sector.id === selectedSector.id) : undefined;

  useEffect(() => setCalendarState('idle'), [roster?.period.start]);

  const exportCalendar = async () => {
    if (!roster || calendarState === 'working') return;
    setCalendarState('working');
    try {
      await exportRosterCalendar(roster);
      setCalendarState('done');
    } catch (exportError) {
      const cancelled = exportError instanceof Error && (exportError.name === 'AbortError' || /cancel/i.test(exportError.message));
      setCalendarState(cancelled ? 'idle' : 'error');
    }
  };

  return <View style={styles.screen}>
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{roster ? rosterMonthLabel(roster) : 'Roster'}</Text>
        {roster?.subject && <Text style={[styles.meta, { color: palette.muted }]}>{roster.subject.base ?? '—'} · contract {DEFAULT_PROFILE.contractRank}</Text>}
      </View>
      <View style={styles.titleActions}>
        {roster && <Pressable onPress={exportCalendar} disabled={calendarState === 'working'} style={[styles.compactButton, { backgroundColor: palette.surface, borderColor: palette.line }]} accessibilityLabel="Export roster to calendar">
          {calendarState === 'working' ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: calendarState === 'error' ? palette.rose : palette.text }]}>{calendarState === 'done' ? 'Added' : calendarState === 'error' ? 'Retry' : 'Calendar'}</Text>}
        </Pressable>}
        <Pressable onPress={onImport} disabled={importing} style={[styles.compactButton, { backgroundColor: palette.accentSoft, borderColor: palette.accentSoft }]}>
          {importing ? <ActivityIndicator size="small" /> : <Text style={[styles.compactText, { color: palette.accent }]}>{roster ? 'Add PDF' : 'Import'}</Text>}
        </Pressable>
      </View>
    </View>

    {roster && rosters.length > 1 && <View style={styles.monthNav}>
      <Pressable disabled={index <= 0} onPress={() => onMonth(-1)}><Text style={[styles.monthNavText, { color: index <= 0 ? palette.line : palette.text }]}>‹ Previous</Text></Pressable>
      <Text style={[styles.meta, { color: palette.muted }]}>{index + 1} / {rosters.length}</Text>
      <Pressable disabled={index >= rosters.length - 1} onPress={() => onMonth(1)}><Text style={[styles.monthNavText, { color: index >= rosters.length - 1 ? palette.line : palette.text }]}>Next ›</Text></Pressable>
    </View>}

    {calendarState === 'done' && <Text style={[styles.feedback, { color: palette.muted }]}>Calendar file prepared locally. KhaVair does not read your calendar.</Text>}
    {calendarState === 'error' && <Text style={[styles.feedback, { color: palette.rose }]}>Calendar export failed. Nothing was uploaded.</Text>}
    {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}

    {!roster ? <Privacy palette={palette} /> : <View style={[styles.innerWindow, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <FlatList
        data={flights}
        keyExtractor={({ sector }) => sector.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: { duty, sector } }) => <Pressable onPress={() => onSelect(sector.id)} style={[styles.rosterCard, { backgroundColor: selectedSector?.id === sector.id ? palette.accentSoft : palette.surfaceStrong, borderColor: palette.line }]} accessibilityLabel={`Open crew for ${sector.flightNumber} ${sector.departure} to ${sector.arrival}`}>
          <View style={styles.flightCardTop}>
            <Text style={[styles.label, { color: palette.muted }]}>{duty.dateLabel}</Text>
            <Text style={[styles.flightNumber, { color: palette.muted }]}>{sector.flightNumber}{sector.deadhead ? ' · DHC' : ''}</Text>
          </View>
          <Text style={[styles.rosterRoute, { color: palette.text }]}>{sector.departure} → {sector.arrival}</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>{sector.departureTime} – {sector.arrivalTime} · Report {duty.reportTime}</Text>
        </Pressable>}
      />
    </View>}

    {selectedRow && <FlightDetail sector={selectedRow.sector} dateLabel={selectedRow.duty.dateLabel} palette={palette} onClose={() => onSelect(undefined)} />}
  </View>;
}

function MoneyScreen({ roster, palette }: { roster?: ParsedAirAstanaRoster; palette: Palette }) {
  if (!roster) return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>
    <Card palette={palette}><Text style={[styles.meta, { color: palette.muted }]}>Import a roster first.</Text></Card>
  </View>;

  return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>
    <SalaryCard roster={roster} palette={palette} />
    <View style={[styles.moneyHint, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Tap the card for details</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>Per-diem relays, NBRK conversion and the salary breakdown scroll inside the sheet — the main app stays fixed.</Text>
    </View>
  </View>;
}

function MoreScreen({ rosters, palette, onErase }: { rosters: ParsedAirAstanaRoster[]; palette: Palette; onErase: () => void }) {
  return <View style={styles.screen}>
    <Text style={[styles.sectionTitle, { color: palette.text }]}>More</Text>
    <Card palette={palette}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Profile</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>Contract position · {DEFAULT_PROFILE.contractRank}</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>Roster position is display-only and never changes pay.</Text>
    </Card>
    <Card palette={palette}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Local roster library</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>{rosters.length ? rosters.map(rosterMonthLabel).join(' · ') : 'No months imported'}</Text>
    </Card>
    <Card palette={palette}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>Privacy</Text>
      <Text style={[styles.meta, { color: palette.muted }]}>Roster PDFs, crew lists and salary settings are processed locally. Only public MRP and USD/KZT values may be requested from official sources.</Text>
    </Card>
    {rosters.length > 0 && <Pressable onPress={onErase} style={[styles.secondaryButton, { borderColor: palette.line }]}><Text style={[styles.secondaryText, { color: palette.text }]}>Erase local roster & pay data</Text></Pressable>}
  </View>;
}

function FlightDetail({ sector, dateLabel, palette, onClose }: { sector: Sector; dateLabel: string; palette: Palette; onClose: () => void }) {
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close flight details" />
      <View style={[styles.flightSheet, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
        <View style={[styles.sheetHandle, { backgroundColor: palette.line }]} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitle}>
            <Text style={[styles.label, { color: palette.muted }]}>{dateLabel} · {sector.flightNumber}{sector.deadhead ? ' · DHC' : ''}</Text>
            <Text style={[styles.sheetRoute, { color: palette.text }]}>{sector.departure} → {sector.arrival}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>{sector.departureTime} – {sector.arrivalTime}</Text>
          </View>
          <Pressable onPress={onClose} style={[styles.sheetClose, { backgroundColor: palette.surface, borderColor: palette.line }]} accessibilityLabel="Close">
            <Text style={[styles.sheetCloseText, { color: palette.text }]}>×</Text>
          </Pressable>
        </View>
        <Text style={[styles.flyingWith, { color: palette.accent }]}>Flying with · {sector.crew.length}</Text>
        {sector.crew.length ? <FlatList
          data={sector.crew}
          keyExtractor={(member) => member.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.crewList}
          renderItem={({ item: member }) => <View style={styles.crewRow}>
            <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}><Text style={[styles.avatarText, { color: palette.accent }]}>{member.name[0]}</Text></View>
            <View style={styles.crewText}>
              <Text style={[styles.crewName, { color: palette.text }]}>{member.name}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{member.position ?? member.rosterRank ?? member.role}</Text>
            </View>
          </View>}
        /> : <Text style={[styles.meta, { color: palette.muted }]}>Crew is not listed for this flight in the imported report.</Text>}
      </View>
    </View>
  </Modal>;
}

function PrimaryButton({ title, onPress, loading, palette }: { title: string; onPress: () => void; loading: boolean; palette: Palette }) {
  return <Pressable onPress={onPress} disabled={loading} style={[styles.primaryButton, { backgroundColor: palette.accent }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{title}</Text>}</Pressable>;
}
function Card({ children, palette }: { children: React.ReactNode; palette: Palette }) { return <View style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>{children}</View>; }
function Privacy({ palette }: { palette: Palette }) { return <View style={[styles.privacy, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.cardTitle, { color: palette.text }]}>Private by design</Text><Text style={[styles.meta, { color: palette.muted }]}>PDFs are parsed locally. KhaVair stores only parsed roster data on this device.</Text></View>; }
function Summary({ title, value, detail, palette }: { title: string; value: string; detail: string; palette: Palette }) { return <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.label, { color: palette.muted }]}>{title}</Text><Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text><Text style={[styles.meta, { color: palette.muted }]}>{detail}</Text></View>; }
function operatingCount(roster: ParsedAirAstanaRoster) { return roster.sectors.filter((sector) => !sector.deadhead).length; }

const styles = StyleSheet.create({
  safe: { flex: 1 },
  app: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 27, fontWeight: '700', letterSpacing: -.8 },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.35 },
  modeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  modeGlyph: { fontSize: 19 },
  viewport: { flex: 1, minHeight: 0 },
  screen: { flex: 1, paddingTop: 8, gap: 12 },
  sectionTitle: { fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -.8 },
  intro: { fontSize: 15, lineHeight: 22, maxWidth: 440 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 17 },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  airport: { fontSize: 34, fontWeight: '700' },
  routeArrow: { fontSize: 22 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summary: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, minHeight: 112 },
  summaryValue: { fontSize: 25, fontWeight: '700', marginTop: 8 },
  privacy: { borderWidth: 1, borderRadius: 20, padding: 14 },
  primaryButton: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontWeight: '700' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  titleText: { flex: 1, minWidth: 0 },
  titleActions: { flexDirection: 'row', gap: 7 },
  monthNav: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavText: { fontSize: 12, fontWeight: '600' },
  compactButton: { height: 38, minWidth: 72, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  compactText: { fontWeight: '700', fontSize: 12 },
  feedback: { fontSize: 11, lineHeight: 15 },
  error: { fontSize: 12 },
  innerWindow: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  listContent: { padding: 8, gap: 7, paddingBottom: 18 },
  rosterCard: { borderWidth: 1, borderRadius: 16, padding: 13 },
  flightCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flightNumber: { fontSize: 11, fontWeight: '700' },
  rosterRoute: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  flyingWith: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 7 },
  crewList: { paddingBottom: 12 },
  crewRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  crewText: { flex: 1, minWidth: 0 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { fontSize: 12, fontWeight: '800' },
  crewName: { fontSize: 14, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 10 },
  flightSheet: { width: '100%', maxWidth: 620, maxHeight: '78%', alignSelf: 'center', borderWidth: 1, borderRadius: 28, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 12, overflow: 'hidden' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sheetTitle: { flex: 1, minWidth: 0 },
  sheetRoute: { fontSize: 28, lineHeight: 33, fontWeight: '700', marginTop: 5 },
  sheetClose: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontSize: 27, lineHeight: 29, fontWeight: '300', marginTop: -2 },
  moneyHint: { borderWidth: 1, borderRadius: 20, padding: 14 },
  secondaryButton: { height: 48, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontWeight: '600' },
  tabBar: { height: 64, marginTop: 10, marginBottom: 4, borderWidth: 1, borderRadius: 22, flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.46)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  unlockCard: { width: '100%', maxWidth: 390, borderWidth: 1, borderRadius: 26, padding: 20 },
  unlockTitle: { fontSize: 26, fontWeight: '700', marginTop: 7 },
  codeInput: { height: 54, borderWidth: 1, borderRadius: 15, marginTop: 18, paddingHorizontal: 16, fontSize: 22, letterSpacing: 5, textAlign: 'center' },
  codeHint: { fontSize: 11, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  action: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
