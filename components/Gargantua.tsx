"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import * as THREE from "three";
import { vert, frag } from "@/lib/shaders";
import { sim, hudBridge, SPIN_A, R_HORIZON, R_ISCO, T_NORM } from "@/lib/sim";

export default function Gargantua() {
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
    }),
    []
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
      const r = cam.position.length();
      hudBridge.radius = r;
      hudBridge.incl = Math.abs((Math.asin(cam.position.y / r) * 180) / Math.PI);
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
