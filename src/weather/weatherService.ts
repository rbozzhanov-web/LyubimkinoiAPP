import { useEffect, useState } from 'react';
import { airportCoords } from './airports';

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
type AirportForecast = { code: string; days: ForecastDay[]; fetchedAt: number };

const STALE_AFTER_MS = 45 * 60 * 1000;

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

// Same key as before this cache helper was generalized — do not change it, or every
// device's already-accumulated weather cache is silently discarded.
const weatherCache = makeCache<AirportWeather>('khavair.weather.v1');
const forecastCache = makeCache<AirportForecast>('khavair.forecast.v1');

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

async function fetchAirportForecast(code: string, days: number): Promise<ForecastDay[] | undefined> {
  const coords = airportCoords(code);
  if (!coords) return undefined;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${days}`;
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
  forecastCache.set(code, { code, days: result, fetchedAt: Date.now() });
  return result;
}

/**
 * Always renders whatever is cached immediately — no loading state blocks the first
 * paint. A background refresh only ever fires when the cache is stale AND the
 * browser reports it's online; offline (or a fresh cache) is a pure no-op, so
 * going offline never triggers a retry loop or a delay — just the last known reading.
 */
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
        .catch(() => { /* keep showing whatever was cached (or nothing) — never surface a fetch error here */ });
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

/** Same immediate-cache/background-refresh shape as useAirportWeather, for the daily forecast. */
export function useAirportForecast(code: string | undefined, days: number): ForecastDay[] | undefined {
  const [forecast, setForecast] = useState<ForecastDay[] | undefined>(() => (code ? forecastCache.get(code)?.days : undefined));

  useEffect(() => {
    setForecast(code ? forecastCache.get(code)?.days : undefined);
    if (!code) return;

    let cancelled = false;
    const refreshIfStale = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const cached = forecastCache.get(code);
      if (cached && cached.days.length >= days && Date.now() - cached.fetchedAt < STALE_AFTER_MS) return;
      fetchAirportForecast(code, days)
        .then((fresh) => { if (fresh && !cancelled) setForecast(fresh); })
        .catch(() => { /* keep showing whatever was cached (or nothing) — never surface a fetch error here */ });
    };

    refreshIfStale();
    const onOnline = () => refreshIfStale();
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }, [code, days]);

  return forecast;
}

/**
 * Fire-and-forget warm-up for stations the user is about to care about (upcoming duties'
 * arrival airports), so the chip and its forecast popup already have data by the time the
 * user opens them — not just whichever flight happens to be on screen right now.
 */
export function prefetchStationWeather(requests: { code: string; days: number }[]): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const { code, days } of requests) {
    const cachedWeather = weatherCache.get(code);
    if (!cachedWeather || Date.now() - cachedWeather.fetchedAt >= STALE_AFTER_MS) fetchAirportWeather(code).catch(() => {});
    const cachedForecast = forecastCache.get(code);
    if (!cachedForecast || cachedForecast.days.length < days || Date.now() - cachedForecast.fetchedAt >= STALE_AFTER_MS) fetchAirportForecast(code, days).catch(() => {});
  }
}
