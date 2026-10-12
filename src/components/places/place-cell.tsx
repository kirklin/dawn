"use client";

import type { ReactNode } from "react";
import type { PlaceSummary } from "~/lib/forecast/summary";
import type { SavedPlace } from "~/lib/places/store";
import { useTranslations } from "next-intl";
import { SwipeRow } from "~/components/ios/swipe-row";
import { useNow } from "~/components/ios/use-now";
import { useLabels } from "~/components/place/use-labels";
import { rgb, skyColors } from "~/components/sky/palette";
import { formatClock } from "~/lib/format";
import { Link } from "~/lib/i18n/navigation";
import { placeHref } from "~/lib/places/store";
import { usePlaceSummary } from "./use-place-summary";

const PENDING_BACKGROUND = "linear-gradient(180deg, #2c3550 0%, #4a5577 100%)";

interface CellLayoutProps {
  title: string;
  subtitle: string;
  level: string;
  footnote: ReactNode;
  times: string;
  background: string;
}

/** The iOS Weather list cell: name and time on the left, the headline value on the right, details below. */
function CellLayout({ title, subtitle, level, footnote, times, background }: CellLayoutProps) {
  return (
    <div className="flex h-[118px] flex-col justify-between px-4 py-3" style={{ background }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[22px] leading-tight font-bold">{title}</p>
          <p className="truncate text-[15px] font-medium">{subtitle}</p>
        </div>
        <p className="shrink-0 text-[40px] leading-none font-light">{level}</p>
      </div>
      <div className="flex items-end justify-between gap-3 text-[15px] font-medium">
        <p className="min-w-0 truncate">{footnote}</p>
        <p className="shrink-0 tabular-nums">{times}</p>
      </div>
    </div>
  );
}

function SummaryCell({ place, current, summary }: { place: SavedPlace; current: boolean; summary: PlaceSummary }) {
  const t = useTranslations("Places");
  const p = useTranslations("Place");
  const glow = useTranslations("Glow");
  const now = useNow(0);
  const labels = useLabels(summary.timezone, now);
  const { nextEvent, sunrise, sunset } = summary;
  const colors = summary.sunAltitude === null ? null : skyColors(summary.sunAltitude, summary.cloud ?? 0);

  return (
    <CellLayout
      title={current ? t("myLocation") : place.name}
      subtitle={current ? place.name : formatClock(now, summary.timezone)}
      level={nextEvent ? glow(`level.${nextEvent.level}`) : "--"}
      footnote={nextEvent
        ? `${labels.day(nextEvent.date, nextEvent.time)}${glow(`event.${nextEvent.kind}`)} ${formatClock(nextEvent.time, summary.timezone)}`
        : p("noEvents")}
      times={sunrise !== null && sunset !== null
        ? p("heroTimes", { sunrise: formatClock(sunrise, summary.timezone), sunset: formatClock(sunset, summary.timezone) })
        : ""}
      background={colors ? `linear-gradient(180deg, ${rgb(colors.top)} 0%, ${rgb(colors.bottom)} 100%)` : PENDING_BACKGROUND}
    />
  );
}

interface PlaceCellProps {
  place: SavedPlace;
  current: boolean;
  onDelete: () => void;
}

export function PlaceCell({ place, current, onDelete }: PlaceCellProps) {
  const t = useTranslations("Places");
  const p = useTranslations("Place");
  const state = usePlaceSummary(place);

  return (
    <SwipeRow actionLabel={t("delete")} onAction={onDelete}>
      <Link href={placeHref(place, { current })} draggable={false} className="block">
        {state && "summary" in state
          ? <SummaryCell place={place} current={current} summary={state.summary} />
          : (
              <CellLayout
                title={current ? t("myLocation") : place.name}
                subtitle={current ? place.name : place.detail}
                level="--"
                footnote={state ? <span className="text-white/70">{p("error.title")}</span> : ""}
                times=""
                background={PENDING_BACKGROUND}
              />
            )}
      </Link>
    </SwipeRow>
  );
}
