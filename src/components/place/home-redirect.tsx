"use client";

import { useEffect } from "react";
import { PageLoading } from "~/components/ios/page-loading";
import { useRouter } from "~/lib/i18n/navigation";
import { locationStore, placeHref, placePages, placesStore } from "~/lib/places/store";

/**
 * Opens the first page, as iOS Weather opens on its first location: the device's own place, then the
 * first saved one, and the example for someone who has neither yet.
 */
export function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const [first] = placePages(placesStore.read(), locationStore.read());
    router.replace(first ? placeHref(first.place, { current: first.current }) : "/example");
  }, [router]);

  return <PageLoading />;
}
