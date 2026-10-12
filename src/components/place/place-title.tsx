"use client";

import type { CSSProperties, Ref } from "react";
import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";

/** The compact line fades in once the hero has scrolled under the title. */
const COMPACT_STYLE: CSSProperties = { opacity: "clamp(0, calc((var(--scroll) - 130) / 40), 1)" };
const HERO_STYLE: CSSProperties = { opacity: "calc(1 - var(--scroll) / 150)" };

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
        <div className="-mx-1 mb-1 flex items-center justify-between text-[17px]">
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

interface PlaceHeroProps {
  level: string | null;
  line: string | null;
  times: string | null;
}

export function PlaceHero({ level, line, times }: PlaceHeroProps) {
  const t = useTranslations("Place");

  return (
    <section className="px-4 pb-10 text-center" style={HERO_STYLE}>
      {level
        ? (
            <>
              <p className="text-[76px] leading-none font-thin whitespace-nowrap">{level}</p>
              <p className="mt-3 text-[20px] font-medium">{line}</p>
            </>
          )
        : <p className="text-[20px] font-medium">{t("noEvents")}</p>}
      {times && <p className="mt-0.5 text-[17px] font-medium text-white/80 tabular-nums">{times}</p>}
    </section>
  );
}
