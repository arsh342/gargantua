"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Gargantua from "./Gargantua";
import SkyEnvironment from "./SkyEnvironment";
import Effects from "./Effects";
import Hud from "./Hud";
import { sim, hudBridge, QUALITY, type Quality } from "@/lib/sim";

export default function Scene() {
  const [quality, setQuality] = useState<Quality>(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? "low" : "med"
  );
  const [sky, setSky] = useState<THREE.CubeTexture | null>(null);
  const onSkyReady = useCallback((tex: THREE.CubeTexture) => setSky(tex), []);

  useEffect(() => {
    sim.steps = QUALITY[quality].steps;
  }, [quality]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sim.paused = true;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        sim.paused = !sim.paused;
        hudBridge.push?.();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="stage">
      <Canvas
        flat
        dpr={QUALITY[quality].dpr}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 0.1, far: 200, position: [5, 3.6, 25] }}
      >
        <SkyEnvironment onReady={onSkyReady} />
        {sky && <Gargantua skyTexture={sky} />}
        <Effects />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={2.5}
          maxDistance={60}
          rotateSpeed={0.55}
          zoomSpeed={0.7}
        />
      </Canvas>
      <Hud quality={quality} setQuality={setQuality} />
    </div>
  );
}
