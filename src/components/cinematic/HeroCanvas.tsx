import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INDIGO = "#4f46e5";
const BLUE = "#7c75ff";
const CYAN = "#3b9eae";

/** Slow-drifting background star field for depth. */
function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 1200;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const p = ref.current;
    if (!p) return;
    p.rotation.y += delta * 0.012;
  });

  const args = useMemo(() => [positions, 3] as [Float32Array, number], [positions]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={args} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color={BLUE}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Glowing wireframe network globe with surface node points and soft pulse. */
function Core() {
  const inner = useRef<THREE.Mesh>(null);
  const nodes = useRef<THREE.Points>(null);
  const halo = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  // Evenly distributed points on the sphere surface (fibonacci sphere).
  const nodePositions = useMemo(() => {
    const count = 220;
    const arr = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      arr[i * 3] = Math.cos(theta) * r * 1.02;
      arr[i * 3 + 1] = y * 1.02;
      arr[i * 3 + 2] = Math.sin(theta) * r * 1.02;
    }
    return arr;
  }, []);

  const nodeArgs = useMemo(
    () => [nodePositions, 3] as [Float32Array, number],
    [nodePositions],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.6) * 0.05;
    if (inner.current) {
      inner.current.scale.setScalar(pulse);
      inner.current.rotation.y += 0.0022;
    }
    if (nodes.current) nodes.current.rotation.y += 0.0022;
    if (halo.current) halo.current.scale.setScalar(pulse * 1.05);
    if (mat.current) mat.current.emissiveIntensity = 0.6 + Math.sin(t * 0.6) * 0.2;
  });

  return (
    <group>
      {/* Wireframe network sphere */}
      <mesh ref={inner}>
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          ref={mat}
          color={INDIGO}
          emissive={INDIGO}
          emissiveIntensity={0.7}
          roughness={0.35}
          metalness={0.5}
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Bright surface nodes */}
      <points ref={nodes}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={nodeArgs} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color={CYAN}
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Soft glow shell */}
      <mesh ref={halo}>
        <sphereGeometry args={[1.18, 32, 32]} />
        <meshBasicMaterial
          color={BLUE}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

/** A neon orbit ring tilted in 3D, rotating at its own speed. */
function OrbitRing({
  radius,
  color,
  speed,
  tilt,
}: {
  radius: number;
  color: string;
  speed: number;
  tilt: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });

  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.012, 16, 160]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** A service node travelling around the core on its own pivot + radius. */
function ServiceNode({
  radius,
  color,
  speed,
  tilt,
  offset,
}: {
  radius: number;
  color: string;
  speed: number;
  tilt: [number, number, number];
  offset: number;
}) {
  const pivot = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (pivot.current) pivot.current.rotation.z += delta * speed;
  });

  return (
    <group rotation={tilt}>
      <group ref={pivot} rotation={[0, 0, offset]}>
        <group position={[radius, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.4}
              roughness={0.2}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** The full digital-ecosystem cluster: core + rings + orbiting nodes. */
function Ecosystem() {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.06;
  });

  return (
    <group ref={ref} position={[3, 0.4, -1]} scale={1.55}>
      <Core />

      <OrbitRing radius={1.7} color={INDIGO} speed={0.18} tilt={[1.3, 0.3, 0]} />
      <OrbitRing radius={2.25} color={BLUE} speed={0.12} tilt={[1.1, -0.5, 0.4]} />
      <OrbitRing radius={2.8} color={CYAN} speed={0.08} tilt={[1.45, 0.6, -0.3]} />

      <ServiceNode radius={1.7} color={INDIGO} speed={0.45} tilt={[1.3, 0.3, 0]} offset={0} />
      <ServiceNode radius={2.25} color={BLUE} speed={0.32} tilt={[1.1, -0.5, 0.4]} offset={2.1} />
      <ServiceNode radius={2.8} color={CYAN} speed={0.24} tilt={[1.45, 0.6, -0.3]} offset={4.2} />
    </group>
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
      <pointLight position={[6, 4, 6]} intensity={40} color={BLUE} />
      <pointLight position={[-6, -3, 2]} intensity={25} color={CYAN} />
      <Particles />
      <Ecosystem />
    </Canvas>
  );
}
