"use client";

import type { PlacePage } from "~/lib/places/store";
import { List, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "~/lib/i18n/navigation";
import { placeKey } from "~/lib/places/store";
import { cn } from "~/lib/utils";

interface PlaceToolbarProps {
  pages: PlacePage[];
  /** Position of this screen among `pages`; -1 when the place is not in the list. */
  index: number;
  onSelect: (index: number) => void;
}

/** Bottom bar with one dot per place, the current location drawn as an arrow, and the list button. */
export function PlaceToolbar({ pages, index, onSelect }: PlaceToolbarProps) {
  const t = useTranslations("Place.toolbar");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[rgb(var(--sky-card)/0.72)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="relative mx-auto flex h-[50px] max-w-xl items-center justify-center px-4">
        {index >= 0 && (
          <ol className="flex items-center gap-1">
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
                    ? <Navigation className="size-[10px] fill-current" strokeWidth={0} />
                    : <span className="size-[7px] rounded-full bg-current" />}
                </button>
              </li>
            ))}
          </ol>
        )}
        <Link href="/" aria-label={t("list")} className="absolute right-3 flex size-11 items-center justify-center">
          <List className="size-6" />
        </Link>
      </div>
    </nav>
  );
}
