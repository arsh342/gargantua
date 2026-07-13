/** Tanner Helland's fit to the Planckian blackbody locus, T in Kelvin.
 * Same formula the ray-tracer shader uses for the disk and stars, kept in
 * sync so the CPU-built starfield and the GPU-rendered disk agree. */
export function blackbody(kelvin: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;

  if (t <= 66) {
    r = 1.0;
    g = clamp01(0.3900816 * Math.log(t) - 0.6318414);
  } else {
    r = clamp01(1.2929362 * Math.pow(t - 60, -0.1332047));
    g = clamp01(1.1298909 * Math.pow(t - 60, -0.0755148));
  }

  if (t >= 66) b = 1.0;
  else if (t <= 19) b = 0.0;
  else b = clamp01(0.5432068 * Math.log(t - 10) - 1.196254);

  return [r * r, g * g, b * b];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
