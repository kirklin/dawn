"use client";

import type { CSSProperties, Ref } from "react";
import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { GLOW_GRADIENT } from "./glow-style";

/** The compact line fades in once the hero has scrolled under the title. */
const COMPACT_STYLE: CSSProperties = { opacity: "clamp(0, calc((var(--scroll) - 120) / 40), 1)" };
const HERO_STYLE: CSSProperties = { opacity: "calc(1 - var(--scroll) / 140)" };

interface PlaceTitleBarProps {
  ref: Ref<HTMLElement>;
  name: string;
  current: boolean;
  compact: string | null;
  /** Cancel and Add, shown for a place that is not in the list yet. */
  actions: { onCancel: () => void; onAdd: () => void } | null;
}

/** Sticky title that stays pinned while the cards scroll under it, like the iOS Weather header. */
export function PlaceTitleBar({ ref, name, current, compact, actions }: PlaceTitleBarProps) {
  const t = useTranslations("Place");

  return (
    <header ref={ref} className="sticky top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-2 text-center">
      {actions && (
        <div className="-mx-1 flex h-10 items-center justify-between text-[17px]">
          <button type="button" onClick={actions.onCancel} className="h-9 px-1">
            {t("preview.cancel")}
          </button>
          <button type="button" onClick={actions.onAdd} className="h-9 px-1 font-semibold">
            {t("preview.add")}
          </button>
        </div>
      )}
      {current && (
        <p className="flex items-center justify-center gap-1 text-[13px] font-semibold text-white/90">
          <Navigation className="size-3 fill-current" strokeWidth={0} />
          {t("myLocation")}
        </p>
      )}
      <h1 className="truncate text-[34px] leading-[41px]">{name}</h1>
      <p className="h-6 truncate text-[17px] font-semibold" style={COMPACT_STYLE}>
        {compact}
      </p>
    </header>
  );
}

export interface HeroContent {
  /** 今天晚霞 18:04 · 2小时11分后 */
  heading: string;
  level: string;
  score: number;
  /** 鲜艳度 33% */
  meter: string;
  /** ECMWF 21% · GFS 0% */
  models: string;
  /** Where to look and the golden and blue hour of the event, in the order they happen. */
  facts: { label: string; value: string }[];
}

/** The selected glow event: when, how vivid by each model, where to look and the light around it. */
export function PlaceHero({ content }: { content: HeroContent | null }) {
  const t = useTranslations("Place");

  return (
    <section className="px-4 pb-5 text-center [text-shadow:0_1px_8px_rgb(0_0_0/0.3)]" style={HERO_STYLE}>
      {content
        ? (
            <>
              <p className="text-[15px] font-semibold text-white/90 tabular-nums">{content.heading}</p>
              <p className="mt-0.5 text-[64px] leading-none font-extralight whitespace-nowrap">{content.level}</p>
              <div className="mt-3 flex items-center justify-center gap-2.5">
                <span className="relative h-1.5 w-40 rounded-full bg-white/20">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: GLOW_GRADIENT, clipPath: `inset(0 ${(1 - content.score) * 100}% 0 0 round 3px)` }}
                  />
                </span>
                <span className="text-[15px] font-semibold tabular-nums">{content.meter}</span>
              </div>
              <p className="mt-1 text-[13px] text-white/70 tabular-nums">{content.models}</p>
              <dl className="mx-auto mt-3 grid max-w-sm grid-cols-3 gap-2">
                {content.facts.map(fact => (
                  <div key={fact.label}>
                    <dt className="text-[12px] text-white/65">{fact.label}</dt>
                    <dd className="text-[15px] font-medium whitespace-nowrap tabular-nums">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )
        : <p className="text-[20px] font-medium">{t("noEvents")}</p>}
    </section>
  );
}
