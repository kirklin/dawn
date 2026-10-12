/**
 * Rounds a value computed with Math.sin, Math.cos or `**` before it goes into markup: Node and the
 * browser may differ in the last digits of those functions, which breaks hydration.
 */
export function roundForMarkup(value: number) {
  return Math.round(value * 1000) / 1000;
}
