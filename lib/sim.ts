export type Quality = "low" | "med" | "high";

export const QUALITY: Record<Quality, { dpr: number; steps: number }> = {
  low: { dpr: 0.55, steps: 260 },
  med: { dpr: 0.9, steps: 360 },
  high: { dpr: 1.4, steps: 500 },
};

/* ---- Kerr geometry, geometric units rs = 1 (so M = 1/2) ---- */

const M = 0.5;

/** Dimensionless spin a★ = a/M. The film's Gargantua was ~0.998; 0.95 keeps
 * the integrator comfortable while the disk still hugs the shadow. */
export const SPIN_STAR = 0.95;

/** Spin parameter a in rs units. */
export const SPIN_A = SPIN_STAR * M;

/** Outer event horizon r₊ = M + √(M² − a²). */
export const R_HORIZON = M + Math.sqrt(M * M - SPIN_A * SPIN_A);

/** Prograde ISCO radius from the Bardeen–Press–Teukolsky formula. */
export function iscoRadius(chi: number): number {
  const z1 =
    1 + Math.cbrt(1 - chi * chi) * (Math.cbrt(1 + chi) + Math.cbrt(1 - chi));
  const z2 = Math.sqrt(3 * chi * chi + z1 * z1);
  return M * (3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2)));
}

export const R_ISCO = iscoRadius(SPIN_STAR);

/** Novikov–Thorne temperature normalization: T(r) = T0 · [r⁻³(1−√(r_in/r))]^¼
 * with the profile's peak (at r = 49/36 · r_in) pinned to T_PEAK kelvin. */
const T_PEAK = 6400;
const rPeak = (49 / 36) * R_ISCO;
const fPeak = Math.pow(
  Math.pow(rPeak, -3) * (1 - Math.sqrt(R_ISCO / rPeak)),
  0.25
);
export const T_NORM = T_PEAK / fPeak;

/** Mutable simulation state shared between the render loop and the HUD. */
export const sim = {
  paused: false,
  steps: QUALITY.med.steps,
};

/** Written by the render loop (~2×/s), pushed to the HUD via `push`. */
export const hudBridge: {
  fps: number;
  radius: number;
  incl: number;
  push?: () => void;
} = { fps: 0, radius: 26, incl: 8 };
