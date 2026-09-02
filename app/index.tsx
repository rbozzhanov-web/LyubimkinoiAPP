import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { demoDuty } from '@/src/data/demoRoster';

type Tab = 'Home' | 'Roster' | 'Money' | 'More';

const tabs: Tab[] = ['Home', 'Roster', 'Money', 'More'];

export default function IndexScreen() {
  const systemScheme = useColorScheme();
  const [tab, setTab] = useState<Tab>('Home');
  const [lovedMode, setLovedMode] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const dark = systemScheme === 'dark';

  const palette = useMemo(() => ({
    background: dark ? '#11110F' : '#F4F1EC',
    surface: dark ? '#1B1A18' : '#FCFAF7',
    surfaceStrong: dark ? '#25231F' : '#FFFFFF',
    text: dark ? '#F7F4EF' : '#171714',
    muted: dark ? '#AAA49A' : '#747067',
    line: dark ? '#302E29' : '#E7E1D8',
    accent: lovedMode ? '#D97B6C' : (dark ? '#C7BDAE' : '#2F3934'),
    accentSoft: lovedMode ? (dark ? '#34221F' : '#F7E4DE') : (dark ? '#222925' : '#E6ECE8'),
  }), [dark, lovedMode]);

  const sector = demoDuty.sectors[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.brand, { color: palette.text }]}>KhaVair</Text>
            <Text style={[styles.kicker, { color: palette.muted }]}>CABIN CREW COMPANION</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle Loved One mode"
            onPress={() => setLovedMode((v) => !v)}
            style={[styles.modeButton, { backgroundColor: palette.surface }]}
          >
            <Text style={styles.modeGlyph}>{lovedMode ? '🌹' : '♡'}</Text>
          </Pressable>
        </View>

        <View style={styles.viewport}>
          {tab === 'Home' && (
            <View style={styles.screen}>
              <Text style={[styles.sectionLabel, { color: palette.muted }]}>NEXT DUTY · {demoDuty.dateLabel}</Text>
              <View style={[styles.hero, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <View style={styles.routeRow}>
                  <Text style={[styles.airport, { color: palette.text }]}>{sector.departure}</Text>
                  <View style={styles.routeLineWrap}>
                    <View style={[styles.routeLine, { backgroundColor: palette.line }]} />
                    <Text style={[styles.flight, { color: palette.muted }]}>{sector.flightNumber}</Text>
                  </View>
                  <Text style={[styles.airport, { color: palette.text }]}>{sector.arrival}</Text>
                </View>
                <View style={styles.timeGrid}>
                  <Metric label="REPORT" value={demoDuty.reportTime} palette={palette} />
                  <Metric label="BLOCK" value="08:20" palette={palette} />
                  <Metric label="RELEASE" value={demoDuty.releaseTime} palette={palette} />
                </View>
                <Pressable
                  onPress={() => setCrewOpen((v) => !v)}
                  style={[styles.crewButton, { backgroundColor: palette.accentSoft }]}
                >
                  <Text style={[styles.crewButtonText, { color: palette.accent }]}>Flying with · {sector.crew.length}</Text>
                  <Text style={[styles.chevron, { color: palette.accent }]}>{crewOpen ? '−' : '+'}</Text>
                </Pressable>
                {crewOpen && (
                  <View style={styles.crewPanel}>
                    {sector.crew.map((member) => (
                      <View key={member.id} style={[styles.crewRow, { borderTopColor: palette.line }]}>
                        <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
                          <Text style={[styles.avatarText, { color: palette.accent }]}>{member.name.slice(0, 1)}</Text>
                        </View>
                        <View style={styles.crewCopy}>
                          <Text style={[styles.crewName, { color: palette.text }]}>{member.name}</Text>
                          <Text style={[styles.crewRole, { color: palette.muted }]}>{member.position ?? member.role}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.summaryRow}>
                <SummaryCard title="THIS MONTH" value="68:42" detail="18 sectors" palette={palette} />
                <SummaryCard title="PER DIEM" value="$230" detail="≈ ₸ pending rate" palette={palette} />
              </View>
              <View style={[styles.privacy, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                <Text style={[styles.privacyTitle, { color: palette.text }]}>Private by design</Text>
                <Text style={[styles.privacyCopy, { color: palette.muted }]}>Roster data stays on this device.</Text>
              </View>
            </View>
          )}

          {tab === 'Roster' && (
            <View style={styles.screen}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>September roster</Text>
              <View style={[styles.innerWindow, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                <FlatList
                  data={[demoDuty]}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => setCrewOpen(true)} style={[styles.rosterCard, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                      <Text style={[styles.sectionLabel, { color: palette.muted }]}>{item.dateLabel}</Text>
                      <Text style={[styles.rosterRoute, { color: palette.text }]}>{item.sectors[0].departure}  →  {item.sectors[0].arrival}</Text>
                      <Text style={[styles.rosterMeta, { color: palette.muted }]}>Report {item.reportTime} · {item.sectors[0].flightNumber} · Crew {item.sectors[0].crew.length}</Text>
                    </Pressable>
                  )}
                />
              </View>
            </View>
          )}

          {tab === 'Money' && (
            <View style={styles.screen}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Money</Text>
              <View style={[styles.hero, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <Text style={[styles.sectionLabel, { color: palette.muted }]}>SEPTEMBER PER DIEM</Text>
                <Text style={[styles.moneyValue, { color: palette.text }]}>$230</Text>
                <Text style={[styles.rosterMeta, { color: palette.muted }]}>KZT total appears after NBRK rate refresh.</Text>
              </View>
              <View style={[styles.disabledCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                <Text style={[styles.privacyTitle, { color: palette.text }]}>Pay estimate</Text>
                <Text style={[styles.privacyCopy, { color: palette.muted }]}>Waiting for your salary rules.</Text>
              </View>
            </View>
          )}

          {tab === 'More' && (
            <View style={styles.screen}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>More</Text>
              <View style={[styles.hero, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <Text style={[styles.privacyTitle, { color: palette.text }]}>Loved One Mode {lovedMode ? '🌹' : ''}</Text>
                <Text style={[styles.privacyCopy, { color: palette.muted }]}>A warm accent, kept intentionally subtle.</Text>
                <Pressable onPress={() => setLovedMode((v) => !v)} style={[styles.actionButton, { backgroundColor: palette.accent }]}> 
                  <Text style={styles.actionText}>{lovedMode ? 'Use standard theme' : 'Turn on 🍑 mode'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.tabBar, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
          {tabs.map((item) => {
            const active = tab === item;
            return (
              <Pressable key={item} onPress={() => setTab(item)} style={styles.tabItem}>
                <View style={[styles.tabDot, active && { backgroundColor: palette.accent }]} />
                <Text style={[styles.tabText, { color: active ? palette.text : palette.muted }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value, palette }: { label: string; value: string; palette: any }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function SummaryCard({ title, value, detail, palette }: { title: string; value: string; detail: string; palette: any }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <Text style={[styles.sectionLabel, { color: palette.muted }]}>{title}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.summaryDetail, { color: palette.muted }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  app: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 27, fontWeight: '700', letterSpacing: -0.8 },
  kicker: { marginTop: 1, fontSize: 9, fontWeight: '700', letterSpacing: 1.35 },
  modeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  modeGlyph: { fontSize: 19 },
  viewport: { flex: 1, minHeight: 0 },
  screen: { flex: 1, paddingTop: 8, gap: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.15 },
  sectionTitle: { fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 },
  hero: { borderWidth: 1, borderRadius: 26, padding: 18 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  airport: { fontSize: 32, fontWeight: '700', letterSpacing: -1.2 },
  routeLineWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  routeLine: { height: 1, alignSelf: 'stretch' },
  flight: { fontSize: 11, fontWeight: '600' },
  timeGrid: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  metric: { minWidth: 72 },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  metricValue: { marginTop: 3, fontSize: 20, fontWeight: '650' },
  crewButton: { marginTop: 18, minHeight: 44, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crewButtonText: { fontSize: 14, fontWeight: '700' },
  chevron: { fontSize: 20, fontWeight: '500' },
  crewPanel: { marginTop: 8 },
  crewRow: { minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  crewCopy: { marginLeft: 10, flex: 1 },
  crewName: { fontSize: 14, fontWeight: '650' },
  crewRole: { marginTop: 1, fontSize: 11 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 112, borderWidth: 1, borderRadius: 20, padding: 14 },
  summaryValue: { marginTop: 8, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  summaryDetail: { marginTop: 4, fontSize: 11 },
  privacy: { borderWidth: 1, borderRadius: 20, padding: 14 },
  privacyTitle: { fontSize: 14, fontWeight: '700' },
  privacyCopy: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  innerWindow: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  listContent: { padding: 10 },
  rosterCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  rosterRoute: { marginTop: 7, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  rosterMeta: { marginTop: 6, fontSize: 12, lineHeight: 17 },
  moneyValue: { marginTop: 8, fontSize: 42, fontWeight: '700', letterSpacing: -1.5 },
  disabledCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
  actionButton: { marginTop: 18, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tabBar: { height: 64, marginTop: 10, marginBottom: 4, borderWidth: 1, borderRadius: 22, flexDirection: 'row', alignItems: 'center' },
  tabItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '650' },
});
