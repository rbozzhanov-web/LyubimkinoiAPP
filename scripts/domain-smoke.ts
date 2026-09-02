import { calculatePerDiemStay, classifyPerDiemStation, kazakhstanQualifyingUtcDays } from '../src/domain/perDiem';
import { calculateRosterPay } from '../src/domain/pay';
import type { StationStay } from '../src/domain/layovers';
import type { ParsedAirAstanaRoster } from '../src/import/parseAirAstanaRoster';

const MRP_2026 = 4325;

function equal<T>(actual: T, expected: T, label?: string): void {
  if (Object.is(actual, expected)) return;
  throw new Error(`${label ?? 'assertion failed'}: expected ${String(expected)}, got ${String(actual)}`);
}

function stay(station: string, arrivalLocal: string, departureLocal: string, durationMinutes: number): StationStay {
  return {
    station,
    arrivalLocal,
    departureLocal,
    durationMinutes,
    arrivalFlight: '100',
    departureFlight: '101',
    crossMonth: false,
  };
}

// Confirmed Kazakhstan examples: UTC midnight splits the presence interval, and only UTC-day
// portions strictly longer than six hours qualify.
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-07T06:09', '2026-07-07T19:22', 793)), 1, 'NQZ same UTC day');
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-08T01:35', '2026-07-08T23:09', 1294)), 1, 'NQZ crossing UTC midnight');
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-09T05:00', '2026-07-09T11:00', 360)), 0, 'exactly six hours is not enough');

const kz = calculatePerDiemStay(stay('NQZ', '2026-07-07T06:09', '2026-07-07T19:22', 793), MRP_2026);
equal(kz.kztAmount, 3 * MRP_2026, 'KZ per diem = 3 MRP');
equal(kz.units, 1, 'KZ unit');

// Foreign per diem is one unit per qualifying relay, even when the stay is longer than 24h.
const cxr = calculatePerDiemStay(stay('CXR', '2026-07-09T09:03', '2026-07-10T09:41', 1478), MRP_2026);
equal(cxr.units, 1, 'CXR one relay unit');
equal(cxr.usdAmount, 50, 'CXR Asia rate');
equal(classifyPerDiemStation('IST'), 'ASIA', 'Turkey is Asia');
equal(classifyPerDiemStation('AYT'), 'ASIA', 'Turkey is Asia');
equal(calculatePerDiemStay(stay('LHR', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 60, 'UK rate');

// Anonymous salary example locks the confirmed cabin-crew tariff bands without storing anyone's
// personal salary or payslip data in the repository.
const roster: ParsedAirAstanaRoster = {
  period: { start: '2026-07-01', end: '2026-07-31' },
  totals: { blockMinutes: 0, nightMinutes: 0 },
  sectors: Array.from({ length: 20 }, (_, index) => ({
    flightNumber: String(100 + index),
    date: `2026-07-${String((index % 20) + 1).padStart(2, '0')}`,
    departureAirport: 'ALA',
    arrivalAirport: 'NQZ',
    timeOut: '10:00',
    timeIn: '12:00',
    deadhead: false,
    actualTimes: true,
    dutyIndex: index,
    dutySectorIndex: 1,
  })),
  duties: [],
  crewRecords: [],
  absences: [],
  unreadCells: [],
};

const pay = calculateRosterPay(
  roster,
  { hourlyRate: 1000, monthlySalary: 100000, monthlyTransport: 10000 },
  { paidHours: 85 },
  MRP_2026,
);
equal(pay.hourBaseLine.amount, 85000, 'base paid hours');
equal(pay.hourSurchargeLines[0].amount, 20000, '60–80 top-up');
equal(pay.hourSurchargeLines[1].amount, 7500, '>80 top-up');
equal(pay.nightLine.amount, 21250, 'night supplement');
equal(pay.sectorLines.reduce((sum, line) => sum + line.amount, 0), 16000, 'sector supplement');
equal(pay.gross, 259750, 'gross');
equal(pay.net, 218697, 'net');

console.log('Domain smoke tests passed');
