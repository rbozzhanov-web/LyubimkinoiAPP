import { calculatePerDiemStay, classifyPerDiemStation, kazakhstanQualifyingUtcDays } from '../src/domain/perDiem';
import { calculateRosterPay } from '../src/domain/pay';
import type { StationStay } from '../src/domain/layovers';
import type { ParsedAirAstanaRoster } from '../src/import/parseAirAstanaRoster';
import { extractCrewRecords } from '../src/import/crew';
import { stationLocalDateTimeMs } from '../src/domain/stationTime';
import { clearLovedMode, loadLovedMode, saveLovedMode } from '../src/storage/lovedModeStorage';
import { swipeAxis } from '../src/domain/gesture';
import type { ExtractedPage, TextItem } from '../src/import/types';
import { readRoster } from '../src/import/duties';
import { isDayOffCode } from '../src/domain/rosterView';

const MRP_2026 = 4325;

function equal<T>(actual: T, expected: T, label?: string): void {
  if (Object.is(actual, expected)) return;
  throw new Error(`${label ?? 'assertion failed'}: expected ${String(expected)}, got ${String(actual)}`);
}

const modeValues = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => modeValues.get(key) ?? null,
    setItem: (key: string, value: string) => modeValues.set(key, value),
    removeItem: (key: string) => modeValues.delete(key),
  },
});
equal(loadLovedMode(), false, 'special mode starts disabled on this device');
saveLovedMode();
equal(loadLovedMode(), true, 'special mode survives an app relaunch on this device');
clearLovedMode();
equal(loadLovedMode(), false, 'turning special mode off clears its local activation');

equal(swipeAxis(48, 20, true, false), 'horizontal', 'dominant horizontal movement drags the screen layer');
equal(swipeAxis(16, 48, false, true), 'down', 'dominant downward movement drags the sheet layer');
equal(swipeAxis(20, 20, true, true), undefined, 'diagonal movement does not steal scroll gestures');

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

// Kazakhstan: every UTC calendar day with strictly more than six hours at station pays one unit.
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-07T06:09', '2026-07-07T19:22', 793)), 1, 'NQZ same UTC day');
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-08T01:35', '2026-07-08T23:09', 1294)), 1, 'NQZ crossing UTC midnight');
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-09T05:00', '2026-07-09T11:00', 360)), 0, 'exactly six hours is not enough');
equal(kazakhstanQualifyingUtcDays(stay('NQZ', '2026-07-08T01:35', '2026-07-09T18:00', 2425)), 2, 'two qualifying UTC days pay two units');

const kz = calculatePerDiemStay(stay('NQZ', '2026-07-08T01:35', '2026-07-09T18:00', 2425), MRP_2026);
equal(kz.kztAmount, 2 * 3 * MRP_2026, 'two KZ UTC days = two 3-MRP units');
equal(kz.units, 2, 'KZ multi-day units');
const kzOtherStation = calculatePerDiemStay(stay('SCO', '2026-07-01T10:00', '2026-07-01T18:00', 480), MRP_2026);
equal(kzOtherStation.units, 1, 'Kazakhstan station outside ALA qualifies');
equal(kzOtherStation.kztAmount, 3 * MRP_2026, 'Kazakhstan station uses 3 MRP');

// Foreign: every UTC calendar day with strictly more than two hours at station pays one regional unit.
// CXR 09:03 local to 09:41 next day covers >2h on both UTC dates, so it earns two $50 units.
const cxr = calculatePerDiemStay(stay('CXR', '2026-07-09T09:03', '2026-07-10T09:41', 1478), MRP_2026);
equal(cxr.units, 2, 'CXR two UTC-day units');
equal(cxr.usdAmount, 100, 'CXR two foreign rates');
equal(classifyPerDiemStation('IST'), 'FOREIGN_50', 'Turkey uses the $50 bucket');
equal(calculatePerDiemStay(stay('BUS', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 50, 'Georgia $50');
equal(calculatePerDiemStay(stay('DME', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 50, 'Russia $50');
equal(calculatePerDiemStay(stay('HRG', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 50, 'Egypt $50');
equal(calculatePerDiemStay(stay('TGD', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 50, 'non-EU Montenegro $50');
equal(calculatePerDiemStay(stay('HER', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 60, 'EU Greece $60');
equal(calculatePerDiemStay(stay('FRA', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 60, 'EU Germany $60');
equal(calculatePerDiemStay(stay('LHR', '2026-07-01T10:00', '2026-07-01T14:00', 240), MRP_2026).usdAmount, 60, 'UK $60');

// A relay spanning three local hours can still be unpaid when UTC midnight divides it into
// slices of no more than two hours. Exactly two hours in one UTC day is also not enough.
const splitForeign = calculatePerDiemStay(stay('IST', '2026-07-08T01:30', '2026-07-08T04:30', 180), MRP_2026);
equal(splitForeign.eligible, false, 'foreign slices of 1:30 each do not qualify');
equal(splitForeign.units, 0, 'unqualified foreign relay has no unit');
const exactTwoForeign = calculatePerDiemStay(stay('IST', '2026-07-08T03:00', '2026-07-08T05:00', 120), MRP_2026);
equal(exactTwoForeign.units, 0, 'exactly two UTC hours is not enough');

const qualifyingForeign = calculatePerDiemStay(stay('IST', '2026-07-08T01:30', '2026-07-08T05:30', 240), MRP_2026);
equal(qualifyingForeign.eligible, true, 'foreign UTC slice over two hours qualifies');
equal(qualifyingForeign.units, 1, 'one qualifying foreign UTC day pays once');
const twoDayForeign = calculatePerDiemStay(stay('IST', '2026-07-07T03:00', '2026-07-08T08:00', 1740), MRP_2026);
equal(twoDayForeign.units, 2, 'two qualifying foreign UTC days pay two units');
equal(twoDayForeign.usdAmount, 100, 'two $50 UTC-day units are combined in one stay payout');

// Other Crew often continues onto page 2 without repeating the table heading. This synthetic
// fixture locks the real August failure mode without storing any real employee data in the repo.
const text = (str: string, x: number, y: number): TextItem => ({ str, x, y, width: Math.max(8, str.length * 4) });
const crewPages: ExtractedPage[] = [
  {
    width: 600,
    height: 800,
    items: [
      text('Date', 20, 100), text('Duty', 130, 100), text('Details', 220, 100),
      text('06/08/2026', 20, 130), text('915', 130, 130),
      text('CP - 101 - TEST CAPTAIN | FJ - 202 - TEST CREW', 220, 130),
    ],
  },
  {
    width: 600,
    height: 800,
    items: [
      text('07/08/2026', 20, 60), text('916', 130, 60),
      text('CP - 303 - SECOND CAPTAIN | FY - 404 - SECOND CREW', 220, 60),
    ],
  },
];
const continuedCrew = extractCrewRecords(crewPages);
equal(continuedCrew.length, 2, 'crew table continues across pages');
equal(continuedCrew[1]?.flightNumber, '916', 'continued page flight');
equal(continuedCrew[1]?.members.length, 2, 'continued page crew members');

// Ground-duty codes (day off, standby, sick, ...) are read from the same grid cells as
// flight sectors but must never become sectors themselves, and must survive as their raw
// code rather than being silently discarded.
const groundReading = readRoster(
  [
    { label: '04/07', cells: ['OFF'] },
    { label: '05/07', cells: ['SICK'] },
  ],
  '2026-07-01', '2026-07-31',
);
equal(groundReading.sectors.length, 0, 'ground-duty codes never become flight sectors');
equal(groundReading.groundDuties.length, 2, 'both ground-duty days are captured');
equal(groundReading.groundDuties[0]?.code, 'OFF', 'raw ground-duty code is preserved, not expanded');
equal(groundReading.groundDuties[0]?.date, '2026-07-04', 'ground-duty day keeps its resolved calendar date');
equal(groundReading.absences.length, 1, 'only the payroll-relevant code becomes an absence');
equal(groundReading.absences[0]?.code, 'SICK', 'SICK is both a ground duty and a payroll absence');
equal(isDayOffCode('OFF'), true, 'OFF is a day-off code');
equal(isDayOffCode('SICK'), false, 'SICK is a payroll absence, not a day-off code');

// Anonymous salary example locks the confirmed cabin-crew tariff bands without storing personal data.
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

// Leave days come out of the salary and transport month. Four issued payslips fix this
// rule: rest codes (OFF, DOFF, ROFF, BOFF, AVLB) stay paid, while SICK, UFF, VAC and CHLD
// each remove a day. A 30-day month with 7 vacation days pays 23.
const leaveRoster: ParsedAirAstanaRoster = {
  ...roster,
  period: { start: '2026-06-01', end: '2026-06-30' },
  absences: [
    ...Array.from({ length: 7 }, (_, index) => ({ code: 'VAC' as const, date: `2026-06-0${index + 1}` })),
  ],
};
const leavePay = calculateRosterPay(
  leaveRoster,
  { hourlyRate: 3100, monthlySalary: 164317, monthlyTransport: 78000 },
  { paidHours: 74.88, vacationAmountOverride: 200000 },
  MRP_2026,
);
equal(leavePay.paidDays, 23, 'seven vacation days leave 23 paid days');
equal(leavePay.vacationDays, 7, 'vacation days counted');
equal(leavePay.salaryLine.amount, 125976, 'salary is prorated over paid days');
equal(leavePay.transportLine.amount, 59800, 'transport is prorated the same way');
equal(leavePay.vacationLine.amount, 200000, 'vacation pay is carried as given');

const childLeave = calculateRosterPay(
  { ...roster, period: { start: '2026-05-01', end: '2026-05-31' },
    absences: [...Array.from({ length: 7 }, (_, i) => ({ code: 'CHLD' as const, date: `2026-05-0${i + 1}` })), { code: 'VAC' as const, date: '2026-05-31' }] },
  { hourlyRate: 3100, monthlySalary: 164317, monthlyTransport: 78000 },
  { paidHours: 67.94, vacationAmountOverride: 0, holidayHours: 4.98, officialDayOffHours: 7.1 },
  MRP_2026,
);
equal(childLeave.paidDays, 23, 'child-care days remove a day each');
equal(childLeave.salaryLine.amount, 121913, 'salary over 23 of 31 days');
// A holiday hour carries one extra rate; an official day off carries half.
equal(childLeave.holidayLine.amount, 15438, 'public holiday hours');
equal(childLeave.officialDayOffLine.amount, 11005, 'official day off hours');

// Station clocks must not depend on the browser's timezone database. WebKit still ships
// pre-2024 tzdata that puts Almaty on UTC+6, which would make every Kazakhstan duty an
// hour long or short.
const alaNoon = stationLocalDateTimeMs('ALA', '2026-08-28', '12:00');
equal(alaNoon, Date.UTC(2026, 7, 28, 7, 0), 'ALA is UTC+5 after the 2024 unification');
equal(stationLocalDateTimeMs('ALA', '2023-08-28', '12:00'), Date.UTC(2023, 7, 28, 6, 0), 'ALA was UTC+6 before it');
equal(stationLocalDateTimeMs('KSN', '2026-08-28', '12:00'), Date.UTC(2026, 7, 28, 7, 0), 'Qostanay moved with Almaty');
equal(stationLocalDateTimeMs('SCO', '2026-08-28', '12:00'), Date.UTC(2026, 7, 28, 7, 0), 'Aqtau was already UTC+5');

// The duty that exposed it: ICN 10:10 report to ALA 15:07 release is 8h57, not 7h57.
const icnReport = stationLocalDateTimeMs('ICN', '2026-08-28', '10:10');
const alaRelease = stationLocalDateTimeMs('ALA', '2026-08-28', '15:07');
equal((alaRelease! - icnReport!) / 60000, 537, 'ICN->ALA duty spans 8:57');

console.log('Domain smoke tests passed');
