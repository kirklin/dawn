import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlaceScreen } from "~/components/place/place-screen";
import { getPlaceForecast } from "~/lib/forecast/place-forecast";
import { placeParamsSchema } from "~/lib/places/params";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parsePlace(searchParams: Awaited<SearchParams>) {
  const parsed = placeParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    notFound();
  }
  return parsed.data;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const place = parsePlace(await searchParams);
  return {
    title: place.name,
    robots: { index: false },
  };
}

export default async function PlacePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { name, detail, lat, lon, current } = parsePlace(await searchParams);

  const forecast = await getPlaceForecast({ lat, lon });
  const place = { name, detail: detail ?? "", lat, lon };

  return (
    <PlaceScreen
      key={[current, lat, lon].join(",")}
      place={place}
      current={current === "1"}
      example={false}
      forecast={forecast}
      renderedAt={forecast.generatedAt}
    />
  );
}
