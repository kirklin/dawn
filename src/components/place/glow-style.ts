/** Quality scale from no glow (grey) through gold and red to the rare purple-pink skies. */
export const GLOW_GRADIENT = "linear-gradient(90deg, #8e9aa6 0%, #ffd60a 20%, #ff9f0a 40%, #ff453a 60%, #ff2d78 80%, #bf5af2 100%)";

/** Aerosol optical depth scale for the 0–1 range, clean to polluted. */
export const AEROSOL_GRADIENT = "linear-gradient(90deg, #64d2ff 0%, #30d158 20%, #ffd60a 45%, #ff9f0a 70%, #a2845e 100%)";

/** Fraction rendered as a 0–100 percentage for CSS. */
export function percent(fraction: number) {
  return `${Math.max(0, Math.min(1, fraction)) * 100}%`;
}
