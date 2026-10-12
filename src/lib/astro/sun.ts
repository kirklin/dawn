import type { AstroTime } from "astronomy-engine";
import type { TimeRange } from "./constants";
import { Body, Equator, Horizon, Observer, SearchAltitude, SearchHourAngle, SearchRiseSet } from "astronomy-engine";
import { addDays, DAY_MS, MINUTE_MS, minutesOfDay, zonedMidnight } from "~/lib/time/zoned";
import {
  ASTRONOMICAL_TWILIGHT,
  BLUE_HOUR_BOTTOM,
  CURVE_STEP_MINUTES,
  GOLDEN_HOUR_BOTTOM,
  GOLDEN_HOUR_TOP,
  NAUTICAL_TWILIGHT,
} from "./constants";

export interface SunDay {
  date: string;
  start: number;
  end: number;
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  /** Civil dawn: the sun 6° below the horizon, rising. */
  firstLight: number | null;
  /** Civil dusk: the sun 6° below the horizon, setting. */
  lastLight: number | null;
  nauticalDawn: number | null;
  nauticalDusk: number | null;
  astronomicalDawn: number | null;
  astronomicalDusk: number | null;
  goldenMorning: TimeRange | null;
  blueMorning: TimeRange | null;
  goldenEvening: TimeRange | null;
  blueEvening: TimeRange | null;
  sunriseAzimuth: number | null;
  sunsetAzimuth: number | null;
  /** Apparent altitude every CURVE_STEP_MINUTES from `start` to `end` inclusive. */
  altitudes: number[];
}

export function createObserver(lat: number, lon: number, elevation: number) {
  return new Observer(lat, lon, elevation);
}

function toEpoch(time: AstroTime | null) {
  return time ? time.date.getTime() : null;
}

function inside(time: number | null, start: number, end: number) {
  return time !== null && time >= start && time < end ? time : null;
}

function range(start: number | null, end: number | null): TimeRange | null {
  return start !== null && end !== null && start < end ? [start, end] : null;
}

export function sunHorizontal(observer: Observer, time: number) {
  const equatorial = Equator(Body.Sun, new Date(time), observer, true, true);
  return Horizon(new Date(time), observer, equatorial.ra, equatorial.dec, "normal");
}

export function sunDay(observer: Observer, date: string, timeZone: string): SunDay {
  const start = zonedMidnight(date, timeZone);
  const end = zonedMidnight(addDays(date, 1), timeZone);
  const limitDays = (end - start) / DAY_MS;
  const from = new Date(start);

  const riseSet = (direction: 1 | -1) =>
    inside(toEpoch(SearchRiseSet(Body.Sun, observer, direction, from, limitDays)), start, end);
  const altitude = (direction: 1 | -1, degrees: number) =>
    inside(toEpoch(SearchAltitude(Body.Sun, observer, direction, from, limitDays, degrees)), start, end);

  const sunrise = riseSet(1);
  const sunset = riseSet(-1);
  const goldenLowRising = altitude(1, GOLDEN_HOUR_BOTTOM);
  const goldenLowSetting = altitude(-1, GOLDEN_HOUR_BOTTOM);
  const firstLight = altitude(1, BLUE_HOUR_BOTTOM);
  const lastLight = altitude(-1, BLUE_HOUR_BOTTOM);

  const samples = Math.round((end - start) / (CURVE_STEP_MINUTES * MINUTE_MS));
  const altitudes = Array.from({ length: samples + 1 }, (_, index) =>
    sunHorizontal(observer, start + index * CURVE_STEP_MINUTES * MINUTE_MS).altitude);

  return {
    date,
    start,
    end,
    sunrise,
    sunset,
    solarNoon: SearchHourAngle(Body.Sun, observer, 0, from, 1).time.date.getTime(),
    firstLight,
    lastLight,
    nauticalDawn: altitude(1, NAUTICAL_TWILIGHT),
    nauticalDusk: altitude(-1, NAUTICAL_TWILIGHT),
    astronomicalDawn: altitude(1, ASTRONOMICAL_TWILIGHT),
    astronomicalDusk: altitude(-1, ASTRONOMICAL_TWILIGHT),
    goldenMorning: range(goldenLowRising, altitude(1, GOLDEN_HOUR_TOP)),
    blueMorning: range(firstLight, goldenLowRising),
    goldenEvening: range(altitude(-1, GOLDEN_HOUR_TOP), goldenLowSetting),
    blueEvening: range(goldenLowSetting, lastLight),
    sunriseAzimuth: sunrise === null ? null : sunHorizontal(observer, sunrise).azimuth,
    sunsetAzimuth: sunset === null ? null : sunHorizontal(observer, sunset).azimuth,
    altitudes,
  };
}

/** Next sunrise or sunset after `time`, searched up to `limitDays` ahead. */
export function nextSunEvent(observer: Observer, direction: 1 | -1, time: number, limitDays: number) {
  const event = toEpoch(SearchRiseSet(Body.Sun, observer, direction, new Date(time), limitDays));
  return event === null ? null : { time: event, azimuth: sunHorizontal(observer, event).azimuth };
}

export interface MonthlySunTimes {
  month: number;
  /** Average wall-clock minutes after midnight. */
  sunrise: number | null;
  sunset: number | null;
}

export interface SunYear {
  year: number;
  months: MonthlySunTimes[];
  longestDay: { date: string; minutes: number } | null;
}

export function sunYear(observer: Observer, year: number, timeZone: string): SunYear {
  const totals = Array.from({ length: 12 }, () => ({ sunrise: 0, sunriseDays: 0, sunset: 0, sunsetDays: 0 }));
  let longestDay: SunYear["longestDay"] = null;

  for (let date = `${year}-01-01`; date.startsWith(String(year)); date = addDays(date, 1)) {
    const start = zonedMidnight(date, timeZone);
    const end = zonedMidnight(addDays(date, 1), timeZone);
    const limitDays = (end - start) / DAY_MS;
    const sunrise = inside(toEpoch(SearchRiseSet(Body.Sun, observer, 1, new Date(start), limitDays)), start, end);
    const sunset = inside(toEpoch(SearchRiseSet(Body.Sun, observer, -1, new Date(start), limitDays)), start, end);
    const month = Number(date.slice(5, 7)) - 1;

    if (sunrise !== null) {
      totals[month].sunrise += minutesOfDay(sunrise, timeZone);
      totals[month].sunriseDays += 1;
    }
    if (sunset !== null) {
      totals[month].sunset += minutesOfDay(sunset, timeZone);
      totals[month].sunsetDays += 1;
    }
    if (sunrise !== null && sunset !== null && sunset > sunrise) {
      const minutes = (sunset - sunrise) / MINUTE_MS;
      if (!longestDay || minutes > longestDay.minutes) {
        longestDay = { date, minutes };
      }
    }
  }

  return {
    year,
    months: totals.map((total, index) => ({
      month: index + 1,
      sunrise: total.sunriseDays > 0 ? total.sunrise / total.sunriseDays : null,
      sunset: total.sunsetDays > 0 ? total.sunset / total.sunsetDays : null,
    })),
    longestDay,
  };
}
