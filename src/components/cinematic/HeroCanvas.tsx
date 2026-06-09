import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 2600;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 9;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const p = ref.current;
    if (!p) return;
    p.rotation.y += delta * 0.035;
    p.rotation.x = THREE.MathUtils.lerp(p.rotation.x, state.pointer.y * 0.25, 0.04);
    p.rotation.z = THREE.MathUtils.lerp(p.rotation.z, state.pointer.x * 0.12, 0.04);
  });

  const args = useMemo(() => [positions, 3] as [Float32Array, number], [positions]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={args} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color="#8b84ff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function GlowKnot() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.x += delta * 0.12;
    m.rotation.y += delta * 0.18;
    m.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.25;
  });

  return (
    <mesh ref={ref} scale={1.7} position={[3, 0.4, -1]}>
      <torusKnotGeometry args={[1, 0.26, 180, 32]} />
      <meshStandardMaterial
        color="#4f46e5"
        emissive="#4f46e5"
        emissiveIntensity={0.55}
        roughness={0.25}
        metalness={0.7}
        wireframe
      />
    </mesh>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 55 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 4, 6]} intensity={40} color="#7c75ff" />
      <pointLight position={[-6, -3, 2]} intensity={25} color="#3b9eae" />
      <Particles />
      <GlowKnot />
    </Canvas>
  );
}
