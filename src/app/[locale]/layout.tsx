import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import * as React from "react";
import Analytics from "~/components/Analytics";
import { Toaster } from "~/components/ui/sonner";
import { routing } from "~/lib/i18n/navigation";
import { getBaseUrl } from "~/lib/url";
import { ogLocale } from "~/lib/utils";
import "~/styles/global.css";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "App" });

  return {
    title: { default: t("brand"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("brand"),
    metadataBase: new URL(getBaseUrl()),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false, address: false, email: false },
    openGraph: {
      locale: ogLocale(locale),
      siteName: t("brand"),
      title: t("brand"),
      description: t("description"),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
