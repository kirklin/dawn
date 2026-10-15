import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { PlaceScreen } from "~/components/place/place-screen";
import { EXAMPLE_PLACE, getExampleForecast } from "~/lib/forecast/example";

type Params = Promise<{ locale: string }>;

export const metadata: Metadata = {
  title: EXAMPLE_PLACE.name,
  robots: { index: false },
};

export default async function ExamplePage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The example's days start today, so it is made for each visit.
  await connection();
  const forecast = getExampleForecast();

  return <PlaceScreen place={EXAMPLE_PLACE} current={false} example forecast={forecast} renderedAt={forecast.generatedAt} />;
}
