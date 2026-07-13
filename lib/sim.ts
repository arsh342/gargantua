export type Quality = "low" | "med" | "high";

export const QUALITY: Record<Quality, { dpr: number; steps: number }> = {
  low: { dpr: 0.55, steps: 260 },
  med: { dpr: 0.9, steps: 360 },
  high: { dpr: 1.4, steps: 500 },
};

/* ---- Kerr geometry, geometric units rs = 1 (so M = 1/2) ---- */

const M = 0.5;
/** Geometric mass (rs = 2M = 1 unit), exported for HUD physics readouts. */
export const M_GEOM = M;

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

/* ---- real-world scale, for converting geometric quantities to SI ----
 * Gargantua's mass is ~1e8 solar masses (Kip Thorne, "The Science of
 * Interstellar" — near-extremal spin needed that scale to make the film's
 * time dilation plausible). Fixing a real mass lets every geometric-unit
 * curvature quantity below convert to a real, checkable physical number. */
const G_NEWTON = 6.674e-11;
const C_LIGHT = 2.998e8;
const M_SUN = 1.989e30;
const G_EARTH = 9.80665;

export const BH_MASS_SOLAR = 1e8;
const M_KG = BH_MASS_SOLAR * M_SUN;

/** Schwarzschild-equivalent radius (2GM/c²) in meters — this is what "1 rs
 * unit" is worth in the real world at Gargantua's mass. */
export const R_S_METERS = (2 * G_NEWTON * M_KG) / (C_LIGHT * C_LIGHT);

/** Converts a dimensionless proper acceleration (rs = 1 units) to Earth g. */
export const ACCEL_TO_G = (C_LIGHT * C_LIGHT) / R_S_METERS / G_EARTH;

/** Converts a dimensionless tidal curvature (1/rs² units) to g per meter. */
export const TIDAL_TO_G_PER_M =
  (C_LIGHT * C_LIGHT) / (R_S_METERS * R_S_METERS) / G_EARTH;

/** Exact Boyer–Lindquist radius from Kerr–Schild Cartesian position — same
 * formula as ksRadius() in the shader, spin axis along +y. */
export function boyerLindquistR(x: number, y: number, z: number, a: number): number {
  const R2 = x * x + y * y + z * z;
  const b = R2 - a * a;
  const r2 = 0.5 * (b + Math.sqrt(b * b + 4 * a * a * y * y));
  return Math.sqrt(Math.max(r2, 1e-6));
}

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
  timeDilation: number;
  localG: number;
  tidalGPerM: number;
  push?: () => void;
} = { fps: 0, radius: 26, incl: 8, timeDilation: 1, localG: 0, tidalGPerM: 0 };
