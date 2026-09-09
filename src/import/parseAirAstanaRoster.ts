import { extractCrewRecords, crewForSector, type CrewRecord } from './crew';
import { readRoster, type RosterAbsence, type RosterDuty, type RosterGroundDuty, type RosterSector } from './duties';
import { extractDayColumns, type DayColumn } from './grid';
import { parsePeriod, parseReportTotals, parseSubject, type ReportPeriod, type ReportSubject, type ReportTotals } from './header';
import type { ExtractedPage } from './types';

export interface RosterExpiry { code: string; description?: string; date?: string }
export interface RosterHotelStay {
  station: string;
  /** Absent for a station-directory entry not tied to a specific dated stay. */
  date?: string;
  hotel?: string;
  rest?: string;
  checkIn?: string;
  checkOut?: string;
  address?: string;
  phone?: string;
}

export interface ParsedAirAstanaRoster {
  subject?: ReportSubject;
  period: ReportPeriod;
  totals: ReportTotals;
  sectors: RosterSector[];
  /** Known departures that continue beyond the report's last calendar column. UI-only; excluded from payroll/layover calculations. */
  boundarySectors?: RosterSector[];
  duties: RosterDuty[];
  absences: RosterAbsence[];
  /** Optional: absent on rosters stored before this field existed. */
  groundDuties?: RosterGroundDuty[];
  crewRecords: CrewRecord[];
  unreadCells: string[];
  /** Only available when parsed from an AIMS Web Archive; the PDF report does not include this. */
  expiries?: RosterExpiry[];
  /** Only available when parsed from an AIMS Web Archive; the PDF report does not include this. */
  hotels?: RosterHotelStay[];
}

export function parseAirAstanaRoster(pages: ExtractedPage[]): ParsedAirAstanaRoster {
  const text = pages.flatMap((page) => page.items.map((item) => item.str)).join(' ');
  if (!text.includes('AIR ASTANA') || !text.includes('Personal Crew Schedule Report')) throw new Error('Unsupported roster PDF');
  const period = parsePeriod(pages);
  if (!period) throw new Error('Could not read roster period');
  const columns = dedupeColumns(pages.flatMap(extractDayColumns));
  const reading = readRoster(columns, period.start, period.end);
  return {
    subject: parseSubject(pages),
    period,
    totals: parseReportTotals(pages),
    sectors: reading.sectors,
    boundarySectors: reading.boundarySectors,
    duties: reading.duties,
    absences: reading.absences,
    groundDuties: reading.groundDuties,
    crewRecords: extractCrewRecords(pages),
    unreadCells: reading.unreadCells,
  };
}

export function getSectorCrew(roster: ParsedAirAstanaRoster, sector: RosterSector) {
  return crewForSector(roster.crewRecords, sector.flightNumber, sector.date, roster.subject?.staffId);
}

function dedupeColumns(columns: DayColumn[]): DayColumn[] {
  const byLabel = new Map<string, DayColumn>();
  for (const column of columns) {
    const existing = byLabel.get(column.label);
    if (!existing || column.cells.length > existing.cells.length) byLabel.set(column.label, column);
  }
  return [...byLabel.values()];
}
