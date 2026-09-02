import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { RosterDuty, RosterSector } from '@/src/import/duties';

export interface CalendarExportResult {
  filename: string;
  events: number;
  method: 'download' | 'share';
}

export function buildRosterIcs(roster: ParsedAirAstanaRoster): string {
  const events = roster.duties.flatMap((duty) => buildDutyEvent(roster, duty));
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KhaVair//Cabin Crew Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:KhaVair',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export async function exportRosterCalendar(roster: ParsedAirAstanaRoster): Promise<CalendarExportResult> {
  const content = buildRosterIcs(roster);
  const filename = `KhaVair-${roster.period.start.slice(0, 7)}.ics`;

  if (typeof navigator !== 'undefined' && 'share' in navigator && typeof File !== 'undefined') {
    try {
      const file = new File([content], filename, { type: 'text/calendar;charset=utf-8' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      const data: ShareData = { files: [file], title: `KhaVair ${roster.period.start.slice(0, 7)}` };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return { filename, events: countEvents(content), method: 'share' };
      }
    } catch (error) {
      // A cancelled share sheet should not trigger a surprise download.
      if (isAbortError(error)) throw error;
    }
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('Calendar export is available in the web/PWA version.');
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return { filename, events: countEvents(content), method: 'download' };
}

function buildDutyEvent(roster: ParsedAirAstanaRoster, duty: RosterDuty): string[] {
  const sectors = roster.sectors.filter((sector) => sector.dutyIndex === duty.index);
  if (sectors.length === 0) return [];

  const first = sectors[0];
  const last = sectors[sectors.length - 1];
  const start = duty.start ?? `${first.date}T${first.timeOut}`;
  const end = duty.end ?? `${last.arrivalDate ?? last.date}T${last.timeIn}`;
  const fixedEnd = ensureEndAfterStart(start, end);
  const flightNumbers = sectors.map((sector) => `KC${sector.flightNumber}`).join(' / ');
  const summary = `${flightNumbers} · ${first.departureAirport} → ${last.arrivalAirport}`;
  const description = sectors.map(sectorDescription).join('\\n');

  return [
    'BEGIN:VEVENT',
    `UID:${escapeIcs(`${roster.period.start}-${duty.index}-${first.flightNumber}@khavair.local`)}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${floatingStamp(start)}`,
    `DTEND:${floatingStamp(fixedEnd)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `LOCATION:${escapeIcs(first.departureAirport)}`,
    `DESCRIPTION:${escapeIcs(`KhaVair roster\\nReport ${timePart(start)} · Release ${timePart(fixedEnd)}\\n${description}`)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ];
}

function sectorDescription(sector: RosterSector): string {
  const flags = sector.deadhead ? ' · DHC' : '';
  return `KC${sector.flightNumber} ${sector.departureAirport}-${sector.arrivalAirport} ${sector.timeOut}-${sector.timeIn}${flags}`;
}

function ensureEndAfterStart(start: string, end: string): string {
  const a = parseNaive(start);
  let b = parseNaive(end);
  if (a === undefined || b === undefined || b > a) return end;
  b += 24 * 60 * 60 * 1000;
  return naiveFromMs(b);
}

function parseNaive(value: string): number | undefined {
  const [date, time] = value.split('T');
  if (!date || !time) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) return undefined;
  return Date.UTC(year, month - 1, day, hour, minute);
}

function naiveFromMs(value: number): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}T${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

function floatingStamp(value: string): string {
  const [date, time] = value.split('T');
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
}

function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}T${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;
}

function timePart(value: string): string { return value.split('T')[1] ?? value; }
function two(value: number): string { return String(value).padStart(2, '0'); }

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function countEvents(content: string): number {
  return content.match(/BEGIN:VEVENT/g)?.length ?? 0;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /cancel/i.test(error.message));
}
