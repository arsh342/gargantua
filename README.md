# Gargantua

A real-time Kerr black hole simulation, rendered as a single full-screen
fragment shader inside a Next.js + React Three Fiber page. Every photon path
bends through an actual geodesic integrator rather than a lensing sprite, and
the accretion disk's color, brightness, and shape come from the same
relativistic equations that describe a real spinning black hole.

## What's actually being computed

- **Geodesics.** Photons are integrated in the **Kerr–Schild** form of the
  Kerr metric — Cartesian, horizon-penetrating coordinates that stay
  numerically clean all the way to the event horizon. Each step evolves the
  Hamiltonian `H = ½(−E² + |p|² − fΦ²)` with a symplectic Euler update, so
  frame dragging near a spinning hole falls out of the integration itself
  rather than being faked.
- **Spin.** Dimensionless spin `a★ = 0.95` (`lib/sim.ts`). The event horizon
  radius `r₊ = M + √(M² − a²)` and the **prograde ISCO** (innermost stable
  circular orbit, Bardeen–Press–Teukolsky formula) are both derived from it
  on the CPU and passed to the shader — at this spin the disk's inner edge
  sits at `0.97 rs`, which is why it hugs the shadow the way Kerr spin allows
  and a non-spinning (Schwarzschild) hole cannot.
- **The accretion disk.** A thin volumetric sheet starting at the ISCO. Gas
  follows exact circular equatorial Kerr geodesics
  (`Ω = √M / (r^1.5 + a√M)`), and its temperature profile follows
  **Novikov–Thorne**: `T(r) ∝ [r⁻³(1 − √(r_in/r))]^¼`, which is why the inner
  edge cools to black at the ISCO instead of glowing right up to the horizon.
- **What you actually see.** The observed frequency shift for a circular
  emitter, `g = E / (uᵗ(E − Ω·p_φ))`, folds gravitational redshift, orbital
  time dilation, and Doppler into one factor. It drives two things
  separately: the color, via a **Planckian blackbody** fit at the shifted
  temperature, and the brightness, via **δ⁴ relativistic beaming**
  (Liouville's theorem) — which is why the side of the disk rotating toward
  you outshines the far side by roughly an order of magnitude.
- **The halo above and below the shadow** isn't a glow effect — it's the
  disk's far side, gravitationally lensed over the poles because photons
  passing near the photon sphere can loop most of the way around the hole
  before reaching the camera.

Everything renders in linear HDR; a post-processing stack (`Bloom` with
mipmap blur, `ACES` filmic tonemapping, film grain, vignette) does the
tonemapping and glow, the same order of operations a VFX pipeline uses.

## Project structure

```
lib/sim.ts          orbital mechanics done once on the CPU: spin, horizon
                     radius, ISCO, temperature normalization
lib/shaders.ts       the ray-marcher — Kerr-Schild geodesics, disk density,
                     blackbody color, sky/starfield
components/
  Gargantua.tsx      full-screen shader quad, feeds camera state to the GPU
  Effects.tsx        bloom / tonemap / grain / vignette post stack
  Scene.tsx          R3F canvas, camera, OrbitControls, quality switching
  Hud.tsx            live readouts (orbit radius, inclination, spin, fps)
app/page.tsx         mounts the scene (client-only; WebGL needs the browser)
```

## Running it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Drag to orbit, scroll to
zoom, space to freeze the disk. LOW/MED/HIGH in the bottom-right trade ray
resolution and step count for frame rate — the geodesic integrator is the
expensive part, so drop to LOW on integrated graphics.

## Tuning

Everything physical lives in `lib/sim.ts`:

- `SPIN_STAR` — dimensionless spin `a★` (0 = Schwarzschild, 1 = extremal).
  Horizon radius, ISCO, and disk temperature all recompute from this.
- `T_PEAK` (in the same file, `T_NORM` derivation) — peak disk temperature in
  Kelvin; shifts the color grade from dull-ember to white-hot.

Visual-only parameters (turbulence scale, disk opacity falloff, star
density, bloom intensity) live in `lib/shaders.ts` and `Effects.tsx`.

## Stack

[Next.js](https://nextjs.org) (App Router) ·
[React Three Fiber](https://docs.pmnd.rs/react-three-fiber) ·
[drei](https://github.com/pmndrs/drei) ·
[postprocessing](https://github.com/pmndrs/postprocessing) · GLSL
