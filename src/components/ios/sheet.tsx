"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Drawer } from "vaul";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

/** iOS page sheet: dark frosted panel with a grabber, centered title and a close button. */
export function Sheet({ open, onOpenChange, title, icon, children }: SheetProps) {
  const t = useTranslations("Common");
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[94dvh] max-w-xl flex-col rounded-t-[14px] bg-[rgb(28_28_30/0.94)] text-white outline-none backdrop-blur-2xl"
        >
          <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-white/30" />
          <div className="relative flex h-12 shrink-0 items-center justify-center px-12">
            <Drawer.Title className="flex items-center gap-2 text-[17px] font-semibold">
              {icon}
              {title}
            </Drawer.Title>
            <Drawer.Close
              aria-label={t("close")}
              className="absolute right-4 flex size-[30px] items-center justify-center rounded-full bg-white/15 text-white/80"
            >
              <X className="size-4" strokeWidth={2.6} />
            </Drawer.Close>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]" data-vaul-no-drag>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
