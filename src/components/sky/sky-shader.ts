import { NOISE_STATS } from "./sky-noise";

/** Full-screen triangle; the fragment shaders do all the work. */
export const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Camera and cloud-layer geometry shared by both passes. Lengths are in kilometres. */
const GEOMETRY = `
/** How far the camera looks up, in radians; it puts the horizon where the layout wants it. */
uniform float u_pitch;

const float PI = 3.14159265;
const float R = 6371.0;
const float EYE = 0.002;
const float LOW = 1.6;
const float MID = 4.5;
const float HIGH = 9.0;

/** View direction through a point of the canvas, 0–1 from the bottom left, looking toward the sun's azimuth (+z). */
vec3 viewDirection(vec2 screen, vec2 view) {
  vec2 uv = (screen - 0.5) * vec2(view.x / view.y, 1.0);
  vec3 camera = normalize(vec3(uv * 2.0, 1.0));
  float cp = cos(u_pitch);
  float sp = sin(u_pitch);
  return normalize(vec3(camera.x, camera.y * cp + camera.z * sp, -camera.y * sp + camera.z * cp));
}

/** Distance along a view ray from the observer to the shell at height h, without cancellation. */
float layerDistance(vec3 dir, float h) {
  float b = (R + EYE) * dir.y;
  float k = (h - EYE) * (2.0 * R + h + EYE);
  return k / (b + sqrt(b * b + k));
}
`;

/**
 * The atmosphere at the moment the glow peaks, computed on a coarse grid whenever the forecast
 * changes: single scattering in a Rayleigh, Mie and ozone atmosphere over a round Earth, and for
 * each cloud layer the sunlight reaching it, traced through the air and the Earth's shadow, as it
 * arrives at the eye. The cloud pass reads these instead of tracing light every frame.
 */
export const ATMOSPHERE_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_view;
uniform vec2 u_size;
uniform float u_sun;
uniform float u_transmission;
uniform float u_aod;
uniform float u_wet;

/** Sky radiance; below the horizon, the sky just above it. */
layout(location = 0) out vec4 outSky;
/** Per layer: sunlight on the cloud as seen from the eye (rgb) and the air's transmittance up to it (a). */
layout(location = 1) out vec4 outLow;
layout(location = 2) out vec4 outMid;
layout(location = 3) out vec4 outHigh;

${GEOMETRY}

const float RT = 6471.0;
const vec3 BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);
// The red channel stands in for the orange Chappuis band, which is what keeps the twilight zenith blue.
const vec3 BETA_O = vec3(2.4e-3, 1.881e-3, 0.085e-3);
const float H_R = 8.0;
const float H_M = 1.2;
const float SUN = 20.0;
/** Twilight that lights haze from all around, warm from the glow along the horizon. */
const vec3 HAZE_LIGHT = vec3(0.012, 0.008, 0.006);

vec3 density(float h) {
  return vec3(exp(-h / H_R), exp(-h / H_M), max(0.0, 1.0 - abs(h - 25.0) / 15.0));
}

vec3 extinction(vec3 depth, float betaM) {
  return exp(-(BETA_R * depth.x + vec3(betaM / 0.9) * depth.y + BETA_O * depth.z));
}

float exitDistance(vec3 p, vec3 dir) {
  float b = dot(p, dir);
  float c = dot(p, p) - RT * RT;
  return -b + sqrt(max(0.0, b * b - c));
}

/** Optical depth from p toward the sun, or a huge value when the Earth stands in the way. */
vec3 sunDepth(vec3 p, vec3 sun) {
  float h = length(p) - R;
  float b = dot(p, sun);
  if (b < 0.0 && h * (2.0 * R + h) < b * b) {
    return vec3(1e6);
  }
  float total = exitDistance(p, sun);
  vec3 depth = vec3(0.0);
  float previous = 0.0;
  if (b < 0.0) {
    float tangent = -b;
    for (int i = 1; i <= 5; i++) {
      float f = float(i) / 5.0;
      float t = tangent * (1.0 - (1.0 - f) * (1.0 - f));
      depth += density(length(p + sun * (0.5 * (previous + t))) - R) * (t - previous);
      previous = t;
    }
  }
  float start = previous;
  for (int i = 1; i <= 6; i++) {
    float f = float(i) / 6.0;
    float t = start + (total - start) * f * f;
    depth += density(length(p + sun * (0.5 * (previous + t))) - R) * (t - previous);
    previous = t;
  }
  return depth;
}

/** Optical depth along the view ray up to \`limit\` kilometres. */
vec3 viewDepth(vec3 origin, vec3 dir, float limit) {
  vec3 depth = vec3(0.0);
  float previous = 0.0;
  for (int i = 1; i <= 8; i++) {
    float f = float(i) / 8.0;
    float t = limit * f * f;
    depth += density(length(origin + dir * (0.5 * (previous + t))) - R) * (t - previous);
    previous = t;
  }
  return depth;
}

float phaseRayleigh(float mu) {
  return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
}

float phaseMie(float mu, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}

/** Light scattered toward the observer along the whole view ray. */
vec3 scatter(vec3 origin, vec3 dir, vec3 sun, float betaM) {
  float limit = exitDistance(origin, dir);
  float mu = dot(dir, sun);
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  vec3 sumHaze = vec3(0.0);
  vec3 depth = vec3(0.0);
  float previous = 0.0;
  for (int i = 1; i <= 16; i++) {
    float f = float(i) / 16.0;
    float t = limit * f * f;
    float step = t - previous;
    vec3 p = origin + dir * (0.5 * (previous + t));
    vec3 local = density(length(p) - R) * step;
    depth += 0.5 * local;
    vec3 attenuation = extinction(depth + sunDepth(p, sun), betaM);
    sumHaze += local.y * extinction(depth, betaM);
    depth += 0.5 * local;
    sumR += local.x * attenuation;
    sumM += local.y * attenuation;
    previous = t;
  }
  vec3 light = SUN * (sumR * BETA_R * phaseRayleigh(mu) + sumM * betaM * phaseMie(mu, 0.8));
  float skylight = smoothstep(-0.2, 0.1, u_sun);
  // Light scattered more than once: by the air from the whole sky, and by haze that the low sun no
  // longer reaches directly, lit by the twilight around it and brightest toward the sun.
  light += sumR * BETA_R * vec3(0.22, 0.42, 0.95) * skylight;
  return light + sumHaze * betaM * HAZE_LIGHT * (0.6 + 0.8 * pow(max(mu, 0.0), 4.0)) * skylight;
}

vec4 layerLight(vec3 origin, vec3 dir, vec3 sun, float betaM, float height) {
  float t = layerDistance(dir, height);
  vec3 sunlight = SUN * extinction(sunDepth(origin + dir * t, sun), betaM) * u_transmission;
  vec3 seen = extinction(viewDepth(origin, dir, t), betaM);
  return vec4(sunlight * seen, dot(seen, vec3(0.2126, 0.7152, 0.0722)));
}

void main() {
  vec3 dir = viewDirection(gl_FragCoord.xy / u_size, u_view);
  vec3 origin = vec3(0.0, R + EYE, 0.0);
  vec3 sun = vec3(0.0, sin(u_sun), cos(u_sun));
  float betaM = max(u_aod, 0.02) / H_M;

  vec3 skyDir = normalize(vec3(dir.x, max(dir.y, 0.004), dir.z));
  outSky = vec4(scatter(origin, skyDir, sun, betaM) * (1.0 - 0.5 * u_wet), 1.0);
  outLow = layerLight(origin, dir, sun, betaM, LOW);
  outMid = layerLight(origin, dir, sun, betaM, MID);
  outHigh = layerLight(origin, dir, sun, betaM, HIGH);
}
`;

/**
 * Noise components in u_map and u_shift, three per layer from low to high. Low and mid clouds have
 * cloudlets, the masses they gather in, and fine detail; high clouds have bands along the wind,
 * the patches they come in, and the strands within them.
 */
export const NOISE_COMPONENTS = 9;

/**
 * The clouds, every frame: three layers whose cover follows the forecast along the sun's azimuth,
 * shaped from a tiling noise texture that the wind carries along, lit from their sunward side with
 * the light the atmosphere pass traced to them, and blended into the sky with the haze in front.
 */
export const CLOUD_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_view;
uniform sampler2D u_sky;
uniform sampler2D u_lowLight;
uniform sampler2D u_midLight;
uniform sampler2D u_highLight;
uniform sampler2D u_noise;
uniform float u_sun;
uniform vec3 u_cover[8];
uniform float u_wet;
/** Kilometres to noise tiles for each component, and where the wind has carried it. */
uniform mat2 u_map[${NOISE_COMPONENTS}];
uniform vec2 u_shift[${NOISE_COMPONENTS}];
uniform vec2 u_seed;
/** How stretched a footprint the noise texture's filtering resolves. */
uniform float u_anisotropy;

out vec4 outColor;

${GEOMETRY}

const float DISTANCES[8] = float[8](0.0, 25.0, 50.0, 100.0, 150.0, 200.0, 300.0, 400.0);
/** Noise cells per tile in the R, G, B and A channels. */
const vec4 CELLS = vec4(8.0, 12.0, 16.0, 32.0);
const float GRADIENT_SPREAD = ${NOISE_STATS.gradientSpread.toFixed(3)};
const float CELLULAR_MEAN = ${NOISE_STATS.cellularMean.toFixed(3)};
const float CELLULAR_SPREAD = ${NOISE_STATS.cellularSpread.toFixed(3)};
const float CLOUD_BRIGHTNESS = 1.1;

vec3 coverAt(float distance) {
  if (distance <= 0.0) {
    return u_cover[0];
  }
  for (int i = 1; i < 8; i++) {
    if (distance < DISTANCES[i]) {
      return mix(u_cover[i - 1], u_cover[i], (distance - DISTANCES[i - 1]) / (DISTANCES[i] - DISTANCES[i - 1]));
    }
  }
  return u_cover[7];
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float henyeyGreenstein(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}

/** Noise of component j at a cloud position (km), filtered to the pixel footprint; warp shifts it in noise tiles. */
vec4 noiseAt(int j, vec2 position, vec2 warp, vec2 dx, vec2 dy, float blur) {
  mat2 map = u_map[j];
  return textureGrad(u_noise, map * position + u_shift[j] + warp, map * dx * blur, map * dy * blur);
}

/** How much of each channel's detail survives at component j's pixel footprint: 1 sharp, 0 averaged away. */
vec4 detailKept(int j, vec2 dx, vec2 dy) {
  mat2 map = u_map[j];
  float a = length(map * dx);
  float b = length(map * dy);
  float footprint = max(min(a, b), max(a, b) / u_anisotropy);
  return clamp(1.5 - 2.0 * footprint * CELLS, 0.0, 1.0);
}

/** Cover with patches: the forecast cover, spread more where it is neither clear nor overcast. */
float patchyCover(float cover, float patches) {
  return clamp(cover + (patches - 0.5) * 3.2 * min(cover, 1.0 - cover), 0.0, 0.98);
}

/** Where to cut noise of a given spread so that \`cover\` of it lies above, taking it as roughly normal. */
float coverLevel(float cover, float spread) {
  float c = clamp(cover, 0.005, 0.995);
  return spread * log((1.0 - c) / c) / 1.702;
}

struct Cloud {
  vec3 color;
  float alpha;
};

struct Light {
  /** Sunlight on the layer as seen from the eye, and the air's transmittance up to it. */
  vec4 sun;
  vec3 ambient;
  vec3 sky;
  float phase;
};

struct Shape {
  /** How far the mass noise bends the cells, in noise tiles. */
  float warp;
  /** Weight of the cellular noise that breaks the masses into cloudlets. */
  float cells;
  /** Weight of the half-size lobes that make cloudlets lumpy. */
  float lobes;
  float detail;
  /** First step of the march toward the sun across cloudlets, km. */
  float shadowStep;
  /** First step of the march across whole cloud masses, km. */
  float massStep;
  /** How far apart the lumps are compared for their relief, km. */
  float reliefStep;
  float opacity;
};

/** Doubles cellular noise coordinates and turns them a quarter, which keeps the tiling, for the lobes. */
const mat2 LOBE_TURN = mat2(0.0, -2.0, 2.0, 0.0);
const vec2 LOBE_OFFSET = vec2(0.37, 0.61);
/** How strongly the lumps facing the sun brighten, and those turned away darken. */
const float RELIEF = 6.0;

/**
 * Low and mid clouds: masses of smooth noise broken into cloudlets by cellular noise, cut at the
 * level that leaves the forecast cover, darkening with the cloud the sunlight crosses on its way
 * in from the sunward side, their lumps lit on the side that faces the sun.
 */
Cloud cumuliform(int base, vec2 position, vec2 dx, vec2 dy, float cover, float sinElevation, Light light, Shape shape) {
  if (cover < 0.005) {
    return Cloud(vec3(0.0), 0.0);
  }
  vec4 field = noiseAt(base + 1, position, vec2(0.0), dx, dy, 1.0);
  vec4 fieldKept = detailKept(base + 1, dx, dy);
  vec2 warp = fieldKept.rb * (field.rb - 0.5) * shape.warp;
  float cellsKept = detailKept(base, dx, dy).g;
  float lobesKept = clamp(cellsKept * 2.0 - 1.0, 0.0, 1.0);
  float detailKeptA = detailKept(base + 2, dx, dy).a;

  mat2 cellMap = u_map[base];
  vec2 cellUv = cellMap * position + u_shift[base] + warp;
  vec2 gx = cellMap * dx;
  vec2 gy = cellMap * dy;
  float masses = fieldKept.r * (field.r - 0.5) + 0.5 * fieldKept.b * (field.b - 0.5);
  float big = shape.cells * cellsKept * (textureGrad(u_noise, cellUv, gx, gy).g - CELLULAR_MEAN);
  float lobes = shape.cells * shape.lobes * lobesKept
    * (textureGrad(u_noise, LOBE_TURN * cellUv + LOBE_OFFSET, LOBE_TURN * gx, LOBE_TURN * gy).g - CELLULAR_MEAN);
  mat2 detailMap = u_map[base + 2];
  vec2 detailUv = detailMap * position + u_shift[base + 2];
  vec2 detailGx = detailMap * dx;
  vec2 detailGy = detailMap * dy;
  // Fine detail in two octaves, the second at twice the frequency, which keeps the tiling.
  float detailFineKept = clamp(detailKeptA * 2.0 - 1.0, 0.0, 1.0);
  float coarseDetail = shape.detail * detailKeptA * (textureGrad(u_noise, detailUv, detailGx, detailGy).a - 0.5);
  float detail = coarseDetail
    + shape.detail * 0.5 * detailFineKept * (textureGrad(u_noise, detailUv * 2.0 + LOBE_OFFSET, detailGx * 2.0, detailGy * 2.0).a - 0.5);

  // The spread of what survives the filtering sets the cut, so distance blurs the clouds without thinning them.
  float spread = length(vec4(
    GRADIENT_SPREAD * fieldKept.r,
    0.5 * GRADIENT_SPREAD * fieldKept.b,
    shape.cells * CELLULAR_SPREAD * length(vec2(cellsKept, shape.lobes * lobesKept)),
    shape.detail * GRADIENT_SPREAD * length(vec2(detailKeptA, 0.5 * detailFineKept))));
  float fullSpread = length(vec4(GRADIENT_SPREAD, 0.5 * GRADIENT_SPREAD, shape.cells * CELLULAR_SPREAD * length(vec2(1.0, shape.lobes)), shape.detail * GRADIENT_SPREAD * length(vec2(1.0, 0.5))));
  float cut = coverLevel(cover, spread);
  float excess = masses + big + lobes + detail - cut;

  float path = inversesqrt(max(sinElevation, 0.02));
  float sharp = 1.0 - exp(-max(excess + 0.02, 0.0) * shape.opacity * path);
  float far = 1.0 - pow(1.0 - cover, 1.0 + 0.25 / max(sinElevation, 0.02));
  float alpha = mix(far, sharp, smoothstep(0.1, 0.6, spread / fullSpread));
  if (alpha < 0.003) {
    return Cloud(vec3(0.0), 0.0);
  }

  // Sunlight comes in from the sunward side (+z) almost level, crossing the cloudlets in its way...
  float rest = masses + detail - cut;
  vec2 sunward = cellMap * vec2(0.0, shape.shadowStep);
  float depth = max(excess, 0.0) * 0.5 * shape.shadowStep;
  for (int i = 1; i <= 3; i++) {
    float ahead = textureGrad(u_noise, cellUv + sunward * float(i * (i + 1) / 2), gx * 2.0, gy * 2.0).g;
    depth += max(rest + shape.cells * cellsKept * (ahead - CELLULAR_MEAN), 0.0) * shape.shadowStep * float(i);
  }
  // ...and the whole masses beyond them.
  float massDepth = 0.0;
  for (int i = 1; i <= 3; i++) {
    vec4 ahead = noiseAt(base + 1, position + vec2(0.0, shape.massStep * float(i * i)), vec2(0.0), dx, dy, 3.0);
    float aheadMasses = fieldKept.r * (ahead.r - 0.5) + 0.5 * fieldKept.b * (ahead.b - 0.5);
    massDepth += max(aheadMasses - cut, 0.0) * shape.massStep * float(2 * i - 1);
  }
  float lit = (0.8 * exp(-depth * 14.0) + 0.2 * exp(-depth * 2.0)) * (0.35 + 0.65 * exp(-massDepth * 2.5));

  // Relief: where the lumps thin out toward the sun, their surface faces it.
  vec2 reliefUv = cellUv + cellMap * vec2(0.0, shape.reliefStep);
  float lobesAhead = shape.cells * shape.lobes * lobesKept
    * (textureGrad(u_noise, LOBE_TURN * reliefUv + LOBE_OFFSET, LOBE_TURN * gx, LOBE_TURN * gy).g - CELLULAR_MEAN);
  float detailAhead = shape.detail * detailKeptA
    * (textureGrad(u_noise, detailUv + detailMap * vec2(0.0, shape.reliefStep), detailGx, detailGy).a - 0.5);
  float relief = clamp(1.0 + RELIEF * (lobes + coarseDetail - lobesAhead - detailAhead), 0.55, 1.5);
  float core = smoothstep(0.0, 0.3, excess);

  vec3 direct = light.sun.rgb * light.phase * lit * relief * CLOUD_BRIGHTNESS;
  vec3 diffuse = light.ambient * light.sun.a * mix(1.0, 0.35, core) * mix(1.0, relief, 0.8);
  return Cloud((direct + diffuse) * (1.0 - 0.6 * u_wet) + light.sky * (1.0 - light.sun.a), alpha);
}

/** High clouds: bands of thin veil along the wind, combed into fine strands, fully lit. */
Cloud cirrus(vec2 position, vec2 dx, vec2 dy, float cover, float sinElevation, Light light) {
  if (cover < 0.005) {
    return Cloud(vec3(0.0), 0.0);
  }
  vec4 field = noiseAt(7, position, vec2(0.0), dx, dy, 1.0);
  vec4 fieldKept = detailKept(7, dx, dy);
  float local = patchyCover(cover, mix(0.5, field.r, fieldKept.r));
  vec2 warp = (fieldKept.br * (field.br - 0.5)) * vec2(0.05, 0.12);

  vec4 bandsKept = detailKept(6, dx, dy);
  vec4 bandNoise = noiseAt(6, position, warp, dx, dy, 1.0);
  float bands = bandsKept.b * (bandNoise.b - 0.5);
  // Waves along each band bend its strands and thin them out here and there.
  float wave = bandsKept.a * (bandNoise.a - 0.5);
  // Strands at two spacings across the wind, so they do not line up like a comb.
  mat2 strandMap = u_map[8];
  vec2 strandUv = strandMap * position + u_shift[8] + warp * 1.5 + vec2(0.0, wave * 0.3);
  // Filtered a little wider than the pixel, so strands stay soft however sharp the filtering.
  vec2 gx = strandMap * dx * 2.0;
  vec2 gy = strandMap * dy * 2.0;
  const vec2 FINER = vec2(1.0, 2.0);
  float strands = detailKept(8, dx, dy).a * (0.65 * textureGrad(u_noise, strandUv, gx, gy).a
    + 0.35 * textureGrad(u_noise, strandUv * FINER + vec2(0.29, 0.53), gx * FINER, gy * FINER).a - 0.5);
  float level = coverLevel(local, max(GRADIENT_SPREAD * bandsKept.b, 0.02));
  float veil = smoothstep(level - 0.04, level + 0.16, bands + 0.25 * strands + 0.3 * wave);
  float alpha = veil * (0.6 + strands) * 0.38 * pow(max(sinElevation, 0.02), -0.3);
  alpha = clamp(alpha, 0.0, 0.7);
  if (alpha < 0.003) {
    return Cloud(vec3(0.0), 0.0);
  }
  vec3 direct = light.sun.rgb * light.phase * CLOUD_BRIGHTNESS * 0.4;
  vec3 diffuse = light.ambient * light.sun.a * 0.6;
  return Cloud((direct + diffuse) * (1.0 - 0.6 * u_wet) + light.sky * (1.0 - light.sun.a), alpha);
}

/** Smooth 1D noise along the horizon from one texture row. */
float ridge(float azimuth, float row, float scale) {
  return 0.6 * textureLod(u_noise, vec2(azimuth * scale, row), 0.0).r
    + 0.3 * textureLod(u_noise, vec2(azimuth * scale * 2.3, row + 0.31), 0.0).b
    + 0.1 * textureLod(u_noise, vec2(azimuth * scale * 5.1, row + 0.57), 0.0).a;
}

vec3 tonemap(vec3 x) {
  x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(x, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 screen = gl_FragCoord.xy / u_view;
  vec3 dir = viewDirection(screen, u_view);
  vec3 sun = vec3(0.0, sin(u_sun), cos(u_sun));

  // Positions on each layer and their screen derivatives, taken before any branch.
  vec2 lowPosition = (dir * layerDistance(dir, LOW)).xz + u_seed;
  vec2 midPosition = (dir * layerDistance(dir, MID)).xz + u_seed;
  vec2 highPosition = (dir * layerDistance(dir, HIGH)).xz + u_seed;
  vec2 lowDx = dFdx(lowPosition);
  vec2 lowDy = dFdy(lowPosition);
  vec2 midDx = dFdx(midPosition);
  vec2 midDy = dFdy(midPosition);
  vec2 highDx = dFdx(highPosition);
  vec2 highDy = dFdy(highPosition);

  vec3 sky = texture(u_sky, screen).rgb;
  float elevation = asin(dir.y);
  // Two ranges of hills, neither higher than 0.032 rad.
  float farRidge = -1.0;
  float nearRidge = -1.0;
  if (elevation < 0.032) {
    float azimuth = atan(dir.x, dir.z);
    farRidge = 0.002 + 0.03 * pow(ridge(azimuth + u_seed.x, 0.17, 0.9), 2.0);
    nearRidge = -0.012 + 0.04 * pow(ridge(azimuth + u_seed.y, 0.63, 0.45), 1.6);
  }

  vec3 color;
  if (elevation < max(nearRidge, 0.0)) {
    color = sky * 0.12 + vec3(0.0004, 0.0004, 0.0006);
  } else if (elevation < farRidge) {
    color = sky * 0.45 + vec3(0.001, 0.001, 0.0015);
  } else {
    // A cloud base sees little of the sky: the dark ground below and the glow along the horizon.
    vec3 zenith = texture(u_sky, vec2(0.5, 1.0)).rgb;
    float horizon = 0.5 - 0.5 * tan(u_pitch);
    vec3 belt = texture(u_sky, vec2(screen.x, horizon + 0.03)).rgb;
    vec3 ambient = zenith * 0.4 + belt * 0.04;
    float mu = dot(dir, sun);
    float phase = 0.6 * henyeyGreenstein(mu, 0.55) + 0.4 / (4.0 * PI);
    float sinElevation = dir.y;

    color = sky;
    Light highLight = Light(texture(u_highLight, screen), ambient, sky, phase);
    Cloud high = cirrus(highPosition, highDx, highDy, coverAt(highPosition.y - u_seed.y).z, sinElevation, highLight);
    color = mix(color, high.color, high.alpha);
    Light midLight = Light(texture(u_midLight, screen), ambient, sky, phase);
    Cloud mid = cumuliform(3, midPosition, midDx, midDy, coverAt(midPosition.y - u_seed.y).y, sinElevation, midLight, Shape(0.1, 0.8, 0.55, 0.3, 0.16, 0.6, 0.05, 11.0));
    color = mix(color, mid.color, mid.alpha);
    // Low cloud bases also catch the glow along the horizon beneath them.
    Light lowLight = Light(texture(u_lowLight, screen), zenith * 0.28 + belt * 0.1, sky, phase);
    Cloud low = cumuliform(0, lowPosition, lowDx, lowDy, coverAt(lowPosition.y - u_seed.y).x, sinElevation, lowLight, Shape(0.08, 1.3, 0.6, 0.7, 0.4, 1.5, 0.1, 10.0));
    color = mix(color, low.color, low.alpha);
  }

  float exposure = 5.5 * exp(-24.0 * clamp(u_sun, -0.1, 0.05));
  vec3 mapped = tonemap(color * exposure);
  // A photographic grade: a little more saturation than the film curve leaves.
  mapped = clamp(mix(vec3(dot(mapped, vec3(0.2126, 0.7152, 0.0722))), mapped, 1.2), 0.0, 1.0);
  mapped += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(mapped, 1.0);
}
`;
