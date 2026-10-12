import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SkyCardProps {
  title: ReactNode;
  icon: LucideIcon;
  wide?: boolean;
  className?: string;
  bodyClassName?: string;
  onClick?: () => void;
  children: ReactNode;
}

/** Frosted card whose header pins under the compact title while its body scrolls away beneath it. */
export function SkyCard({ title, icon: Icon, wide, className, bodyClassName, onClick, children }: SkyCardProps) {
  const content = (
    <>
      <header data-card-header className="sticky top-(--pin) z-[1] flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white/60">
        <Icon className="size-3.5 shrink-0" strokeWidth={2.4} />
        <span className="truncate">{title}</span>
      </header>
      <div data-card-body className={cn("px-4 pb-4", bodyClassName)}>
        {children}
      </div>
    </>
  );

  return (
    <section data-card className={cn("sky-card relative", wide ? "col-span-2" : "col-span-1", className)}>
      {onClick
        ? (
            <button type="button" className="block w-full text-left" onClick={onClick}>
              {content}
            </button>
          )
        : content}
    </section>
  );
}
