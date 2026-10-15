"use client";

import { useTranslations } from "next-intl";
import { formatMonthDay, formatWeekday, splitDuration } from "~/lib/format";
import { addDays, daysBetween, zonedDateKey } from "~/lib/time/zoned";

/** From this many days ahead a weekday could be this week's or next, so days go by their date. */
const DATED_FROM_DAYS = 7;

const CARDINALS = [
  { degrees: 0, base: "north", clockwise: "east", counter: "west" },
  { degrees: 90, base: "east", clockwise: "south", counter: "north" },
  { degrees: 180, base: "south", clockwise: "west", counter: "east" },
  { degrees: 270, base: "west", clockwise: "north", counter: "south" },
  { degrees: 360, base: "north", clockwise: "east", counter: "west" },
] as const;

export function useLabels(timeZone: string, now: number) {
  const common = useTranslations("Common");
  const direction = useTranslations("Direction");
  const today = zonedDateKey(now, timeZone);

  /** 今天 / 明天 / 后天 / 周四 */
  const relativeDay = (dateKey: string, time: number) => {
    if (dateKey === today) {
      return common("today");
    }
    if (dateKey === addDays(today, 1)) {
      return common("tomorrow");
    }
    if (dateKey === addDays(today, 2)) {
      return common("dayAfterTomorrow");
    }
    return formatWeekday(time, timeZone);
  };

  return {
    /** 今天 / 明天 / 后天 / 周四, and 10月23日 from a week ahead */
    day(dateKey: string, time: number) {
      return daysBetween(today, dateKey) >= DATED_FROM_DAYS ? formatMonthDay(time, timeZone) : relativeDay(dateKey, time);
    },
    /** 今天 10月16日 / 周四 10月23日 */
    heading(dateKey: string, time: number) {
      return `${relativeDay(dateKey, time)} ${formatMonthDay(time, timeZone)}`;
    },
    /** 6小时39分钟 / 6小时 / 39分钟 */
    duration(ms: number) {
      const { hours, minutes } = splitDuration(ms);
      if (hours === 0) {
        return common("durationMinutes", { minutes });
      }
      return minutes === 0 ? common("durationHours", { hours }) : common("duration", { hours, minutes });
    },
    /** 西偏南8° */
    azimuth(degrees: number) {
      const normalized = ((degrees % 360) + 360) % 360;
      const nearest = CARDINALS.reduce((best, entry) =>
        Math.abs(normalized - entry.degrees) < Math.abs(normalized - best.degrees) ? entry : best);
      const offset = Math.round(normalized - nearest.degrees);
      if (offset === 0) {
        return direction("exact", { base: direction(nearest.base) });
      }
      return direction("offset", {
        base: direction(nearest.base),
        side: direction(offset > 0 ? nearest.clockwise : nearest.counter),
        degrees: Math.abs(offset),
      });
    },
  };
}

export type Labels = ReturnType<typeof useLabels>;
