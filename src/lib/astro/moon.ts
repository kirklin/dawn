import type { Observer } from "astronomy-engine";
import { Body, Equator, Horizon, Illumination, MoonPhase, NextMoonQuarter, SearchMoonQuarter, SearchRiseSet } from "astronomy-engine";

export type MoonPhaseName
  = | "new"
    | "waxingCrescent"
    | "firstQuarter"
    | "waxingGibbous"
    | "full"
    | "waningGibbous"
    | "thirdQuarter"
    | "waningCrescent";

/** The Moon's elongation moves about 12.2° a day, so ±6° names the quarter phases for roughly one day. */
const QUARTER_TOLERANCE = 6;

export function moonPhaseName(phaseAngle: number): MoonPhaseName {
  const angle = ((phaseAngle % 360) + 360) % 360;
  const near = (target: number) => Math.abs(((angle - target + 540) % 360) - 180) <= QUARTER_TOLERANCE;
  if (near(0)) {
    return "new";
  }
  if (near(90)) {
    return "firstQuarter";
  }
  if (near(180)) {
    return "full";
  }
  if (near(270)) {
    return "thirdQuarter";
  }
  if (angle < 90) {
    return "waxingCrescent";
  }
  if (angle < 180) {
    return "waxingGibbous";
  }
  if (angle < 270) {
    return "waningGibbous";
  }
  return "waningCrescent";
}

export interface MoonState {
  /** Sun–Moon elongation in ecliptic longitude, 0 = new, 180 = full. */
  phaseAngle: number;
  /** Illuminated fraction of the disc, 0–1. */
  illumination: number;
  phase: MoonPhaseName;
}

export function moonState(time: number): MoonState {
  const phaseAngle = MoonPhase(new Date(time));
  return {
    phaseAngle,
    illumination: Illumination(Body.Moon, new Date(time)).phase_fraction,
    phase: moonPhaseName(phaseAngle),
  };
}

export type MoonQuarterName = "new" | "firstQuarter" | "full" | "thirdQuarter";

const QUARTER_NAMES: MoonQuarterName[] = ["new", "firstQuarter", "full", "thirdQuarter"];

export interface MoonQuarterEvent {
  quarter: MoonQuarterName;
  time: number;
}

export function upcomingQuarters(time: number, count: number): MoonQuarterEvent[] {
  const events: MoonQuarterEvent[] = [];
  let quarter = SearchMoonQuarter(new Date(time));
  while (events.length < count) {
    events.push({ quarter: QUARTER_NAMES[quarter.quarter], time: quarter.time.date.getTime() });
    quarter = NextMoonQuarter(quarter);
  }
  return events;
}

export function nextMoonEvent(observer: Observer, direction: 1 | -1, time: number, limitDays: number) {
  const event = SearchRiseSet(Body.Moon, observer, direction, new Date(time), limitDays);
  return event ? event.date.getTime() : null;
}

export function moonAltitude(observer: Observer, time: number) {
  const equatorial = Equator(Body.Moon, new Date(time), observer, true, true);
  return Horizon(new Date(time), observer, equatorial.ra, equatorial.dec, "normal").altitude;
}
