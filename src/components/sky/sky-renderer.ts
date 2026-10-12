import type { SkyParams } from "./sky-params";
import { cloudNoiseTexture, NOISE_SIZE } from "./sky-noise";
import { blendSkyParams } from "./sky-params";
import { ATMOSPHERE_SHADER, CLOUD_SHADER, NOISE_COMPONENTS, VERTEX_SHADER } from "./sky-shader";

/** Canvas pixels per CSS pixel on a high-density screen. */
const RESOLUTION = 0.75;
/** The atmosphere varies slowly across the sky, so its light is traced on a grid this much coarser than the canvas. */
const ATMOSPHERE_DOWNSCALE = 4;
const MORPH_MS = 900;
const FRAME_MS = 1000 / 30;
/** Sky seconds per screen second: the clouds drift like a gentle time-lapse. */
const TIMELAPSE = 20;
/** Filtering of the noise texture along the foreshortening, so clouds near the horizon keep their width without shimmering. */
const ANISOTROPY = 8;

interface NoiseComponent {
  /** Kilometres per noise tile along and across the component's axes. */
  scale: readonly [number, number];
  /** Direction of the first axis in radians counterclockwise from the viewer's right, or along the layer's wind. */
  angle: number | "wind";
  /** Share of the layer's wind it drifts with. */
  carry: number;
  /** A drift of its own, km per screen second, so the clouds keep changing shape. */
  evolve: readonly [number, number];
}

/** Low, mid and high layers, in the order of u_map in the cloud shader. */
const LAYERS: readonly (readonly [NoiseComponent, NoiseComponent, NoiseComponent])[] = [
  [
    { scale: [24, 24], angle: 0, carry: 1, evolve: [0, 0] },
    { scale: [90, 90], angle: 0.5, carry: 0.85, evolve: [0.05, 0.03] },
    { scale: [9, 9], angle: -0.4, carry: 1.12, evolve: [0.01, -0.02] },
  ],
  [
    { scale: [14, 10], angle: 0, carry: 1, evolve: [0, 0] },
    { scale: [40, 40], angle: -0.45, carry: 0.85, evolve: [-0.04, 0.03] },
    { scale: [4.5, 4.5], angle: 0.7, carry: 1.12, evolve: [0.01, 0.02] },
  ],
  [
    { scale: [300, 40], angle: "wind", carry: 1, evolve: [0, 0] },
    { scale: [160, 160], angle: 0.3, carry: 0.9, evolve: [0.06, -0.03] },
    { scale: [70, 6], angle: "wind", carry: 1.08, evolve: [0, 0] },
  ],
];

/** Where the horizon may sit, as a share of the canvas height from the top. */
const HORIZON_RANGE = [0.35, 0.8] as const;

const ATMOSPHERE_UNIFORMS = ["u_pitch", "u_view", "u_size", "u_sun", "u_sunAzimuth", "u_transmission", "u_aod", "u_wet"] as const;
const CLOUD_UNIFORMS = ["u_pitch", "u_view", "u_sun", "u_sunAzimuth", "u_cover", "u_wet", "u_map", "u_shift", "u_seed", "u_anisotropy"] as const;
const CLOUD_SAMPLERS = ["u_sky", "u_lowLight", "u_midLight", "u_highLight", "u_noise"] as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("WebGL could not create a shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Sky shader failed to compile: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function link<const Name extends string>(gl: WebGL2RenderingContext, vertex: WebGLShader, fragmentSource: string, uniforms: readonly Name[]) {
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Sky shader failed to link: ${gl.getProgramInfoLog(program)}`);
  }
  gl.deleteShader(fragment);
  const locations = Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, name)])) as Record<Name, WebGLUniformLocation | null>;
  return { program, locations };
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Kilometres to noise tiles for one component, column-major for a GLSL mat2. */
function noiseMap(component: NoiseComponent, wind: readonly [number, number]) {
  const angle = component.angle === "wind" ? Math.atan2(wind[1], wind[0]) : component.angle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [along, across] = component.scale;
  return [cos / along, -sin / across, sin / along, cos / across] as const;
}

export interface SkyRenderer {
  /** Morphs to `params`, or jumps straight there when `instant`, as while the time is being dragged. */
  setParams: (params: SkyParams, instant: boolean) => void;
  /** Puts the horizon `top` CSS pixels below the top of the canvas. */
  setHorizon: (top: number) => void;
  resize: () => void;
  dispose: () => void;
}

/**
 * Draws the forecast sky into `canvas`: the atmosphere whenever the parameters, the size or the
 * horizon change, the clouds every frame as the wind carries them, morphing between parameter
 * sets. With reduced motion the clouds hold still and frames are drawn only on change.
 */
export function createSkyRenderer(canvas: HTMLCanvasElement, initial: SkyParams, horizon: number, onFirstFrame: () => void): SkyRenderer {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
  if (!gl) {
    throw new Error("This browser has no WebGL2, which the forecast sky needs");
  }
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("This browser cannot render to float textures, which the forecast sky needs");
  }
  const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
  if (!anisotropic) {
    throw new Error("This browser has no anisotropic texture filtering, which the forecast sky needs");
  }
  const anisotropy = Math.min(ANISOTROPY, gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number);

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const atmosphere = link(gl, vertex, ATMOSPHERE_SHADER, ATMOSPHERE_UNIFORMS);
  const clouds = link(gl, vertex, CLOUD_SHADER, [...CLOUD_UNIFORMS, ...CLOUD_SAMPLERS]);
  gl.deleteShader(vertex);
  const vertexArray = gl.createVertexArray();

  gl.useProgram(clouds.program);
  CLOUD_SAMPLERS.forEach((name, unit) => gl.uniform1i(clouds.locations[name], unit));

  const noise = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + CLOUD_SAMPLERS.indexOf("u_noise"));
  gl.bindTexture(gl.TEXTURE_2D, noise);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, cloudNoiseTexture());
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);

  /** Sky, then the low, mid and high layer light, filled by the atmosphere pass. */
  let targets: WebGLTexture[] = [];
  const framebuffer = gl.createFramebuffer();
  let atmosphereSize = [0, 0] as [number, number];

  const allocateTargets = () => {
    targets.forEach(texture => gl.deleteTexture(texture));
    atmosphereSize = [Math.ceil(canvas.width / ATMOSPHERE_DOWNSCALE), Math.ceil(canvas.height / ATMOSPHERE_DOWNSCALE)];
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    targets = [0, 1, 2, 3].map((index) => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, atmosphereSize[0], atmosphereSize[1]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture, 0);
      return texture;
    });
    gl.drawBuffers(targets.map((_, index) => gl.COLOR_ATTACHMENT0 + index));
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`The sky's atmosphere targets are incomplete: framebuffer status ${status}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  let horizonTop = horizon;
  /** Camera pitch that puts the horizon at `horizonTop` on the canvas, whose vertical field of view is ±45°. */
  const pitch = () => {
    const share = Math.min(HORIZON_RANGE[1], Math.max(HORIZON_RANGE[0], horizonTop / Math.max(1, canvas.clientHeight)));
    return Math.atan(2 * share - 1);
  };

  const drawAtmosphere = (params: SkyParams) => {
    const { program, locations } = atmosphere;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, atmosphereSize[0], atmosphereSize[1]);
    gl.useProgram(program);
    gl.uniform1f(locations.u_pitch, pitch());
    gl.uniform2f(locations.u_view, canvas.width, canvas.height);
    gl.uniform2f(locations.u_size, atmosphereSize[0], atmosphereSize[1]);
    gl.uniform1f(locations.u_sun, params.sun);
    gl.uniform1f(locations.u_sunAzimuth, params.sunAzimuth);
    gl.uniform1f(locations.u_transmission, params.transmission);
    gl.uniform1f(locations.u_aod, params.aod);
    gl.uniform1f(locations.u_wet, params.wet);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /** Where the wind has carried each noise component, in noise tiles; only the fraction matters as the noise tiles. */
  const shifts = new Float64Array(NOISE_COMPONENTS * 2);
  const shiftUniform = new Float32Array(NOISE_COMPONENTS * 2);
  const maps = new Float32Array(NOISE_COMPONENTS * 4);

  const drift = (params: SkyParams, seconds: number) => {
    LAYERS.forEach((components, layer) => {
      const wind = params.wind[layer];
      components.forEach((component, index) => {
        const j = layer * 3 + index;
        const [a, b, c, d] = noiseMap(component, wind);
        const x = (wind[0] * TIMELAPSE / 1000 * component.carry + component.evolve[0]) * seconds;
        const z = (wind[1] * TIMELAPSE / 1000 * component.carry + component.evolve[1]) * seconds;
        const u = shifts[j * 2] - (a * x + c * z);
        const v = shifts[j * 2 + 1] - (b * x + d * z);
        shifts[j * 2] = u - Math.floor(u);
        shifts[j * 2 + 1] = v - Math.floor(v);
      });
    });
  };

  const drawClouds = (params: SkyParams) => {
    const { program, locations } = clouds;
    LAYERS.forEach((components, layer) => components.forEach((component, index) => {
      maps.set(noiseMap(component, params.wind[layer]), (layer * 3 + index) * 4);
    }));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    targets.forEach((texture, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    });
    gl.activeTexture(gl.TEXTURE0 + CLOUD_SAMPLERS.indexOf("u_noise"));
    gl.bindTexture(gl.TEXTURE_2D, noise);
    gl.uniform1f(locations.u_pitch, pitch());
    gl.uniform2f(locations.u_view, canvas.width, canvas.height);
    gl.uniform1f(locations.u_sun, params.sun);
    gl.uniform1f(locations.u_sunAzimuth, params.sunAzimuth);
    gl.uniform3fv(locations.u_cover, params.cover.flat());
    gl.uniform1f(locations.u_wet, params.wet);
    gl.uniformMatrix2fv(locations.u_map, false, maps);
    shiftUniform.set(shifts);
    gl.uniform2fv(locations.u_shift, shiftUniform);
    gl.uniform2f(locations.u_seed, params.seed[0], params.seed[1]);
    gl.uniform1f(locations.u_anisotropy, anisotropy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let from = initial;
  let target = initial;
  let shown = initial;
  let atmosphereFor: SkyParams | null = null;
  let morphStart = -Infinity;
  let lastDraw = 0;
  let changed = true;
  let drawn = false;
  let frame = 0;

  gl.bindVertexArray(vertexArray);

  const tick = (now: number) => {
    frame = 0;
    const moving = !reducedMotion.matches;
    const progress = Math.min(1, (now - morphStart) / MORPH_MS);
    if (changed || progress < 1 || (moving && now - lastDraw >= FRAME_MS - 2)) {
      const params = progress >= 1 ? target : blendSkyParams(from, target, easeInOut(progress));
      shown = params;
      if (moving && lastDraw > 0) {
        drift(params, Math.min(now - lastDraw, 100) / 1000);
      }
      lastDraw = now;
      changed = false;
      if (params !== atmosphereFor) {
        drawAtmosphere(params);
        atmosphereFor = params;
      }
      drawClouds(params);
      if (!drawn) {
        drawn = true;
        onFirstFrame();
      }
    }
    if (moving || progress < 1) {
      frame = requestAnimationFrame(tick);
    }
  };

  const schedule = () => {
    if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  };

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio, 2) * RESOLUTION;
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (width !== canvas.width || height !== canvas.height || targets.length === 0) {
      canvas.width = width;
      canvas.height = height;
      allocateTargets();
      atmosphereFor = null;
      changed = true;
      schedule();
    }
  };

  const restart = () => {
    lastDraw = 0;
    changed = true;
    schedule();
  };

  reducedMotion.addEventListener("change", restart);
  resize();
  schedule();

  return {
    setParams(params, instant) {
      if (params === target) {
        return;
      }
      from = instant ? params : shown;
      target = params;
      morphStart = instant ? -Infinity : performance.now();
      changed = true;
      schedule();
    },
    setHorizon(top) {
      if (top === horizonTop) {
        return;
      }
      horizonTop = top;
      atmosphereFor = null;
      changed = true;
      schedule();
    },
    resize,
    dispose() {
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", restart);
      targets.forEach(texture => gl.deleteTexture(texture));
      gl.deleteTexture(noise);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(atmosphere.program);
      gl.deleteProgram(clouds.program);
    },
  };
}
