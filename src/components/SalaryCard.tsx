import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import { calculateRosterPay, formatKzt, payReadiness, type PayMonthOverrides, type PayProfile } from '@/src/domain/pay';
import { resolveMrp, type MrpSnapshot } from '@/src/domain/mrp';
import { loadPayMonth, loadPayProfile, savePayMonth, savePayProfile } from '@/src/storage/payStorage';

type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string>;

type Draft = {
  hourlyRate: string;
  monthlySalary: string;
  monthlyTransport: string;
  paidHours: string;
  deadheadHours: string;
  sickDailyRate: string;
};

export function SalaryCard({ roster, palette }: { roster: ParsedAirAstanaRoster; palette: Palette }) {
  const monthKey = roster.period.start.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Partial<PayProfile>>();
  const [month, setMonth] = useState<PayMonthOverrides>();
  const [mrp, setMrp] = useState<MrpSnapshot>();
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
      sickDailyRate: optionalNumberFrom(draft.sickDailyRate),
    };

    if (!(nextProfile.hourlyRate > 0) || !(nextProfile.monthlySalary > 0) || !(nextProfile.monthlyTransport >= 0)) {
      setError('Fill hourly rate, monthly salary and transport allowance.');
      return;
    }
    if (!(nextMonth.paidHours && nextMonth.paidHours > 0)) {
      setError('Enter payroll / CrewPay Norm hours for this month.');
      return;
    }
    if (deadheadSectors > 0 && !(typeof nextMonth.deadheadHours === 'number' && nextMonth.deadheadHours >= 0)) {
      setError('This roster has deadhead. Enter its paid hours.');
      return;
    }
    if (sickDays > 0 && !(typeof nextMonth.sickDailyRate === 'number' && nextMonth.sickDailyRate >= 0)) {
      setError('This roster has sick days. Enter the sick daily rate for this month.');
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
      accessibilityLabel="Salary estimate settings"
    >
      <View style={styles.headerRow}>
        <View style={styles.grow}>
          <Text style={[styles.label, { color: palette.muted }]}>SALARY ESTIMATE</Text>
          <Text style={[styles.value, { color: palette.text }]}>{calculation ? formatKzt(calculation.net) : 'Set up'}</Text>
        </View>
        <Text style={[styles.openGlyph, { color: palette.accent }]}>›</Text>
      </View>
      {calculation
        ? <Text style={[styles.meta, { color: palette.muted }]}>Gross {formatKzt(calculation.gross)} · {calculation.paidHours.toFixed(2)} paid h · {calculation.operatingSectors} sectors</Text>
        : <Text style={[styles.meta, { color: palette.muted }]}>{readiness.missing.length ? `Needs: ${readiness.missing.join(', ')}` : 'Waiting for annual MRP.'}</Text>}
    </Pressable>

    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.line }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.grow}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Salary estimate</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{monthKey} · stored only on this device</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={[styles.close, { backgroundColor: palette.surface }]}><Text style={[styles.closeText, { color: palette.text }]}>×</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.section, { color: palette.text }]}>Personal rates</Text>
            <Field label="Hourly rate · ₸" value={draft.hourlyRate} onChange={(value) => setDraft((old) => ({ ...old, hourlyRate: value }))} palette={palette} />
            <Field label="Full monthly salary · ₸" value={draft.monthlySalary} onChange={(value) => setDraft((old) => ({ ...old, monthlySalary: value }))} palette={palette} />
            <Field label="Full monthly transport · ₸" value={draft.monthlyTransport} onChange={(value) => setDraft((old) => ({ ...old, monthlyTransport: value }))} palette={palette} />

            <Text style={[styles.section, { color: palette.text }]}>This month</Text>
            <Field label="Payroll / CrewPay Norm hours" value={draft.paidHours} onChange={(value) => setDraft((old) => ({ ...old, paidHours: value }))} palette={palette} />
            <Text style={[styles.hint, { color: palette.muted }]}>Roster reports {formatRosterBlock(roster.totals.blockMinutes)} actual block. Payroll hours can differ, so KhaVair does not silently substitute this value.</Text>
            {deadheadSectors > 0 && <Field label={`Deadhead paid hours · ${deadheadSectors} sector${deadheadSectors === 1 ? '' : 's'} detected`} value={draft.deadheadHours} onChange={(value) => setDraft((old) => ({ ...old, deadheadHours: value }))} palette={palette} />}
            {sickDays > 0 && <Field label={`Sick daily rate · ${sickDays} day${sickDays === 1 ? '' : 's'} detected`} value={draft.sickDailyRate} onChange={(value) => setDraft((old) => ({ ...old, sickDailyRate: value }))} palette={palette} />}

            <View style={[styles.facts, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <Text style={[styles.factTitle, { color: palette.text }]}>From roster automatically</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{operatingSectors} operating sectors · {deadheadSectors} DHC · {sickDays} SICK · {unfitDays} UFF</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>Night pay = ½ paid hours × 0.5 rate. Sector bands: first 15 free, then ×3 / ×4 / ×5 / ×6. DHC = ×0.5.</Text>
            </View>

            {mrp && <Text style={[styles.hint, { color: palette.muted }]}>IPN standard deduction: 30 MRP = {formatKzt(mrp.valueKzt * 30)} · MRP {mrp.valueKzt.toLocaleString('ru-RU')} ₸.</Text>}
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
              {calculation.sickLine.amount > 0 && <Line label="Sick leave" value={calculation.sickLine.amount} palette={palette} />}
              <Line label="Gross" value={calculation.gross} strong palette={palette} />
              <Line label="OSMS" value={-calculation.osms} palette={palette} />
              <Line label="OPV" value={-calculation.opv} palette={palette} />
              <Line label="IPN" value={-calculation.ipn} palette={palette} />
              <Line label="Net" value={calculation.net} strong palette={palette} />
            </View>}
          </ScrollView>

          <Pressable onPress={save} style={[styles.save, { backgroundColor: palette.accent }]}><Text style={styles.saveText}>Save on this device</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
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

function emptyDraft(): Draft { return { hourlyRate: '', monthlySalary: '', monthlyTransport: '', paidHours: '', deadheadHours: '', sickDailyRate: '' }; }
function draftFrom(profile?: Partial<PayProfile>, month?: PayMonthOverrides): Draft {
  return {
    hourlyRate: inputValue(profile?.hourlyRate),
    monthlySalary: inputValue(profile?.monthlySalary),
    monthlyTransport: inputValue(profile?.monthlyTransport),
    paidHours: inputValue(month?.paidHours),
    deadheadHours: inputValue(month?.deadheadHours),
    sickDailyRate: inputValue(month?.sickDailyRate),
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
  value: { fontSize: 27, fontWeight: '700', marginTop: 5 },
  meta: { fontSize: 12, lineHeight: 17 },
  openGlyph: { fontSize: 30, fontWeight: '300', paddingLeft: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.48)', justifyContent: 'flex-end' },
  sheet: { height: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
  sheetTitle: { fontSize: 25, fontWeight: '700', letterSpacing: -.5 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 27, lineHeight: 30 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 22 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 15, marginBottom: 8 },
  field: { marginBottom: 9 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { height: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16 },
  hint: { fontSize: 11, lineHeight: 16, marginBottom: 10 },
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
