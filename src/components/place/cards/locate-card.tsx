"use client";

import { LocationRow } from "~/components/places/location-row";
import { useLocate } from "~/components/places/use-locate";
import { useRouter } from "~/lib/i18n/navigation";
import { placeHref } from "~/lib/places/store";

/** On the example: asks for the device's location and opens its forecast instead. */
export function LocateCard() {
  const router = useRouter();
  const { locating, locate } = useLocate();

  const locateAndOpen = async () => {
    const place = await locate();
    if (place) {
      router.replace(placeHref(place, { current: true }));
    }
  };

  return <LocationRow locating={locating} onLocate={() => void locateAndOpen()} className="sky-material col-span-2 rounded-[22px]" />;
}
