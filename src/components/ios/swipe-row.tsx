"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { cn } from "~/lib/utils";

const ACTION_WIDTH = 88;
/** Movement before a press counts as a drag along one axis. */
const SLOP = 8;

interface SwipeRowProps {
  actionLabel: string;
  onAction: () => void;
  className?: string;
  children: ReactNode;
}

/** iOS list row that slides left to reveal a red destructive action. */
export function SwipeRow({ actionLabel, onAction, className, children }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** The action stays painted until the row has slid fully closed, so its edge never shows at rest. */
  const [revealed, setRevealed] = useState(false);
  const gestureRef = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  /** Set when the press that just ended was a drag, so the click it may produce is swallowed. */
  const draggedRef = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggedRef.current = false;
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    gestureRef.current = { x: event.clientX, y: event.clientY, base: offset, axis: null };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) {
      return;
    }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.axis === null) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
        gesture.axis = "x";
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        setRevealed(true);
      } else if (Math.abs(dy) > SLOP) {
        gesture.axis = "y";
      }
    }
    if (gesture.axis === "x") {
      setOffset(Math.min(0, Math.max(-1.5 * ACTION_WIDTH, gesture.base + dx)));
    }
  };

  const onPointerEnd = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (gesture?.axis !== "x") {
      return;
    }
    draggedRef.current = true;
    setDragging(false);
    const settled = offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
    setOffset(settled);
    if (settled === 0 && offset === 0) {
      setRevealed(false);
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (draggedRef.current || offset !== 0) {
      event.preventDefault();
      event.stopPropagation();
      if (!draggedRef.current) {
        setOffset(0);
      }
    }
    draggedRef.current = false;
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <button
        type="button"
        onClick={onAction}
        tabIndex={revealed ? 0 : -1}
        aria-hidden={!revealed}
        className="absolute inset-y-0 right-0 bg-[#ff3b30] text-[17px] font-medium"
        style={{ width: Math.max(ACTION_WIDTH, -offset), visibility: revealed ? "visible" : "hidden" }}
      >
        {actionLabel}
      </button>
      <div
        className={cn("relative touch-pan-y", !dragging && "transition-transform duration-300 ease-out")}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        onTransitionEnd={() => {
          if (offset === 0) {
            setRevealed(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
