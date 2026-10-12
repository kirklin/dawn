"use client";

import type { RefObject } from "react";
import { useEffect, useEffectEvent } from "react";

const MIN_DISTANCE = 60;
const MAX_DURATION_MS = 700;

/**
 * Pages between screens on a quick horizontal swipe across `root`, as iOS Weather pages between
 * places. Swipes that start inside `[data-swipe-ignore]` belong to that element.
 */
export function useSwipePaging(root: RefObject<HTMLElement | null>, onSwipe: (direction: 1 | -1) => void) {
  const swipe = useEffectEvent(onSwipe);

  useEffect(() => {
    const element = root.current;
    if (!element) {
      throw new Error("useSwipePaging needs the screen mounted");
    }

    let start: { x: number; y: number; time: number } | null = null;
    const onStart = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      start = event.touches.length === 1 && !target?.closest("[data-swipe-ignore]")
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, time: event.timeStamp }
        : null;
    };
    const onEnd = (event: TouchEvent) => {
      if (!start) {
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = event.timeStamp - start.time < MAX_DURATION_MS;
      start = null;
      if (quick && Math.abs(dx) > MIN_DISTANCE && Math.abs(dx) > 2 * Math.abs(dy)) {
        swipe(dx < 0 ? 1 : -1);
      }
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchend", onEnd);
    };
  }, [root]);
}
