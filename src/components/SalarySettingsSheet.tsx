import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { PayMonthOverrides, PayProfile } from '@/src/domain/pay';
import { loadPayMonth, loadPayProfile, savePayMonth, savePayProfile } from '@/src/storage/payStorage';
import { SwipeSurface } from './SwipeSurface';

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

export function SalarySettingsSheet({ visible, roster, palette, onClose, onSaved }: { visible: boolean; roster?: ParsedAirAstanaRoster; palette: Palette; onClose: () => void; onSaved: () => void }) {
  const monthKey = roster?.period.start.slice(0, 7);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setDraft(draftFrom(loadPayProfile(), monthKey ? loadPayMonth(monthKey) : undefined));
    setError(undefined);
  }, [visible, monthKey]);

  const save = () => {
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
        sickEarnings12m: optionalNumberFrom(draft.sickEarnings12m),
        sickWorkedHours12m: optionalNumberFrom(draft.sickWorkedHours12m),
        sickMissedHours: optionalNumberFrom(draft.sickMissedHours),
      };
      savePayMonth(monthKey, overrides);
    }
    onSaved();
    onClose();
  };

  const sickDays = roster?.absences?.filter((item) => item.code === 'SICK').length ?? 0;
  const deadheadSectors = roster?.sectors.filter((item) => item.deadhead).length ?? 0;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <SwipeSurface style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.line }]} onSwipeDown={onClose}>
        <View style={[styles.handle, { backgroundColor: palette.line }]} />
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={[styles.title, { color: palette.text }]}>Salary settings</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>Optional · stored only on this device</Text>
          </View>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: palette.surface }]}><Text style={[styles.closeText, { color: palette.text }]}>×</Text></Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Hourly rate · ₸" value={draft.hourlyRate} onChange={(v) => setDraft((d) => ({ ...d, hourlyRate: v }))} palette={palette} />
          <Field label="Full monthly salary · ₸" value={draft.monthlySalary} onChange={(v) => setDraft((d) => ({ ...d, monthlySalary: v }))} palette={palette} />
          <Field label="Transport allowance · ₸" value={draft.monthlyTransport} onChange={(v) => setDraft((d) => ({ ...d, monthlyTransport: v }))} palette={palette} />

          {roster && <>
            <Text style={[styles.section, { color: palette.text }]}>Current month overrides</Text>
            <Field label="Paid hours override · optional" value={draft.paidHours} onChange={(v) => setDraft((d) => ({ ...d, paidHours: v }))} palette={palette} />
            {deadheadSectors > 0 && <Field label="Deadhead paid hours" value={draft.deadheadHours} onChange={(v) => setDraft((d) => ({ ...d, deadheadHours: v }))} palette={palette} />}
            {sickDays > 0 && <>
              <Text style={[styles.meta, { color: palette.muted }]}>For sick leave, Kazakhstan average-pay inputs can be entered when the 12-month history is available.</Text>
              <Field label="Included earnings · preceding 12 months" value={draft.sickEarnings12m} onChange={(v) => setDraft((d) => ({ ...d, sickEarnings12m: v }))} palette={palette} />
              <Field label="Worked hours · same 12 months" value={draft.sickWorkedHours12m} onChange={(v) => setDraft((d) => ({ ...d, sickWorkedHours12m: v }))} palette={palette} />
              <Field label="Scheduled hours missed" value={draft.sickMissedHours} onChange={(v) => setDraft((d) => ({ ...d, sickMissedHours: v }))} palette={palette} />
            </>}
          </>}
          {error && <Text style={[styles.error, { color: palette.rose }]}>{error}</Text>}
        </ScrollView>
        <Pressable onPress={save} style={[styles.save, { backgroundColor: palette.accent }]}><Text style={styles.saveText}>Save settings</Text></Pressable>
      </SwipeSurface>
    </View>
  </Modal>;
}

function Field({ label, value, onChange, palette }: { label: string; value: string; onChange: (value: string) => void; palette: Palette }) {
  return <View style={styles.field}>
    <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
    <TextInput value={value} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.line }]} />
  </View>;
}
function emptyDraft(): Draft { return { hourlyRate: '', monthlySalary: '', monthlyTransport: '', paidHours: '', deadheadHours: '', sickEarnings12m: '', sickWorkedHours12m: '', sickMissedHours: '' }; }
function draftFrom(profile?: Partial<PayProfile>, month?: PayMonthOverrides): Draft {
  const show = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return { hourlyRate: show(profile?.hourlyRate), monthlySalary: show(profile?.monthlySalary), monthlyTransport: show(profile?.monthlyTransport), paidHours: show(month?.paidHours), deadheadHours: show(month?.deadheadHours), sickEarnings12m: show(month?.sickEarnings12m), sickWorkedHours12m: show(month?.sickWorkedHours12m), sickMissedHours: show(month?.sickMissedHours) };
}
function numberFrom(value: string): number { return Number(value.replace(',', '.')); }
function optionalNumberFrom(value: string): number | undefined { if (!value.trim()) return undefined; const n = numberFrom(value); return Number.isFinite(n) ? n : undefined; }

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.48)', justifyContent: 'flex-end' },
  sheet: { height: '86%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, grow: { flex: 1 },
  title: { fontSize: 25, fontWeight: '700' }, meta: { fontSize: 12, lineHeight: 17 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 27 },
  scroll: { flex: 1 }, content: { paddingBottom: 22 }, section: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  field: { marginBottom: 10 }, label: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { height: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16 },
  error: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  save: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, saveText: { color: '#fff', fontWeight: '700' },
});
