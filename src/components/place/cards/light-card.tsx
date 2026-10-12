"use client";

import type { Labels } from "../use-labels";
import type { SunDay } from "~/lib/astro/sun";
import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { lightPhases } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { LIGHT_PHASES, percent } from "../glow-style";

interface LightCardProps {
  event: GlowEvent;
  days: SunDay[];
  timeZone: string;
  labels: Labels;
}

/** When the sun crosses the horizon for the selected glow, where, and the golden and blue hour around it. */
export function LightCard({ event, days, timeZone, labels }: LightCardProps) {
  const t = useTranslations("Place.light");
  const glow = useTranslations("Glow");
  const phases = lightPhases(event, days);
  const clock = (time: number) => formatClock(time, timeZone);

  const start = phases.length > 0 ? phases[0].range[0] : event.time;
  const end = phases.length > 0 ? phases[phases.length - 1].range[1] : event.time;
  const at = (time: number) => (end > start ? (time - start) / (end - start) : 0.5);

  return (
    <SkyCard wide title={glow(`sun.${event.kind}`)} accessory={<span className="tabular-nums">{t("direction", { direction: labels.azimuth(event.azimuth) })}</span>}>
      <p className="mt-2 text-[34px] leading-10 tabular-nums">{clock(event.time)}</p>
      {phases.length > 0 && (
        <>
          <div className="relative mt-4 h-1.5">
            <div className="relative h-full overflow-hidden rounded-full bg-white/15">
              {phases.map(phase => (
                <span
                  key={phase.kind}
                  className="absolute inset-y-0"
                  style={{
                    left: percent(at(phase.range[0])),
                    width: percent(at(phase.range[1]) - at(phase.range[0])),
                    background: LIGHT_PHASES[phase.kind].bar,
                  }}
                />
              ))}
            </div>
            <span
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(14_17_31)]"
              style={{ left: percent(at(event.time)) }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            {phases.map(phase => (
              <div key={phase.kind}>
                <dt className="flex items-center gap-1.5 text-[13px] leading-[18px] text-white/60">
                  <span className="size-2 rounded-full" style={{ background: LIGHT_PHASES[phase.kind].dot }} />
                  {t(phase.kind)}
                </dt>
                <dd className="mt-0.5 text-[17px] leading-[22px] tabular-nums">{`${clock(phase.range[0])}–${clock(phase.range[1])}`}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </SkyCard>
  );
}
