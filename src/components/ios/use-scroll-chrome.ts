"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Drives the iOS Weather scroll effect: exposes the scroll offset as `--scroll` and the title bar
 * height as `--pin` on `root`, and clips every card at the pinned title bar so it collapses under
 * its sticky header.
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

      const cards = Array.from(rootElement.querySelectorAll<HTMLElement>("[data-card]"), (card) => {
        const header = card.querySelector<HTMLElement>("[data-card-header]");
        const body = card.querySelector<HTMLElement>("[data-card-body]");
        if (!header || !body) {
          throw new Error("A card is missing its header or body");
        }
        return { card, body, rect: card.getBoundingClientRect(), bodyRect: body.getBoundingClientRect(), headerHeight: header.offsetHeight };
      });

      for (const { card, body, rect, bodyRect, headerHeight } of cards) {
        const cut = Math.max(0, Math.min(rect.height, pin - rect.top));
        card.style.clipPath = cut > 0 ? `inset(${cut}px 0 0 0 round 16px)` : "";
        const bodyCut = Math.max(0, Math.min(bodyRect.height, pin + headerHeight - bodyRect.top));
        body.style.clipPath = bodyCut > 0 ? `inset(${bodyCut}px 0 0 0)` : "";
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
