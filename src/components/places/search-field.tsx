"use client";

import type { Ref } from "react";
import { CircleX, Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchFieldProps {
  ref: Ref<HTMLInputElement>;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onCancel: () => void;
}

/** iOS search bar with an inline clear button and a Cancel button while searching. */
export function SearchField({ ref, value, active, onChange, onFocus, onCancel }: SearchFieldProps) {
  const t = useTranslations("Places");

  return (
    <div className="flex items-center gap-3">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] bg-[rgb(118_118_128/0.24)] px-2 text-white/60">
        <Search className="size-[18px] shrink-0" />
        <input
          ref={ref}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label={t("search")}
          placeholder={t("search")}
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-white/50"
        />
        {value && (
          <button type="button" aria-label={t("clear")} onClick={() => onChange("")} className="flex size-6 shrink-0 items-center justify-center">
            <CircleX className="size-[17px] fill-white/55 text-[#2c2c2e]" />
          </button>
        )}
      </label>
      {active && (
        <button type="button" onClick={onCancel} className="h-9 shrink-0 text-[17px]">
          {t("cancel")}
        </button>
      )}
    </div>
  );
}
