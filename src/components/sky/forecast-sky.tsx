"use client";

import type { RefObject } from "react";
import type { SkyColors } from "./palette";
import type { SkyParams } from "./sky-params";
import type { SkyRenderer } from "./sky-renderer";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { rgb } from "./palette";
import { createSkyRenderer } from "./sky-renderer";

interface ForecastSkyProps {
  params: SkyParams;
  /** Gradient shown until the first frame is drawn. */
  fallback: SkyColors;
  /** The horizon lines up with this element's top edge as laid out before scrolling. */
  horizonRef: RefObject<HTMLElement | null>;
}

/** Fixed full-screen backdrop: the forecast sky of the selected glow event, rendered with WebGL. */
export function ForecastSky({ params, fallback, horizonRef }: ForecastSkyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkyRenderer | null>(null);
  const [drawn, setDrawn] = useState(false);
  const initialParams = useEffectEvent(() => params);

  useEffect(() => {
    const canvas = canvasRef.current;
    const anchor = horizonRef.current;
    if (!canvas || !anchor) {
      throw new Error("ForecastSky needs its canvas and its horizon element mounted");
    }
    const horizonTop = () => anchor.getBoundingClientRect().top + window.scrollY;
    const renderer = createSkyRenderer(canvas, initialParams(), horizonTop(), () => setDrawn(true));
    rendererRef.current = renderer;
    const resizes = new ResizeObserver(() => {
      renderer.resize();
      renderer.setHorizon(horizonTop());
    });
    resizes.observe(canvas);
    resizes.observe(document.body);
    return () => {
      resizes.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [horizonRef]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      throw new Error("The sky renderer is not running");
    }
    renderer.setParams(params);
  }, [params]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10"
      style={{ background: `linear-gradient(180deg, ${rgb(fallback.top)} 0%, ${rgb(fallback.bottom)} 100%)` }}
    >
      <canvas ref={canvasRef} className={cn("size-full transition-opacity duration-700", drawn ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
