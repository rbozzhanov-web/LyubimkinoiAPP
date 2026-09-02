import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';

export interface PayProfile {
  hourlyRate: number;
  monthlySalary: number;
  monthlyTransport: number;
}

export interface PayMonthOverrides {
  /** Payroll/CrewPay Norm hours as a true decimal, e.g. 95.43. */
  paidHours?: number;
  /** Positioning/deadhead paid hours as a true decimal. */
  deadheadHours?: number;
  /** Sick-leave amount per certified sick day for this month. */
  sickDailyRate?: number;
}

export interface PayLine {
  label: string;
  units: number;
  multiplier: number;
  amount: number;
}

export interface PayCalculation {
  paidDays: number;
  daysInMonth: number;
  sickDays: number;
  unfitDays: number;
  operatingSectors: number;
  deadheadSectors: number;
  paidHours: number;
  nightHours: number;
  salaryLine: PayLine;
  transportLine: PayLine;
  sickLine: PayLine;
  hourBaseLine: PayLine;
  hourSurchargeLines: PayLine[];
  nightLine: PayLine;
  sectorLines: PayLine[];
  deadheadLine: PayLine;
  gross: number;
  osms: number;
  opv: number;
  ipnStandardDeduction: number;
  ipn: number;
  totalDeductions: number;
  net: number;
}

export interface PayReadiness {
  ready: boolean;
  missing: string[];
}

// Structural payroll rules from the supplied cabin-crew calculation and payslip.
// Personal amounts (salary, hourly rate, transport and sick rate) are intentionally NOT here.
export const PAYROLL_RULES = {
  hourBands: [
    { upTo: 60, effectiveMultiplier: 1 },
    { upTo: 80, effectiveMultiplier: 2 },
    { upTo: Number.POSITIVE_INFINITY, effectiveMultiplier: 2.5 },
  ],
  sectorBands: [
    { from: 1, to: 15, multiplier: 0 },
    { from: 16, to: 19, multiplier: 3 },
    { from: 20, to: 24, multiplier: 4 },
    { from: 25, to: 30, multiplier: 5 },
    { from: 31, to: Number.POSITIVE_INFINITY, multiplier: 6 },
  ],
  nightHoursShare: 0.5,
  nightPayMultiplier: 0.5,
  deadheadMultiplier: 0.5,
  osmsRate: 0.02,
  opvRate: 0.1,
  ipnRate: 0.1,
  ipnDeductionMrpMultiplier: 30,
} as const;

export function payReadiness(
  roster: ParsedAirAstanaRoster,
  profile: Partial<PayProfile> | undefined,
  overrides: PayMonthOverrides | undefined,
): PayReadiness {
  const missing: string[] = [];
  if (!positive(profile?.hourlyRate)) missing.push('hourly rate');
  if (!positive(profile?.monthlySalary)) missing.push('monthly salary');
  if (!nonNegative(profile?.monthlyTransport)) missing.push('transport allowance');
  if (!positive(overrides?.paidHours)) missing.push('payroll / CrewPay Norm hours');

  const deadheadSectors = roster.sectors.filter((sector) => sector.deadhead).length;
  if (deadheadSectors > 0 && !nonNegative(overrides?.deadheadHours)) missing.push('deadhead hours');

  const sickDays = (roster.absences ?? []).filter((absence) => absence.code === 'SICK').length;
  if (sickDays > 0 && !nonNegative(overrides?.sickDailyRate)) missing.push('sick daily rate');

  return { ready: missing.length === 0, missing };
}

export function calculateRosterPay(
  roster: ParsedAirAstanaRoster,
  profile: PayProfile,
  overrides: PayMonthOverrides,
  mrpKzt: number,
): PayCalculation {
  const readiness = payReadiness(roster, profile, overrides);
  if (!readiness.ready) throw new Error(`Payroll setup incomplete: ${readiness.missing.join(', ')}`);

  const rate = profile.hourlyRate;
  const paidHours = round2(overrides.paidHours ?? 0);
  const deadheadHours = round2(overrides.deadheadHours ?? 0);
  const absences = roster.absences ?? [];
  const sickDays = absences.filter((absence) => absence.code === 'SICK').length;
  const unfitDays = absences.filter((absence) => absence.code === 'UFF').length;
  const daysInMonth = daysInCalendarMonth(roster.period.start.slice(0, 7));
  const paidDays = Math.max(daysInMonth - sickDays - unfitDays, 0);
  const attendanceShare = paidDays / daysInMonth;
  const operatingSectors = roster.sectors.filter((sector) => !sector.deadhead).length;
  const deadheadSectors = roster.sectors.filter((sector) => sector.deadhead).length;

  const salaryLine: PayLine = {
    label: 'Salary', units: paidDays, multiplier: attendanceShare,
    amount: round0(profile.monthlySalary * attendanceShare),
  };
  const transportLine: PayLine = {
    label: 'Transport', units: paidDays, multiplier: attendanceShare,
    amount: round2(profile.monthlyTransport * attendanceShare),
  };
  const sickLine: PayLine = {
    label: 'Sick leave', units: sickDays, multiplier: overrides.sickDailyRate ?? 0,
    amount: round2(sickDays * (overrides.sickDailyRate ?? 0)),
  };

  const firstBandMultiplier = PAYROLL_RULES.hourBands[0].effectiveMultiplier;
  const hourBaseLine: PayLine = {
    label: 'All paid hours', units: paidHours, multiplier: firstBandMultiplier,
    amount: round0(paidHours * rate * firstBandMultiplier),
  };
  const hours60to80 = Math.min(Math.max(paidHours - 60, 0), 20);
  const hoursOver80 = Math.max(paidHours - 80, 0);
  const hourSurchargeLines: PayLine[] = [
    {
      label: '60–80 h top-up', units: round2(hours60to80), multiplier: 1,
      amount: round0(hours60to80 * rate),
    },
    {
      label: 'Over 80 h top-up', units: round2(hoursOver80), multiplier: 1.5,
      amount: round0(hoursOver80 * rate * 1.5),
    },
  ];

  const nightHours = paidHours * PAYROLL_RULES.nightHoursShare;
  const nightLine: PayLine = {
    label: 'Night hours', units: nightHours, multiplier: PAYROLL_RULES.nightPayMultiplier,
    amount: round0(nightHours * rate * PAYROLL_RULES.nightPayMultiplier),
  };

  const sectorLines = PAYROLL_RULES.sectorBands.map((band) => {
    const units = unitsInBand(operatingSectors, band.from, band.to);
    return {
      label: band.to === Number.POSITIVE_INFINITY ? `${band.from}+ sectors` : `${band.from}–${band.to} sectors`,
      units,
      multiplier: band.multiplier,
      amount: round0(units * rate * band.multiplier),
    };
  });

  const deadheadLine: PayLine = {
    label: 'Deadhead', units: deadheadHours, multiplier: PAYROLL_RULES.deadheadMultiplier,
    amount: round0(deadheadHours * rate * PAYROLL_RULES.deadheadMultiplier),
  };

  const gross = round2(
    salaryLine.amount + transportLine.amount + sickLine.amount + hourBaseLine.amount +
    hourSurchargeLines.reduce((sum, line) => sum + line.amount, 0) + nightLine.amount +
    sectorLines.reduce((sum, line) => sum + line.amount, 0) + deadheadLine.amount,
  );

  const osms = round0(gross * PAYROLL_RULES.osmsRate);
  const opv = round2(gross * PAYROLL_RULES.opvRate);
  const ipnStandardDeduction = round0(mrpKzt * PAYROLL_RULES.ipnDeductionMrpMultiplier);
  const ipnBase = Math.max(gross - osms - opv - ipnStandardDeduction, 0);
  const ipn = round0(ipnBase * PAYROLL_RULES.ipnRate);
  const totalDeductions = round2(osms + opv + ipn);

  return {
    paidDays, daysInMonth, sickDays, unfitDays, operatingSectors, deadheadSectors,
    paidHours, nightHours, salaryLine, transportLine, sickLine, hourBaseLine,
    hourSurchargeLines, nightLine, sectorLines, deadheadLine, gross, osms, opv,
    ipnStandardDeduction, ipn, totalDeductions, net: round2(gross - totalDeductions),
  };
}

function unitsInBand(quantity: number, from: number, to: number): number {
  if (quantity < from) return 0;
  return Math.max(Math.min(quantity, to) - from + 1, 0);
}

function daysInCalendarMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function round0(value: number) { return Math.round(value); }
function round2(value: number) { return Math.round(value * 100) / 100; }
function positive(value: number | undefined): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function nonNegative(value: number | undefined): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }

export function formatKzt(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₸`;
}
