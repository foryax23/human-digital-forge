// Studio scene for the four service icons (see ../render-service-icons.mjs for how to run it).
//
// One rig for the whole family: the same camera, lights, studio reflections, materials,
// plate form (FAMILY), yaw, framing (FRAME) and contact shadow; only the model changes. Each icon is rendered at 2048 px in three passes and
// composited to a transparent 1024 px image:
//   1. colour: the model lit on the page's night background (#020208, the .cinematic
//      --background), so the frosted glass shows exactly what it will show on the site;
//   2. coverage: the model in flat white on black, the antialiased alpha;
//   3. shadow: a contact shadow baked from below and blurred, in white on black.
// Alpha = coverage over shadow; colour = (pass 1 − background) / alpha, then a 2×2 box
// downsample. The page exposes window.renderIcon(slug) once window.iconsReady is true.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const RENDER = 2048;
const OUT = 1024;
const BG = "#020208";
const LIFT = 0.16; // every icon floats this far above the floor

const PALETTE = {
  violet: "#5b52f0",
};

/**
 * The family's shared form, in model units (every model is built about 2.4 units wide):
 * each plate (browser pane, sheet, speech form, card, calendar) is one depth with one corner
 * radius and one bevel, and every model turns the same way, its front 18° off the camera.
 */
const FAMILY = { depth: 0.1, radius: 0.16, bevel: 0.034 };
const YAW = THREE.MathUtils.degToRad(12); // the camera stands at 30°
/** Framing: the art's projected box has the area of a square 72% of the frame, its top at 12%. */
const FRAME = { area: 0.72, maxSpan: 0.86, top: 0.12 };

/* ------------------------------------------------------------------ renderer + rig */

const canvas = document.createElement("canvas");
canvas.width = canvas.height = RENDER;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(RENDER, RENDER, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const bgColor = new THREE.Color(BG);
const black = new THREE.Color(0x000000);

/** Dark studio with a violet softbox (key), two cool strips behind (rims) and a dim top. */
function studioEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color("#0e0c22");
  const panel = (w, h, hex, k, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex).multiplyScalar(k),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6.5, 4.5, "#b8b0ff", 5.5, [-5, 5, 4]); // key softbox, upper left front
  panel(1.4, 8, "#c8f5ff", 5, [5.5, 2.5, -4.5]); // cool rim strip, behind right
  panel(1.1, 7, "#8d85ff", 2.4, [-5.2, 2, -4.8]); // violet rim strip, behind left
  panel(8, 8, "#4a42c8", 1.1, [0, 8, 0]); // top fill
  // Front sweep: what the camera-facing faces reflect (front, slightly left, 24° down).
  // Bright above that direction and dim below it, brighter to the left, so every flat face
  // carries a soft top-left to bottom-right falloff instead of one flat tone.
  const sweepTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const v = x.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "#ffffff");
    v.addColorStop(0.47, "#e2e0ee");
    v.addColorStop(0.53, "#2c2a40");
    v.addColorStop(1, "#0c0b16");
    x.fillStyle = v;
    x.fillRect(0, 0, 256, 256);
    const h = x.createLinearGradient(0, 0, 256, 0);
    h.addColorStop(0, "rgba(0,0,0,0)");
    h.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = h;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({
      map: sweepTex,
      color: new THREE.Color("#dcd8ff").multiplyScalar(1.6),
      side: THREE.DoubleSide,
    }),
  );
  sweep.position.set(-1.3, -2.9, 6.3);
  sweep.lookAt(0, 0, 0);
  env.add(sweep);
  panel(9, 1.4, "#ebe8ff", 4, [-4, 5.5, -5]); // top-back strip: highlight along top edges
  panel(1.2, 5, "#bff2ff", 4, [5, -1.2, -5]); // low cool strip: highlight along right edges
  panel(12, 3, "#1c1840", 1, [0, -4, 0]); // floor bounce
  return env;
}

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnvironment(), 0.035).texture;
scene.environmentIntensity = 1;

const key = new THREE.DirectionalLight("#d2ccff", 3);
key.position.set(-3.4, 5.6, 3.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {
  left: -2.6,
  right: 2.6,
  top: 2.6,
  bottom: -2.6,
  near: 0.5,
  far: 16,
});
key.shadow.radius = 5;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.012;
// The rims are strong on purpose: every bevel should catch one bright edge.
const rim = new THREE.DirectionalLight("#a9eeff", 3.9);
rim.position.set(3.6, 2.6, -4.6);
const rim2 = new THREE.DirectionalLight("#7c73ff", 1.56);
rim2.position.set(-4.2, 1.4, -3.6);
const fill = new THREE.HemisphereLight("#6d66e0", "#0a0818", 0.7);
scene.add(key, key.target, rim, rim2, fill);

// Softboxes close to the model. Unlike the (infinitely distant) environment, their light
// changes across a flat face, which is what gives panes and plates a studio falloff.
RectAreaLightUniformsLib.init();
const softbox = (hex, intensity, w, h, pos) => {
  const l = new THREE.RectAreaLight(hex, intensity, w, h);
  l.position.set(...pos);
  l.lookAt(0, 0.9, 0);
  scene.add(l);
  return l;
};
const SOFTBOX = {
  key: softbox("#c9c2ff", 6, 3.2, 2.2, [-2.6, 3.4, 3.2]),
  front: softbox("#e4e1ff", 2.4, 4.4, 1.4, [-0.6, -0.7, 3.8]),
  rim: softbox("#bdf1ff", 14.3, 0.7, 3, [3.2, 1.8, -2.8]),
};

const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
{
  const el = THREE.MathUtils.degToRad(24);
  const az = THREE.MathUtils.degToRad(30);
  const dist = 9.5;
  const target = new THREE.Vector3(0, 0.75, 0);
  camera.position.set(
    dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/* ------------------------------------------------------------------ materials */

const mat = {
  // Glossy violet glass with a hard clearcoat, so every bevel catches a sharp highlight line.
  // The tint is set per unit of thickness, so every plate carries the same colour.
  glass: ({ thickness = FAMILY.depth, ...o } = {}) =>
    new THREE.MeshPhysicalMaterial({
      color: "#c3bdff",
      emissive: new THREE.Color("#1a1258"),
      roughness: 0.15,
      metalness: 0,
      transmission: 0.55,
      thickness,
      ior: 1.5,
      attenuationColor: new THREE.Color(PALETTE.violet),
      attenuationDistance: thickness * 2.6,
      specularIntensity: 0.55,
      specularColor: new THREE.Color("#a59dff"),
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.3,
      ...o,
    }),
  satin: (o = {}) =>
    new THREE.MeshPhysicalMaterial({
      color: "#dcd9ee",
      metalness: 1,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.15,
      ...o,
    }),
  graphite: (o = {}) =>
    new THREE.MeshPhysicalMaterial({ color: "#4d4a6a", metalness: 1, roughness: 0.4, ...o }),
  pearl: (o = {}) =>
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      ...o,
    }),
  // The one detail per icon (click ring, booked slot, highlighted line): bright pearl, lit
  // like everything else. Nothing emits light, so nothing has a halo, and cyan stays the
  // hero's colour (plan §1.1).
  accent: (o = {}) =>
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.4,
      // a touch of self-light keeps it the brightest thing in the icon, far too little to glow
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.3,
      ...o,
    }),
};

/* ------------------------------------------------------------------ geometry helpers */

const V2 = (x, y) => new THREE.Vector2(x, y);

/** A closed outline with softened corners (quadratic fillets; radius per corner or one for all). */
function roundedPolygon(points, radii) {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const r = Array.isArray(radii) ? radii[i] : radii;
    const v1 = p0.clone().sub(p1);
    const v2 = p2.clone().sub(p1);
    const d1 = v1.length();
    const d2 = v2.length();
    v1.normalize();
    v2.normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(v1.dot(v2), -1, 1));
    const t = Math.min(r / Math.tan(ang / 2), d1 * 0.5, d2 * 0.5);
    const a = p1.clone().addScaledVector(v1, t);
    const b = p1.clone().addScaledVector(v2, t);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

/** Smooth the side + bevel normals of an extrusion (group 1) and keep the flat caps crisp. */
function smoothSides(g, creaseDeg = 50) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const grp = g.groups.find((x) => x.materialIndex === 1);
  if (!grp) return g;
  const cosC = Math.cos(THREE.MathUtils.degToRad(creaseDeg));
  const k = (i) =>
    `${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`;
  const faces = [];
  const byKey = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = grp.start; t < grp.start + grp.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const unit = n.lengthSq() > 1e-14 ? n.clone().normalize() : null;
    faces.push({ t, n, unit });
    for (let j = 0; j < 3; j++) {
      const key = k(t + j);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(faces.length - 1);
    }
  }
  const sum = new THREE.Vector3();
  for (const f of faces) {
    if (!f.unit) continue;
    for (let j = 0; j < 3; j++) {
      sum.set(0, 0, 0);
      for (const fi of byKey.get(k(f.t + j))) {
        const o = faces[fi];
        if (o.unit && o.unit.dot(f.unit) > cosC) sum.add(o.n);
      }
      sum.normalize();
      nor.setXYZ(f.t + j, sum.x, sum.y, sum.z);
    }
  }
  nor.needsUpdate = true;
  return g;
}

/** Extrude a shape to `depth` (outer size kept), centred on z, with a soft rounded bevel. */
function extrude(shape, depth, bevel, { curveSegments = 40, bevelSegments = 7 } = {}) {
  const core = Math.max(depth - 2 * bevel, 0.001);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments,
    curveSegments,
    steps: 1,
  });
  g.translate(0, 0, -core / 2);
  return smoothSides(g);
}

/** Thin slab with properly rounded edges (radius limited by the thickness). */
function slab(w, h, d, r = d * 0.48) {
  return new RoundedBoxGeometry(w, h, d, 6, Math.min(r, d / 2 - 1e-4));
}

/** A rounded rectangle outline, centred. */
function roundedRect(w, h, r) {
  return roundedPolygon(
    [V2(-w / 2, h / 2), V2(w / 2, h / 2), V2(w / 2, -h / 2), V2(-w / 2, -h / 2)],
    r,
  );
}

/** The family plate: FAMILY depth, corner radius and bevel, front face at z = depth / 2. */
function plate(w, h) {
  return extrude(roundedRect(w, h, FAMILY.radius), FAMILY.depth, FAMILY.bevel);
}

/** A rod with rounded ends along x (rails, binder rings). */
function rod(length, radius) {
  const g = new THREE.CapsuleGeometry(radius, Math.max(length - 2 * radius, 0.001), 8, 32);
  g.rotateZ(Math.PI / 2);
  return g;
}

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------------------------ models */

/** Site-uri web: three browser panes floating in depth, a pointer and its click ring. */
function websites() {
  const g = new THREE.Group();
  const W = 2.0;
  const H = 1.3;
  const z = FAMILY.depth / 2;
  const back = mesh(plate(W, H), mat.graphite());
  back.position.set(-0.68, 0.52, -0.72);
  const mid = mesh(plate(W, H), mat.satin({ roughness: 0.3 }));
  mid.position.set(-0.34, 0.28, -0.36);

  const front = new THREE.Group();
  front.add(mesh(plate(W, H), mat.glass()));
  // window bar: three small dots and an address field
  for (let i = 0; i < 3; i++) {
    const dot = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 32), mat.satin());
    dot.rotation.x = Math.PI / 2;
    dot.position.set(-W / 2 + 0.18 + i * 0.105, H / 2 - 0.16, z + 0.008);
    front.add(dot);
  }
  const address = mesh(slab(0.92, 0.08, 0.022), mat.satin({ roughness: 0.3 }));
  address.position.set(0.14, H / 2 - 0.16, z + 0.008);
  front.add(address);
  const rule = mesh(slab(W - 0.2, 0.012, 0.012), mat.satin({ roughness: 0.35 }));
  rule.position.set(0, H / 2 - 0.28, z + 0.004);
  front.add(rule);
  // page content: a hero block and two lines of text
  const hero = mesh(slab(0.84, 0.48, 0.03), mat.satin());
  hero.position.set(-0.44, -0.13, z + 0.012);
  front.add(hero);
  const l1 = mesh(slab(0.6, 0.075, 0.024), mat.satin({ roughness: 0.3 }));
  l1.position.set(0.46, 0.05, z + 0.009);
  const l2 = mesh(slab(0.42, 0.075, 0.024), mat.satin({ roughness: 0.3 }));
  l2.position.set(0.37, -0.1, z + 0.009);
  front.add(l1, l2);
  // the click ring under the pointer tip
  const tip = new THREE.Vector2(0.52, -0.3);
  const ring = mesh(new THREE.TorusGeometry(0.09, 0.017, 16, 96), mat.accent(), { cast: false });
  ring.position.set(tip.x, tip.y, z + 0.012);
  front.add(ring);
  // pointer
  const arrow = roundedPolygon(
    [
      V2(0, 0),
      V2(0, -1),
      V2(0.235, -0.78),
      V2(0.39, -1.13),
      V2(0.545, -1.07),
      V2(0.385, -0.725),
      V2(0.7, -0.7),
    ],
    [0.05, 0.05, 0.025, 0.04, 0.04, 0.025, 0.05],
  );
  const pointer = mesh(extrude(arrow, 0.12, 0.04), mat.pearl());
  pointer.scale.setScalar(0.56);
  pointer.position.set(tip.x, tip.y, z + 0.2);
  pointer.rotation.set(0.04, 0.12, 0.1);
  front.add(pointer);
  front.position.set(0, 0.1, 0);

  g.add(back, mid, front);
  return g;
}

/** Materiale grafice: a document, a presentation page and a poster, fanned like cards. */
function graphicMaterials() {
  const g = new THREE.Group();
  const W = 1.0;
  const H = 1.4;
  const z = FAMILY.depth / 2;
  const fan = (sheet, angle, x, depth) => {
    const pivot = new THREE.Group();
    sheet.position.y = 0.6 + H / 2;
    pivot.add(sheet);
    pivot.position.set(x, 0, depth);
    pivot.rotation.z = angle;
    return pivot;
  };
  // document: graphite sheet with lines of text
  const doc = new THREE.Group();
  doc.add(mesh(plate(W, H), mat.graphite()));
  [0.68, 0.68, 0.68, 0.5, 0.68, 0.4].forEach((w, i) => {
    const line = mesh(slab(w, 0.06, 0.02), mat.satin({ roughness: 0.3 }));
    line.position.set(-0.34 + w / 2, 0.47 - i * 0.155, z + 0.006);
    doc.add(line);
  });
  // presentation page: satin sheet with a title and three bars
  const deck = new THREE.Group();
  deck.add(mesh(plate(W, H), mat.satin({ roughness: 0.28 })));
  const title = mesh(slab(0.48, 0.075, 0.022), mat.graphite({ roughness: 0.4 }));
  title.position.set(-0.2, 0.52, z + 0.008);
  deck.add(title);
  const sub = mesh(slab(0.32, 0.055, 0.02), mat.graphite({ roughness: 0.42 }));
  sub.position.set(-0.28, 0.39, z + 0.006);
  deck.add(sub);
  [0.22, 0.36, 0.5].forEach((h, i) => {
    const bar = mesh(slab(0.062, h, 0.028), mat.graphite({ roughness: 0.36 }));
    bar.position.set(-0.4 + i * 0.095, -0.56 + h / 2, z + 0.01);
    deck.add(bar);
  });
  // poster: glass with a disc, a block and one bright line
  const poster = new THREE.Group();
  poster.add(mesh(plate(W, H), mat.glass()));
  const disc = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 96), mat.satin());
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0.07, 0.22, z + 0.014);
  poster.add(disc);
  const block = mesh(slab(0.66, 0.085, 0.024), mat.satin({ roughness: 0.3 }));
  block.position.set(-0.06, -0.33, z + 0.008);
  const accent = mesh(slab(0.36, 0.055, 0.022), mat.accent(), { cast: false });
  accent.position.set(-0.21, -0.47, z + 0.008);
  poster.add(block, accent);

  g.add(fan(doc, 0.34, -0.13, -0.34), fan(deck, 0.1, 0, -0.17), fan(poster, -0.16, 0.13, 0));
  return g;
}

/**
 * Automatizare AI: an enquiry handled on its own. A glass message card slides along a short
 * rail into a calendar tile, next to the slot it just booked.
 */
function aiAutomation() {
  const g = new THREE.Group();
  const z = FAMILY.depth / 2;
  // calendar tile: two binder rings, a header strip and a 3 × 2 grid of days, one booked
  const cal = new THREE.Group();
  const CW = 1.6;
  const CH = 1.72;
  cal.add(mesh(plate(CW, CH), mat.satin({ roughness: 0.26 })));
  const head = mesh(slab(CW - 0.26, 0.2, 0.026), mat.graphite({ roughness: 0.32 }));
  head.position.set(0, CH / 2 - 0.28, z + 0.01);
  cal.add(head);
  for (const x of [-0.4, 0.4]) {
    const binder = mesh(rod(0.32, 0.05), mat.graphite({ roughness: 0.3 }));
    binder.rotation.z = Math.PI / 2;
    binder.position.set(x, CH / 2, z + 0.03);
    cal.add(binder);
  }
  const BOOKED = [1, 1]; // column, row
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const booked = col === BOOKED[0] && row === BOOKED[1];
      // On the light tile the booked day is the one violet cell (white would vanish).
      const cell = mesh(
        slab(0.34, 0.26, booked ? 0.05 : 0.022, 0.011),
        booked
          ? mat.accent({ color: PALETTE.violet, emissive: PALETTE.violet })
          : mat.graphite({ roughness: 0.34 }),
        { cast: !booked },
      );
      cell.position.set(-0.42 + col * 0.42, 0.0 - row * 0.34, z + (booked ? 0.022 : 0.008));
      cal.add(cell);
    }
  }
  cal.position.set(0.44, 1.0, -0.12);

  // message card: an avatar and two lines of text, on its rail
  const card = new THREE.Group();
  const MW = 1.2;
  const MH = 0.76;
  card.add(mesh(plate(MW, MH), mat.glass()));
  const avatar = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 64), mat.satin());
  avatar.rotation.x = Math.PI / 2;
  avatar.position.set(-MW / 2 + 0.25, 0.08, z + 0.012);
  card.add(avatar);
  const m1 = mesh(slab(0.56, 0.075, 0.024), mat.satin({ roughness: 0.3 }));
  m1.position.set(0.12, 0.14, z + 0.009);
  const m2 = mesh(slab(0.38, 0.075, 0.024), mat.satin({ roughness: 0.3 }));
  m2.position.set(0.03, -0.02, z + 0.009);
  card.add(m1, m2);
  card.position.set(-0.44, 0.46, 0.4);
  // the rail it rides on: it starts behind the card and runs into the calendar
  const rail = mesh(rod(1.4, 0.04), mat.satin());
  rail.position.set(-0.6, 0.46 - MH / 2 - 0.045, 0.4);

  g.add(cal, card, rail);
  return g;
}

/** Consultanță: two speech forms in conversation, one glass, one metal. */
function consultancy() {
  const g = new THREE.Group();
  const z = FAMILY.depth / 2;
  // A family plate whose lower corner on `side` becomes the tail.
  const bubble = (w, h, side) => {
    const x0 = -w / 2;
    const x1 = w / 2;
    const y0 = -h / 2;
    const y1 = h / 2;
    const pts = [
      V2(x0, y1),
      V2(x1, y1),
      V2(x1, y0),
      V2(x0 + 0.56, y0),
      V2(x0 - 0.03, y0 - 0.27),
      V2(x0, y0 + 0.24),
    ];
    const r = FAMILY.radius;
    const radii = [r, r, r, 0.1, 0.06, 0.1];
    if (side === "right") pts.forEach((p) => (p.x = -p.x));
    return extrude(roundedPolygon(pts, radii), FAMILY.depth, FAMILY.bevel);
  };
  const back = new THREE.Group();
  back.add(mesh(bubble(1.24, 0.92, "right"), mat.satin({ roughness: 0.28 })));
  const reply = mesh(slab(0.58, 0.09, 0.03), mat.graphite({ roughness: 0.36 }));
  reply.position.set(0.06, 0.12, z + 0.012);
  back.add(reply);
  back.position.set(0.44, 1.42, -0.4);
  const frontG = new THREE.Group();
  frontG.add(mesh(bubble(1.56, 1.08, "left"), mat.glass()));
  const l1 = mesh(slab(0.86, 0.09, 0.03), mat.satin({ roughness: 0.3 }));
  l1.position.set(-0.08, 0.17, z + 0.012);
  const l2 = mesh(slab(0.5, 0.09, 0.03), mat.accent(), { cast: false });
  l2.position.set(-0.26, -0.07, z + 0.012);
  frontG.add(l1, l2);
  frontG.position.set(-0.32, 0.74, 0.1);
  g.add(back, frontG);
  return g;
}

const MODELS = {
  websites,
  "digital-products": graphicMaterials,
  "ai-automation": aiAutomation,
  consultancy,
};

/* ------------------------------------------------------------------ placement + framing */

/** Turn to the family yaw, normalise to unit size, centre on x/z, base on the floor + LIFT. */
function place(model) {
  model.rotation.y = YAW;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const inner = new THREE.Group();
  inner.add(model);
  model.position.sub(
    new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2),
  );
  const root = new THREE.Group();
  root.add(inner);
  inner.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  root.position.y = LIFT;
  return root;
}

const tmpV = new THREE.Vector3();
/** The model's silhouette box in normalised device coordinates, from every vertex. */
function projectedBox(root) {
  root.updateMatrixWorld(true);
  const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
      r.x0 = Math.min(r.x0, tmpV.x);
      r.x1 = Math.max(r.x1, tmpV.x);
      r.y0 = Math.min(r.y0, tmpV.y);
      r.y1 = Math.max(r.y1, tmpV.y);
    }
  });
  return r;
}

/**
 * Scale the model by the area of its silhouette box, so wide and tall models carry the same
 * visual weight (never wider or taller than FRAME.maxSpan), then lens-shift it so it is
 * centred across and its top sits at FRAME.top: in a list, the icons line up with the titles.
 * The shadow is left out of the framing; on the night background it is all but invisible.
 */
function frame(root) {
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  for (let i = 0; i < 5; i++) {
    const r = projectedBox(root);
    const w = (r.x1 - r.x0) / 2;
    const h = (r.y1 - r.y0) / 2;
    root.scale.multiplyScalar(
      Math.min(FRAME.area / Math.sqrt(w * h), FRAME.maxSpan / Math.max(w, h)),
    );
  }
  const r = projectedBox(root);
  const cx = (r.x0 + r.x1) / 2;
  const top = (1 - r.y1) / 2; // the silhouette's top, as a fraction of the frame from its top
  camera.setViewOffset(
    RENDER,
    RENDER,
    (cx * RENDER) / 2,
    (top - FRAME.top) * RENDER,
    RENDER,
    RENDER,
  );
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ contact shadow */

function blur(src, res, radius, passes = 3) {
  let a = src;
  let b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < res; y++) {
      let acc = 0;
      const row = y * res;
      for (let x = -radius; x <= radius; x++) acc += a[row + THREE.MathUtils.clamp(x, 0, res - 1)];
      for (let x = 0; x < res; x++) {
        b[row + x] = acc / (2 * radius + 1);
        acc += a[row + Math.min(x + radius + 1, res - 1)] - a[row + Math.max(x - radius, 0)];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < res; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++)
        acc += a[THREE.MathUtils.clamp(y, 0, res - 1) * res + x];
      for (let y = 0; y < res; y++) {
        b[y * res + x] = acc / (2 * radius + 1);
        acc +=
          a[Math.min(y + radius + 1, res - 1) * res + x] - a[Math.max(y - radius, 0) * res + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Bake the floor shadow: lowest surface per column from below, near = dark, then blur. */
function bakeShadow({ size = 5, res = 512, falloff = 1.3, strength = 0.75 } = {}) {
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, falloff);
  cam.position.set(0, 0, 0);
  cam.up.set(0, 0, 1);
  cam.lookAt(0, 1, 0);
  cam.updateMatrixWorld();
  const heightMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { falloff: { value: falloff } },
    vertexShader:
      "varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader:
      "uniform float falloff; varying float vY; void main(){ float k = clamp(1.0 - vY / falloff, 0.0, 1.0); gl_FragColor = vec4(vec3(k * k), 1.0); }",
  });
  const rt = new THREE.WebGLRenderTarget(res, res);
  scene.overrideMaterial = heightMat;
  scene.background = black;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(res * res * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, res, res, px);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  const h = new Float32Array(res * res);
  for (let i = 0; i < res * res; i++) h[i] = px[i * 4] / 255;
  const tight = blur(h, res, 5);
  const wide = blur(h, res, 26);
  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const v = Math.min(1, (0.45 * tight[i] + 0.7 * wide[i]) * strength);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  // floor quad whose UVs are its projection into the baking camera
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    tmpV.fromBufferAttribute(p, i).project(cam);
    uv.setXY(i, (tmpV.x + 1) / 2, (tmpV.y + 1) / 2);
  }
  const floor = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(texture2D(map, vUv).r), 1.0); }",
    }),
  );
  const s = new THREE.Scene();
  s.background = black;
  s.add(floor);
  return s;
}

/* ------------------------------------------------------------------ passes + composite */

const readCanvas = document.createElement("canvas");
readCanvas.width = readCanvas.height = RENDER;
const readCtx = readCanvas.getContext("2d", { willReadFrequently: true });
function grab() {
  readCtx.clearRect(0, 0, RENDER, RENDER);
  readCtx.drawImage(renderer.domElement, 0, 0);
  return readCtx.getImageData(0, 0, RENDER, RENDER).data;
}

/** 1 inside, easing to 0 over the outer 6 % of the frame, so a wide shadow never ends in a hard edge. */
function edgeFade(u, v) {
  const d = Math.min(u, v, 1 - u, 1 - v) / 0.06;
  const t = Math.min(1, Math.max(0, d));
  return t * t * (3 - 2 * t);
}

function composite(color, cover, shadow, shadowOpacity = 1) {
  // the background exactly as it came out of the colour pass (top-left pixel is always empty)
  const B = [color[0], color[1], color[2]];
  const out = new ImageData(OUT, OUT);
  const o = out.data;
  for (let y = 0; y < OUT; y++) {
    for (let x = 0; x < OUT; x++) {
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * RENDER + (x * 2 + dx)) * 4;
          const a = cover[i] / 255;
          const s = (shadow[i] / 255) * shadowOpacity * edgeFade(x / OUT, y / OUT);
          pr += Math.max(0, color[i] - (1 - a) * B[0]);
          pg += Math.max(0, color[i + 1] - (1 - a) * B[1]);
          pb += Math.max(0, color[i + 2] - (1 - a) * B[2]);
          pa += a + s * (1 - a);
        }
      const j = (y * OUT + x) * 4;
      const A = pa / 4;
      if (A <= 0) continue;
      o[j] = Math.min(255, Math.round(pr / 4 / A));
      o[j + 1] = Math.min(255, Math.round(pg / 4 / A));
      o[j + 2] = Math.min(255, Math.round(pb / 4 / A));
      o[j + 3] = Math.round(A * 255);
    }
  }
  return out;
}

function toCanvas(imageData) {
  const c = document.createElement("canvas");
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

/** High-quality downscale by successive halving. */
function downscale(src, size) {
  let cur = src;
  while (cur.width / 2 >= size) {
    const next = document.createElement("canvas");
    next.width = next.height = Math.round(cur.width / 2);
    const ctx = next.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  if (cur.width !== size) {
    const next = document.createElement("canvas");
    next.width = next.height = size;
    const ctx = next.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, size, size);
    cur = next;
  }
  return cur;
}

const whiteMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  toneMapped: false,
  side: THREE.DoubleSide,
});

window.renderIcon = (slug, { sizes = [320] } = {}) => {
  const build = MODELS[slug];
  if (!build) throw new Error(`unknown icon ${slug}`);
  const root = place(build());
  scene.add(root);
  frame(root);
  root.updateMatrixWorld(true);

  const shadowScene = bakeShadow();

  // 1. colour
  scene.background = bgColor;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.render(scene, camera);
  const color = grab();
  // 2. coverage
  scene.overrideMaterial = whiteMat;
  scene.background = black;
  renderer.render(scene, camera);
  const cover = grab();
  scene.overrideMaterial = null;
  // 3. shadow
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.render(shadowScene, camera);
  const shadow = grab();
  renderer.toneMapping = THREE.NeutralToneMapping;

  const master = toCanvas(composite(color, cover, shadow));
  const result = { master: master.toDataURL("image/png") };
  for (const s of sizes) result[s] = downscale(master, s).toDataURL("image/png");
  return result;
};

window.iconsReady = true;
