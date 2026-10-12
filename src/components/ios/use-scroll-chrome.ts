"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Drives the scroll effect: exposes the scroll offset as `--scroll` and the title bar height as
 * `--pin` on `root`, and clips every card at the pinned title bar so it slides under it.
 */
export function useScrollChrome(root: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const rootElement = root.current;
    const barElement = bar.current;
    if (!rootElement || !barElement) {
      throw new Error("useScrollChrome needs both the screen and the title bar mounted");
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      rootElement.style.setProperty("--scroll", String(window.scrollY));
      const pin = barElement.getBoundingClientRect().height;
      rootElement.style.setProperty("--pin", `${pin}px`);

      const cards = Array.from(rootElement.querySelectorAll<HTMLElement>("[data-card]"), card => ({ card, rect: card.getBoundingClientRect() }));
      for (const { card, rect } of cards) {
        const cut = Math.max(0, Math.min(rect.height, pin - rect.top));
        card.style.clipPath = cut > 0 ? `inset(${cut}px 0 0 0 round 22px)` : "";
      }
    };
    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    const resizes = new ResizeObserver(schedule);
    resizes.observe(rootElement);
    resizes.observe(barElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      resizes.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [root, bar]);
}
