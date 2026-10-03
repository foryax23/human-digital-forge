import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";

import { ARC_HUBS, landDots, toVector, type LatLon } from "./geo";

/*
 * The analysis globe: a dotted Earth in neutral greys with Romania in the brand
 * line, turned so Romania faces the camera, a faint scanner band while the
 * analysis runs, a marker on the company's city and a pulse along an arc
 * whenever an analysis step finishes. No atmosphere halo or rim glow; colours
 * come from the page tokens (--vx-*), read once when the scene mounts.
 * Lazy-loaded (three.js stays out of the route chunk); while paused or
 * off-screen it renders on demand and holds its resting pose.
 */

export type GlobeSceneProps = {
  /** The company's city (or Romania's centre). */
  home: LatLon;
  /** Finished analysis steps; every increase fires a pulse along an arc. */
  pulses: number;
  running: boolean;
  done: boolean;
  /** False while motion is paused or the globe is off-screen. */
  active: boolean;
  /** Called once the WebGL context exists, to retire the SVG placeholder. */
  onReady?: () => void;
};

type Live = Omit<GlobeSceneProps, "home" | "onReady">;

const FOV = 36;
/** Puts the globe's silhouette at 30 % of the canvas size (GLOBE_RADIUS_RATIO). */
const CAMERA_Z = 5.23;
const DOT_SIZE = 0.0105;
const SPARK_SIZE = 0.045;

/**
 * A colour token from the scan page (".cinematic" scope), with a fallback. The raw shaders
 * write their colour straight to the screen, so the sRGB value is kept as is (no linear
 * conversion) and the dots match the page's greys.
 */
function token(name: string, fallback: string) {
  const color = new THREE.Color();
  const scope =
    typeof document === "undefined"
      ? null
      : (document.querySelector(".cinematic") ?? document.documentElement);
  const value = scope ? getComputedStyle(scope).getPropertyValue(name).trim() : "";
  return color.setStyle(value || fallback, THREE.LinearSRGBColorSpace);
}

/** Dots shade from the label grey to the secondary-text grey; Romania and pulses use the brand line. */
const COLORS = {
  get dot() {
    return token("--vx-fg-3", "#7d8095");
  },
  get light() {
    return token("--vx-fg-2", "#a7a9b9");
  },
  get brand() {
    return token("--vx-brand-line", "#8079ff");
  },
  get body() {
    return token("--vx-s1", "#0a0b16");
  },
};

const DOT_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aRomania;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uSweep;
  uniform float uSweepAmount;
  uniform vec3 uHighlight;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vec3 n = normalize(normalMatrix * position);
    float band = exp(-pow((world.y - uSweep) * 7.0, 2.0)) * uSweepAmount;
    vColor = mix(aColor, uHighlight, aRomania) + band * vec3(0.16);
    vAlpha = smoothstep(-0.05, 0.4, n.z) * (0.92 + 0.08 * aRomania);
    gl_PointSize = aSize * (1.0 + band * 0.6) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.18, d) * vAlpha);
  }
`;

const SPARK_VERTEX = /* glsl */ `
  uniform float uScale;
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const SPARK_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a);
  }
`;

const NORMAL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Opaque body in the panel colour, no rim; hides the dots on the far side. */
const BODY_FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  void main() {
    gl_FragColor = vec4(uBase, 1.0);
  }
`;

const ARC_VERTEX = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAGMENT = /* glsl */ `
  uniform float uHead;
  uniform vec3 uColor;
  varying float vT;
  void main() {
    float d = uHead - vT;
    float trail = d >= 0.0 ? smoothstep(0.32, 0.0, d) : 0.0;
    gl_FragColor = vec4(uColor, 0.1 + trail * 0.9);
  }
`;

/** Device pixels per world unit at depth 1, for size-attenuated points. */
function pointScale(state: RootState) {
  return (state.size.height * state.viewport.dpr) / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
}

/** Frame delta, capped so a long pause doesn't make animations jump. */
function step(delta: number, live: Live) {
  return live.active ? Math.min(delta, 0.05) : 0;
}

/** A soft light from the top left across the globe (object space, so it turns with it). */
function dotColor(x: number, y: number, palette: { dot: THREE.Color; light: THREE.Color }) {
  const t = THREE.MathUtils.clamp((y * 0.65 - x * 0.35 + 1) / 2, 0, 1);
  return palette.dot.clone().lerp(palette.light, t);
}

type Sweep = { y: number; amount: number; done: number };

function Dots({ sweep }: { sweep: RefObject<Sweep> }) {
  const geometry = useMemo(() => {
    const palette = { dot: COLORS.dot, light: COLORS.light };
    const dots = landDots(1);
    const positions = new Float32Array(dots.length * 3);
    const colors = new Float32Array(dots.length * 3);
    const sizes = new Float32Array(dots.length);
    const romania = new Float32Array(dots.length);
    dots.forEach((dot, i) => {
      const [x, y, z] = toVector(dot.lat, dot.lon);
      positions.set([x, y, z], i * 3);
      const color = dotColor(x, y, palette);
      colors.set([color.r, color.g, color.b], i * 3);
      sizes[i] = dot.romania ? DOT_SIZE * 1.7 : DOT_SIZE;
      romania[i] = dot.romania ? 1 : 0;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aRomania", new THREE.BufferAttribute(romania, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DOT_VERTEX,
        fragmentShader: DOT_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uScale: { value: 1 },
          uSweep: { value: 2 },
          uSweepAmount: { value: 0 },
          uHighlight: { value: COLORS.brand },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const u = material.uniforms;
    u.uScale.value = pointScale(state);
    u.uSweep.value = sweep.current.y;
    u.uSweepAmount.value = sweep.current.amount;
  });

  return <points geometry={geometry} material={material} />;
}

function Body() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NORMAL_VERTEX,
        fragmentShader: BODY_FRAGMENT,
        uniforms: { uBase: { value: COLORS.body } },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material}>
      <sphereGeometry args={[0.992, 64, 64]} />
    </mesh>
  );
}

type Arc = { line: THREE.Line; material: THREE.ShaderMaterial; points: THREE.Vector3[] };

/** Great-circle arcs from the home point, lifted above the surface. */
function buildArcs(home: LatLon): Arc[] {
  const from = new THREE.Vector3(...toVector(home[0], home[1]));
  return ARC_HUBS.map((hub) => {
    const to = new THREE.Vector3(...toVector(hub[0], hub[1]));
    const angle = from.angleTo(to);
    const lift = 0.04 + angle * 0.45;
    const segments = 64;
    const points: THREE.Vector3[] = [];
    const ts = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = Math.sin((1 - t) * angle) / Math.sin(angle);
      const b = Math.sin(t * angle) / Math.sin(angle);
      points.push(
        from
          .clone()
          .multiplyScalar(a)
          .add(to.clone().multiplyScalar(b))
          .multiplyScalar(1 + lift * Math.sin(Math.PI * t)),
      );
      ts[i] = t;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute("aT", new THREE.BufferAttribute(ts, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: ARC_VERTEX,
      fragmentShader: ARC_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uHead: { value: -1 }, uColor: { value: COLORS.light } },
    });
    return { line: new THREE.Line(geometry, material), material, points };
  });
}

function Arcs({ home, live }: { home: LatLon; live: Live }) {
  const arcs = useMemo(() => buildArcs(home), [home]);
  const heads = useRef<number[]>([]);
  const idle = useRef(1.2);
  const fired = useRef(live.pulses);

  const sparks = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(ARC_HUBS.length * 3), 3),
    );
    const material = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uScale: { value: 1 },
        uSize: { value: SPARK_SIZE },
        uColor: { value: COLORS.brand },
      },
    });
    return { geometry, material };
  }, []);

  useEffect(() => {
    heads.current = arcs.map(() => -1);
    return () => {
      for (const arc of arcs) {
        arc.line.geometry.dispose();
        arc.material.dispose();
      }
    };
  }, [arcs]);

  useEffect(
    () => () => {
      sparks.geometry.dispose();
      sparks.material.dispose();
    },
    [sparks],
  );

  useFrame((state, rawDelta) => {
    const delta = step(rawDelta, live);
    sparks.material.uniforms.uScale.value = pointScale(state);

    // A finished step fires the next arc; between steps, an occasional idle pulse.
    if (live.pulses > fired.current) {
      heads.current[(live.pulses - 1) % arcs.length] = 0;
      fired.current = live.pulses;
      idle.current = 2.4;
    }
    if (live.active) {
      idle.current -= delta;
      if (idle.current <= 0) {
        const free = heads.current.flatMap((head, i) => (head < 0 ? [i] : []));
        if (free.length) heads.current[free[Math.floor(Math.random() * free.length)]] = 0;
        idle.current = live.running ? 1.6 : 2.8;
      }
    }

    const positions = sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
    arcs.forEach((arc, i) => {
      let head = heads.current[i] ?? -1;
      if (head >= 0) {
        head += delta / 1.5;
        if (head > 1.35) head = -1;
        heads.current[i] = head;
      }
      arc.material.uniforms.uHead.value = head;
      // Parked sparks sit at the centre, hidden inside the globe.
      if (head >= 0 && head <= 1) {
        const p = arc.points[Math.round(head * (arc.points.length - 1))];
        positions.setXYZ(i, p.x, p.y, p.z);
      } else {
        positions.setXYZ(i, 0, 0, 0);
      }
    });
    positions.needsUpdate = true;
  });

  return (
    <group>
      {arcs.map((arc, i) => (
        <primitive key={i} object={arc.line} />
      ))}
      <points geometry={sparks.geometry} material={sparks.material} />
    </group>
  );
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Marker on the company's city in the brand line; its rings pulse only while motion runs. */
function HomeMarker({ home, live }: { home: LatLon; live: Live }) {
  const rings = useRef<Array<THREE.Mesh | null>>([]);
  const time = useRef(0.6);
  const { position, quaternion } = useMemo(() => {
    const normal = new THREE.Vector3(...toVector(home[0], home[1]));
    return {
      position: normal.clone().multiplyScalar(1.004),
      quaternion: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, normal),
    };
  }, [home]);

  const color = useMemo(() => COLORS.brand, []);

  useFrame((_, rawDelta) => {
    time.current += step(rawDelta, live);
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (time.current / 2.2 + i * 0.5) % 1;
      ring.scale.setScalar(1 + phase * 3.2);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.85;
    });
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <circleGeometry args={[0.016, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            rings.current[i] = mesh;
          }}
        >
          <ringGeometry args={[0.02, 0.026, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Globe({ home, live }: { home: LatLon; live: Live }) {
  const tiltGroup = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const time = useRef(0);
  const sweep = useRef<Sweep>({ y: 1.4, amount: 0, done: live.done ? 1 : 0 });

  // Tilt so the home latitude sits a little above the centre; the yaw brings
  // its longitude to the front. The pose starts exactly where the SVG
  // placeholder is (so the cross-fade doesn't jump), eases to a new home when
  // the company's city becomes known, and sways gently once running.
  const tilt = THREE.MathUtils.degToRad(home[0] - 16);
  const yaw = -THREE.MathUtils.degToRad(home[1]);
  const pose = useRef({ tilt, yaw, sway: 0 });

  useFrame((_, rawDelta) => {
    const delta = step(rawDelta, live);
    const s = sweep.current;
    const p = pose.current;
    if (!live.active) {
      // Resting pose: no scanner, final colours.
      p.tilt = tilt;
      p.yaw = yaw;
      s.amount = 0;
      s.done = live.done ? 1 : 0;
    } else {
      time.current += delta;
      const k = 1 - Math.exp(-delta * 2.4);
      p.tilt += (tilt - p.tilt) * k;
      p.yaw += (yaw - p.yaw) * k;
      p.sway = Math.min(1, p.sway + delta / 4);
      s.amount += ((live.running ? 1 : 0) - s.amount) * Math.min(1, delta * 2);
      s.done += ((live.done ? 1 : 0) - s.done) * Math.min(1, delta * 1.5);
      s.y -= delta * 0.75;
      if (s.y < -1.4) s.y = 1.4;
    }
    if (tiltGroup.current) tiltGroup.current.rotation.x = p.tilt;
    if (spin.current) {
      spin.current.rotation.y = p.yaw + Math.sin(time.current * 0.14) * 0.3 * p.sway;
    }
  });

  return (
    <group ref={tiltGroup} rotation-x={pose.current.tilt}>
      <group ref={spin} rotation-y={pose.current.yaw}>
        <Body />
        <Dots sweep={sweep} />
        <Arcs home={home} live={live} />
        <HomeMarker home={home} live={live} />
      </group>
    </group>
  );
}

export default function GlobeScene({ home, onReady, ...live }: GlobeSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, CAMERA_Z], fov: FOV }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={live.active ? "always" : "demand"}
      onCreated={() => onReady?.()}
      style={{ pointerEvents: "none" }}
    >
      <Globe home={home} live={live} />
    </Canvas>
  );
}
