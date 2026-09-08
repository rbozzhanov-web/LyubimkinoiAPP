import type { PayMonthOverrides, PayProfile } from '@/src/domain/pay';
import { savePayMonth, savePayProfile } from './payStorage';

// This preset is activated only after the Loved One code is entered. It is intentionally
// separate from the generic app defaults so other users start with editable blank settings.
const SPECIAL_PAY_PROFILE: PayProfile = {
  hourlyRate: 3100,
  monthlySalary: 164317,
  monthlyTransport: 78000,
};

const SPECIAL_MONTH_OVERRIDES: Record<string, PayMonthOverrides> = {
  // Known factual July payroll values supplied with the payslip. Sick pay is kept as the
  // issued payslip amount until enough 12-month history exists to calculate it independently.
  // Deadhead hours are derived automatically from the roster in Special Mode.
  '2026-07': {
    paidHours: 95.43,
    sickAmountOverride: 73214.34,
  },
  // Known factual August payroll values supplied with the payslip. Vacation pay for the one
  // day off (23 Aug) is an average-earnings figure the roster cannot derive on its own.
  '2026-08': {
    vacationAmountOverride: 24368.33,
  },
};

export function activateSpecialPayPreset(): void {
  savePayProfile(SPECIAL_PAY_PROFILE);
  Object.entries(SPECIAL_MONTH_OVERRIDES).forEach(([monthKey, overrides]) => savePayMonth(monthKey, overrides));
}
