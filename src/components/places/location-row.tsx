"use client";

import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "~/lib/utils";

interface LocationRowProps {
  locating: boolean;
  onLocate: () => void;
  /** The row's background and corners. */
  className: string;
}

/** "My Location" while it is off: what it shows, and the button that asks for the device's location. */
export function LocationRow({ locating, onLocate, className }: LocationRowProps) {
  const t = useTranslations("Places");

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", className)}>
      <Navigation className="size-5 shrink-0 fill-[#0a84ff] text-[#0a84ff]" strokeWidth={0} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold">{t("myLocation")}</p>
        <p className="text-[13px] text-white/60">{t("locateHint")}</p>
      </div>
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="h-8 shrink-0 rounded-full bg-[#0a84ff] px-3.5 text-[15px] font-semibold disabled:opacity-60"
      >
        {locating ? t("locating") : t("locate")}
      </button>
    </div>
  );
}
