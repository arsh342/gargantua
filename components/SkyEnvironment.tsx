"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { nebulaVert, nebulaFrag, pointVert, pointFrag } from "@/lib/skyShaders";
import { blackbody } from "@/lib/blackbody";

const NEBULA_RADIUS = 26;
const STAR_RADIUS = 10;
const STAR_COUNT = 4000;
const GALAXY_COUNT = 1;

function randomOnSphere(radius: number): [number, number, number] {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Orthonormal basis for a tangent plane at a point on the sphere — used to
 * scatter galaxy-cluster members around a center without leaving the shell. */
function tangentBasis(n: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const up = Math.abs(n.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  return [t1, t2];
}

function buildStarField(): THREE.Points {
  const bandNormal = new THREE.Vector3(0.32, 0.86, 0.4).normalize();
  const total = STAR_COUNT + GALAXY_COUNT * 30;
  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const colors = new Float32Array(total * 3);

  let idx = 0;
  const put = (x: number, y: number, z: number, size: number, rgb: [number, number, number]) => {
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    sizes[idx] = size;
    colors[idx * 3] = rgb[0];
    colors[idx * 3 + 1] = rgb[1];
    colors[idx * 3 + 2] = rgb[2];
    idx++;
  };

  for (let i = 0; i < STAR_COUNT; i++) {
    let [x, y, z] = randomOnSphere(STAR_RADIUS);
    /* bias ~45% of stars toward the galactic band, like the real sky */
    if (Math.random() < 0.45) {
      const n = new THREE.Vector3(x, y, z).normalize();
      const drift = (Math.random() - 0.5) * 0.35;
      const corrected = n.clone().addScaledVector(bandNormal, -n.dot(bandNormal) + drift);
      [x, y, z] = corrected.normalize().multiplyScalar(STAR_RADIUS).toArray();
    }
    const mag = Math.pow(Math.random(), 8);
    const size = 1.6 + mag * 7.0;
    const intensity = 1.6 + Math.pow(Math.random(), 10) * 9.0;
    const temp = 3000 + Math.random() * 12000;
    const [r, g, b] = blackbody(temp);
    put(x, y, z, size, [r * intensity, g * intensity, b * intensity]);
  }

  /* distant galaxies: small elongated clusters, flattened along one axis */
  for (let g = 0; g < GALAXY_COUNT; g++) {
    const [cx, cy, cz] = randomOnSphere(STAR_RADIUS * 0.98);
    const center = new THREE.Vector3(cx, cy, cz);
    const normal = center.clone().normalize();
    const [t1, t2] = tangentBasis(normal);
    const stretch = 0.4 + Math.random() * 0.5;
    const tilt = Math.random() * Math.PI;
    const spread = 0.55 + Math.random() * 0.4;
    const coreTemp = 4200 + Math.random() * 3500;
    const [cr, cg, cb] = blackbody(coreTemp);

    put(cx, cy, cz, 4.2, [cr * 2.2, cg * 2.2, cb * 2.2]);
    for (let m = 1; m < 30; m++) {
      const rad = Math.pow(Math.random(), 0.6) * spread;
      const ang = Math.random() * Math.PI * 2;
      const ex = Math.cos(ang) * rad * stretch;
      const ey = Math.sin(ang) * rad;
      const ax = ex * Math.cos(tilt) - ey * Math.sin(tilt);
      const ay = ex * Math.sin(tilt) + ey * Math.cos(tilt);
      const offset = t1.clone().multiplyScalar(ax).addScaledVector(t2, ay);
      const p = center.clone().add(offset).normalize().multiplyScalar(STAR_RADIUS * 0.98);
      const fall = 1.0 - rad / spread;
      put(p.x, p.y, p.z, 0.8 + fall * 1.6, [cr * fall, cg * fall, cb * fall]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    depthWrite: true,
  });

  return new THREE.Points(geo, mat);
}

export default function SkyEnvironment({
  onReady,
}: {
  onReady: (tex: THREE.CubeTexture) => void;
}) {
  const { gl } = useThree();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const scene = new THREE.Scene();

    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(NEBULA_RADIUS, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: nebulaVert,
        fragmentShader: nebulaFrag,
        side: THREE.BackSide,
      })
    );
    scene.add(nebula);
    scene.add(buildStarField());

    /* no mipmap chain: averaging a lone bright star texel with its black
     * neighbors at coarser mips washes it out almost to nothing, while the
     * denser galaxy clusters survive — leaving a sky with "stars" that are
     * really just the surviving clusters. Plain bilinear keeps every star
     * at full brightness. */
    const rt = new THREE.WebGLCubeRenderTarget(1024, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const cubeCam = new THREE.CubeCamera(0.1, 100, rt);
    cubeCam.update(gl, scene);

    onReady(rt.texture);

    return () => {
      nebula.geometry.dispose();
      (nebula.material as THREE.Material).dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      rt.dispose();
    };
  }, [gl, onReady]);

  return null;
}
