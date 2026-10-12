"use client";

import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { aerosolLevel } from "~/lib/forecast/glow";
import { formatPercent } from "~/lib/format";
import { canvasKey, glowFactors, lowKey, pathKey } from "../glow-factors";
import { AEROSOL_GRADIENT, CANVAS_GRADIENT, LOW_GRADIENT, PATH_GRADIENT } from "../glow-style";
import { MetricBar, MetricCard } from "../metric";

/** Why the selected glow is rated as it is: the clouds to light, the light's way in, the air and the view. */
export function FactorCards({ event }: { event: GlowEvent }) {
  const t = useTranslations("Place.factors");
  const factors = glowFactors(event);

  return (
    <>
      <MetricCard
        title={t("canvas.title")}
        value={String(formatPercent(factors.canvas))}
        unit="%"
        note={t(`canvas.note.${canvasKey(factors.canvas)}`)}
        bar={<MetricBar gradient={CANVAS_GRADIENT} fill={factors.canvas} />}
      />
      <MetricCard
        title={t("path.title")}
        value={String(formatPercent(factors.path))}
        unit="%"
        note={t(`path.note.${pathKey(factors.path)}`)}
        bar={<MetricBar gradient={PATH_GRADIENT} fill={factors.path} />}
      />
      <MetricCard
        title={t("air.title")}
        value={factors.aod === null ? "--" : factors.aod.toFixed(2)}
        note={factors.aod === null ? t("air.unavailable") : t(`air.note.${aerosolLevel(factors.aod)}`)}
        bar={<MetricBar gradient={AEROSOL_GRADIENT} mark={factors.aod ?? undefined} />}
      />
      <MetricCard
        title={t("low.title")}
        value={String(formatPercent(factors.low))}
        unit="%"
        note={t(`low.note.${lowKey(factors.low)}`)}
        bar={<MetricBar gradient={LOW_GRADIENT} fill={factors.low} />}
      />
    </>
  );
}
