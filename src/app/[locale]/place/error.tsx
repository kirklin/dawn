"use client";

import { CloudAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "~/lib/i18n/navigation";

export default function PlaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Place.error");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-linear-to-b from-[#1b2a52] to-[#4a5b8c] px-8 text-center">
      <CloudAlert className="size-12 text-white/70" strokeWidth={1.5} />
      <h1 className="text-[22px] font-semibold">{t("title")}</h1>
      <p className="text-[15px] break-all text-white/60">{error.digest ?? error.message}</p>
      <button type="button" onClick={retry} className="mt-2 h-11 rounded-full bg-white/20 px-6 text-[17px] font-semibold">
        {t("retry")}
      </button>
      <Link href="/places" className="h-11 px-4 text-[17px] leading-[44px] text-white/80">
        {t("back")}
      </Link>
    </main>
  );
}
