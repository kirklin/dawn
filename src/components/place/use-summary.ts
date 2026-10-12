"use client";

import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { MODEL_DISAGREEMENT } from "~/lib/forecast/glow";
import { MODEL_IDS } from "~/lib/forecast/models";
import { formatPercent } from "~/lib/format";

/** Mean of a glow factor over the cloud models. */
export function meanFactor(event: GlowEvent, pick: (factors: GlowEvent["models"][keyof GlowEvent["models"]]["factors"]) => number) {
  return MODEL_IDS.reduce((sum, model) => sum + pick(event.models[model].factors), 0) / MODEL_IDS.length;
}

/** One-paragraph explanation of the coming glow, like the description line atop iOS Weather. */
export function useSummary(event: GlowEvent | null, dayLabel: string) {
  const t = useTranslations("Place.summary");
  const glow = useTranslations("Glow");
  if (!event) {
    return null;
  }

  const sun = glow(`sun.${event.kind}`);
  const canvas = meanFactor(event, factors => factors.canvasCover);
  const transmission = meanFactor(event, factors => factors.transmission);
  const view = meanFactor(event, factors => factors.view);

  const canvasKey = canvas < 0.05 ? "none" : canvas < 0.25 ? "few" : canvas < 0.8 ? "some" : "full";
  const pathKey = transmission >= 0.7 ? "clear" : transmission >= 0.35 ? "partial" : "blocked";
  const parts = [
    t(`canvas.${canvasKey}`, { percent: formatPercent(canvas) }),
    t(`path.${pathKey}`, { sun }),
  ];
  if (view < 0.5) {
    parts.push(t("view"));
  }

  const eventName = glow(`event.${event.kind}`);
  const conclusion = event.level === "none"
    ? t("conclusionNone", { event: eventName })
    : t("conclusion", { event: eventName, level: glow(`level.${event.level}`) });

  return [
    t("lead", { day: dayLabel, sun }),
    parts.join("，"),
    "，",
    conclusion,
    event.spread >= MODEL_DISAGREEMENT ? t("uncertain") : "",
  ].join("");
}
