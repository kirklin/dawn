export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(epochMs)) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Offset of `timeZone` from UTC at the instant `epochMs`, in milliseconds. */
export function zoneOffsetMs(epochMs: number, timeZone: string) {
  const p = zonedParts(epochMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** Local calendar date ("2026-10-12") of an instant in `timeZone`. */
export function zonedDateKey(epochMs: number, timeZone: string) {
  const p = zonedParts(epochMs, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Instant of local midnight that starts `dateKey` in `timeZone`. */
export function zonedMidnight(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day);
  let guess = wallClock - zoneOffsetMs(wallClock, timeZone);
  guess = wallClock - zoneOffsetMs(guess, timeZone);
  return guess;
}

export function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to`, both "2026-10-12" keys. */
export function daysBetween(from: string, to: string) {
  const utc = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** Minutes after local midnight of an instant, used for clock-face comparisons across days. */
export function minutesOfDay(epochMs: number, timeZone: string) {
  const p = zonedParts(epochMs, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}
