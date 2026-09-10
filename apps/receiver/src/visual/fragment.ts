// Um único fragment shader com todos os motions. O receptor calcula dois campos
// (motion de origem e de destino) e mistura por uMix durante a transição.
// Cada motion devolve vec2(base, glow): base escolhe a cor na paleta, glow adiciona luz.
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uResolution;
uniform float uPhase;
uniform float uTime;
uniform vec3 uPalette[5];
uniform float uBrightness;
uniform float uContrast;
uniform int uMotionA;
uniform int uMotionB;
uniform float uMix;

// ---------- ruído ----------

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float hash21(vec2 p) {
  return hash22(p).x;
}

// Ruído de gradiente (Perlin-like), muito mais orgânico que value noise.
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = hash22(i) * 2.0 - 1.0;
  vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y) * 0.5 + 0.5;
}

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * gnoise(p);
    p = ROT * p * 2.02 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}

// Versão barata para deslocar o domínio: o warp não precisa de detalhe fino.
float fbmLow(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * gnoise(p);
    p = ROT * p * 2.02 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}

// fbm com domain warping: nuvens, fumaça e fogo ganham volume.
float warped(vec2 p, float t, float strength) {
  vec2 q = vec2(fbmLow(p + vec2(0.0, t * 0.3)), fbmLow(p + vec2(5.2, 1.3) - t * 0.2));
  // fbm concentra em torno de 0.5; reexpande para usar a paleta inteira
  return smoothstep(0.22, 0.78, fbm(p + strength * (q * 2.0 - 1.0)));
}

// Partículas em grade com jitter, tamanho e cintilação por célula.
float particles(vec2 g, float density, float radius, float t, float softness) {
  vec2 id = floor(g);
  vec2 rnd = hash22(id);
  float h = hash21(id + 3.1);
  if (h > density) return 0.0;
  vec2 c = fract(g) - 0.5 - (rnd - 0.5) * 0.7;
  float size = radius * (0.5 + rnd.x);
  float twinkle = 0.55 + 0.45 * sin(t * (1.5 + rnd.y * 3.0) + h * 40.0);
  return smoothstep(size, size * softness, length(c)) * twinkle;
}

// Gotas alongadas (chuva) e traços (brasas subindo).
float streaks(vec2 uv, float columns, float speed, float lengthFactor, float t, float seed) {
  float x = uv.x * columns;
  float col = floor(x);
  vec2 rnd = hash22(vec2(col, seed));
  float y = fract(uv.y * lengthFactor + t * speed * (0.7 + rnd.x * 0.6) + rnd.y * 7.0);
  float core = smoothstep(0.35, 0.0, abs(fract(x) - 0.5) * 2.0 - 0.05);
  float drop = smoothstep(0.0, 0.15, y) * smoothstep(0.55, 0.15, y);
  float present = step(0.55, hash21(vec2(col, seed + 1.0)));
  return core * drop * present;
}

// ---------- motions ----------
// p: centrado, corrigido por aspecto. uv: 0..1. t: fase acumulada (já escalada por speed).

vec2 staticGlow(vec2 p, vec2 uv, float t) {
  float breath = 0.5 + 0.5 * sin(t * 0.4);
  float radial = 1.0 - smoothstep(0.0, 1.1, length(p * vec2(1.0, 1.3)));
  float cloud = warped(p * 1.6 + vec2(t * 0.05, 0.0), t * 0.5, 0.6);
  float base = radial * 0.55 + cloud * 0.5 + breath * 0.05;
  float glow = pow(radial, 3.0) * (0.25 + breath * 0.1);
  return vec2(base, glow);
}

vec2 fireFlicker(vec2 p, vec2 uv, float t) {
  vec2 q = vec2(p.x * 2.6, uv.y * 2.4 - t * 1.6);
  float flame = warped(q, t * 2.0, 1.2);
  float shape = pow(max(0.0, 1.35 - uv.y * 1.5), 1.4);
  float tongues = pow(flame, 2.2) * shape * 1.8;
  float bed = (1.0 - smoothstep(0.0, 0.35, uv.y)) * (0.5 + 0.3 * fbm(vec2(p.x * 6.0, t * 4.0)));
  float sparks = particles(vec2(p.x * 40.0 + sin(uv.y * 5.0 + t) * 0.6, (uv.y + t * 0.5) * 40.0), 0.06, 0.12, t * 3.0, 0.2) * shape;
  float base = tongues + bed * 0.6;
  float glow = pow(tongues, 2.0) * 0.6 + bed * 0.25 + sparks;
  return vec2(base, glow);
}

vec2 rainStreaks(vec2 p, vec2 uv, float t) {
  float back = warped(p * 1.4 + vec2(t * 0.04, 0.0), t * 0.3, 0.5) * 0.55;
  float far = streaks(uv + vec2(0.0, 0.0), 90.0, 1.6, 6.0, t, 1.0) * 0.25;
  float mid = streaks(uv + vec2(0.013, 0.2), 55.0, 2.4, 3.5, t, 2.0) * 0.45;
  float near = streaks(uv + vec2(0.027, 0.5), 30.0, 3.4, 2.0, t, 3.0) * 0.7;
  float rain = far + mid + near;
  float sheen = smoothstep(0.7, 1.0, uv.y) * 0.1;
  return vec2(back + rain * 0.5 + sheen, rain * 0.35);
}

vec2 waves(vec2 p, vec2 uv, float t) {
  vec2 flow = vec2(t * 0.12, 0.0);
  float a = warped(p * 1.8 + flow, t * 0.5, 0.7);
  float b = warped(p * 2.6 - flow * 1.4 + vec2(3.1, 1.7), t * 0.7, 0.5);
  float swell = sin(uv.y * 5.0 - t * 0.6 + a * 3.0) * 0.5 + 0.5;
  float sea = a * 0.45 + b * 0.3 + swell * 0.25;
  float ripple = gnoise(p * 9.0 + vec2(t * 0.6, -t * 0.4) + a * 2.0);
  float caustic = pow(smoothstep(0.55, 0.95, ripple), 2.0) * 0.6;
  return vec2(0.2 + sea * 0.6, caustic * (0.3 + sea * 0.5));
}

vec2 fogDrift(vec2 p, vec2 uv, float t) {
  float back = warped(p * 1.1 + vec2(t * 0.06, t * 0.015), t * 0.4, 0.9);
  float front = warped(p * 2.4 + vec2(-t * 0.11, t * 0.03), t * 0.6, 0.5);
  float base = back * 0.7 + front * 0.4;
  float glow = pow(front, 4.0) * 0.12;
  return vec2(base, glow);
}

vec2 starfield(vec2 p, vec2 uv, float t) {
  vec2 drift = vec2(t * 0.004, t * 0.002);
  float band = pow(fbm(p * 1.3 + vec2(2.0, 0.0) + drift), 2.5) * smoothstep(0.7, 0.0, abs(p.y * 1.6 - p.x * 0.4));
  float dust = fbm(p * 3.0 - drift) * 0.08;
  float tiny = particles((p + drift) * 140.0, 0.12, 0.05, t, 0.3) * 0.5;
  float small = particles((p + drift * 0.8) * 70.0 + 3.7, 0.07, 0.07, t, 0.3) * 0.8;
  float bright = particles((p + drift * 0.6) * 28.0 + 9.1, 0.05, 0.11, t * 0.7, 0.1);
  float stars = tiny + small + bright;
  float base = 0.08 + band * 0.5 + dust;
  float glow = stars * 2.2 + band * 0.25;
  return vec2(base, glow);
}

vec2 pulse(vec2 p, vec2 uv, float t) {
  float d = length(p * vec2(1.0, 1.2)) + fbm(p * 3.0 + t * 0.2) * 0.12;
  float rings = sin(d * 9.0 - t * 1.6) * 0.5 + 0.5;
  rings = pow(rings, 2.0) * exp(-d * 1.2) * 0.6;
  float core = exp(-d * 3.0) * (0.35 + 0.25 * sin(t * 1.6));
  float haze = warped(p * 1.8, t * 0.3, 0.6) * 0.35;
  float base = 0.2 + haze + rings * 0.4 + core * 0.3;
  float glow = rings * 0.3 + core * 0.35;
  return vec2(base, glow);
}

vec2 embers(vec2 p, vec2 uv, float t) {
  float heat = warped(vec2(p.x * 2.2, uv.y * 2.0 - t * 0.5), t, 0.8) * pow(1.0 - uv.y, 1.5);
  vec2 sway = vec2(sin(uv.y * 6.0 + t * 1.3) * 0.006, 0.0);
  float far = streaks(uv + sway, 90.0, 0.35, 6.0, t, 11.0) * 0.3;
  float near = streaks(uv + sway * 2.0 + vec2(0.03, 0.0), 50.0, 0.6, 4.0, t, 12.0) * 0.55;
  float sparks = particles(vec2(p.x * 45.0 + sway.x * 40.0, (uv.y + t * 0.3) * 45.0), 0.08, 0.1, t * 4.0, 0.15);
  float base = 0.18 + heat * 0.7 + (far + near) * 0.3;
  float glow = heat * 0.3 + (far + near) * 0.5 + sparks * 0.9;
  return vec2(base, glow);
}

vec2 snowfall(vec2 p, vec2 uv, float t) {
  float sky = 0.45 + warped(p * 1.2 + vec2(t * 0.03, 0.0), t * 0.3, 0.6) * 0.35;
  float sway = sin(uv.y * 4.0 + t * 0.8) * 0.05;
  float far = particles(vec2(p.x * 60.0 + sway * 20.0, (uv.y - t * 0.08) * 60.0), 0.18, 0.12, t, 0.0) * 0.35;
  float mid = particles(vec2(p.x * 32.0 + sway * 40.0 + 2.0, (uv.y - t * 0.14) * 32.0), 0.14, 0.16, t, 0.05) * 0.6;
  float near = particles(vec2(p.x * 16.0 + sway * 60.0 + 5.0, (uv.y - t * 0.22) * 16.0), 0.1, 0.22, t, 0.1) * 0.9;
  float snow = far + mid + near;
  return vec2(sky + snow * 0.3, snow * 0.6);
}

vec2 lightning(vec2 p, vec2 uv, float t) {
  float clouds = warped(p * 1.5 + vec2(t * 0.15, 0.0), t * 0.5, 0.9);
  float cell = floor(t * 0.4);
  float ft = fract(t * 0.4);
  vec2 rnd = hash22(vec2(cell, 17.0));
  float strikes = step(0.55, rnd.x);
  // dois ou três sub-flashes por relâmpago
  float flicker = exp(-ft * 18.0) + 0.6 * exp(-abs(ft - 0.08) * 40.0) + 0.35 * exp(-abs(ft - 0.17) * 40.0);
  vec2 origin = vec2((rnd.y - 0.5) * 1.4, 0.55);
  float radial = exp(-length(p - origin) * 1.1);
  float flash = strikes * flicker * (0.5 + radial);
  float base = 0.12 + clouds * 0.45 + flash * clouds * 0.5;
  float glow = flash * (0.4 + radial * 0.8);
  return vec2(base, glow);
}

vec2 field(int motion, vec2 p, vec2 uv, float t) {
  if (motion == 0) return staticGlow(p, uv, t);
  if (motion == 1) return fireFlicker(p, uv, t);
  if (motion == 2) return rainStreaks(p, uv, t);
  if (motion == 3) return waves(p, uv, t);
  if (motion == 4) return fogDrift(p, uv, t);
  if (motion == 5) return starfield(p, uv, t);
  if (motion == 6) return pulse(p, uv, t);
  if (motion == 7) return embers(p, uv, t);
  if (motion == 8) return snowfall(p, uv, t);
  return lightning(p, uv, t);
}

// ---------- cor ----------

vec3 paletteAt(float f) {
  float x = clamp(f, 0.0, 1.0) * 4.0;
  int i = int(floor(x));
  int j = min(i + 1, 4);
  return mix(uPalette[i], uPalette[j], smoothstep(0.0, 1.0, fract(x)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Fora da transição só um motion é calculado; o desvio é uniforme, então não custa divergência.
  vec2 f;
  if (uMix >= 1.0) {
    f = field(uMotionB, p, uv, uPhase);
  } else if (uMix <= 0.0) {
    f = field(uMotionA, p, uv, uPhase);
  } else {
    f = mix(field(uMotionA, p, uv, uPhase), field(uMotionB, p, uv, uPhase), uMix);
  }

  float base = clamp((f.x - 0.5) * (0.7 + uContrast * 1.6) + 0.5, 0.0, 1.0);
  vec3 col = paletteAt(base);

  // luz: brasas, estrelas e relâmpagos empurram para a cor mais clara da paleta e além
  vec3 light = paletteAt(1.0);
  col += light * f.y * (0.6 + uContrast * 0.6);

  // respiração global bem lenta, imperceptível mas viva
  float breath = 1.0 + 0.04 * sin(uTime * 0.25);
  col *= (0.3 + uBrightness * 0.95) * breath;

  // vinheta suave e grão animado para quebrar banding em TV
  float vignette = 1.0 - 0.4 * pow(length(uv - 0.5) * 1.35, 2.2);
  col *= vignette;
  float grain = (hash21(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.02;
  col += grain;

  // tone mapping leve para o glow saturar com graça em vez de estourar
  col = col / (1.0 + col * 0.35);
  outColor = vec4(pow(max(col, 0.0), vec3(0.95)), 1.0);
}
`;

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
