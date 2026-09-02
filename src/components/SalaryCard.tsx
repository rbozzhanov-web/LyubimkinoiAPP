import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { calculateRosterPay, formatKzt, payReadiness, type PayMonthOverrides, type PayProfile } from '@/src/domain/pay';
import { CREW_PAY_NORM_STATED_TO } from '@/src/domain/crewPayNorm';
import { resolveMrp, type MrpSnapshot } from '@/src/domain/mrp';
import { resolveUsdKzt, type UsdKztSnapshot } from '@/src/domain/fx';
import { calculatePerDiemMonth, formatUsd } from '@/src/domain/perDiem';
import { detectStationStays, formatStayDuration } from '@/src/domain/layovers';
import { loadPayMonth, loadPayProfile, savePayMonth, savePayProfile } from '@/src/storage/payStorage';
import { loadStoredRosters } from '@/src/storage/rosterStorage';

type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string>;

type Draft = {
  hourlyRate: string;
  monthlySalary: string;
  monthlyTransport: string;
  paidHours: string;
  deadheadHours: string;
  sickEarnings12m: string;
  sickWorkedHours12m: string;
  sickMissedHours: string;
};

export function SalaryCard({ roster, palette }: { roster: ParsedAirAstanaRoster; palette: Palette }) {
  const monthKey = roster.period.start.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Partial<PayProfile>>();
  const [month, setMonth] = useState<PayMonthOverrides>();
  const [mrp, setMrp] = useState<MrpSnapshot>();
  const [fx, setFx] = useState<UsdKztSnapshot>();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string>();

  useEffect(() => {
    const nextProfile = loadPayProfile();
    const nextMonth = loadPayMonth(monthKey);
    setProfile(nextProfile);
    setMonth(nextMonth);
    setDraft(draftFrom(nextProfile, nextMonth));
    setError(undefined);
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
  const calculation = useMemo(() => {
    if (!readiness.ready || !mrp || !profile) return undefined;
    try {
      return calculateRosterPay(roster, profile as PayProfile, month ?? {}, mrp.valueKzt);
    } catch {
      return undefined;
    }
  }, [roster, profile, month, mrp, readiness.ready]);

  // Read the whole local roster library so a layover crossing a month boundary remains one stay.
  const localStays = useMemo(() => detectStationStays(loadStoredRosters()), [roster.period.start, roster.sectors.length]);
  const perDiem = useMemo(
    () => mrp ? calculatePerDiemMonth(localStays, monthKey, mrp.valueKzt, fx?.usdKzt) : undefined,
    [localStays, monthKey, mrp, fx],
  );

  const absences = roster.absences ?? [];
  const sickDays = absences.filter((item) => item.code === 'SICK').length;
  const unfitDays = absences.filter((item) => item.code === 'UFF').length;
  const operatingSectors = roster.sectors.filter((sector) => !sector.deadhead).length;
  const deadheadSectors = roster.sectors.filter((sector) => sector.deadhead).length;

  const save = () => {
    const nextProfile: PayProfile = {
      hourlyRate: numberFrom(draft.hourlyRate),
      monthlySalary: numberFrom(draft.monthlySalary),
      monthlyTransport: numberFrom(draft.monthlyTransport),
    };
    const nextMonth: PayMonthOverrides = {
      paidHours: optionalNumberFrom(draft.paidHours),
      deadheadHours: optionalNumberFrom(draft.deadheadHours),
      sickEarnings12m: optionalNumberFrom(draft.sickEarnings12m),
      sickWorkedHours12m: optionalNumberFrom(draft.sickWorkedHours12m),
      sickMissedHours: optionalNumberFrom(draft.sickMissedHours),
    };

    const nextReadiness = payReadiness(roster, nextProfile, nextMonth);
    if (!nextReadiness.ready) {
      setError(`Needs: ${nextReadiness.missing.join(', ')}.`);
      return;
    }

    savePayProfile(nextProfile);
    savePayMonth(monthKey, nextMonth);
    setProfile(nextProfile);
    setMonth(nextMonth);
    setError(undefined);
    setOpen(false);
  };

  return <>
    <Pressable
      onPress={() => { setDraft(draftFrom(profile, month)); setError(undefined); setOpen(true); }}
      style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}
      accessibilityRole="button"
      accessibilityLabel="Money details and salary estimate settings"
    >
      <View style={styles.headerRow}>
        <View style={styles.grow}>
          <Text style={[styles.label, { color: palette.muted }]}>PER DIEM</Text>
          <Text style={[styles.value, { color: palette.text }]}>{perDiem ? perDiemHeadline(perDiem, fx) : 'Calculating…'}</Text>
          {perDiem && <Text style={[styles.meta, { color: palette.muted }]}>{perDiemSubline(perDiem, fx)}</Text>}
        </View>
        <Text style={[styles.openGlyph, { color: palette.accent }]}>›</Text>
      </View>

      <View style={[styles.compactDivider, { backgroundColor: palette.line }]} />
      <Text style={[styles.label, { color: palette.muted }]}>SALARY ESTIMATE</Text>
      <Text style={[styles.salaryValue, { color: palette.text }]}>{calculation ? formatKzt(calculation.net) : 'Set up'}</Text>
      {calculation
        ? <Text style={[styles.meta, { color: palette.muted }]}>Gross {formatKzt(calculation.gross)} · {calculation.paidHours.toFixed(2)} paid h ({calculation.paidHoursSource === 'crewPayNorm' ? `Norm ${calculation.crewPayNormVersion}` : 'manual'}) · {calculation.operatingSectors} sectors</Text>
        : <Text style={[styles.meta, { color: palette.muted }]}>{readiness.missing.length ? `Needs: ${readiness.missing.join(', ')}` : 'Waiting for annual MRP.'}</Text>}
    </Pressable>

    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.line }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.grow}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Money</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{monthKey} · personal data stays on this device</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={[styles.close, { backgroundColor: palette.surface }]}><Text style={[styles.closeText, { color: palette.text }]}>×</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.section, { color: palette.text }]}>Per diem</Text>
            {perDiem ? <>
              <View style={[styles.perDiemSummary, { backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}>
                <Text style={[styles.label, { color: palette.muted }]}>MONTH TOTAL</Text>
                <Text style={[styles.perDiemTotal, { color: palette.text }]}>{perDiemHeadline(perDiem, fx)}</Text>
                <Text style={[styles.meta, { color: palette.muted }]}>{perDiemSubline(perDiem, fx)}</Text>
                {fx && <Text style={[styles.hint, { color: palette.muted }]}>NBRK USD/KZT {fx.usdKzt.toFixed(2)} · {fx.source === 'official' ? 'official rate' : 'cached official rate'}</Text>}
              </View>

              {perDiem.items.map((item) => <View key={`${item.stay.arrivalLocal}-${item.stay.station}`} style={[styles.perDiemItem, { borderColor: palette.line }]}>
                <View style={styles.headerRow}>
                  <View style={styles.grow}>
                    <Text style={[styles.perDiemStation, { color: palette.text }]}>{item.stay.station}</Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>{shortDate(item.stay.arrivalLocal)} · {formatStayDuration(item.stay.durationMinutes)} · {regionLabel(item.region)}</Text>
                  </View>
                  <Text style={[styles.perDiemAmount, { color: item.needsClassification ? palette.rose : palette.accent }]}>{perDiemItemAmount(item)}</Text>
                </View>
                {item.region === 'KZ' && item.eligible && <Text style={[styles.hint, { color: palette.muted }]}>{item.units} qualifying UTC day{item.units === 1 ? '' : 's'} · 3 MRP each</Text>}
                {!item.eligible && !item.needsClassification && <Text style={[styles.hint, { color: palette.muted }]}>Does not meet the station-time threshold.</Text>}
                {item.needsClassification && <Text style={[styles.hint, { color: palette.rose }]}>Station region is not confirmed yet, so no money is added.</Text>}
              </View>)}

              {perDiem.unresolvedStations.length > 0 && <Text style={[styles.hint, { color: palette.rose }]}>Needs classification: {perDiem.unresolvedStations.join(', ')}.</Text>}
              {!fx && <Text style={[styles.hint, { color: palette.muted }]}>NBRK rate is unavailable offline. Foreign per diem remains in USD and Kazakhstan per diem remains in KZT until an official rate is cached.</Text>}
            </> : <Text style={[styles.hint, { color: palette.muted }]}>Waiting for annual MRP.</Text>}

            <View style={[styles.sectionDivider, { backgroundColor: palette.line }]} />
            <Text style={[styles.section, { color: palette.text }]}>Salary estimate</Text>
            <Text style={[styles.section, { color: palette.text }]}>Personal rates</Text>
            <Field label="Hourly rate · ₸" value={draft.hourlyRate} onChange={(value) => setDraft((old) => ({ ...old, hourlyRate: value }))} palette={palette} />
            <Field label="Full monthly salary · ₸" value={draft.monthlySalary} onChange={(value) => setDraft((old) => ({ ...old, monthlySalary: value }))} palette={palette} />
            <Field label="Full monthly transport · ₸" value={draft.monthlyTransport} onChange={(value) => setDraft((old) => ({ ...old, monthlyTransport: value }))} palette={palette} />

            <Text style={[styles.section, { color: palette.text }]}>CrewPay hours</Text>
            {readiness.autoPaidHours !== undefined
              ? <View style={[styles.facts, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                  <Text style={[styles.factTitle, { color: palette.text }]}>CrewPay Norm {readiness.crewPayNormVersion} · {readiness.autoPaidHours.toFixed(2)} h</Text>
                  <Text style={[styles.meta, { color: palette.muted }]}>Calculated from {operatingSectors} operating sectors. DHC is separate.</Text>
                  {readiness.crewPayNormAfterStatedPeriod && <Text style={[styles.meta, { color: palette.muted }]}>The document’s stated period ended {CREW_PAY_NORM_STATED_TO}. Version {readiness.crewPayNormVersion} is still used because it is the latest published version and no successor has been issued.</Text>}
                </View>
              : <Text style={[styles.hint, { color: palette.muted }]}>Automatic CrewPay is incomplete because the table does not contain: {readiness.crewPayNormMissingRoutes.join(', ') || 'unknown route'}.</Text>}
            <Field label="Paid hours override · optional" value={draft.paidHours} onChange={(value) => setDraft((old) => ({ ...old, paidHours: value }))} palette={palette} />
            <Text style={[styles.hint, { color: palette.muted }]}>Leave blank to use CrewPay Norm automatically. Roster total is {formatRosterBlock(roster.totals.blockMinutes)} and is not substituted for payroll norm.</Text>

            {deadheadSectors > 0 && <>
              <Text style={[styles.section, { color: palette.text }]}>Deadhead</Text>
              <Field label={`Deadhead paid hours · ${deadheadSectors} sector${deadheadSectors === 1 ? '' : 's'} detected`} value={draft.deadheadHours} onChange={(value) => setDraft((old) => ({ ...old, deadheadHours: value }))} palette={palette} />
            </>}

            {sickDays > 0 && <>
              <Text style={[styles.section, { color: palette.text }]}>Sick leave · Kazakhstan rules</Text>
              <Text style={[styles.hint, { color: palette.muted }]}>For summarized working-time accounting: average hourly earnings from the 12 calendar months before sickness × scheduled working hours missed because of sickness. Ordinary monthly benefit is capped at 25 MRP.</Text>
              <Field label="Included earnings in preceding 12 months · ₸" value={draft.sickEarnings12m} onChange={(value) => setDraft((old) => ({ ...old, sickEarnings12m: value }))} palette={palette} />
              <Field label="Worked hours in the same 12 months" value={draft.sickWorkedHours12m} onChange={(value) => setDraft((old) => ({ ...old, sickWorkedHours12m: value }))} palette={palette} />
              <Field label={`Scheduled hours missed · ${sickDays} SICK day${sickDays === 1 ? '' : 's'}`} value={draft.sickMissedHours} onChange={(value) => setDraft((old) => ({ ...old, sickMissedHours: value }))} palette={palette} />
            </>}

            <View style={[styles.facts, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <Text style={[styles.factTitle, { color: palette.text }]}>From roster automatically</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{operatingSectors} operating sectors · {deadheadSectors} DHC · {sickDays} SICK · {unfitDays} UFF</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>Night pay = ½ paid hours × 0.5 rate. Sector bands: first 15 free, then ×3 / ×4 / ×5 / ×6. DHC = ×0.5.</Text>
            </View>

            {mrp && <Text style={[styles.hint, { color: palette.muted }]}>MRP {mrp.valueKzt.toLocaleString('ru-RU')} ₸ · IPN standard deduction 30 MRP = {formatKzt(mrp.valueKzt * 30)} · ordinary sick-leave cap 25 MRP = {formatKzt(mrp.valueKzt * 25)}.</Text>}
            {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}

            {calculation && <View style={[styles.breakdown, { borderColor: palette.line }]}>
              <Text style={[styles.section, { color: palette.text }]}>Current estimate</Text>
              <Line label="Salary" value={calculation.salaryLine.amount} palette={palette} />
              <Line label="Transport" value={calculation.transportLine.amount} palette={palette} />
              <Line label="All paid hours" value={calculation.hourBaseLine.amount} palette={palette} />
              {calculation.hourSurchargeLines.filter((line) => line.amount > 0).map((line) => <Line key={line.label} label={line.label} value={line.amount} palette={palette} />)}
              <Line label="Night" value={calculation.nightLine.amount} palette={palette} />
              <Line label="Sector supplements" value={calculation.sectorLines.reduce((sum, line) => sum + line.amount, 0)} palette={palette} />
              {calculation.deadheadLine.amount > 0 && <Line label="Deadhead" value={calculation.deadheadLine.amount} palette={palette} />}
              {calculation.sickLine.amount > 0 && <Line label={calculation.sickCapped ? 'Sick leave · capped at 25 MRP' : 'Sick leave'} value={calculation.sickLine.amount} palette={palette} />}
              <Line label="Gross" value={calculation.gross} strong palette={palette} />
              <Line label="OSMS" value={-calculation.osms} palette={palette} />
              <Line label="OPV" value={-calculation.opv} palette={palette} />
              <Line label="IPN" value={-calculation.ipn} palette={palette} />
              <Line label="Net" value={calculation.net} strong palette={palette} />
            </View>}
          </ScrollView>

          <Pressable onPress={save} style={[styles.save, { backgroundColor: palette.accent }]}><Text style={styles.saveText}>Save salary settings</Text></Pressable>
        </View>
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

function perDiemSubline(result: ReturnType<typeof calculatePerDiemMonth>, fx?: UsdKztSnapshot): string {
  const paid = result.items.filter((item) => item.eligible).length;
  const unresolved = result.unresolvedStations.length;
  const rate = fx ? ` · USD/KZT ${fx.usdKzt.toFixed(2)}` : '';
  return `${paid} qualifying layover${paid === 1 ? '' : 's'}${unresolved ? ` · ${unresolved} unresolved` : ''}${rate}`;
}

function perDiemItemAmount(item: ReturnType<typeof calculatePerDiemMonth>['items'][number]): string {
  if (item.needsClassification) return 'Check';
  if (!item.eligible) return '—';
  if (item.region === 'KZ') return formatKzt(item.kztAmount);
  return formatUsd(item.usdAmount);
}

function regionLabel(region: ReturnType<typeof calculatePerDiemMonth>['items'][number]['region']): string {
  if (region === 'KZ') return 'Kazakhstan';
  if (region === 'EU_UK') return 'EU / UK';
  if (region === 'ASIA') return 'Asia';
  return 'Unclassified';
}

function shortDate(value: string): string {
  const [date] = value.split('T');
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}

function Field({ label, value, onChange, palette }: { label: string; value: string; onChange: (value: string) => void; palette: Palette }) {
  return <View style={styles.field}>
    <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, ''))}
      keyboardType="decimal-pad"
      placeholder="—"
      placeholderTextColor={palette.muted}
      style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.line }]}
    />
  </View>;
}

function Line({ label, value, strong, palette }: { label: string; value: number; strong?: boolean; palette: Palette }) {
  return <View style={styles.line}><Text style={[styles.lineText, strong && styles.strong, { color: palette.text }]}>{label}</Text><Text style={[styles.lineText, strong && styles.strong, { color: palette.text }]}>{value < 0 ? '−' : ''}{formatKzt(Math.abs(value))}</Text></View>;
}

function emptyDraft(): Draft {
  return { hourlyRate: '', monthlySalary: '', monthlyTransport: '', paidHours: '', deadheadHours: '', sickEarnings12m: '', sickWorkedHours12m: '', sickMissedHours: '' };
}
function draftFrom(profile?: Partial<PayProfile>, month?: PayMonthOverrides): Draft {
  return {
    hourlyRate: inputValue(profile?.hourlyRate),
    monthlySalary: inputValue(profile?.monthlySalary),
    monthlyTransport: inputValue(profile?.monthlyTransport),
    paidHours: inputValue(month?.paidHours),
    deadheadHours: inputValue(month?.deadheadHours),
    sickEarnings12m: inputValue(month?.sickEarnings12m),
    sickWorkedHours12m: inputValue(month?.sickWorkedHours12m),
    sickMissedHours: inputValue(month?.sickMissedHours),
  };
}
function inputValue(value: number | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''; }
function numberFrom(value: string): number { return Number(value.replace(',', '.')); }
function optionalNumberFrom(value: string): number | undefined { if (!value.trim()) return undefined; const result = numberFrom(value); return Number.isFinite(result) ? result : undefined; }
function formatRosterBlock(minutes?: number): string { if (minutes === undefined) return '—'; return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  value: { fontSize: 23, fontWeight: '700', marginTop: 5 },
  salaryValue: { fontSize: 21, fontWeight: '700', marginTop: 4 },
  meta: { fontSize: 12, lineHeight: 17 },
  openGlyph: { fontSize: 30, fontWeight: '300', paddingLeft: 10 },
  compactDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.48)', justifyContent: 'flex-end' },
  sheet: { height: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
  sheetTitle: { fontSize: 25, fontWeight: '700', letterSpacing: -.5 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 27, lineHeight: 30 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 22 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 15, marginBottom: 8 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginTop: 18, marginBottom: 2 },
  perDiemSummary: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 8 },
  perDiemTotal: { fontSize: 24, fontWeight: '700', marginTop: 5, marginBottom: 2 },
  perDiemItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11 },
  perDiemStation: { fontSize: 17, fontWeight: '700' },
  perDiemAmount: { fontSize: 14, fontWeight: '700', marginLeft: 12 },
  field: { marginBottom: 9 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { height: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 10 },
  facts: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 4, marginTop: 8, marginBottom: 10 },
  factTitle: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 12, fontWeight: '600', marginVertical: 8 },
  breakdown: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5 },
  lineText: { fontSize: 12 },
  strong: { fontWeight: '800' },
  save: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
