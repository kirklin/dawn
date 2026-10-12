"use client";

import { Haze } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { aerosolLevel } from "~/lib/forecast/glow";
import { AEROSOL_GRADIENT, percent } from "../glow-style";

/** Aerosol optical depth along the light path, shown like the iOS UV index tile. */
export function AerosolCard({ aod }: { aod: number | null }) {
  const t = useTranslations("Place.aerosol");
  const level = aod === null ? null : aerosolLevel(aod);

  return (
    <SkyCard title={t("title")} icon={Haze}>
      {aod === null || level === null
        ? <p className="text-[15px] text-white/70">{t("unavailable")}</p>
        : (
            <>
              <p className="text-[34px] leading-tight tabular-nums">{aod.toFixed(2)}</p>
              <p className="text-[17px] font-semibold">{t(`level.${level}`)}</p>
              <div className="relative mt-3 h-[5px] rounded-full" style={{ background: AEROSOL_GRADIENT }}>
                <span
                  className="absolute top-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/50 bg-white"
                  style={{ left: percent(aod) }}
                />
              </div>
              <p className="mt-3 text-[15px] leading-snug">{t(`description.${level}`)}</p>
            </>
          )}
    </SkyCard>
  );
}
