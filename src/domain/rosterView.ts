import type { Duty, CrewMember, Sector } from './types';
import { getSectorCrew, type ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { RosterCrewMember } from '@/src/import/crew';
import type { RosterSector } from '@/src/import/duties';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function rosterToDuties(roster: ParsedAirAstanaRoster): Duty[] {
  const visibleSectors = [...roster.sectors, ...(roster.boundarySectors ?? []), ...legacyBoundarySectors(roster)];
  return roster.duties.flatMap((duty) => {
    const sourceSectors = visibleSectors
      .filter((sector) => sector.dutyIndex === duty.index)
      .sort((a, b) => a.dutySectorIndex - b.dutySectorIndex);
    if (sourceSectors.length === 0) return [];
    const first = sourceSectors[0];
    const last = sourceSectors[sourceSectors.length - 1];
    const date = new Date(`${first.date}T00:00:00Z`);
    const sectors: Sector[] = sourceSectors.map((sector, index) => {
      const crew = getSectorCrew(roster, sector)?.members
        .filter((member) => member.id !== roster.subject?.staffId)
        .sort(crewOrder)
        .map(toCrewMember) ?? [];
      return {
        id: `${sector.date}-${sector.flightNumber}-${index}`,
        flightNumber: `KC${sector.flightNumber}`,
        departure: sector.departureAirport || '…',
        arrival: sector.arrivalAirport || '…',
        departureTime: sector.timeOut || '—',
        arrivalTime: sector.timeIn || '—',
        blockMinutes: 0,
        crew,
        deadhead: sector.deadhead,
        actualTimes: sector.actualTimes,
      };
    });
    const reportStamp = duty.start?.split('T');
    const releaseStamp = duty.end?.split('T');
    return [{
      id: `duty-${first.date}-${duty.index}`,
      date: first.date,
      reportDate: reportStamp?.[0] ?? first.date,
      releaseDate: releaseStamp?.[0] ?? last.arrivalDate ?? last.date,
      dateLabel: `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}`,
      reportTime: reportStamp?.[1] ?? first.timeOut || '—',
      releaseTime: releaseStamp?.[1] ?? (last.timeIn || '—'),
      sectors,
      layoverStation: last.arrivalAirport || '…',
    }];
  });
}

// Rosters parsed before the month-boundary fix did not persist a final sector when its
// arrival continued beyond the report's last calendar column. The source PDF bytes are not
// stored, but the duty shell and Other Crew record are. Recover only the unambiguous legacy
// case: a one-sector duty with no saved sector and an own-crew record on the report end date.
// Flight number/date are factual; departure is reused only when the same flight number has
// already appeared in this roster. Unknown times/destination stay visibly unknown.
function legacyBoundarySectors(roster: ParsedAirAstanaRoster): RosterSector[] {
  if (roster.boundarySectors !== undefined) return [];
  const represented = new Set(roster.sectors.map((sector) => `${sector.date}|${sector.flightNumber}`));
  const candidates = roster.crewRecords.filter((record) =>
    record.date === roster.period.end &&
    !represented.has(`${record.date}|${record.flightNumber}`) &&
    (!roster.subject?.staffId || record.members.some((member) => member.id === roster.subject?.staffId)),
  );
  if (candidates.length === 0) return [];

  const missingDuties = roster.duties.filter((duty) =>
    duty.sectorCount === 1 && !roster.sectors.some((sector) => sector.dutyIndex === duty.index),
  );

  return missingDuties.flatMap((duty, index) => {
    const record = candidates[index];
    if (!record) return [];
    const reference = roster.sectors.find((sector) => sector.flightNumber === record.flightNumber);
    const own = roster.subject?.staffId ? record.members.find((member) => member.id === roster.subject?.staffId) : undefined;
    return [{
      flightNumber: record.flightNumber,
      date: record.date,
      departureAirport: reference?.departureAirport ?? '',
      arrivalAirport: '',
      timeOut: '',
      timeIn: '',
      deadhead: own?.deadhead ?? false,
      actualTimes: false,
      dutyIndex: duty.index,
      dutySectorIndex: 1,
    }];
  });
}

function toCrewMember(member: RosterCrewMember): CrewMember {
  const flightDeck = member.rank === 'CP' || member.rank === 'FO';
  return {
    id: member.id,
    name: titleCase(member.name),
    role: flightDeck ? 'Flight deck' : 'Cabin',
    position: `${member.deadhead ? 'DHC · ' : ''}${rankLabel(member.rank)}`,
    rosterRank: member.rank,
    deadhead: member.deadhead,
  };
}

function crewOrder(a: RosterCrewMember, b: RosterCrewMember): number {
  const weight = (rank: string) => rank === 'CP' ? 0 : rank === 'FO' ? 1 : rank === 'PU' ? 2 : rank === 'IS' ? 3 : 4;
  return weight(a.rank) - weight(b.rank);
}
function rankLabel(rank: string): string {
  return ({ CP: 'Captain', FO: 'First Officer', PU: 'Purser', IS: 'Instructor', FJ: 'FJ', FY: 'FY', PS: 'PS', LI: 'LI' } as Record<string, string>)[rank] ?? rank;
}
function titleCase(value: string): string { return value.toLowerCase().replace(/(^|[ -])\p{L}/gu, (letter) => letter.toUpperCase()); }

export function formatMinutes(minutes?: number): string {
  if (minutes === undefined) return '—';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function rosterMonthLabel(roster: ParsedAirAstanaRoster): string {
  const date = new Date(`${roster.period.start}T00:00:00Z`);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
