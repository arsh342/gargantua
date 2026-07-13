# Gargantua

A real-time Kerr black hole simulation, rendered as a single full-screen
fragment shader inside a Next.js + React Three Fiber page. Every photon path
bends through an actual geodesic integrator rather than a lensing sprite, the
accretion disk's color and brightness come from the same relativistic
equations that describe a real spinning black hole, and the HUD's readouts
(time dilation, gravity, tidal force) are computed live from those same
equations rather than being decorative numbers.

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
- **The sky is real geometry, not a shader trick.** A separate three.js scene
  (a nebula dome + a real 3D star point-cloud, biased toward a galactic band,
  plus a faint background galaxy) is rendered once into an HDR cubemap by a
  `CubeCamera` (`components/SkyEnvironment.tsx`). The geodesic integrator
  samples that cubemap with the *bent* ray direction whenever a photon
  escapes to infinity, so the nebula and stars get gravitationally lensed
  into the halo exactly like the disk's far side does — that's why dust and
  stars visibly smear around the shadow instead of just sitting behind it.
- **The HUD readouts are exact GR, not flavor text.** Every frame, the
  camera's Cartesian position is converted to its true Boyer–Lindquist
  radius and polar angle, then used to compute:
  - **Time flow** — `dτ/dt = √(1 − 2Mr/Σ)`, Σ = r² + a²cos²θ: the exact
    time-dilation factor for a static observer at that position, valid at
    any latitude, not just the equator.
  - **Local gravity** — `M√Δ / [r²(r − 2M)]`: the proper acceleration a
    hovering observer's accelerometer would read, exact on the equatorial
    plane and reducing to the textbook Schwarzschild formula
    `M/(r²√(1−2M/r))` when spin is zero.
  - **Tidal pull** — `2|Ψ₂|`, twice the modulus of the Kerr Weyl curvature
    scalar `Ψ₂ = −M/(r − ia·cosθ)³`: the actual differential stretching
    force, i.e. the real "spaghettification" number.

  To turn those geometric-unit quantities into numbers you can sanity-check,
  `lib/sim.ts` pins Gargantua's mass at **~100 million solar masses** (Kip
  Thorne's figure from *The Science of Interstellar*), which fixes a real
  Schwarzschild radius (~1.97 AU) to convert acceleration into Earth g's and
  curvature into g-per-meter. It's also why the tidal-pull readout stays
  vanishingly small everywhere reachable — a hole this size has gentle
  tides, which is the actual physics behind why the film's crew could
  approach Gargantua without being torn apart.

Everything renders in linear HDR; a post-processing stack (`Bloom` with
mipmap blur, `ACES` filmic tonemapping, film grain, vignette) does the
tonemapping and glow, the same order of operations a VFX pipeline uses.

## Project structure

```
lib/sim.ts             orbital mechanics + real-world scale done once on the
                        CPU: spin, horizon radius, ISCO, temperature norm,
                        Boyer-Lindquist conversion, g-force/tidal constants
lib/shaders.ts          the ray-marcher — Kerr-Schild geodesics, disk density,
                        blackbody color, cubemap sky lookup
lib/skyShaders.ts       shaders for the background scene: nebula dome, and
                        the soft-sprite material shared by stars and galaxies
lib/blackbody.ts        CPU-side Planckian blackbody fit, used to color the
                        star field so it matches the disk's color model
components/
  Gargantua.tsx         full-screen shader quad; feeds camera state to the
                        GPU and computes the live GR HUD readouts each frame
  SkyEnvironment.tsx     builds the star/nebula/galaxy scene and renders it
                        once into an HDR cubemap via a CubeCamera
  Effects.tsx           bloom / tonemap / grain / vignette post stack
  Scene.tsx             R3F canvas, camera, OrbitControls, quality switching
  Hud.tsx               live readouts (radius, inclination, spin, time flow,
                        local gravity, tidal pull, disk state, fps)
app/page.tsx            mounts the scene (client-only; WebGL needs the browser)
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

Physics and scale live in `lib/sim.ts`:

- `SPIN_STAR` — dimensionless spin `a★` (0 = Schwarzschild, 1 = extremal).
  Horizon radius, ISCO, and disk temperature all recompute from this.
- `T_PEAK` (via the `T_NORM` derivation) — peak disk temperature in Kelvin;
  shifts the color grade from dull-ember to white-hot.
- `BH_MASS_SOLAR` — the real mass (in solar masses) used to convert the HUD's
  local-gravity and tidal-pull readouts from geometric units into Earth g's;
  raising it makes the hole gentler at a given `r/rs`, lowering it harsher.

The background sky is tuned in `components/SkyEnvironment.tsx`:
`STAR_COUNT`, `GALAXY_COUNT`, and the cluster spread/brightness constants
control how dense the field and how prominent the background galaxies look.

Visual-only parameters (turbulence scale, disk opacity falloff, bloom
intensity) live in `lib/shaders.ts` and `Effects.tsx`.

## Stack

[Next.js](https://nextjs.org) (App Router) ·
[React Three Fiber](https://docs.pmnd.rs/react-three-fiber) ·
[drei](https://github.com/pmndrs/drei) ·
[postprocessing](https://github.com/pmndrs/postprocessing) · GLSL
