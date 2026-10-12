import type { AstroTime } from "astronomy-engine";
import type { TimeRange } from "./constants";
import { Body, Equator, Horizon, Observer, SearchAltitude, SearchRiseSet } from "astronomy-engine";
import { addDays, DAY_MS, MINUTE_MS, zonedMidnight } from "~/lib/time/zoned";
import { BLUE_HOUR_BOTTOM, CURVE_STEP_MINUTES, GOLDEN_HOUR_BOTTOM, GOLDEN_HOUR_TOP } from "./constants";

export interface SunDay {
  date: string;
  start: number;
  end: number;
  sunrise: number | null;
  sunset: number | null;
  /** From civil dawn, the sun 6° below the horizon, to the morning golden hour. */
  blueMorning: TimeRange | null;
  goldenMorning: TimeRange | null;
  goldenEvening: TimeRange | null;
  /** From the evening golden hour to civil dusk. */
  blueEvening: TimeRange | null;
  sunriseAzimuth: number | null;
  sunsetAzimuth: number | null;
  /** Apparent altitude every CURVE_STEP_MINUTES from `start` to `end` inclusive. */
  altitudes: number[];
  /** Azimuth, degrees clockwise from north, at the same instants. */
  azimuths: number[];
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

/** Hundredths of a degree are finer than the curve is drawn and keep the page payload small. */
function roundAngle(degrees: number) {
  return Math.round(degrees * 100) / 100;
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
  const positions = Array.from({ length: samples + 1 }, (_, index) =>
    sunHorizontal(observer, start + index * CURVE_STEP_MINUTES * MINUTE_MS));

  return {
    date,
    start,
    end,
    sunrise,
    sunset,
    blueMorning: range(firstLight, goldenLowRising),
    goldenMorning: range(goldenLowRising, altitude(1, GOLDEN_HOUR_TOP)),
    goldenEvening: range(altitude(-1, GOLDEN_HOUR_TOP), goldenLowSetting),
    blueEvening: range(goldenLowSetting, lastLight),
    sunriseAzimuth: sunrise === null ? null : sunHorizontal(observer, sunrise).azimuth,
    sunsetAzimuth: sunset === null ? null : sunHorizontal(observer, sunset).azimuth,
    altitudes: positions.map(position => roundAngle(position.altitude)),
    azimuths: positions.map(position => roundAngle(position.azimuth)),
  };
}

/** Next sunrise or sunset after `time`, searched up to `limitDays` ahead. */
export function nextSunEvent(observer: Observer, direction: 1 | -1, time: number, limitDays: number) {
  const event = toEpoch(SearchRiseSet(Body.Sun, observer, direction, new Date(time), limitDays));
  return event === null ? null : { time: event, azimuth: sunHorizontal(observer, event).azimuth };
}
