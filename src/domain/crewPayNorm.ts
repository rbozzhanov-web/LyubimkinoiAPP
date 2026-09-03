/**
 * Latest published Air Astana CrewPay Norm block-time table known to KhaVair.
 *
 * Version 1.64 states an effective period of 2025-10-01..2026-03-31. The user confirmed that
 * no successor has been published yet, so KhaVair continues to use 1.64 after 2026-03-31 as the
 * latest published table, while exposing that fact to the UI. When a new table appears this file
 * must be replaced rather than silently changing historical calculations.
 *
 * Published rule for an unlisted sector: use actual operated block time. KhaVair cannot safely
 * derive that from local DEP/ARR clock times without airport time-zone conversion, therefore an
 * unlisted route makes automatic monthly CrewPay hours incomplete and requires a manual override.
 */

import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';

export const CREW_PAY_NORM_VERSION = '1.64';
export const CREW_PAY_NORM_STATED_FROM = '2025-10-01';
export const CREW_PAY_NORM_STATED_TO = '2026-03-31';

const CREW_PAY_NORM_TIMES: readonly [string, string, number][] = [
  ['AKX', 'ALA', 158], ['AKX', 'NQZ', 109], ['ALA', 'AKX', 168], ['ALA', 'AUH', 315],
  ['ALA', 'AYT', 367], ['ALA', 'BKK', 408], ['ALA', 'BJV', 375], ['ALA', 'BOM', 289],
  ['ALA', 'BSZ', 51], ['ALA', 'BUS', 276], ['ALA', 'CAN', 372], ['ALA', 'CMB', 383],
  ['ALA', 'CIT', 92], ['ALA', 'CTU', 268], ['ALA', 'CXR', 456], ['ALA', 'DAD', 410],
  ['ALA', 'DEL', 215], ['ALA', 'DME', 293], ['ALA', 'DOH', 316], ['ALA', 'DXB', 302],
  ['ALA', 'DYU', 117], ['ALA', 'FRA', 503], ['ALA', 'GOI', 301], ['ALA', 'GUW', 203],
  ['ALA', 'GYD', 225], ['ALA', 'HER', 393], ['ALA', 'HKT', 429], ['ALA', 'HRG', 436],
  ['ALA', 'ICN', 347], ['ALA', 'IST', 378], ['ALA', 'JED', 422], ['ALA', 'KBP', 331],
  ['ALA', 'KGF', 87], ['ALA', 'KZO', 110], ['ALA', 'LHR', 578], ['ALA', 'LED', 333],
  ['ALA', 'MED', 402], ['ALA', 'MLE', 409], ['ALA', 'NQZ', 115], ['ALA', 'OVB', 151],
  ['ALA', 'OSS', 81], ['ALA', 'PEK', 290], ['ALA', 'PLX', 92], ['ALA', 'PQC', 442],
  ['ALA', 'PWQ', 107], ['ALA', 'SCO', 211], ['ALA', 'SSH', 430], ['ALA', 'SYX', 395],
  ['ALA', 'TAS', 100], ['ALA', 'TBS', 253], ['ALA', 'TGD', 417], ['ALA', 'TLV', 397],
  ['ALA', 'UKK', 97], ['ALA', 'UBN', 205], ['ALA', 'URA', 204], ['ALA', 'URC', 108],
  ['AMS', 'GUW', 355], ['AUH', 'ALA', 256], ['AUH', 'NQZ', 292], ['AYT', 'ALA', 320],
  ['AYT', 'NQZ', 296], ['BJV', 'ALA', 326], ['BJV', 'NQZ', 305], ['BKK', 'ALA', 435],
  ['BOM', 'ALA', 278], ['BSZ', 'ALA', 60], ['BUS', 'ALA', 237], ['BUS', 'NQZ', 222],
  ['CAN', 'ALA', 400], ['CMB', 'ALA', 386], ['CIT', 'ALA', 75], ['CIT', 'DOH', 248],
  ['CIT', 'JED', 381], ['CIT', 'MED', 336], ['CTU', 'ALA', 308], ['CXR', 'ALA', 478],
  ['DAD', 'ALA', 447], ['DAD', 'NQZ', 518], ['DEL', 'ALA', 211], ['DME', 'ALA', 272],
  ['DMB', 'NQZ', 109], ['DME', 'NQZ', 210], ['DOH', 'ALA', 281], ['DOH', 'CIT', 221],
  ['DOH', 'NQZ', 297], ['DXB', 'ALA', 261], ['DXB', 'GUW', 239], ['DXB', 'NQZ', 284],
  ['DYU', 'ALA', 111], ['FRA', 'ALA', 438], ['FRA', 'GUW', 353], ['FRA', 'NQZ', 434],
  ['FRA', 'URA', 363], ['FRU', 'NQZ', 99], ['GOI', 'ALA', 312], ['GUW', 'ALA', 171],
  ['GUW', 'AMS', 391], ['GUW', 'DXB', 239], ['GUW', 'FRA', 384], ['GUW', 'GYD', 87],
  ['GUW', 'IST', 239], ['GUW', 'NQZ', 136], ['GUW', 'SCO', 55], ['GUW', 'TBS', 109],
  ['GUW', 'URA', 60], ['GYD', 'ALA', 185], ['GYD', 'GUW', 90], ['HER', 'ALA', 349],
  ['HKT', 'ALA', 452], ['HKT', 'NQZ', 448], ['HRG', 'ALA', 392], ['HRG', 'NQZ', 371],
  ['ICN', 'ALA', 422], ['ICN', 'NQZ', 457], ['IST', 'ALA', 310], ['IST', 'GUW', 212],
  ['IST', 'NQZ', 293], ['JED', 'CIT', 363], ['JED', 'ALA', 361], ['KBP', 'ALA', 302],
  ['KBP', 'NQZ', 248], ['KGF', 'ALA', 92], ['KGF', 'NQZ', 52], ['KSN', 'NQZ', 74],
  ['KZO', 'ALA', 102], ['KZO', 'NQZ', 95], ['LED', 'ALA', 279], ['LED', 'NQZ', 242],
  ['LHR', 'ALA', 494], ['LHR', 'NQZ', 470], ['LHR', 'SCO', 354], ['MED', 'ALA', 339],
  ['MED', 'CIT', 284], ['MLE', 'ALA', 405], ['MLE', 'NQZ', 457], ['OSS', 'ALA', 77],
  ['PEK', 'ALA', 336], ['PEK', 'NQZ', 371], ['PQC', 'ALA', 472], ['PQC', 'NQZ', 539],
  ['SCO', 'ALA', 189], ['SCO', 'GUW', 58], ['SCO', 'LHR', 411], ['SCO', 'MED', 231],
  ['SCO', 'NQZ', 161], ['SSH', 'NQZ', 385], ['SSH', 'ALA', 381], ['SYX', 'ALA', 436],
  ['SYX', 'NQZ', 455], ['TAS', 'ALA', 91], ['TAS', 'NQZ', 122], ['TBS', 'ALA', 225],
  ['TBS', 'GUW', 110], ['TBS', 'NQZ', 201], ['TGD', 'ALA', 358], ['TGD', 'NQZ', 341],

  // Confirmed rows from the supplied published CrewPay Norm extract.
  ['TLV', 'ALA', 334],
  ['NQZ', 'AKX', 118], ['NQZ', 'ALA', 113], ['NQZ', 'AUH', 318], ['NQZ', 'AYT', 342],
  ['NQZ', 'BJV', 352], ['NQZ', 'BUS', 257], ['NQZ', 'CXR', 485], ['NQZ', 'DAD', 441],
  ['NQZ', 'DMB', 106], ['NQZ', 'DME', 236], ['NQZ', 'DOH', 332], ['NQZ', 'DXB', 313],
  ['NQZ', 'FRA', 481], ['NQZ', 'FRU', 104], ['NQZ', 'GUW', 159], ['NQZ', 'HKT', 479],
  ['NQZ', 'HRG', 401], ['NQZ', 'ICN', 392], ['NQZ', 'IST', 356], ['NQZ', 'KSN', 83],
  ['NQZ', 'KBP', 282], ['NQZ', 'KZO', 100], ['NQZ', 'LED', 267], ['NQZ', 'PEK', 327],
  ['NQZ', 'PLX', 83], ['NQZ', 'PQC', 488], ['NQZ', 'LHR', 516], ['NQZ', 'SCO', 180],
  ['NQZ', 'SSH', 415], ['NQZ', 'TAS', 131], ['NQZ', 'TBS', 229], ['NQZ', 'TGD', 390],
  ['NQZ', 'UKK', 91], ['NQZ', 'URA', 151], ['NQZ', 'URC', 157],
  ['NRT', 'ALA', 542], ['OVB', 'ALA', 166],
  ['PLX', 'ALA', 95], ['PLX', 'GUW', 130], ['PLX', 'NQZ', 85],
  ['UBN', 'ALA', 242], ['UKK', 'ALA', 100], ['UKK', 'NQZ', 95],
  ['URA', 'ALA', 200], ['URA', 'FRA', 395], ['URA', 'NQZ', 132],
  ['URC', 'ALA', 120], ['URC', 'NQZ', 159],
];

const normIndex = new Map(CREW_PAY_NORM_TIMES.map(([dep, arr, minutes]) => [`${dep}|${arr}`, minutes]));

export function findCrewPayNormMinutes(dep: string, arr: string): number | undefined {
  return normIndex.get(`${dep.toUpperCase()}|${arr.toUpperCase()}`);
}

export interface CrewPayNormSummary {
  complete: boolean;
  minutes: number;
  hours: number;
  missingRoutes: string[];
  version: string;
  afterStatedPeriod: boolean;
}

/** Sum CrewPay Norm minutes for operating sectors only. DHC is paid separately. */
export function crewPayNormForRoster(roster: ParsedAirAstanaRoster): CrewPayNormSummary {
  let minutes = 0;
  const missingRoutes = new Set<string>();
  for (const sector of roster.sectors) {
    if (sector.deadhead) continue;
    const norm = findCrewPayNormMinutes(sector.departureAirport, sector.arrivalAirport);
    if (norm === undefined) missingRoutes.add(`${sector.departureAirport}–${sector.arrivalAirport}`);
    else minutes += norm;
  }
  return {
    complete: missingRoutes.size === 0,
    minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
    missingRoutes: [...missingRoutes],
    version: CREW_PAY_NORM_VERSION,
    afterStatedPeriod: roster.period.end > CREW_PAY_NORM_STATED_TO,
  };
}
