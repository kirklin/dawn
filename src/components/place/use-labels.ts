"use client";

import { useTranslations } from "next-intl";
import { formatWeekday, splitDuration } from "~/lib/format";
import { addDays, zonedDateKey } from "~/lib/time/zoned";

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

  return {
    /** 今天 / 明天 / 后天 / 周四 */
    day(dateKey: string, time: number) {
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
    },
    duration(ms: number) {
      const { hours, minutes } = splitDuration(ms);
      return hours > 0 ? common("duration", { hours, minutes }) : common("durationMinutes", { minutes });
    },
    /** 西偏南 8° */
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
