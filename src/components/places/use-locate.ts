"use client";

import type { SavedPlace } from "~/lib/places/store";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { locateCurrentPlace, LocateError } from "~/lib/places/locate";
import { locationStore } from "~/lib/places/store";

/**
 * Finds the device's place and stores it as "My Location"; failures are reported in a toast, and a
 * denied permission removes "My Location" as iOS does. Resolves to the place, or null when it failed.
 */
export function useLocate() {
  const t = useTranslations("Locate");
  const [locating, setLocating] = useState(false);

  const locate = async ({ quiet = false }: { quiet?: boolean } = {}): Promise<SavedPlace | null> => {
    if (!quiet) {
      setLocating(true);
    }
    try {
      const place = await locateCurrentPlace();
      locationStore.write({ enabled: true, last: place });
      return place;
    } catch (error) {
      if (error instanceof LocateError && error.reason === "denied") {
        locationStore.write({ enabled: false, last: null });
      }
      toast.error(error instanceof LocateError
        ? t(error.reason)
        : t("failed", { message: error instanceof Error ? error.message : String(error) }));
      return null;
    } finally {
      setLocating(false);
    }
  };

  return { locating, locate };
}
