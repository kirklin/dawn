import type { ReactNode } from "react";
import { SkyCard } from "~/components/ios/sky-card";
import { percent } from "./glow-style";

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  note: string;
  /** Pinned to the bottom of the card. */
  bar: ReactNode;
}

/** Half-width card: a title, one value with a line on what it means, and a bar at the bottom. */
export function MetricCard({ title, value, unit, note, bar }: MetricCardProps) {
  return (
    <SkyCard title={title}>
      <p className="mt-2 text-[34px] leading-10 tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[20px]">{unit}</span>}
      </p>
      <p className="mt-1 text-[15px] leading-5 text-balance">{note}</p>
      <div className="mt-auto pt-4">{bar}</div>
    </SkyCard>
  );
}

interface MetricBarProps {
  gradient: string;
  /** Fills the track up to this fraction. */
  fill?: number;
  /** Marks this fraction along the whole gradient. */
  mark?: number;
}

/** Rounded track with a gradient, filled up to a value or marked at one along its scale. */
export function MetricBar({ gradient, fill, mark }: MetricBarProps) {
  return (
    <div className="relative h-1.5">
      <div className="h-full overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full" style={{ background: gradient, width: fill === undefined ? "100%" : percent(fill) }} />
      </div>
      {mark !== undefined && (
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(14_17_31)]"
          style={{ left: percent(mark) }}
        />
      )}
    </div>
  );
}
