"use client";

import type { PlacePage } from "~/lib/places/store";
import { List, Navigation, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "~/lib/i18n/navigation";
import { placeKey } from "~/lib/places/store";
import { cn } from "~/lib/utils";

interface PlaceToolbarProps {
  pages: PlacePage[];
  /** Position of this screen among `pages`; -1 for a place not in the list yet. */
  index: number;
  onSelect: (index: number) => void;
  /** Adds the place on screen; given while it is not in the list. */
  onAdd: (() => void) | null;
  name: string;
}

const BUTTON = "pointer-events-auto flex size-11 items-center justify-center rounded-full";

/**
 * Floating buttons for the place list and adding a place, with the page dots between them. A place
 * not in the list yet gets a ring after the dots, and the add button, filled, adds it; the example has
 * neither dots nor a ring.
 */
export function PlaceToolbar({ pages, index, onSelect, onAdd, name }: PlaceToolbarProps) {
  const t = useTranslations("Place.toolbar");

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4">
        <Link href="/places" aria-label={t("list")} className={cn("float-material", BUTTON)}>
          <List className="size-[22px]" />
        </Link>
        {(pages.length > 0 || onAdd) && (
          <ol className="float-material pointer-events-auto flex h-7 items-center rounded-full px-1.5">
            {pages.map((page, pageIndex) => (
              <li key={`${page.current ? "current" : "saved"}-${placeKey(page.place)}`}>
                <button
                  type="button"
                  aria-label={t("page", { index: pageIndex + 1, total: pages.length })}
                  aria-current={pageIndex === index ? "page" : undefined}
                  onClick={() => onSelect(pageIndex)}
                  className={cn("flex size-4 items-center justify-center", pageIndex === index ? "text-white" : "text-white/40")}
                >
                  {page.current
                    ? <Navigation className="size-[9px] fill-current" strokeWidth={0} />
                    : <span className="size-1.5 rounded-full bg-current" />}
                </button>
              </li>
            ))}
            {onAdd && (
              <li aria-current="page" className="flex size-4 items-center justify-center">
                <span className="size-[7px] rounded-full border-[1.5px] border-white" />
              </li>
            )}
          </ol>
        )}
        {onAdd
          ? (
              <button type="button" onClick={onAdd} aria-label={t("addPlace", { name })} className={cn("bg-white text-black shadow-lg", BUTTON)}>
                <Plus className="size-[22px]" strokeWidth={2.5} />
              </button>
            )
          : (
              <Link href="/places#search" aria-label={t("search")} className={cn("float-material", BUTTON)}>
                <Plus className="size-[22px]" />
              </Link>
            )}
      </div>
    </nav>
  );
}
