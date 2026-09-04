import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { PayMonthOverrides, PayProfile } from '@/src/domain/pay';
import { loadPayMonth, loadPayProfile, savePayMonth, savePayProfile } from '@/src/storage/payStorage';
import { IOSSheet } from './IOSOverlay';

type Palette = Record<'background'|'surface'|'surfaceStrong'|'text'|'muted'|'line'|'accent'|'accentSoft'|'rose'|'aqua', string> & { sheetGlass?: any };

type Draft = {
  hourlyRate: string;
  monthlySalary: string;
  monthlyTransport: string;
  paidHours: string;
  deadheadHours: string;
  vacationAmount: string;
  holidayHours: string;
  officialDayOffHours: string;
  sickEarnings12m: string;
  sickWorkedHours12m: string;
  sickMissedHours: string;
};

export function SalarySettingsSheet({ visible, roster, palette, onClose, onSaved }: { visible: boolean; roster?: ParsedAirAstanaRoster; palette: Palette; onClose: () => void; onSaved: () => void }) {
  const monthKey = roster?.period.start.slice(0, 7);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string>();
  const [scrollAtTop, setScrollAtTop] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setDraft(draftFrom(loadPayProfile(), monthKey ? loadPayMonth(monthKey) : undefined));
    setError(undefined);
    setScrollAtTop(true);
  }, [visible, monthKey]);

  const save = (dismiss: () => void) => {
    const hourlyRate = numberFrom(draft.hourlyRate);
    const monthlySalary = numberFrom(draft.monthlySalary);
    const monthlyTransport = numberFrom(draft.monthlyTransport);
    if (!(hourlyRate > 0) || !(monthlySalary > 0) || !(monthlyTransport >= 0)) {
      setError('Enter hourly rate, monthly salary and transport allowance.');
      return;
    }
    const profile: PayProfile = { hourlyRate, monthlySalary, monthlyTransport };
    savePayProfile(profile);
    if (monthKey) {
      const current = loadPayMonth(monthKey) ?? {};
      const overrides: PayMonthOverrides = {
        ...current,
        paidHours: optionalNumberFrom(draft.paidHours),
        deadheadHours: optionalNumberFrom(draft.deadheadHours),
        vacationAmountOverride: optionalNumberFrom(draft.vacationAmount),
        holidayHours: optionalNumberFrom(draft.holidayHours),
        officialDayOffHours: optionalNumberFrom(draft.officialDayOffHours),
        sickEarnings12m: optionalNumberFrom(draft.sickEarnings12m),
        sickWorkedHours12m: optionalNumberFrom(draft.sickWorkedHours12m),
        sickMissedHours: optionalNumberFrom(draft.sickMissedHours),
      };
      savePayMonth(monthKey, overrides);
    }
    onSaved();
    dismiss();
  };

  const sickDays = roster?.absences?.filter((item) => item.code === 'SICK').length ?? 0;
  const vacationDays = roster?.absences?.filter((item) => item.code === 'VAC').length ?? 0;
  const deadheadSectors = roster?.sectors.filter((item) => item.deadhead).length ?? 0;

  return <IOSSheet
    visible={visible}
    onClose={onClose}
    handleColor={palette.line}
    scrollAtTop={scrollAtTop}
    style={[styles.sheet, palette.sheetGlass, { backgroundColor: palette.background, borderColor: palette.line }]}
  >
    {(dismiss) => <>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={[styles.title, { color: palette.text }]}>Salary settings</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>Optional · stored only on this device</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => setScrollAtTop(event.nativeEvent.contentOffset.y <= 1)}
      >
        <Field label="Hourly rate · ₸" value={draft.hourlyRate} onChange={(v) => setDraft((d) => ({ ...d, hourlyRate: v }))} palette={palette} />
        <Field label="Full monthly salary · ₸" value={draft.monthlySalary} onChange={(v) => setDraft((d) => ({ ...d, monthlySalary: v }))} palette={palette} />
        <Field label="Transport allowance · ₸" value={draft.monthlyTransport} onChange={(v) => setDraft((d) => ({ ...d, monthlyTransport: v }))} palette={palette} />

        {roster && <>
          <Text style={[styles.section, { color: palette.text }]}>Current month overrides</Text>
          <Field label="Paid hours override · optional" value={draft.paidHours} onChange={(v) => setDraft((d) => ({ ...d, paidHours: v }))} palette={palette} />
          {deadheadSectors > 0 && <Field label="Deadhead paid hours" value={draft.deadheadHours} onChange={(v) => setDraft((d) => ({ ...d, deadheadHours: v }))} palette={palette} />}
          {vacationDays > 0 && <>
            <Text style={[styles.meta, { color: palette.muted }]}>{vacationDays} vacation day{vacationDays === 1 ? '' : 's'} this month. Vacation pay is an average-earnings figure the roster cannot derive — copy it from the payslip.</Text>
            <Field label="Vacation pay · ₸" value={draft.vacationAmount} onChange={(v) => setDraft((d) => ({ ...d, vacationAmount: v }))} palette={palette} />
          </>}
          <Text style={[styles.meta, { color: palette.muted }]}>The roster does not mark public holidays. Enter these only if the payslip shows them.</Text>
          <Field label="Hours flown on a public holiday" value={draft.holidayHours} onChange={(v) => setDraft((d) => ({ ...d, holidayHours: v }))} palette={palette} />
          <Field label="Hours flown on an official day off" value={draft.officialDayOffHours} onChange={(v) => setDraft((d) => ({ ...d, officialDayOffHours: v }))} palette={palette} />
          {sickDays > 0 && <>
            <Text style={[styles.meta, { color: palette.muted }]}>For sick leave, Kazakhstan average-pay inputs can be entered when the 12-month history is available.</Text>
            <Field label="Included earnings · preceding 12 months" value={draft.sickEarnings12m} onChange={(v) => setDraft((d) => ({ ...d, sickEarnings12m: v }))} palette={palette} />
            <Field label="Worked hours · same 12 months" value={draft.sickWorkedHours12m} onChange={(v) => setDraft((d) => ({ ...d, sickWorkedHours12m: v }))} palette={palette} />
            <Field label="Scheduled hours missed" value={draft.sickMissedHours} onChange={(v) => setDraft((d) => ({ ...d, sickMissedHours: v }))} palette={palette} />
          </>}
        </>}
        {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}
      </ScrollView>
      <Pressable onPress={() => save(dismiss)} style={[styles.save, { backgroundColor: palette.accent }]}><Text style={styles.saveText}>Save settings</Text></Pressable>
    </>}
  </IOSSheet>;
}

function Field({ label, value, onChange, palette }: { label: string; value: string; onChange: (value: string) => void; palette: Palette }) {
  return <View style={styles.field}>
    <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
    <TextInput value={value} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.line }]} />
  </View>;
}
function emptyDraft(): Draft { return { hourlyRate: '', monthlySalary: '', monthlyTransport: '', paidHours: '', deadheadHours: '', vacationAmount: '', holidayHours: '', officialDayOffHours: '', sickEarnings12m: '', sickWorkedHours12m: '', sickMissedHours: '' }; }
function draftFrom(profile?: Partial<PayProfile>, month?: PayMonthOverrides): Draft {
  const show = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return { hourlyRate: show(profile?.hourlyRate), monthlySalary: show(profile?.monthlySalary), monthlyTransport: show(profile?.monthlyTransport), paidHours: show(month?.paidHours), deadheadHours: show(month?.deadheadHours), vacationAmount: show(month?.vacationAmountOverride), holidayHours: show(month?.holidayHours), officialDayOffHours: show(month?.officialDayOffHours), sickEarnings12m: show(month?.sickEarnings12m), sickWorkedHours12m: show(month?.sickWorkedHours12m), sickMissedHours: show(month?.sickMissedHours) };
}
function numberFrom(value: string): number { return Number(value.replace(',', '.')); }
function optionalNumberFrom(value: string): number | undefined { if (!value.trim()) return undefined; const n = numberFrom(value); return Number.isFinite(n) ? n : undefined; }

const styles = StyleSheet.create({
  sheet: {
    height: '88%',
    maxWidth: 620,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, grow: { flex: 1 },
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.4 }, meta: { fontSize: 12, lineHeight: 17 },
  scroll: { flex: 1 }, content: { paddingBottom: 22 }, section: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  field: { marginBottom: 10 }, label: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { height: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 13, fontSize: 16 },
  error: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  save: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, saveText: { color: '#fff', fontWeight: '700' },
});