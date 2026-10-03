import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useMotionPause } from "../motion-pause";
import { prefersReducedMotion } from "../motion-prefs";

/*
 * The hero's accent words, drawn again on a WebGL canvas and gently warped:
 * a slow drift, a lens with a soft ripple under the pointer and a faint
 * colour split. Adapted from React Bits' WarpText (MIT): the same shader,
 * ported to plain WebGL2 (no extra dependency), tuned quieter and laid
 * exactly over the real text. The text stays in the DOM for layout, search
 * engines and screen readers, and is what shows when WebGL or fonts are
 * unavailable, motion is reduced or the line wraps.
 */

/** Tuning: quieter than the React Bits defaults so the title stays readable. */
const WARP = {
  strength: 0.08,
  scale: 1.7,
  speed: 0.5,
  pointerInfluence: 0.38,
  pointerStrength: 0.36,
  refraction: 0.016,
  ripple: 1,
};

/** The accent gradient from .hero-heading-accent, painted into the texture. */
const ACCENT_STOPS: Array<[number, string]> = [
  [0, "#a996fb"],
  [0.5, "#b4a6fc"],
  [1, "#c4b8fd"],
];

const VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D uText;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uRipple;
uniform vec3 uFringeAhead;
uniform vec3 uFringeBehind;

in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uText, uv);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float scale = max(uWarpScale, 0.001);

  vec2 drift = vec2(uTime * 0.055, -uTime * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045;

  vec2 delta = uv - uPointer;
  vec2 aspectDelta = vec2(delta.x * aspect, delta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);

  float rippleRing = (sin(dist * 28.0 - uTime * 4.2) * 0.5) * uRipple;
  vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
  pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;

  vec2 displaced = uv + ambient + pointerWarp;
  vec2 splitDir = ambient + pointerWarp;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);

  vec4 base = sampleText(displaced);
  vec4 ahead = sampleText(displaced + split);
  vec4 behind = sampleText(displaced - split);
  // Brand fringes instead of an RGB split: cyan ahead of the warp, violet behind it.
  float wBase = base.a;
  float wAhead = ahead.a * (1.0 - wBase);
  float wBehind = behind.a * (1.0 - wBase);
  vec3 color = (base.rgb * wBase + uFringeAhead * wAhead + uFringeBehind * wBehind)
    / max(wBase + wAhead + wBehind, 0.0001);
  color += lens * base.a * 0.055;
  float a = max(max(ahead.a, base.a), behind.a);
  fragColor = vec4(color, a);
}
`;

type Raster = { image: HTMLCanvasElement; width: number; height: number; pad: number };

/**
 * Paints `text` into a 2D canvas so it lines up with the DOM text: same font,
 * size, weight, tracking and baseline, plus room around it for the warp.
 * Returns null when the text wraps over more than one line.
 */
function rasterize(host: HTMLElement, textEl: HTMLElement, dpr: number): Raster | null {
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const rects = range.getClientRects();
  if (rects.length !== 1) return null;
  const box = rects[0];
  const hostRect = host.getBoundingClientRect();
  const style = getComputedStyle(textEl);
  const fontSize = parseFloat(style.fontSize) || 48;
  const pad = Math.ceil(fontSize * 0.45);
  const width = Math.ceil(hostRect.width) + pad * 2;
  const height = Math.ceil(hostRect.height) + pad * 2;

  const image = document.createElement("canvas");
  image.width = Math.max(1, Math.round(width * dpr));
  image.height = Math.max(1, Math.round(height * dpr));
  const ctx = image.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  const tracking = style.letterSpacing === "normal" ? 0 : parseFloat(style.letterSpacing) || 0;
  // Canvas letterSpacing is recent (Safari 17.4); older engines get the manual path below.
  const tracked = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const nativeTracking = typeof tracked.letterSpacing === "string";
  if (nativeTracking) tracked.letterSpacing = `${tracking}px`;

  const text = textEl.textContent ?? "";
  const metrics = ctx.measureText(text);
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  const x = box.left - hostRect.left + pad;
  const baseline = box.top - hostRect.top + pad + (box.height - (ascent + descent)) / 2 + ascent;

  const gradient = ctx.createLinearGradient(x, 0, x + box.width, 0);
  for (const [stop, colour] of ACCENT_STOPS) gradient.addColorStop(stop, colour);
  ctx.fillStyle = gradient;

  if (nativeTracking) {
    ctx.fillText(text, x, baseline);
  } else {
    // Older browsers: place each character, adding the tracking by hand.
    let cursor = x;
    for (const char of Array.from(text)) {
      ctx.fillText(char, cursor, baseline);
      cursor += ctx.measureText(char).width + tracking;
    }
  }
  return { image, width, height, pad };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * The words shown in the DOM, with the warped copy on top once it is ready.
 * `className` styles the host (layout), `textClassName` the text itself
 * (colour or gradient), so the fallback looks exactly like the canvas.
 */
export function WarpWords({
  text,
  className,
  textClassName,
}: {
  text: string;
  className?: string;
  textClassName?: string;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const { paused } = useMotionPause();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  /** Restarts or stops the loop; set by the WebGL effect, called when the pause switch flips. */
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    scheduleRef.current();
  }, [paused]);

  useEffect(() => {
    const host = hostRef.current;
    const textEl = textRef.current;
    const canvas = canvasRef.current;
    if (!host || !textEl || !canvas || prefersReducedMotion()) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // One triangle that covers the canvas, with matching texture coordinates.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    const uvAttr = gl.getAttribLocation(program, "uv");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvAttr);
    gl.vertexAttribPointer(uvAttr, 2, gl.FLOAT, false, 16, 8);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uni = {
      resolution: u("uResolution"),
      pointer: u("uPointer"),
      pointerActive: u("uPointerActive"),
      time: u("uTime"),
    };
    gl.uniform1i(u("uText"), 0);
    gl.uniform1f(u("uWarpStrength"), WARP.strength);
    gl.uniform1f(u("uWarpScale"), WARP.scale);
    gl.uniform1f(u("uPointerInfluence"), WARP.pointerInfluence);
    gl.uniform1f(u("uPointerStrength"), WARP.pointerStrength);
    gl.uniform1f(u("uRefraction"), WARP.refraction);
    gl.uniform1f(u("uRipple"), WARP.ripple);
    gl.uniform3f(u("uFringeAhead"), 0.47, 0.86, 1.0);
    gl.uniform3f(u("uFringeBehind"), 0.6, 0.45, 1.0);
    gl.clearColor(0, 0, 0, 0);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, target: 0 };
    let raster: Raster | null = null;
    let time = 0;
    let last = 0;
    let raf = 0;
    let onScreen = true;
    let disposed = false;

    const draw = () => {
      if (!raster) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uni.resolution, canvas.width, canvas.height);
      gl.uniform2f(uni.pointer, pointer.x, pointer.y);
      gl.uniform1f(uni.pointerActive, pointer.active);
      gl.uniform1f(uni.time, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const rebuild = () => {
      if (disposed) return;
      raster = rasterize(host, textEl, dpr);
      if (!raster) {
        setReady(false);
        return;
      }
      canvas.width = raster.image.width;
      canvas.height = raster.image.height;
      canvas.style.left = `${-raster.pad}px`;
      canvas.style.top = `${-raster.pad}px`;
      canvas.style.width = `${raster.width}px`;
      canvas.style.height = `${raster.height}px`;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster.image);
      draw();
      setReady(true);
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      time += dt * WARP.speed;
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
      pointer.active += (pointer.target - pointer.active) * 0.08;
      draw();
      schedule();
    };
    const schedule = () => {
      if (raf || disposed || !onScreen || document.hidden || pausedRef.current) {
        last = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    scheduleRef.current = schedule;

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientX > rect.left - 40 &&
        event.clientX < rect.right + 40 &&
        event.clientY > rect.top - 40 &&
        event.clientY < rect.bottom + 40;
      pointer.target = inside ? 1 : 0;
      if (inside) {
        pointer.tx = (event.clientX - rect.left) / rect.width;
        pointer.ty = 1 - (event.clientY - rect.top) / rect.height;
      }
    };

    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(rebuild);
    });
    resizeObserver.observe(host);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      schedule();
    });
    intersection.observe(host);
    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);
    if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });
    const onLost = (event: Event) => {
      event.preventDefault();
      disposed = true;
      setReady(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    // Draw only once the web font is in, so the canvas matches the DOM text.
    void document.fonts.ready.then(() => {
      rebuild();
      schedule();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      scheduleRef.current = () => {};
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setReady(false);
    };
  }, [text]);

  return (
    <span ref={hostRef} className={cn("relative inline-block", className)}>
      <span
        ref={textRef}
        className={cn("transition-opacity duration-300", textClassName)}
        style={{ opacity: ready ? 0 : 1 }}
      >
        {text}
      </span>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute transition-opacity duration-300"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </span>
  );
}
