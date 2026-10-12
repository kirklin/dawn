import { MINUTE_MS } from "~/lib/time/zoned";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat("zh-CN", { timeZone, ...options });
    formatters.set(key, cached);
  }
  return cached;
}

/** "18:04" */
export function formatClock(time: number, timeZone: string) {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);
}

/** "周一" */
export function formatWeekday(time: number, timeZone: string) {
  return formatter(timeZone, { weekday: "short" }).format(time);
}

/** "12日08时" */
export function formatRunTime(time: number, timeZone: string) {
  return formatter(timeZone, { day: "numeric", hour: "2-digit", hourCycle: "h23" }).format(time).replace(/\s/g, "");
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / MINUTE_MS));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function formatPercent(fraction: number) {
  return Math.round(fraction * 100);
}

/** Glow score as a percentage, rounded down so a score never shows the threshold of a level it has not reached. */
export function formatScore(score: number) {
  return Math.floor(score * 100);
}
