"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { locateCurrentPlace, LocateError } from "~/lib/places/locate";
import { locationStore } from "~/lib/places/store";

/**
 * Finds the device's place and stores it as "My Location"; failures are reported in a toast, and a
 * denied permission removes "My Location" as iOS does.
 */
export function useLocate() {
  const t = useTranslations("Locate");
  const [locating, setLocating] = useState(false);

  const locate = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) {
      setLocating(true);
    }
    try {
      locationStore.write({ enabled: true, last: await locateCurrentPlace() });
    } catch (error) {
      if (error instanceof LocateError && error.reason === "denied") {
        locationStore.write({ enabled: false, last: null });
      }
      toast.error(error instanceof LocateError
        ? t(error.reason)
        : t("failed", { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setLocating(false);
    }
  };

  return { locating, locate };
}
