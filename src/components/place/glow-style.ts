/** Quality scale from no glow (grey) through gold and red to the rare purple-pink skies. */
export const GLOW_GRADIENT = "linear-gradient(90deg, #8e9aa6 0%, #ffd60a 20%, #ff9f0a 40%, #ff453a 60%, #ff2d78 80%, #bf5af2 100%)";

/** Aerosol optical depth scale for the 0–1 range, clean to polluted. */
export const AEROSOL_GRADIENT = "linear-gradient(90deg, #64d2ff 0%, #30d158 20%, #ffd60a 45%, #ff9f0a 70%, #a2845e 100%)";

/** Fills for the other glow factors: clouds turning pink, warm low sunlight, and grey low cloud. */
export const CANVAS_GRADIENT = "linear-gradient(90deg, #7d8cff 0%, #c79bff 55%, #ff9ecb 100%)";
export const PATH_GRADIENT = "linear-gradient(90deg, #ff6b3d 0%, #ffb340 55%, #ffe08a 100%)";
export const LOW_GRADIENT = "linear-gradient(90deg, #8e9aaf 0%, #c7cfdc 100%)";

/** The golden and blue hour on the light timeline. */
export const LIGHT_PHASES = {
  golden: { bar: "linear-gradient(90deg, #ffcf5c, #ff9f45)", dot: "#ffb547" },
  blue: { bar: "linear-gradient(90deg, #4f6bff, #7b8cff)", dot: "#6f84ff" },
} as const;

/** Fraction rendered as a 0–100 percentage for CSS. */
export function percent(fraction: number) {
  return `${Math.max(0, Math.min(1, fraction)) * 100}%`;
}
