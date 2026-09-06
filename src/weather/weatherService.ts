import { useEffect, useState } from 'react';
import { airportCoords } from './airports';
import { loadStoredRosters } from '@/src/storage/rosterStorage';

export type AirportWeather = {
  code: string;
  temp: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
  windDeg: number;
  pressure: number;
  fetchedAt: number;
};

export type ForecastDay = { date: string; weatherCode: number; tempMax: number; tempMin: number };
export type ForecastLoadStatus = 'loading' | 'ready' | 'offline' | 'error';
export type AirportForecastState = { forecast?: ForecastDay[]; status: ForecastLoadStatus; startDate?: string; retry: () => void };
type AirportForecast = { code: string; days: ForecastDay[]; fetchedAt: number; startDate?: string };
type ForecastWindow = { startDate?: string; days: number };

const STALE_AFTER_MS = 45 * 60 * 1000;
const MAX_FORECAST_DAYS = 16;

function makeCache<T extends { fetchedAt: number }>(storageKey: string) {
  function load(): Record<string, T> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }
  function save(cache: Record<string, T>) {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(storageKey, JSON.stringify(cache)); } catch { /* storage full or unavailable — cached view still works this session */ }
  }
  return {
    get: (code: string) => load()[code],
    set: (code: string, value: T) => { const cache = load(); cache[code] = value; save(cache); },
  };
}

const weatherCache = makeCache<AirportWeather>('khavair.weather.v1');
const forecastCache = makeCache<AirportForecast>('khavair.forecast.v1');

function validIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addIsoDays(value: string, offset: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function isoDayNumber(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function inclusiveIsoDays(start: string, end: string): number {
  return Math.max(1, isoDayNumber(end) - isoDayNumber(start) + 1);
}

function clockMinutes(value: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

function sectorArrivalDate(sector: { date: string; arrivalDate?: string; timeOut?: string; timeIn?: string }): string {
  if (validIsoDate(sector.arrivalDate)) return sector.arrivalDate;
  const out = clockMinutes(sector.timeOut);
  const arrival = clockMinutes(sector.timeIn);
  return out !== undefined && arrival !== undefined && arrival < out ? addIsoDays(sector.date, 1) : sector.date;
}

function resolveLayoverWindow(code: string, requestedDays: number, startDateHint?: string): ForecastWindow {
  const fallbackStart = validIsoDate(startDateHint) ? startDateHint : undefined;
  const fallback = { startDate: fallbackStart, days: normalizedDays(requestedDays) };
  const target = code.trim().toUpperCase();
  // ALA is the crew base, so an arrival there is not treated as a layover forecast.
  if (target === 'ALA') return { startDate: fallbackStart, days: 1 };
  if (typeof localStorage === 'undefined') return fallback;

  try {
    const sectors = loadStoredRosters()
      .flatMap((roster) => [...roster.sectors, ...(roster.boundarySectors ?? [])])
      .filter((sector) => validIsoDate(sector.date))
      .sort((a, b) => `${a.date}T${a.timeOut || '00:00'}`.localeCompare(`${b.date}T${b.timeOut || '00:00'}`));

    const arrivals = sectors
      .map((sector) => ({ sector, arrivalDate: sectorArrivalDate(sector) }))
      .filter((item) => item.sector.arrivalAirport?.trim().toUpperCase() === target);
    if (!arrivals.length) return { startDate: fallbackStart, days: 1 };

    const hintedDay = validIsoDate(startDateHint) ? isoDayNumber(startDateHint) : undefined;
    const arrival = [...arrivals].sort((a, b) => {
      if (hintedDay === undefined) return b.arrivalDate.localeCompare(a.arrivalDate);
      return Math.abs(isoDayNumber(a.arrivalDate) - hintedDay) - Math.abs(isoDayNumber(b.arrivalDate) - hintedDay);
    })[0];
    if (!arrival) return { startDate: fallbackStart, days: 1 };

    const arrivalMoment = `${arrival.arrivalDate}T${arrival.sector.timeIn || '00:00'}`;
    const nextDeparture = sectors.find((sector) =>
      sector.dutyIndex !== arrival.sector.dutyIndex &&
      sector.departureAirport?.trim().toUpperCase() === target &&
      `${sector.date}T${sector.timeOut || '00:00'}` > arrivalMoment
    );
    if (!nextDeparture) return { startDate: arrival.arrivalDate, days: 1 };

    return {
      startDate: arrival.arrivalDate,
      days: normalizedDays(inclusiveIsoDays(arrival.arrivalDate, nextDeparture.date)),
    };
  } catch {
    return { startDate: fallbackStart, days: 1 };
  }
}

function normalizedDays(days: number): number {
  return Math.max(1, Math.min(MAX_FORECAST_DAYS, Math.trunc(days) || 1));
}

function forecastCacheKey(code: string, startDate?: string): string {
  return validIsoDate(startDate) ? `${code}:${startDate}` : code;
}

function selectForecastDays(days: ForecastDay[], requestedDays: number, startDate?: string): ForecastDay[] | undefined {
  const count = normalizedDays(requestedDays);
  if (!validIsoDate(startDate)) return days.length >= count ? days.slice(0, count) : undefined;
  const startIndex = days.findIndex((day) => day.date === startDate);
  if (startIndex < 0 || days.length - startIndex < count) return undefined;
  return days.slice(startIndex, startIndex + count);
}

function cachedForecast(code: string, days: number, startDate?: string): AirportForecast | undefined {
  const exact = forecastCache.get(forecastCacheKey(code, startDate));
  if (exact && selectForecastDays(exact.days, days, startDate)) return exact;
  if (validIsoDate(startDate)) {
    const legacy = forecastCache.get(code);
    if (legacy && selectForecastDays(legacy.days, days, startDate)) return legacy;
  }
  return undefined;
}

async function fetchAirportWeather(code: string): Promise<AirportWeather | undefined> {
  const coords = airportCoords(code);
  if (!coords) return undefined;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,surface_pressure&wind_speed_unit=kn`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const data = await response.json();
  const current = data?.current;
  if (!current) return undefined;
  const weather: AirportWeather = {
    code,
    temp: Math.round(current.temperature_2m),
    weatherCode: current.weather_code,
    isDay: current.is_day === 1,
    windSpeed: Math.round(current.wind_speed_10m),
    windDeg: current.wind_direction_10m,
    pressure: Math.round(current.surface_pressure),
    fetchedAt: Date.now(),
  };
  weatherCache.set(code, weather);
  return weather;
}

async function fetchAirportForecast(code: string, days: number, startDate?: string): Promise<ForecastDay[] | undefined> {
  const coords = airportCoords(code);
  if (!coords) return undefined;
  const count = normalizedDays(days);
  const range = validIsoDate(startDate)
    ? `&start_date=${startDate}&end_date=${addIsoDays(startDate, count - 1)}`
    : `&forecast_days=${count}`;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto${range}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`);
  const data = await response.json();
  const daily = data?.daily;
  if (!daily?.time) return undefined;
  const result: ForecastDay[] = daily.time.map((date: string, index: number) => ({
    date,
    weatherCode: daily.weather_code[index],
    tempMax: Math.round(daily.temperature_2m_max[index]),
    tempMin: Math.round(daily.temperature_2m_min[index]),
  }));
  forecastCache.set(forecastCacheKey(code, startDate), { code, days: result, fetchedAt: Date.now(), startDate: validIsoDate(startDate) ? startDate : undefined });
  return result;
}

export function useAirportWeather(code: string | undefined): AirportWeather | undefined {
  const [weather, setWeather] = useState<AirportWeather | undefined>(() => (code ? weatherCache.get(code) : undefined));

  useEffect(() => {
    setWeather(code ? weatherCache.get(code) : undefined);
    if (!code) return;

    let cancelled = false;
    const refreshIfStale = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const cached = weatherCache.get(code);
      if (cached && Date.now() - cached.fetchedAt < STALE_AFTER_MS) return;
      fetchAirportWeather(code)
        .then((fresh) => { if (fresh && !cancelled) setWeather(fresh); })
        .catch(() => {});
    };

    refreshIfStale();
    const onOnline = () => refreshIfStale();
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }, [code]);

  return weather;
}

export function useAirportForecastState(code: string | undefined, days: number, startDate?: string): AirportForecastState {
  const forecastWindow = code ? resolveLayoverWindow(code, days, startDate) : { startDate, days: normalizedDays(days) };
  const readCached = () => {
    if (!code) return undefined;
    const cached = cachedForecast(code, forecastWindow.days, forecastWindow.startDate);
    return cached ? selectForecastDays(cached.days, forecastWindow.days, forecastWindow.startDate) : undefined;
  };
  const initialForecast = readCached();
  const [forecast, setForecast] = useState<ForecastDay[] | undefined>(initialForecast);
  const [status, setStatus] = useState<ForecastLoadStatus>(() => initialForecast ? 'ready' : (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'loading'));
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const cachedNow = readCached();
    setForecast(cachedNow);
    if (!code) { setStatus('error'); return; }

    let cancelled = false;
    const refreshIfStale = (force = false) => {
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      const cached = cachedForecast(code, forecastWindow.days, forecastWindow.startDate);
      const cachedDays = cached ? selectForecastDays(cached.days, forecastWindow.days, forecastWindow.startDate) : undefined;
      if (cachedDays) {
        setForecast(cachedDays);
        if (!force && Date.now() - cached!.fetchedAt < STALE_AFTER_MS) {
          setStatus('ready');
          return;
        }
      }
      if (!online) {
        setStatus(cachedDays ? 'ready' : 'offline');
        return;
      }
      setStatus(cachedDays ? 'ready' : 'loading');
      fetchAirportForecast(code, forecastWindow.days, forecastWindow.startDate)
        .then((fresh) => {
          if (cancelled) return;
          const selected = fresh ? selectForecastDays(fresh, forecastWindow.days, forecastWindow.startDate) : undefined;
          if (selected?.length) {
            setForecast(selected);
            setStatus('ready');
          } else {
            setStatus(cachedDays ? 'ready' : 'error');
          }
        })
        .catch(() => {
          if (!cancelled) setStatus(cachedDays ? 'ready' : 'error');
        });
    };

    refreshIfStale(retryToken > 0);
    const onOnline = () => refreshIfStale(true);
    const onOffline = () => { if (!readCached()) setStatus('offline'); };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, [code, forecastWindow.days, forecastWindow.startDate, retryToken]);

  return { forecast, status, startDate: forecastWindow.startDate, retry: () => setRetryToken((value) => value + 1) };
}

export function useAirportForecast(code: string | undefined, days: number, startDate?: string): ForecastDay[] | undefined {
  return useAirportForecastState(code, days, startDate).forecast;
}

export function prefetchStationWeather(requests: { code: string; days: number; startDate?: string }[]): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const request of requests) {
    const { code } = request;
    const forecastWindow = resolveLayoverWindow(code, request.days, request.startDate);
    const cachedWeather = weatherCache.get(code);
    if (!cachedWeather || Date.now() - cachedWeather.fetchedAt >= STALE_AFTER_MS) fetchAirportWeather(code).catch(() => {});
    const cached = cachedForecast(code, forecastWindow.days, forecastWindow.startDate);
    if (!cached || Date.now() - cached.fetchedAt >= STALE_AFTER_MS) fetchAirportForecast(code, forecastWindow.days, forecastWindow.startDate).catch(() => {});
  }
}
