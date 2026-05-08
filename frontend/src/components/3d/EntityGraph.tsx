"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// Hex equivalents of design tokens — Three.js colors can't use CSS vars
const DEPT_COLORS = ["#4A90D9", "#B8840C", "#2ECC8A", "#E07B3A"]; // sky-blue, gold, emerald, amber
const UBID_COLOR  = "#F0C040"; // bright gold — hub nodes are the unified identity anchor

/* ── Deterministic pseudo-random ── */
function prng(seed: number, n: number) {
  return Math.abs(Math.sin(seed * 9301 + n * 49297 + 233) % 1);
}

/* ── Generate node/edge graph ── */
interface NodeDef {
  pos: [number, number, number];
  color: string;
  r: number;
  isHub: boolean;
}
function makeGraph(seed = 42) {
  const nodes: NodeDef[] = [];
  const edges: [number, number][] = [];

  /* 6 hub (UBID) nodes */
  for (let i = 0; i < 6; i++) {
    nodes.push({
      pos: [
        (prng(seed, i * 3)     - 0.5) * 8,
        (prng(seed, i * 3 + 1) - 0.5) * 5,
        (prng(seed, i * 3 + 2) - 0.5) * 3,
      ],
      color: UBID_COLOR,
      r: 0.30,
      isHub: true,
    });
  }

  /* 2-4 leaf nodes per hub */
  let ni = 6;
  for (let u = 0; u < 6; u++) {
    const leafCount = 2 + Math.floor(prng(seed, u * 7) * 3);
    for (let l = 0; l < leafCount; l++) {
      const angle  = (l / leafCount) * Math.PI * 2 + prng(seed, u + l) * 0.5;
      const radius = 1.2 + prng(seed, ni) * 0.8;
      const [bx, by, bz] = nodes[u].pos;
      nodes.push({
        pos: [
          bx + Math.cos(angle) * radius,
          by + Math.sin(angle) * radius * 0.65,
          bz + (prng(seed, ni + 1) - 0.5) * 1.8,
        ],
        color: DEPT_COLORS[Math.floor(prng(seed, ni + 2) * 4)],
        r: 0.14 + prng(seed, ni + 3) * 0.07,
        isHub: false,
      });
      edges.push([u, ni]);
      ni++;
    }
  }

  /* A few cross-leaf edges */
  for (let i = 0; i < 6; i++) {
    const a = 6 + Math.floor(prng(seed, i * 13) * (nodes.length - 6));
    const b = 6 + Math.floor(prng(seed, i * 17) * (nodes.length - 6));
    if (a !== b) edges.push([a, b]);
  }

  return { nodes, edges };
}

/* ── Single sphere ── */
function Node({ pos, color, r, isHub }: NodeDef) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * (isHub ? 0.35 : 0.18);
  });
  return (
    <Float speed={isHub ? 2.2 : 1.4} rotationIntensity={0.15} floatIntensity={isHub ? 0.9 : 0.4}>
      <mesh ref={ref} position={pos}>
        <sphereGeometry args={[r, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHub ? 1.2 : 0.65}
          roughness={0.10}
          metalness={0.55}
          transparent
          opacity={isHub ? 1.0 : 0.90}
        />
      </mesh>
      {isHub && (
        <mesh position={pos}>
          <sphereGeometry args={[r * 1.8, 16, 16]} />
          <meshStandardMaterial color={color} transparent opacity={0.07} side={THREE.BackSide} />
        </mesh>
      )}
    </Float>
  );
}

/* ── Edge as a line segment ── */
function Edge({ a, b, hub }: { a: [number,number,number]; b: [number,number,number]; hub: boolean }) {
  const lineObj = useMemo(() => {
    const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: hub ? "#F0C040" : "#C8B99C",
      transparent: true,
      opacity: hub ? 0.70 : 0.35,
    });
    return new THREE.Line(geo, mat);
  }, [a, b, hub]);
  return <primitive object={lineObj} />;
}

/* ── Scene ── */
function Scene() {
  const { nodes, edges } = useMemo(() => makeGraph(42), []);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((s) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = s.clock.elapsedTime * 0.055;
    groupRef.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.035) * 0.09;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[8, 10, 6]} intensity={1.8} color="#FFFFFF" />
      <pointLight position={[-6, 4, 6]} intensity={1.2} color="#F0C040" />
      <pointLight position={[6, -4, -4]} intensity={0.8} color="#4A90D9" />
      {edges.map(([ai, bi], i) => (
        <Edge
          key={i}
          a={nodes[ai].pos}
          b={nodes[bi].pos}
          hub={nodes[ai].isHub || nodes[bi].isHub}
        />
      ))}
      {nodes.map((n, i) => <Node key={i} {...n} />)}
    </group>
  );
}

/* ── Public component ── */
export function EntityGraph() {
  return (
    /* Explicit 100%×100% so Three.js knows the canvas dimensions */
    <div style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 13], fov: 52 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
