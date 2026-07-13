export const vert = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/*
 * Kerr geodesic ray-marcher, geometric units rs = 1 (G = c = 1, M = 1/2).
 *
 * Photons are integrated in Kerr–Schild Cartesian coordinates, where the
 * inverse metric is g^μν = η^μν − f k^μ k^ν with
 *   f = 2M r³ / (r⁴ + a²y²),   k = ((rx+az)/(r²+a²), y/r, (rz−ax)/(r²+a²)),
 * r the oblate-spheroidal radius, spin axis +y aligned with the disk. These
 * coordinates are horizon-penetrating: no singularity at r₊, so frame
 * dragging near the horizon integrates cleanly. The Hamiltonian
 *   H = ½(−E² + |p|² − f Φ²),  Φ = E + k·p
 * gives ẋ = p − fΦk and ṗ = ½∇(fΦ²), integrated with symplectic Euler and
 * central-difference gradients. Photon energy E is set once from H = 0.
 *
 * The disk is physical: it starts at the prograde ISCO (Bardeen formula,
 * computed on the CPU), temperature follows Novikov–Thorne, gas follows
 * circular equatorial Kerr geodesics with Ω = √M/(r^3/2 + a√M), and the
 * observed shift g = E/(uᵗ(E − Ω·p_φ)) — exact for a circular emitter —
 * drives blackbody color and δ⁴ (Liouville) beaming.
 * Output is linear HDR — bloom and ACES tonemapping happen in post.
 */
export const frag = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec3  uCamPos;
uniform mat3  uCamMat;
uniform float uAspect;
uniform float uTanFov;
uniform float uSteps;
uniform float uSpin;    /* a, rs units */
uniform float uHorizon; /* r+ */
uniform float uDiskIn;  /* prograde ISCO, Boyer-Lindquist r */
uniform float uTNorm;   /* Novikov-Thorne temperature normalization, K */

const float M        = 0.5;
const float SQRT_M   = 0.70710678;
const float T_REF    = 6400.0;
const float DISK_OUT = 14.0;
const float ESCAPE_R = 44.0;

/* ---------- hash & noise ---------- */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = p * 2.17 + 19.19;
    a *= 0.52;
  }
  return v;
}

/* ---------- Planckian blackbody chromaticity ----------
 * Tanner Helland's fit to the blackbody locus, T in Kelvin (~1000–40000),
 * squared as a cheap sRGB→linear approximation for the HDR pipeline. */
vec3 blackbody(float T) {
  float t = clamp(T, 1000.0, 40000.0) / 100.0;
  float r, g, b;
  if (t <= 66.0) {
    r = 1.0;
    g = clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0);
  } else {
    r = clamp(1.2929362 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    g = clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  }
  if (t >= 66.0) b = 1.0;
  else if (t <= 19.0) b = 0.0;
  else b = clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0);
  vec3 c = vec3(r, g, b);
  return c * c;
}

/* ---------- Kerr-Schild field ---------- */
float ksRadius(vec3 pos) {
  float R2 = dot(pos, pos);
  float b = R2 - uSpin * uSpin;
  return sqrt(max(0.5 * (b + sqrt(b * b + 4.0 * uSpin * uSpin * pos.y * pos.y)), 1e-6));
}

void ksField(vec3 pos, out float f, out vec3 k) {
  float A = uSpin;
  float r = ksRadius(pos);
  float r2 = r * r;
  f = 2.0 * M * r2 * r / (r2 * r2 + A * A * pos.y * pos.y);
  float inv = 1.0 / (r2 + A * A);
  k = vec3((r * pos.x + A * pos.z) * inv, pos.y / r, (r * pos.z - A * pos.x) * inv);
}

/* S(x) = f·(E + k·p)² — the position-dependent part of the Hamiltonian */
float hamS(vec3 pos, vec3 pv, float E) {
  float f; vec3 k;
  ksField(pos, f, k);
  float phi = E + dot(k, pv);
  return f * phi * phi;
}

/* ---------- background sky ---------- */
vec3 sky(vec3 d) {
  vec3 col = vec3(0.0);
  vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));

  /* the sky is near-black: only a whisper of galactic dust */
  vec3 bandN = normalize(vec3(0.32, 0.86, 0.40));
  float band = exp(-pow(dot(d, bandN), 2.0) * 14.0);
  float neb = fbm(sph * vec2(3.0, 5.0) + 7.7);
  col += vec3(0.016, 0.019, 0.030) * band * (0.3 + 1.6 * neb * neb);
  float dust = fbm(sph * vec2(6.0, 9.5) + 2.2);
  col += vec3(0.026, 0.019, 0.014) * band * dust * dust * dust;

  /* three star layers */
  for (int l = 0; l < 3; l++) {
    float scale = (l == 0) ? 40.0 : ((l == 1) ? 85.0 : 160.0);
    vec2 uv = sph * vec2(scale, scale * 0.62);
    vec2 id = floor(uv);
    vec2 gv = fract(uv) - 0.5;
    float h = hash21(id + float(l) * 77.7);
    if (h > 0.93) {
      vec2 off = (vec2(hash21(id + 1.3), hash21(id + 2.7)) - 0.5) * 0.72;
      float core = smoothstep(0.08, 0.0, length(gv - off));
      float mag = (h - 0.93) / 0.07;
      /* stellar population: real blackbody tints, 3000 K M-dwarfs to A stars */
      vec3 tint = blackbody(mix(3000.0, 11000.0, hash21(id + 9.1)));
      col += tint * core * mag * mag * (0.5 + 0.8 * band) * 1.5;
    }
  }
  return col;
}

/* ---------- Novikov–Thorne effective temperature ----------
 * T(r) ∝ [r⁻³ (1 − √(r_in/r))]^¼ — zero torque at the ISCO, so the inner
 * edge cools to black; uTNorm pins the peak (r = 49/36·r_in) to T_PEAK. */
float diskTemp(float r) {
  float f = pow(max(pow(r, -3.0) * (1.0 - sqrt(uDiskIn / r)), 0.0), 0.25);
  return uTNorm * f;
}

/* ---------- volumetric accretion disk (r is Boyer-Lindquist) ---------- */
float diskDensity(vec3 p, float r) {
  if (r < uDiskIn || r > DISK_OUT) return 0.0;
  float x = clamp((r - uDiskIn) / (DISK_OUT - uDiskIn), 0.0, 1.0);

  /* razor-thin sheet, flaring only slightly outward */
  float H = 0.045 + 0.16 * pow(x, 1.4);
  float vert = exp(-p.y * p.y / (H * H) * 2.0);

  /* exact Kerr angular velocity Ω = √M/(r^3/2 + a√M), 3x time-lapse */
  float phi = atan(p.z, p.x);
  float omega = SQRT_M / (pow(r, 1.5) + uSpin * SQRT_M);
  float ang = phi - uTime * 3.0 * omega;

  /* fine concentric striations over broad soft clumps */
  float rings = fbm(vec2(r * 9.0, ang * 1.6));
  float clump = fbm(vec2(r * 1.5 - 0.3 * ang, ang * 2.2 + r * 1.8));
  float n = rings * 0.55 + clump * 0.45;

  float edgeIn = smoothstep(uDiskIn, uDiskIn + 0.35, r);
  float edgeOut = 1.0 - smoothstep(DISK_OUT * 0.45, DISK_OUT, r);
  float streaks = 0.55 + smoothstep(0.30, 0.80, n) * 1.05;
  return vert * edgeIn * edgeOut * streaks;
}

vec3 trace(vec3 ro, vec3 rd) {
  vec3 x = ro;
  vec3 pv = rd;

  /* photon energy from H = 0: (1+f)E² + 2fκE + (fκ² − 1) = 0 */
  float f; vec3 k;
  ksField(ro, f, k);
  float kap = dot(k, rd);
  float qa = 1.0 + f;
  float qb = f * kap;
  float E = (-qb + sqrt(max(qb * qb - qa * (f * kap * kap - 1.0), 0.0))) / qa;

  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  vec3 xdot = rd;

  for (int i = 0; i < 620; i++) {
    if (float(i) >= uSteps) break;

    float r = ksRadius(x);
    if (r < uHorizon + 0.02) { captured = true; break; }

    ksField(x, f, k);
    float phi = E + dot(k, pv);
    xdot = pv - f * phi * k;
    float speed = max(length(xdot), 1e-4);

    if (dot(x, x) > ESCAPE_R * ESCAPE_R && dot(x, xdot) > 0.0) break;

    float dt = clamp(0.09 * r, 0.02, 1.5) / speed;

    /* slab-aware stepping: never let one step jump across the razor-thin
     * disk sheet (that skipping is what carves banding artifacts) */
    float rxz2 = dot(x.xz, x.xz);
    if (rxz2 < (DISK_OUT + 2.0) * (DISK_OUT + 2.0)) {
      float ay = abs(x.y);
      if (ay < 0.45) {
        dt = min(dt, 0.045 / speed);
      } else {
        /* outside the slab: step at most to just short of its surface */
        dt = min(dt, max((ay - 0.40) / max(abs(xdot.y), 1e-3), 0.05));
      }
    }

    /* dp/dλ = ½∇S, central differences */
    float e = max(0.002, 0.004 * r);
    vec3 grad = vec3(
      hamS(x + vec3(e, 0.0, 0.0), pv, E) - hamS(x - vec3(e, 0.0, 0.0), pv, E),
      hamS(x + vec3(0.0, e, 0.0), pv, E) - hamS(x - vec3(0.0, e, 0.0), pv, E),
      hamS(x + vec3(0.0, 0.0, e), pv, E) - hamS(x - vec3(0.0, 0.0, e), pv, E)
    ) / (2.0 * e);
    pv += 0.5 * grad * dt;

    /* symplectic Euler: advance x with the updated momentum */
    phi = E + dot(k, pv);
    xdot = pv - f * phi * k;
    x += xdot * dt;

    /* disk sample */
    if (abs(x.y) < 0.5) {
      float rbl = sqrt(max(dot(x.xz, x.xz) - uSpin * uSpin, 1e-4));
      float dens = diskDensity(x, rbl);
      if (dens > 0.001) {
        /* circular equatorial Kerr geodesic emitter */
        float r32 = pow(rbl, 1.5);
        float omega = SQRT_M / (r32 + uSpin * SQRT_M);
        float ut = (r32 + uSpin * SQRT_M) /
          (pow(rbl, 0.75) * sqrt(max(r32 - 3.0 * M * sqrt(rbl) + 2.0 * uSpin * SQRT_M, 1e-4)));

        /* exact shift for a circular emitter: g = E / (uᵗ(E − Ω·p_φ)),
         * p_φ = x·p_z − z·p_x conserved by axisymmetry */
        float pphi = x.x * pv.z - x.z * pv.x;
        float gsh = clamp(E / (ut * max(E - omega * pphi, 1e-3)), 0.0, 2.5);

        /* observed temperature and Liouville δ⁴ beaming: I_obs = g⁴·σT⁴ */
        float To = diskTemp(rbl) * gsh;
        vec3 c = blackbody(To);
        float I = pow(To / T_REF, 4.0);

        float ds = speed * dt; /* proper-ish path length through the gas */
        col += trans * c * I * dens * ds * 4.5;
        trans *= exp(-dens * 1.9 * ds);
        if (trans < 0.01) break;
      }
    }
  }

  if (!captured) col += trans * sky(normalize(xdot));
  return col;
}

void main() {
  vec2 uv = vec2(vUv.x * uAspect, vUv.y) * uTanFov;
  vec3 rd = normalize(uCamMat * vec3(uv, -1.0));
  gl_FragColor = vec4(trace(uCamPos, rd), 1.0);
}
`;
