import type { Duty } from '../domain/types';

export const demoDuty: Duty = {
  id: 'demo-duty-1',
  dateLabel: '04 SEP',
  reportTime: '05:35',
  releaseTime: '15:10',
  layoverStation: 'FRA',
  sectors: [
    {
      id: 'demo-sector-1',
      flightNumber: 'KC921',
      departure: 'ALA',
      arrival: 'FRA',
      departureTime: '07:05',
      arrivalTime: '12:25',
      blockMinutes: 500,
      crew: [
        { id: 'c1', name: 'Khava', role: 'Cabin', position: 'Cabin crew' },
        { id: 'c2', name: 'A. Demo', role: 'Cabin', position: 'Cabin crew' },
        { id: 'c3', name: 'B. Demo', role: 'Cabin', position: 'Cabin crew' },
        { id: 'c4', name: 'C. Demo', role: 'Flight deck', position: 'Captain' },
        { id: 'c5', name: 'D. Demo', role: 'Flight deck', position: 'First Officer' }
      ]
    }
  ]
};
