"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let current = 0;
let timer = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      for (const notify of listeners) {
        notify();
      }
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
    }
  };
}

function getSnapshot() {
  if (current === 0) {
    current = Date.now();
  }
  return current;
}

/** Wall-clock time shared by every component, ticking every 30 s; `initial` is the server render time. */
export function useNow(initial: number) {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}
