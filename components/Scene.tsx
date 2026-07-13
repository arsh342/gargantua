"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Gargantua from "./Gargantua";
import Effects from "./Effects";
import Hud from "./Hud";
import { sim, hudBridge, QUALITY, type Quality } from "@/lib/sim";

export default function Scene() {
  const [quality, setQuality] = useState<Quality>(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? "low" : "med"
  );

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
        <Gargantua />
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
