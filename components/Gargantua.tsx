"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import * as THREE from "three";
import { vert, frag } from "@/lib/shaders";
import {
  sim,
  hudBridge,
  SPIN_A,
  R_HORIZON,
  R_ISCO,
  T_NORM,
  M_GEOM,
  boyerLindquistR,
  ACCEL_TO_G,
  TIDAL_TO_G_PER_M,
} from "@/lib/sim";

export default function Gargantua({ skyTexture }: { skyTexture: THREE.CubeTexture }) {
  const m3 = useMemo(() => new THREE.Matrix3(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 14.0 },
      uCamPos: { value: new THREE.Vector3() },
      uCamMat: { value: new THREE.Matrix3() },
      uAspect: { value: 1 },
      uTanFov: { value: 0.5 },
      uSteps: { value: sim.steps },
      uSpin: { value: SPIN_A },
      uHorizon: { value: R_HORIZON },
      uDiskIn: { value: R_ISCO },
      uTNorm: { value: T_NORM },
      uSky: { value: skyTexture },
    }),
    [skyTexture]
  );
  const meter = useRef({ frames: 0, clock: 0 });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (!sim.paused) uniforms.uTime.value += dt;

    const cam = state.camera as THREE.PerspectiveCamera;
    uniforms.uCamPos.value.copy(cam.position);
    uniforms.uCamMat.value.copy(m3.setFromMatrix4(cam.matrixWorld));
    uniforms.uAspect.value = state.size.width / state.size.height;
    uniforms.uTanFov.value = Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5));
    uniforms.uSteps.value = sim.steps;

    const m = meter.current;
    m.frames++;
    m.clock += dt;
    if (m.clock > 0.5) {
      hudBridge.fps = Math.round(m.frames / m.clock);

      /* exact Kerr Boyer-Lindquist radius/polar angle of the camera */
      const { x, y, z } = cam.position;
      const r = boyerLindquistR(x, y, z, SPIN_A);
      const cosTheta = y / r;
      const sigma = r * r + SPIN_A * SPIN_A * cosTheta * cosTheta;
      const delta = r * r - 2 * M_GEOM * r + SPIN_A * SPIN_A;

      hudBridge.radius = r;
      hudBridge.incl = Math.abs((Math.asin(cosTheta) * 180) / Math.PI);

      /* exact for any θ: dτ/dt = √(−g_tt) for a static observer */
      hudBridge.timeDilation = Math.sqrt(Math.max(1 - (2 * M_GEOM * r) / sigma, 0));

      /* exact on the equatorial plane (where the disk lives) — the proper
       * acceleration a static observer's accelerometer reads while hovering.
       * Reduces to the familiar M/(r²√(1−2M/r)) Schwarzschild formula at a=0. */
      const hover = delta > 0 && r > 2 * M_GEOM
        ? (M_GEOM * Math.sqrt(delta)) / (r * r * (r - 2 * M_GEOM))
        : Infinity;
      hudBridge.localG = hover * ACCEL_TO_G;

      /* exact for any θ: 2|Ψ2|, the modulus of the Weyl curvature scalar
       * Ψ2 = −M/(r−ia·cosθ)³ — the actual "spaghettification" stretch. */
      hudBridge.tidalGPerM = (2 * M_GEOM / Math.pow(sigma, 1.5)) * TIDAL_TO_G_PER_M;

      hudBridge.push?.();
      m.frames = 0;
      m.clock = 0;
    }
  });

  return (
    <ScreenQuad frustumCulled={false}>
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}
