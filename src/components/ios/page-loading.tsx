import { LoaderCircle } from "lucide-react";

/** A dusk sky with a spinner, while a forecast loads or the first page is picked. */
export function PageLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-linear-to-b from-[#1b2a52] to-[#4a5b8c]">
      <LoaderCircle className="size-7 animate-spin text-white/70" />
    </main>
  );
}
