import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { PlacesScreen } from "~/components/places/places-screen";
import { createAlternates } from "~/lib/utils";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: createAlternates("/places", locale) };
}

export default function PlacesPage({ params }: { params: Params }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <PlacesScreen />;
}
