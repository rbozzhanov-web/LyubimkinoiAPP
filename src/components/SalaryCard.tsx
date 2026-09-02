import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { calculateRosterPay, formatKzt, payReadiness, type PayCalculation, type PayMonthOverrides, type PayProfile } from '@/src/domain/pay';
import { CREW_PAY_NORM_STATED_TO } from '@/src/domain/crewPayNorm';
import { resolveMrp, type MrpSnapshot } from '@/src/domain/mrp';
import { resolveUsdKzt, type UsdKztSnapshot } from '@/src/domain/fx';
import { calculatePerDiemMonth, formatUsd } from '@/src/domain/perDiem';
import { detectStationStays, formatStayDuration } from '@/src/domain/layovers';
import { loadPayMonth, loadPayProfile } from '@/src/storage/payStorage';
import { loadStoredRosters } from '@/src/storage/rosterStorage';
import { SwipeSurface } from './SwipeSurface';

type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string>;

export function SalaryCard({ roster, palette }: { roster: ParsedAirAstanaRoster; palette: Palette }) {
  const monthKey = roster.period.start.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Partial<PayProfile>>();
  const [month, setMonth] = useState<PayMonthOverrides>();
  const [mrp, setMrp] = useState<MrpSnapshot>();
  const [fx, setFx] = useState<UsdKztSnapshot>();

  useEffect(() => {
    setProfile(loadPayProfile());
    setMonth(loadPayMonth(monthKey));
  }, [monthKey]);

  useEffect(() => {
    let alive = true;
    resolveMrp(Number(monthKey.slice(0, 4)))
      .then((snapshot) => { if (alive) setMrp(snapshot); })
      .catch(() => { if (alive) setMrp(undefined); });
    resolveUsdKzt()
      .then((snapshot) => { if (alive) setFx(snapshot); })
      .catch(() => { if (alive) setFx(undefined); });
    return () => { alive = false; };
  }, [monthKey]);

  const readiness = useMemo(() => payReadiness(roster, profile, month), [roster, profile, month]);
  const calculation = useMemo<PayCalculation | undefined>(() => {
    if (!readiness.ready || !mrp || !profile) return undefined;
    try { return calculateRosterPay(roster, profile as PayProfile, month ?? {}, mrp.valueKzt); }
    catch { return undefined; }
  }, [roster, profile, month, mrp, readiness.ready]);

  const localStays = useMemo(() => detectStationStays(loadStoredRosters()), [roster.period.start, roster.sectors.length]);
  const perDiem = useMemo(
    () => mrp ? calculatePerDiemMonth(localStays, monthKey, mrp.valueKzt, fx?.usdKzt) : undefined,
    [localStays, monthKey, mrp, fx],
  );
  const paidLayovers = perDiem?.items.filter((item) => item.eligible) ?? [];

  return <>
    <Pressable onPress={() => setOpen(true)} style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]} accessibilityRole="button" accessibilityLabel="Open money details">
      <View style={styles.headerRow}>
        <View style={styles.grow}>
          <Text style={[styles.label, { color: palette.muted }]}>PER DIEM</Text>
          <Text style={[styles.value, { color: palette.text }]}>{perDiem ? perDiemHeadline(perDiem, fx) : 'Calculating…'}</Text>
          {perDiem && <Text style={[styles.meta, { color: palette.muted }]}>{paidLayovers.length} qualifying layover{paidLayovers.length === 1 ? '' : 's'}</Text>}
        </View>
        <Text style={[styles.openGlyph, { color: palette.accent }]}>›</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.line }]} />
      <Text style={[styles.label, { color: palette.muted }]}>SALARY ESTIMATE</Text>
      <Text style={[styles.salaryValue, { color: palette.text }]}>{calculation ? formatKzt(calculation.net) : 'Not configured'}</Text>
      {calculation
        ? <Text style={[styles.meta, { color: palette.muted }]}>Gross {formatKzt(calculation.gross)} · {calculation.paidHours.toFixed(2)} paid h · {calculation.operatingSectors} sectors</Text>
        : <Text style={[styles.meta, { color: palette.muted }]}>{readiness.missing.length ? 'More → Salary settings' : 'Waiting for annual MRP.'}</Text>}
    </Pressable>

    {perDiem && <View style={styles.inline}>
      <Text style={[styles.label, { color: palette.muted }]}>QUALIFYING LAYOVERS</Text>
      {paidLayovers.length
        ? <FlatList data={paidLayovers} style={styles.inlineList} showsVerticalScrollIndicator={false}
            keyExtractor={(item) => `${item.stay.arrivalLocal}-${item.stay.station}`}
            renderItem={({ item }) => <View style={[styles.inlineRow, { borderColor: palette.line }]}>
              <View style={styles.grow}>
                <Text style={[styles.inlineStation, { color: palette.text }]}>{item.stay.station}</Text>
                <Text style={[styles.meta, { color: palette.muted }]}>{shortDate(item.stay.arrivalLocal)} · {formatStayDuration(item.stay.durationMinutes)}</Text>
              </View>
              <Text style={[styles.inlineAmount, { color: palette.accent }]}>{perDiemItemAmount(item)}</Text>
            </View>} />
        : <Text style={[styles.meta, { color: palette.muted }]}>No layover this month met its minimum ground time.</Text>}
    </View>}

    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <SwipeSurface style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.line }]} onSwipeDown={() => setOpen(false)}>
          <View style={[styles.handle, { backgroundColor: palette.line }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.grow}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Money</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{monthKey}</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={[styles.close, { backgroundColor: palette.surface }]}><Text style={[styles.closeText, { color: palette.text }]}>×</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.section, { color: palette.text }]}>Qualifying layovers</Text>
            {perDiem ? <>
              <View style={[styles.summary, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <Text style={[styles.label, { color: palette.muted }]}>MONTH TOTAL</Text>
                <Text style={[styles.total, { color: palette.text }]}>{perDiemHeadline(perDiem, fx)}</Text>
                <Text style={[styles.meta, { color: palette.muted }]}>{paidLayovers.length} paid layover{paidLayovers.length === 1 ? '' : 's'}</Text>
                {fx && <Text style={[styles.hint, { color: palette.muted }]}>NBRK USD/KZT {fx.usdKzt.toFixed(2)} · {fx.source === 'official' ? 'official' : 'cached official'} rate</Text>}
              </View>

              {paidLayovers.length ? paidLayovers.map((item) => <View key={`${item.stay.arrivalLocal}-${item.stay.station}`} style={[styles.layover, { borderColor: palette.line }]}>
                <View style={styles.headerRow}>
                  <View style={styles.grow}>
                    <Text style={[styles.station, { color: palette.text }]}>{item.stay.station}</Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>{shortDate(item.stay.arrivalLocal)} · {item.units} day{item.units === 1 ? '' : 's'} · {formatStayDuration(item.stay.durationMinutes)}</Text>
                    <Text style={[styles.hint, { color: palette.muted }]}>{regionLabel(item.region)}</Text>
                  </View>
                  <Text style={[styles.amount, { color: palette.accent }]}>{perDiemItemAmount(item)}</Text>
                </View>
              </View>) : <Text style={[styles.meta, { color: palette.muted }]}>No qualifying layovers this month.</Text>}
            </> : <Text style={[styles.meta, { color: palette.muted }]}>Waiting for annual MRP.</Text>}

            <View style={[styles.sectionDivider, { backgroundColor: palette.line }]} />
            <Text style={[styles.section, { color: palette.text }]}>Salary estimate</Text>
            {calculation ? <>
              <View style={[styles.summary, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <Text style={[styles.label, { color: palette.muted }]}>TO RECEIVE</Text>
                <Text style={[styles.total, { color: palette.text }]}>{formatKzt(calculation.net)}</Text>
                <Text style={[styles.meta, { color: palette.muted }]}>Gross {formatKzt(calculation.gross)} · CrewPay {calculation.paidHours.toFixed(2)} h</Text>
              </View>
              <View style={styles.breakdown}>
                <Line label="Salary" value={calculation.salaryLine.amount} palette={palette} />
                <Line label="Transport" value={calculation.transportLine.amount} palette={palette} />
                <Line label="Paid hours" value={calculation.hourBaseLine.amount} palette={palette} />
                {calculation.hourSurchargeLines.filter((line) => line.amount > 0).map((line) => <Line key={line.label} label={line.label} value={line.amount} palette={palette} />)}
                <Line label="Night" value={calculation.nightLine.amount} palette={palette} />
                {calculation.holidayLine.amount > 0 && <Line label="Public holiday hours" value={calculation.holidayLine.amount} palette={palette} />}
                {calculation.officialDayOffLine.amount > 0 && <Line label="Official day off hours" value={calculation.officialDayOffLine.amount} palette={palette} />}
                <Line label="Sector supplements" value={calculation.sectorLines.reduce((sum, line) => sum + line.amount, 0)} palette={palette} />
                {calculation.deadheadLine.amount > 0 && <Line label="Deadhead" value={calculation.deadheadLine.amount} palette={palette} />}
                {calculation.sickLine.amount > 0 && <Line label={calculation.sickSource === 'known-payslip' ? 'Sick leave · known payslip' : 'Sick leave'} value={calculation.sickLine.amount} palette={palette} />}
                {calculation.vacationLine.amount > 0 && <Line label={`Vacation pay · ${calculation.vacationDays} day${calculation.vacationDays === 1 ? '' : 's'}`} value={calculation.vacationLine.amount} palette={palette} />}
                <Line label="Gross" value={calculation.gross} strong palette={palette} />
                <Line label="OSMS" value={-calculation.osms} palette={palette} />
                <Line label="OPV" value={-calculation.opv} palette={palette} />
                <Line label="IPN" value={-calculation.ipn} palette={palette} />
                <Line label="Net" value={calculation.net} strong palette={palette} />
              </View>
              <Text style={[styles.hint, { color: palette.muted }]}>CrewPay Norm {calculation.crewPayNormVersion}{calculation.crewPayNormAfterStatedPeriod ? ` · latest published after ${CREW_PAY_NORM_STATED_TO}` : ''}.</Text>
            </> : <View style={[styles.summary, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
              <Text style={[styles.meta, { color: palette.muted }]}>Salary is optional for other users. Configure it in More → Salary settings.</Text>
              {readiness.missing.length > 0 && <Text style={[styles.hint, { color: palette.muted }]}>Missing: {readiness.missing.join(', ')}.</Text>}
            </View>}
          </ScrollView>
        </SwipeSurface>
      </View>
    </Modal>
  </>;
}

function perDiemHeadline(result: ReturnType<typeof calculatePerDiemMonth>, fx?: UsdKztSnapshot): string {
  if (fx && result.totalUsd !== undefined) return `${formatUsd(result.totalUsd)} · ${formatKzt(result.totalKzt ?? 0)}`;
  const parts: string[] = [];
  if (result.foreignUsd > 0) parts.push(formatUsd(result.foreignUsd));
  if (result.kazakhstanKzt > 0) parts.push(formatKzt(result.kazakhstanKzt));
  return parts.join(' + ') || 'No qualifying stays';
}
function perDiemItemAmount(item: ReturnType<typeof calculatePerDiemMonth>['items'][number]): string {
  return item.region === 'KZ' ? formatKzt(item.kztAmount) : formatUsd(item.usdAmount);
}
function regionLabel(region: ReturnType<typeof calculatePerDiemMonth>['items'][number]['region']): string {
  if (region === 'KZ') return 'Astana · 3 MRP';
  if (region === 'EU_UK') return 'EU / UK · $60';
  return 'Other foreign · $50';
}
function shortDate(value: string): string {
  const [date] = value.split('T');
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}
function Line({ label, value, strong, palette }: { label: string; value: number; strong?: boolean; palette: Palette }) {
  return <View style={styles.line}><Text style={[styles.lineText, strong && styles.strong, { color: palette.text }]}>{label}</Text><Text style={[styles.lineText, strong && styles.strong, { color: palette.text }]}>{value < 0 ? '−' : ''}{formatKzt(Math.abs(value))}</Text></View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  value: { fontSize: 23, fontWeight: '700', marginTop: 5 },
  salaryValue: { fontSize: 21, fontWeight: '700', marginTop: 4 },
  meta: { fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  openGlyph: { fontSize: 30, fontWeight: '300', paddingLeft: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  inline: { flex: 1, minHeight: 0, gap: 2 }, inlineList: { flex: 1 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  inlineStation: { fontSize: 16, fontWeight: '700' }, inlineAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.48)', justifyContent: 'flex-end' },
  sheet: { height: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  sheetTitle: { fontSize: 25, fontWeight: '700' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 27 },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 24 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginTop: 18, marginBottom: 2 },
  summary: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 8 },
  total: { fontSize: 24, fontWeight: '700', marginTop: 5, marginBottom: 2 },
  layover: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  station: { fontSize: 18, fontWeight: '700' },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
  breakdown: { paddingTop: 2, paddingBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5 },
  lineText: { fontSize: 12 }, strong: { fontWeight: '800' },
});
