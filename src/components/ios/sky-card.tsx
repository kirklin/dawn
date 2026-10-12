import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SkyCardProps {
  title: ReactNode;
  /** Shown at the right end of the title row. */
  accessory?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/** Card over the sky: a quiet title, then the content; it slides under the pinned title as the page scrolls. */
export function SkyCard({ title, accessory, wide, children }: SkyCardProps) {
  return (
    <section data-card className={cn("sky-material flex flex-col rounded-[22px] p-4", wide ? "col-span-2" : "col-span-1")}>
      <header className="flex h-5 items-center justify-between gap-3 text-[15px] leading-5 text-white/60">
        <h2 className="truncate">{title}</h2>
        {accessory}
      </header>
      {children}
    </section>
  );
}
