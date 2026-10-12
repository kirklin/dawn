"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";

/** The compact line fades in once the hero has scrolled under the title. */
const COMPACT_STYLE: CSSProperties = { opacity: "clamp(0, calc((var(--scroll) - 150) / 40), 1)" };
const HERO_STYLE: CSSProperties = { opacity: "calc(1 - var(--scroll) / 180)" };

interface PlaceTitleBarProps {
  ref: Ref<HTMLElement>;
  name: string;
  current: boolean;
  compact: string;
}

/** Place name pinned at the top while the cards scroll under it. */
export function PlaceTitleBar({ ref, name, current, compact }: PlaceTitleBarProps) {
  const t = useTranslations("Place");

  return (
    <header ref={ref} className="text-on-sky sticky top-0 z-20 pt-[calc(env(safe-area-inset-top)+12px)] pb-2">
      <div className="mx-auto max-w-xl px-8">
        <h1 className="flex items-center gap-1.5 text-[28px] leading-[34px] font-medium">
          <span className="truncate">{name}</span>
          {current && <Navigation aria-label={t("myLocation")} className="size-4 shrink-0 fill-current" strokeWidth={0} />}
        </h1>
        <p className="h-5 truncate text-[15px] leading-5 text-white/85 tabular-nums" style={COMPACT_STYLE}>
          {compact}
        </p>
      </div>
    </header>
  );
}

interface PlaceHeroProps {
  /** The moment shown, as a clock time. */
  time: string;
  /** What the moment is: the countdown to the next sunrise or sunset, or the light at a chosen moment. */
  context: string;
  /** Returns to the present; given while another moment is shown. */
  onNow: (() => void) | null;
  /** The sun's path, edge to edge across the page column, which moves the moment. */
  children: ReactNode;
}

/** The time at the place, the light it brings, and the sun's path through the day. */
export function PlaceHero({ time, context, onNow, children }: PlaceHeroProps) {
  const t = useTranslations("Place.hero");

  return (
    <section className="pt-1 pb-[clamp(3rem,8svh,6rem)]" style={HERO_STYLE}>
      <div className="mx-auto max-w-xl px-8">
        <div className="text-on-sky flex items-end justify-between gap-3">
          <p className="text-[64px] leading-[72px] font-extralight tabular-nums">{time}</p>
          {onNow && (
            <button type="button" onClick={onNow} className="sky-material mb-3 h-8 shrink-0 rounded-full px-3.5 text-[15px] [text-shadow:none]">
              {t("now")}
            </button>
          )}
        </div>
        <p className="text-on-sky text-[17px] leading-6 tabular-nums">{context}</p>
      </div>
      <div className="mx-auto mt-5 max-w-xl">{children}</div>
    </section>
  );
}
