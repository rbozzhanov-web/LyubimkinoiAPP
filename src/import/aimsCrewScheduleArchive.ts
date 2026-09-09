import { NON_DUTY_CODES } from './patterns';
import type { RosterAbsence, RosterDuty, RosterGroundDuty, RosterSector } from './duties';
import type { RosterCrewMember, CrewRecord } from './crew';
import type { ParsedAirAstanaRoster, RosterExpiry, RosterHotelStay } from './parseAirAstanaRoster';

type JsonRecord = Record<string, unknown>;

const SECTOR_RE = /(\d{1,5})\s*-\s*([A-Z]{3,4})\s*\(([A]?)(\d{4})(⁺¹)?\)\s*-\s*([A-Z]{3,4})\s*\(([A]?)(\d{4})(⁺¹)?\)/g;
// Same four codes as duties.ts's PAYROLL_ABSENCE_CODES: they take a day out of the salary
// and transport month, unlike the other NON_DUTY_CODES (OFF, DOFF, ROFF, BOFF, AVLB, HOMS, ...).
const PAYROLL_ABSENCE_CODES = new Set<RosterAbsence['code']>(['SICK', 'UFF', 'VAC', 'CHLD']);

/**
 * Parse a locally saved AIMS CrewSchedule HTML page or Safari Web Archive into the same
 * ParsedAirAstanaRoster shape the PDF importer produces, so every existing screen (roster
 * timeline, crew sheet, ground-duty rows, pay engine) works unchanged. The Web Archive JSON
 * carries more detail than the PDF report -- real crew names and ids, hotel stays, licence
 * expiry dates -- so those come through on the optional expiries/hotels fields and the same
 * crewRecords the PDF path already fills.
 */
export function parseAimsCrewScheduleArchive(html: string): ParsedAirAstanaRoster {
  if (!/\/eCrew\/CrewSchedule|CrewSchedule/i.test(html) || !/initialResult/.test(html)) {
    throw new Error('Unsupported AIMS file. Save the fully loaded Crew Schedule page locally and import that file.');
  }

  const initialResult = parseAssignedJsonObject(html, /var\s+initialResult\s*=/);
  const periodStart = readLocalStorageString(html, 'PeriodStart');
  const periodEnd = readLocalStorageString(html, 'PeriodEnd');
  if (!periodStart || !periodEnd) throw new Error('Could not read the AIMS roster period from the saved Crew Schedule file.');

  const events = Array.isArray(initialResult.SchedulerEvents) ? initialResult.SchedulerEvents.filter(isRecord) : [];
  const { sectors, duties, absences, groundDuties } = buildFromEvents(events);
  const crewRecords = buildCrewRecords(findElementById(initialResult.elementList, 'members'));
  const expiries = buildExpiries(findElementById(initialResult.elementList, 'expiries'));
  const hotels = buildHotels(findElementById(initialResult.elementList, 'hotels'), events);
  const totals = buildTotals(findElementById(initialResult.elementList, 'hours'));

  return {
    period: { start: periodStart, end: periodEnd },
    totals,
    sectors,
    duties,
    absences,
    groundDuties,
    crewRecords,
    unreadCells: [],
    ...(expiries.length ? { expiries } : {}),
    ...(hotels.length ? { hotels } : {}),
  };
}

function buildFromEvents(events: JsonRecord[]): { sectors: RosterSector[]; duties: RosterDuty[]; absences: RosterAbsence[]; groundDuties: RosterGroundDuty[] } {
  const sectors: RosterSector[] = [];
  const duties: RosterDuty[] = [];
  const absences: RosterAbsence[] = [];
  const groundDuties: RosterGroundDuty[] = [];

  for (const event of events) {
    const dutyDate = isoDatePart(textValue(event.start));
    const flights = parseSectorDetails(event, dutyDate);
    if (flights.length) {
      const dutyIndex = duties.length;
      duties.push({ index: dutyIndex, start: eventBoundary(textValue(event.start)), end: eventBoundary(textValue(event.end)), sectorCount: flights.length });
      flights.forEach((flight, index) => {
        flight.dutyIndex = dutyIndex;
        flight.dutySectorIndex = index + 1;
        sectors.push(flight);
      });
      continue;
    }
    if (!dutyDate) continue;
    const code = eventCode(event);
    if (!code || !NON_DUTY_CODES.has(code)) continue;
    groundDuties.push({ code, date: dutyDate });
    if (PAYROLL_ABSENCE_CODES.has(code as RosterAbsence['code'])) absences.push({ code: code as RosterAbsence['code'], date: dutyDate });
  }

  return { sectors, duties, absences, groundDuties };
}

function parseSectorDetails(event: JsonRecord, dutyDate: string | undefined): RosterSector[] {
  if (!dutyDate) return [];
  const details = textValue(event.details);
  const flights: RosterSector[] = [];
  SECTOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SECTOR_RE.exec(details))) {
    const [, flightNumber, origin, outPrefix, outHhmm, outNextDay, destination, inPrefix, inHhmm, inNextDay] = match;
    const date = addDaysIso(dutyDate, outNextDay ? 1 : 0);
    const arrivalDate = addDaysIso(dutyDate, inNextDay ? 1 : 0);
    if (!date || !arrivalDate) continue;
    flights.push({
      flightNumber,
      date,
      departureAirport: origin,
      arrivalAirport: destination,
      timeOut: hhmm(outHhmm),
      timeIn: hhmm(inHhmm),
      arrivalDate: arrivalDate !== date ? arrivalDate : undefined,
      deadhead: Boolean(event.IsDeadhead),
      actualTimes: outPrefix === 'A' && inPrefix === 'A',
      dutyIndex: -1,
      dutySectorIndex: -1,
    });
  }
  return flights;
}

/** eScrew's own text for the first line of a non-flight event, e.g. "OFF" or "SICK 08:00 17:00". */
function eventCode(event: JsonRecord): string | undefined {
  const firstLine = textValue(event.text).split(/\r?\n/, 1)[0]?.trim();
  const token = firstLine?.replace(/\s+/g, ' ').split(' ')[0];
  if (token) return token;
  return /-\s*([A-Z][A-Z0-9_]{1,7})(?:\s|\r|\n|$)/.exec(textValue(event.details))?.[1];
}

function buildCrewRecords(membersElement?: JsonRecord): CrewRecord[] {
  const groups = membersElement && Array.isArray(membersElement.data) ? membersElement.data : [];
  const records: CrewRecord[] = [];
  for (const rawGroup of groups) {
    if (!isRecord(rawGroup)) continue;
    const key = parseCrewGroupKey(textValue(rawGroup.value));
    if (!key || !Array.isArray(rawGroup.data)) continue;
    const members: RosterCrewMember[] = rawGroup.data.flatMap((item): RosterCrewMember[] => {
      if (!isRecord(item)) return [];
      const name = textValue(item.value2).replace(/\s+/g, ' ').trim();
      const position = textValue(item.value4).trim();
      const id = scalarString(item.value3);
      if (!name || !position) return [];
      const rank = position.split('-')[0]?.trim().toUpperCase() ?? '';
      return [{ rank, id, name, deadhead: /\bDHC\b/i.test(position) }];
    });
    if (members.length) records.push({ date: key.date, flightNumber: key.flightNumber, members });
  }
  return records;
}

/** Mirrors eScrew's parseCrewGroup: "DD/MM/YYYY | flightNumber | ORG-DST ...". */
function parseCrewGroupKey(value: string): { date: string; flightNumber: string } | undefined {
  const normalized = value
    .replace(/&emsp;|&#8195;|&#x2003;/gi, ' | ')
    .replace(/ /g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*([A-Z]?\d{1,5})\s*\|\s*[A-Z]{3,4}\s*-\s*[A-Z]{3,4}/i.exec(normalized);
  if (!match) return undefined;
  const [, day, month, year, flightNumber] = match;
  // Crew rows can carry a single-letter flight-number prefix; sectors never do (CELL_FLIGHT_NUMBER_RE
  // is digits-only), so strip it to keep crewForSector's plain `===` match working.
  return { date: `${year}-${month}-${day}`, flightNumber: flightNumber.replace(/^[A-Z]/, '') };
}

function buildExpiries(expiriesElement?: JsonRecord): RosterExpiry[] {
  const rows = expiriesElement && Array.isArray(expiriesElement.data) ? expiriesElement.data : [];
  const expiries: RosterExpiry[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const code = textValue(row.code).trim();
    if (!code) continue;
    expiries.push({ code, description: textValue(row.description).trim() || undefined, date: isoSlashDate(textValue(row.expirydate)) });
  }
  return expiries;
}

function buildHotels(hotelsElement: JsonRecord | undefined, events: JsonRecord[]): RosterHotelStay[] {
  const directory = new Map<string, { address?: string; phone?: string }>();
  const rows = hotelsElement && Array.isArray(hotelsElement.data) ? hotelsElement.data : [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const port = cleanHtml(textValue(row.port)).toUpperCase();
    if (!port) continue;
    directory.set(port, { address: cleanHtml(textValue(row.addresses)) || undefined, phone: cleanHtml(textValue(row.phones)) || undefined });
  }

  const stays: RosterHotelStay[] = [];
  const seenStations = new Set<string>();
  for (const event of events) {
    const hotelInfo = isRecord(event.HotelInfo) ? event.HotelInfo : undefined;
    if (!hotelInfo && !meaningful(event.HotelNo)) continue;
    const station = textValue(event.location).trim().toUpperCase();
    const date = isoDatePart(textValue(event.start));
    const text = textValue(event.text);
    const hotel = /^Rest\s+(.+?)\s+\(/i.exec(text)?.[1]?.trim();
    const rest = hotelInfo ? textValue(hotelInfo.Rest).trim() || undefined : undefined;
    const checkIn = hotelInfo ? textValue(hotelInfo.CheckInTime).trim() || undefined : undefined;
    const checkOut = hotelInfo ? textValue(hotelInfo.CheckOutTime).trim() || undefined : undefined;
    if (!hotel && !rest && !checkIn && !checkOut) continue;
    const directoryEntry = station ? directory.get(station) : undefined;
    stays.push({ station: station || 'Layover', date, hotel, rest, checkIn, checkOut, address: directoryEntry?.address, phone: directoryEntry?.phone });
    if (station) seenStations.add(station);
  }
  // A directory row with no matching dated stay is still useful (address/phone for a station
  // the crew is scheduled through), so keep it as a date-less fallback.
  for (const [station, entry] of directory) {
    if (seenStations.has(station)) continue;
    if (!entry.address && !entry.phone) continue;
    stays.push({ station, address: entry.address, phone: entry.phone });
  }
  return stays;
}

function buildTotals(hoursElement?: JsonRecord): ParsedAirAstanaRoster['totals'] {
  const rows = hoursElement && Array.isArray(hoursElement.data) ? hoursElement.data : [];
  const totals: ParsedAirAstanaRoster['totals'] = {};
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const label = textValue(row.desc).toLowerCase();
    const minutes = clockMinutes(textValue(row.hours));
    if (minutes === undefined) continue;
    if (label.includes('block')) totals.blockMinutes = minutes;
    if (label.includes('night')) totals.nightMinutes = minutes;
  }
  return totals;
}

function parseAssignedJsonObject(source: string, marker: RegExp): JsonRecord {
  const match = marker.exec(source);
  if (!match) throw new Error('Could not find AIMS CrewSchedule data in the saved local file.');
  const start = source.indexOf('{', match.index + match[0].length);
  if (start < 0) throw new Error('Could not read AIMS CrewSchedule data.');
  const json = balancedJson(source, start, '{', '}');
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new Error('Saved AIMS CrewSchedule data is not valid JSON.'); }
  if (!isRecord(parsed)) throw new Error('Saved AIMS CrewSchedule data has an invalid shape.');
  return parsed;
}

function balancedJson(source: string, start: number, open: string, close: string): string {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('Saved AIMS CrewSchedule data is incomplete.');
}

function readLocalStorageString(source: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`localStorage\\[['"]${escaped}['"]\\]\\s*=\\s*['"]([^'"]+)['"]`).exec(source)?.[1];
}

function findElementById(value: unknown, id: string): JsonRecord | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findElementById(item, id);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (value.id === id) return value;
  for (const child of Object.values(value)) {
    const found = findElementById(child, id);
    if (found) return found;
  }
  return undefined;
}

function isRecord(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function meaningful(value: unknown): boolean { return value !== undefined && value !== null && value !== false && value !== 0 && value !== ''; }
function textValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
function scalarString(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
function cleanHtml(value: string): string { return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim(); }
function clockMinutes(value: string): number | undefined {
  const match = /^(\d{1,3}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[2]) > 59) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}
function isoDatePart(value: string): string | undefined { return /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0]; }
function isoSlashDate(value: string): string | undefined {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}
function eventBoundary(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]}T${match[2]}` : undefined;
}
function hhmm(value: string): string { return `${value.slice(0, 2)}:${value.slice(2, 4)}`; }
function addDaysIso(value: string, days: number): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
