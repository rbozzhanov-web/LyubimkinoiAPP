import type { Duty, CrewMember, Sector } from './types';
import { getSectorCrew, type ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { RosterCrewMember } from '@/src/import/crew';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function rosterToDuties(roster: ParsedAirAstanaRoster): Duty[] {
  return roster.duties.flatMap((duty) => {
    const sourceSectors = roster.sectors.filter((sector) => sector.dutyIndex === duty.index);
    if (sourceSectors.length === 0) return [];
    const first = sourceSectors[0];
    const date = new Date(`${first.date}T00:00:00Z`);
    const sectors: Sector[] = sourceSectors.map((sector, index) => {
      const crew = getSectorCrew(roster, sector)?.members
        .filter((member) => member.id !== roster.subject?.staffId)
        .sort(crewOrder)
        .map(toCrewMember) ?? [];
      return {
        id: `${sector.date}-${sector.flightNumber}-${index}`,
        flightNumber: `KC${sector.flightNumber}`,
        departure: sector.departureAirport,
        arrival: sector.arrivalAirport,
        departureTime: sector.timeOut,
        arrivalTime: sector.timeIn,
        blockMinutes: 0,
        crew,
        deadhead: sector.deadhead,
        actualTimes: sector.actualTimes,
      };
    });
    return [{
      id: `duty-${first.date}-${duty.index}`,
      dateLabel: `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}`,
      reportTime: duty.start?.split('T')[1] ?? first.timeOut,
      releaseTime: duty.end?.split('T')[1] ?? sourceSectors[sourceSectors.length - 1].timeIn,
      sectors,
      layoverStation: sourceSectors[sourceSectors.length - 1].arrivalAirport,
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
