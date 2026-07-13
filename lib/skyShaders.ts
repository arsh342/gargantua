/*
 * The environment behind the black hole: a nebula/dust dome plus a real 3D
 * star point-cloud, rendered once by a CubeCamera into a cubemap that the
 * geodesic ray-tracer samples whenever a bent photon escapes to infinity.
 * Keeping this as an actual three.js scene (real geometry, real render
 * pass) rather than more procedural shader code is what gives the
 * background genuine depth and clustering instead of uniform noise.
 */

export const nebulaVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaFrag = /* glsl */ `
precision highp float;
varying vec3 vDir;

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

void main() {
  vec3 d = normalize(vDir);
  vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
  vec3 col = vec3(0.0);

  /* galactic band: a tilted plane of dense dust and gas, kept narrow */
  vec3 bandN = normalize(vec3(0.32, 0.86, 0.40));
  float band = exp(-pow(dot(d, bandN), 2.0) * 17.0);

  /* emission nebula: H-alpha red/pink vs O-III teal, sparse patches only */
  float mask = fbm(sph * vec2(2.6, 4.4) + 7.7);
  float species = smoothstep(0.35, 0.75, fbm(sph * vec2(3.4, 3.0) + 41.0));
  vec3 emission = mix(vec3(0.62, 0.13, 0.19), vec3(0.10, 0.34, 0.38), species);
  col += emission * band * pow(max(mask - 0.44, 0.0) * 1.8, 2.0) * 0.55;

  /* dark dust lanes threading the band */
  float dust = fbm(sph * vec2(6.0, 9.0) + 2.2);
  col += vec3(0.035, 0.024, 0.020) * band * dust * dust * dust;
  col *= 1.0 - 0.55 * band * smoothstep(0.55, 0.85, fbm(sph * vec2(8.0, 13.0) + 5.5));

  /* faint reflection-nebula blue haze off-band */
  float haze = fbm(sph * vec2(1.1, 1.6) + 90.0);
  col += vec3(0.007, 0.008, 0.013) * (0.2 + 0.7 * haze * haze);

  gl_FragColor = vec4(col, 1.0);
}
`;

/* Soft round sprites for stars, galaxy cores, and galaxy halo points alike —
 * vColor already carries HDR intensity (can exceed 1 for bright stars, which
 * lets Bloom react to them like it does the disk). */
export const pointVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize;
}
`;

export const pointFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * core * core, 1.0);
}
`;
