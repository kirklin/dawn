"use client";

import type { GlowEvent } from "~/lib/forecast/types";
import { Layers2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { MODEL_IDS } from "~/lib/forecast/models";
import { formatPercent } from "~/lib/format";
import { percent } from "../glow-style";

const LAYERS = ["high", "mid", "low"] as const;

/** Cloud layers over the observer when the event is scored, averaged over the cloud models. */
export function LayersCard({ event }: { event: GlowEvent }) {
  const t = useTranslations("Place.layers");
  const glow = useTranslations("Glow");
  const cover = (layer: (typeof LAYERS)[number]) =>
    MODEL_IDS.reduce((sum, model) => sum + event.models[model].section[0][layer], 0) / MODEL_IDS.length;

  return (
    <SkyCard title={t("title", { sun: glow(`sun.${event.kind}`) })} icon={Layers2}>
      <ul className="space-y-3">
        {LAYERS.map((layer) => {
          const value = cover(layer);
          return (
            <li key={layer}>
              <div className="flex items-baseline justify-between text-[15px]">
                <span>{t(layer)}</span>
                <span className="text-[20px] font-medium tabular-nums">{`${formatPercent(value)}%`}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-black/25">
                <div className="h-full rounded-full bg-white/85" style={{ width: percent(value) }} />
              </div>
            </li>
          );
        })}
      </ul>
    </SkyCard>
  );
}
