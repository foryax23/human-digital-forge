import { useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

import swirlAsset from "@/assets/brand/vortex-swirl.png.asset.json";

const INDIGO = "#4f46e5";
const DEEP = "#1e1e5a";
const PERI = "#8ea2ff";

/** The brand swirl mapped onto a tilted disc, rotating slowly. */
function SwirlDisc() {
  const map = useLoader(THREE.TextureLoader, swirlAsset.url);
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.z -= delta * 0.12;
    m.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.06;
  });

  return (
    <mesh ref={ref} rotation={[-0.42, 0, 0]}>
      <planeGeometry args={[5.2, 5.2]} />
      <meshBasicMaterial
        map={map}
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Spiral of dust drawn into the core — the sense of a vortex. */
function Spiral({ count = 2600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const angle = t * Math.PI * 7 + arm;
      const radius = 0.5 + t * 3.6 + Math.random() * 0.28;
      arr[i * 3] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = (Math.random() - 0.5) * (0.12 + t * 0.5);
      arr[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return arr;
  }, [count]);

  const args = useMemo(() => [positions, 3] as [Float32Array, number], [positions]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.16;
  });

  return (
    <points ref={ref} rotation={[0.32, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={args} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color={PERI}
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Breathing light at the centre of the vortex. */
function Core() {
  const inner = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.07;
    if (inner.current) inner.current.scale.setScalar(pulse);
    if (halo.current) halo.current.scale.setScalar(pulse * 1.14);
  });

  return (
    <group>
      <mesh ref={inner}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial color={PERI} toneMapped={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial
          color={INDIGO}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial
          color={DEEP}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

/** Thin light rings suggesting depth around the vortex. */
function Ring({ radius, speed, tilt }: { radius: number; speed: number; tilt: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.006, 12, 180]} />
      <meshBasicMaterial
        color={PERI}
        transparent
        opacity={0.32}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Whole cluster; drifts gently toward the pointer. */
function Vortex() {
  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    target.current.x = state.pointer.y * 0.14;
    target.current.y = state.pointer.x * 0.22;
    const k = 1 - Math.exp(-2.4 * Math.min(delta, 0.05));
    g.rotation.x += (target.current.x - g.rotation.x) * k;
    g.rotation.y += (target.current.y - g.rotation.y) * k;
  });

  return (
    <group ref={group}>
      <SwirlDisc />
      <Spiral />
      <Core />
      <Ring radius={2.5} speed={0.1} tilt={[1.28, 0.2, 0]} />
      <Ring radius={3.35} speed={-0.07} tilt={[1.16, -0.4, 0.3]} />
    </group>
  );
}

export default function VortexScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 7.4], fov: 52 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <Vortex />
    </Canvas>
  );
}
