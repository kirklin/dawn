"use client";

import type { Labels } from "../use-labels";
import type { ModelId } from "~/lib/forecast/models";
import type { GlowEvent } from "~/lib/forecast/types";
import { ChartSpline } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SkyCard } from "~/components/ios/sky-card";
import { MODEL_IDS } from "~/lib/forecast/models";
import { cn } from "~/lib/utils";
import { SectionChart } from "../section-chart";

const MODEL_NAMES: Record<ModelId, string> = { ecmwf: "ECMWF", gfs: "GFS" };

interface SectionCardProps {
  event: GlowEvent;
  labels: Labels;
}

export function SectionCard({ event, labels }: SectionCardProps) {
  const t = useTranslations("Place.section");
  const glow = useTranslations("Glow");
  const [model, setModel] = useState<ModelId>("ecmwf");

  return (
    <SkyCard wide title={t("title")} icon={ChartSpline}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px]">
          {t("direction", { sun: glow(`sun.${event.kind}`), direction: labels.azimuth(event.azimuth) })}
        </p>
        <div className="flex rounded-lg bg-black/25 p-0.5 text-[13px] font-medium">
          {MODEL_IDS.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setModel(id)}
              className={cn("rounded-md px-2.5 py-1", id === model ? "bg-white/25" : "text-white/60")}
            >
              {MODEL_NAMES[id]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <ul className="flex shrink-0 flex-col justify-around py-1 text-[11px] text-white/60">
          <li>{t("high")}</li>
          <li>{t("mid")}</li>
          <li>{t("low")}</li>
        </ul>
        <div className="flex-1">
          <SectionChart section={event.models[model].section} />
          <div className="flex justify-between text-[11px] text-white/60">
            <span>{t("local")}</span>
            <span>{t("distance", { km: 400 })}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-white/60">{t("ray")}</p>
    </SkyCard>
  );
}
