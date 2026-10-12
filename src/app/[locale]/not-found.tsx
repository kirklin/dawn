import { CloudOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "~/lib/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-linear-to-b from-[#1b2a52] to-[#4a5b8c] px-8 text-center">
      <CloudOff className="size-12 text-white/70" strokeWidth={1.5} />
      <h1 className="text-[22px] font-semibold">{t("title")}</h1>
      <p className="text-[15px] text-white/60">{t("description")}</p>
      <Link href="/" className="mt-2 h-11 rounded-full bg-white/20 px-6 text-[17px] leading-[44px] font-semibold">
        {t("backHome")}
      </Link>
    </main>
  );
}
