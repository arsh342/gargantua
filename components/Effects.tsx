"use client";

import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={1.15}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.25}
        radius={0.82}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise premultiply opacity={0.35} />
      <Vignette offset={0.18} darkness={0.72} />
    </EffectComposer>
  );
}
