'use strict';
// ---------- math ----------
const M4 = {
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), r = new Float32Array(16); r[0] = t / asp; r[5] = t; r[10] = (f + n) / (n - f); r[11] = -1; r[14] = 2 * f * n / (n - f); return r; },
  ident() { const r = new Float32Array(16); r[0] = r[5] = r[10] = r[15] = 1; return r; },
  mul(a, b) { const r = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; },
  trans(x, y, z) { const r = M4.ident(); r[12] = x; r[13] = y; r[14] = z; return r; },
  scale(x, y, z) { const r = M4.ident(); r[0] = x; r[5] = y; r[10] = z; return r; },
  rx(a) { const r = M4.ident(), c = Math.cos(a), s = Math.sin(a); r[5] = c; r[6] = s; r[9] = -s; r[10] = c; return r; },
  ry(a) { const r = M4.ident(), c = Math.cos(a), s = Math.sin(a); r[0] = c; r[2] = -s; r[8] = s; r[10] = c; return r; },
  rz(a) { const r = M4.ident(), c = Math.cos(a), s = Math.sin(a); r[0] = c; r[1] = s; r[4] = -s; r[5] = c; return r; },
  chain(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); },
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- noise ----------
function makeNoise(seed) {
  const p = new Uint8Array(512), q = [...Array(256).keys()];
  let s = (seed >>> 0) || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  for (let i = 0; i < 512; i++) p[i] = q[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const g2 = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  function n2(x, y) {
    const X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; const xi = X & 255, yi = Y & 255;
    const u = fade(x), v = fade(y);
    const a = g2(p[p[xi] + yi], x, y), b = g2(p[p[xi + 1] + yi], x - 1, y), c = g2(p[p[xi] + yi + 1], x, y - 1), d = g2(p[p[xi + 1] + yi + 1], x - 1, y - 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 0.7;
  }
  function g3(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h == 12 || h == 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  function n3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z; const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi, B = p[xi + 1] + yi, BA = p[B] + zi, BB = p[B + 1] + zi;
    return lerp(lerp(lerp(g3(p[AA], x, y, z), g3(p[BA], x - 1, y, z), u), lerp(g3(p[AB], x, y - 1, z), g3(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(g3(p[AA + 1], x, y, z - 1), g3(p[BA + 1], x - 1, y, z - 1), u), lerp(g3(p[AB + 1], x, y - 1, z - 1), g3(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm(x, y, o = 4) { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < o; i++) { s += n2(x * f, y * f) * a; t += a; a *= .5; f *= 2; } return s / t; }
  const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 974711) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  return { n2, n3, fbm, hash };
}

// ---------- assets ----------
const IMG = {};
function loadImg(k, src) { return new Promise((res, rej) => { const i = new Image(); if (window.EMBED) src = EMBED[src] || src; i.onload = () => { IMG[k] = i; res(i); }; i.onerror = () => { console.warn('missing', src); res(null); }; i.src = src; }); }
let REG, BL, BYNAME = {}, ITEMS, NB;
let SHAPE, ALPHA, EMIT, OPAQUE, SOLID, TEX, SBOX, FLUID, FLVL;
const ITEM_BASE = 4096; // item keys start here (blocks use 0..4095); old saves used 1000 and are converted on load
const GUI_FILES = ['font', 'menu_background', 'menu_list_background', 'inworld_menu_background', 'header_separator', 'footer_separator', 'inventory', 'crafting_table',
  'furnace', 'generic_54', 'tab_items', 'tab_item_search', 'tab_inventory', 'sun', 'clouds', 'rain', 'snowfall', 'underwater', 'pig', 'cow', 'sheep', 'sheep_wool',
  'widget_button', 'widget_button_highlighted', 'widget_button_disabled', 'widget_slider', 'widget_slider_highlighted', 'widget_slider_handle', 'widget_slider_handle_highlighted',
  'widget_text_field', 'widget_text_field_highlighted', 'widget_checkbox', 'widget_checkbox_selected', 'widget_tab', 'widget_tab_selected', 'widget_tab_highlighted',
  'widget_tab_selected_highlighted', 'widget_scroller', 'hud_hotbar', 'hud_hotbar_selection', 'hud_food_empty', 'hud_food_full', 'hud_food_half',
  'hud_experience_bar_background', 'hud_experience_bar_progress', 'hud_air', 'hud_air_empty', 'hud_heart_container', 'hud_heart_full', 'hud_heart_half',
  'hud_heart_hardcore_full', 'hud_heart_hardcore_half', 'hud_heart_container_blinking', 'tooltip_background', 'tooltip_frame', 'container_furnace_burn_progress',
  'container_furnace_lit_progress', 'container_creative_inventory_scroller', 'container_creative_inventory_scroller_disabled', 'world_list_join', 'world_list_join_highlighted',
  'container_slot_highlight_back', 'container_slot_highlight_front', 'skin_steve', 'skin_alex', 'skin_ari', 'skin_efe', 'skin_kai', 'skin_makena', 'skin_noor', 'skin_sunny', 'skin_zuri', 'husk', 'drowned', 'stray', 'wither_skeleton', 'cave_spider', 'mooshroom_red', 'piglin', 'piglin_brute', 'bogged', 'enderman', 'slime', 'magmacube', 'ghast', 'ghast_shooting', 'zombified_piglin', 'wolf', 'wolf_tame', 'wolf_angry', 'zombie', 'skeleton', 'creeper', 'spider', 'spider_eyes', 'steve', 'toast', 'pack'];
GUI_FILES.push('font_improved', 'title_logo', 'title_edition', 'prompts/xbox_a', 'prompts/xbox_b', 'prompts/xbox_x', 'prompts/xbox_y', 'prompts/xbox_lb', 'prompts/xbox_rb', 'prompts/xbox_lt', 'prompts/xbox_rt', 'prompts/xbox_start', 'prompts/xbox_back', 'prompts/xbox_ls', 'prompts/xbox_rs', 'prompts/xbox_dpad', 'prompts/ps_a', 'prompts/ps_b', 'prompts/ps_x', 'prompts/ps_y', 'prompts/ps_lb', 'prompts/ps_rb', 'prompts/ps_lt', 'prompts/ps_rt', 'prompts/ps_start', 'prompts/ps_back', 'prompts/ps_ls', 'prompts/ps_rs', 'prompts/ps_dpad', 'prompts/switch_a', 'prompts/switch_b', 'prompts/switch_x', 'prompts/switch_y', 'prompts/switch_lb', 'prompts/switch_rb', 'prompts/switch_lt', 'prompts/switch_rt', 'prompts/switch_start', 'prompts/switch_back', 'prompts/switch_ls', 'prompts/switch_rs', 'prompts/switch_dpad', 'prompts/touch_tap', 'prompts/touch_tap_hold', 'prompts/touch_swipe_move');
for (let i = 0; i < 8; i++) GUI_FILES.push('moon' + i);
GUI_FILES.push('particles');
for (const k of ['chicken', 'villager', 'iron_golem', 'snow_golem', 'blaze', 'squid', 'glow_squid', 'witch', 'zombie_villager', 'pillager', 'vindicator', 'evoker', 'horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'polar_bear', 'hoglin', 'zoglin', 'silverfish', 'endermite', 'wandering_trader', 'vex', 'ravager', 'ender_dragon', 'minecart']) GUI_FILES.push('mob_' + k);
for (const m of ['chainmail', 'copper', 'diamond', 'gold', 'iron', 'leather', 'netherite', 'turtle_scute']) GUI_FILES.push('mob_armor_' + m, 'mob_armorl_' + m);
for (let i = 1; i < 8; i++) for (const k of ['top_selected', 'top_unselected', 'bottom_selected', 'bottom_unselected']) GUI_FILES.push(`tab_${k}_${i}`);
for (let i = 0; i < 6; i++) GUI_FILES.push('panorama_' + i);

async function loadAssets(progress) {
  REG = window.EMBED ? EMBED.registry : window.REGISTRY;
  if (!REG) throw new Error('Game data is missing. Unzip the whole folder first, then open Blockcraft.html');
  BL = REG.blocks; ITEMS = REG.items; NB = BL.length;
  BL.forEach((b, i) => { b.id = i; BYNAME[b.n] = i; });
  SHAPE = new Uint8Array(NB); ALPHA = new Uint8Array(NB); EMIT = new Uint8Array(NB); OPAQUE = new Uint8Array(NB); SOLID = new Uint8Array(NB); TEX = new Uint16Array(NB * 4); SBOX = new Uint8Array(NB); FLUID = new Uint8Array(NB); FLVL = new Uint8Array(NB);
  const SH = { cube: 1, cross: 2, water: 3, lava: 4, cactus: 5, flat: 6, box: 7 };
  BL.forEach((b, i) => {
    SHAPE[i] = i == 0 ? 0 : SH[b.s]; ALPHA[i] = b.a; EMIT[i] = b.e; for (let f = 0; f < 4; f++) TEX[i * 4 + f] = b.t[f];
    SBOX[i] = b.solid ? 1 : 0; FLUID[i] = SHAPE[i] == 3 ? 1 : SHAPE[i] == 4 ? 2 : 0; FLVL[i] = b.lvl || 0;
    OPAQUE[i] = (SHAPE[i] == 1 && b.a == 0) ? 1 : 0; SOLID[i] = (SHAPE[i] == 1 || SHAPE[i] == 5) && b.n != 'nether_portal' ? 1 : 0;
  });
  ITEMS.forEach((n, i) => { BYNAME['item:' + n] = ITEM_BASE + i; });
  const jobs = [...Object.keys(window.PACK_FILES || { faithful64: 1 }).flatMap(id => [loadImg('packs/' + id + '_icon', 'packs/' + id + '_icon.png'), loadImg('packs/' + id + '_preview', 'packs/' + id + '_preview.png')]), loadImg('blocks', 'blocks.png'), loadImg('items', 'items.png'), loadImg('water', 'water_still.png'), loadImg('lava', 'lava_still.png'), loadImg('anim', 'anim.png'),
    ...GUI_FILES.map(f => loadImg(f, 'gui/' + f + '.png'))];
  let done = 0; jobs.forEach(j => j.then(() => progress && progress(++done / jobs.length)));
  await Promise.all(jobs);
  if (typeof registerPotions == 'function') registerPotions();
}
const itemKey = n => BYNAME[n] ?? BYNAME['item:' + n];
const keyName = k => k >= 9000 ? (typeof POTK != 'undefined' && POTK[k] ? POTK[k].f : undefined) : k >= ITEM_BASE ? ITEMS[k - ITEM_BASE] : BL[k]?.n;
const prettyName = k => k >= 9000 && typeof POTK != 'undefined' && POTK[k] ? POTK[k].name : (keyName(k) || '?').split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const MAXSTACK = k => { const n = keyName(k) || ''; return /(_pickaxe|_axe|_shovel|_sword|_hoe|_helmet|_chestplate|_leggings|_boots|bucket$|^bow$|shears|flint_and_steel|fishing_rod|trident|elytra|totem|_boat|minecart|saddle|potion|music_disc|_horse_armor|stew|soup|_spear|mace)/.test(n) && n != 'bucket' ? 1 : /(ender_pearl|snowball|egg$|^bucket$|_sign)/.test(n) ? 16 : 64; };

// ---------- shader packs (ports of the look of popular Java shader packs): sun strength, shade strength, saturation, contrast, shade colour, sunlight colour ----------
const SHADER_PACKS = [null,
  // values read from each pack's own code. sp: [exposure, -, saturation, Lottes contrast a] sp2: [vignette, fog tint, bloom, Lottes shoulder d]
  // Complementary r5.9.3 lib/colors/lightAndAmbientColors.glsl: noon light (0.65,0.55,0.375)*2.05, sunset pow(0.64,0.45,0.3)^1.5*5, night 0.9*(0.15,0.14,0.20); tonemap: Lottes (composite5 DoCompTonemap)
  { name: 'Complementary', tm: 0, sp: [.72, 0, 1.25, 1.1], sp2: [.2, .15, .15, 1.0], warm: [1.33, 1.13, .77], set: [2.56, 1.51, .82], night: [.135, .126, .18], shade: [.42, .53, .72], torch: [1.0, .55, .25], fogT: [.62, .74, .92] },
  // Photon v1.4: SUN 1.00 (white, atmosphere-coloured), MOON (0.75,0.83,1.00), BLOCKLIGHT (1.00,0.75,0.63), SKYLIGHT_I 1.00; tonemap_lottes a=1.5 d=0.91
  { name: 'Photon', tm: 0, sp: [.85, 0, 1.15, 1.5], sp2: [.1, .1, .2, .91], warm: [1.25, 1.18, 1.05], set: [2.2, 1.2, .55], night: [.09, .1, .14], shade: [.32, .45, .72], torch: [1.0, .75, .63], fogT: [.65, .78, 1.0] },
  // Bliss v2.1.2: Sun_temp 6300K, Moon_temp 15000K, TORCH (1.0,0.75,0.65), AmbientLight 1.0, TONEMAP ToneMap_AgX_minimal
  { name: 'Bliss', tm: 1, sp: [1.1, 0, 1.2, 1.0], sp2: [.25, .35, .35, 1.0], warm: [1.0, .94, .88], set: [1.0, .62, .38], night: [.07, .09, .14], shade: [.36, .48, .78], torch: [1.0, .75, .65], fogT: [.72, .66, .95] },
  // AstraLex V93: LIGHT_D (180,172,164)*1.40, LIGHT_E (236,188,132)*1.05, LIGHT_N (156,192,240)*1.20 (night x0.15), AMBIENT_D (156,188,228)*0.40, BLOCKLIGHT (224,172,136), BLOOM 0.5, Lottes
  { name: 'AstraLex', tm: 0, sp: [.9, 0, 1.1, 1.35], sp2: [.9, .45, .5, .95], warm: [.99, .94, .9], set: [.97, .77, .54], night: [.09, .11, .14], shade: [.24, .29, .35], torch: [.88, .67, .53], fogT: [.95, .74, .5] }];
// ---------- WebGL ----------
let gl, PROG, TEXS = {};
const VS = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec3 aL;
uniform mat4 uPV, uM; uniform float uFrames, uFrame, uShader, uTime; uniform vec3 uCam;
out vec2 vUv; out vec3 vL; out vec3 vT; out vec3 vRel;
void main(){ vec4 w = uM*vec4(aPos,1.0); vec3 L = aL; if (L.x < 0.0) { L.x = -L.x; if (uShader > 0.5) { float ph = w.x*0.7 + w.z*0.9 + uTime*1.6; w.x += sin(ph)*0.06*L.y; w.z += cos(ph*0.8)*0.05*L.y; } }
  gl_Position = uPV*w; vUv = vec2(aUv.x,(aUv.y+uFrame)/uFrames); vL=L; vT=vec3(1.0);
  if (L.x >= 2.0) { float code = floor(L.x*0.5); vL.x = L.x - code*2.0; code -= 1.0; vT = vec3(floor(code/1024.0), mod(floor(code/32.0),32.0), mod(code,32.0))/31.0*2.0; }
  vRel = w.xyz - uCam; }`;
const FS = `#version 300 es
precision mediump float;
in vec2 vUv; in vec3 vL; in vec3 vT; in vec3 vRel;
uniform sampler2D uTex; uniform float uDay, uAlphaTest, uFogN, uFogF, uAlpha, uFull, uMinL, uShaderF, uSunset; uniform vec3 uFog; uniform vec4 uTint; uniform vec4 uSP, uSP2; uniform vec3 uShade, uWarm, uFogT, uGrade, uSetC, uNightC, uTorch; uniform vec2 uRes; uniform float uTM, uBright;
out vec4 o;
void main(){ float vDist = length(vRel); vec4 c = texture(uTex, vUv); if(c.a < uAlphaTest) discard;
  float l = max(vL.y*uDay, vL.z); l = mix(max(l,uMinL), 1.0, uFull);
  vec3 col = min(c.rgb * vT, vec3(1.0)) * vL.x * l; col = mix(col, uTint.rgb, uTint.a);
  float f = clamp((vDist-uFogN)/(uFogF-uFogN),0.0,1.0);
  if (uShaderF > 0.5 && uFull < 0.5) { // Complementary-style lighting: warm sun, orange torchlight, cool blue shade, filmic curve, richer colour
    // the pack's own pipeline: linear colour x (its sun/sunset/night light + its ambient + its block light), its exposure, its tone map
    vec3 base = pow(min(c.rgb * vT, vec3(1.0)), vec3(2.2)) * vL.x; float sky = vL.y, blk = vL.z;
    vec3 light = mix(mix(uNightC, uWarm, uDay), uSetC, uSunset * uDay);
    vec3 amb = uShade * mix(0.35, 1.0, uDay);
    vec3 hdr = base * (light * sky * sky + amb * max(sky, uMinL * 2.0) + uTorch * pow(blk, 3.0) * 1.6) * uSP.x;
    hdr = mix(hdr, uTint.rgb, uTint.a);
    if (uTM < 0.5) { // Lottes 2016 (Complementary's DoCompTonemap / Photon's tonemap_lottes)
      vec3 ta = vec3(uSP.w), td = vec3(uSP2.w), hm = vec3(8.0), mi = vec3(0.26), mo = vec3(0.32);
      vec3 tb = (-pow(mi, ta) + pow(hm, ta) * mo) / ((pow(hm, ta * td) - pow(mi, ta * td)) * mo);
      vec3 tc = (pow(hm, ta * td) * pow(mi, ta) - pow(hm, ta) * pow(mi, ta * td) * mo) / ((pow(hm, ta * td) - pow(mi, ta * td)) * mo);
      col = pow(hdr, ta) / (pow(hdr, ta * td) * tb + tc); col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
    } else { // AgX minimal (Bliss)
      mat3 ins = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
      mat3 outs = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
      vec3 x = ins * max(hdr, vec3(1e-6)); x = (clamp(log2(x), -12.47393, 4.026069) + 12.47393) / 16.5;
      vec3 x2 = x * x, x4 = x2 * x2; x = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      float lu = dot(x, vec3(0.2126, 0.7152, 0.0722)); x = lu + 1.25 * (x - lu); col = outs * x; }
    float g = dot(col, vec3(0.299,0.587,0.114)); col = clamp(mix(vec3(g), col, uSP.z), 0.0, 1.0);
    float lum = dot(col, vec3(0.299,0.587,0.114)); col += max(lum - 0.75, 0.0) * uSP2.z; // bloom
    vec2 sc = gl_FragCoord.xy / uRes - 0.5; col *= 1.0 - dot(sc, sc) * uSP2.x; // vignette
    f = f*f*(3.0-2.0*f); }
  vec3 fc = uShaderF > 0.5 && uFull < 0.5 ? mix(uFog, uFogT, uSP2.y) : uFog;
  col = pow(max(col, vec3(0.0)), vec3(1.0 / (1.0 + uBright * 0.8))); // brightness setting lifts dark areas
  o = vec4(mix(col, fc, f), min(1.0, c.a*uAlpha)); }`;
function initGL(canvas) {
  const ca = { antialias: false, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false };
  gl = canvas.getContext('webgl2', ca); GL1 = false;
  if (!gl) { gl = canvas.getContext('webgl', ca) || canvas.getContext('experimental-webgl', ca); if (!gl) throw new Error('This browser has 3D graphics (WebGL) turned off. On a school Chromebook, ask your IT admin to allow WebGL, or open chrome://gpu to check it.'); GL1 = true; webgl1Shim(gl); }
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, GL1 ? toGLSL100(s, t == gl.FRAGMENT_SHADER) : s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUv'); gl.bindAttribLocation(p, 2, 'aL'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p);
  PROG = { p, u: {} };
  for (const n of ['uBright', 'uSetC', 'uNightC', 'uTorch', 'uTM', 'uSP2', 'uFogT', 'uGrade', 'uRes', 'uSP', 'uShade', 'uWarm', 'uShaderF', 'uShader', 'uTime', 'uSunset', 'uPV', 'uM', 'uFrames', 'uFrame', 'uTex', 'uDay', 'uAlphaTest', 'uFogN', 'uFogF', 'uAlpha', 'uFull', 'uFog', 'uTint', 'uCam', 'uMinL']) PROG.u[n] = gl.getUniformLocation(p, n);
  gl.useProgram(p); gl.uniform1f(PROG.u.uMinL, .09);
  try { buildBiomeTiles(); } catch (e) { console.warn('biome tiles', e); }
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const k of ['particles', 'blocks', 'items', 'water', 'lava', 'sun', 'clouds', 'rain', 'snowfall', 'pig', 'cow', 'sheep', 'sheep_wool', 'steve', 'skin_steve', 'skin_alex', 'skin_ari', 'skin_efe', 'skin_kai', 'skin_makena', 'skin_noor', 'skin_sunny', 'skin_zuri', 'husk', 'drowned', 'stray', 'wither_skeleton', 'cave_spider', 'mooshroom_red', 'piglin', 'piglin_brute', 'bogged', 'enderman', 'slime', 'magmacube', 'ghast', 'ghast_shooting', 'zombified_piglin', 'wolf', 'wolf_tame', 'wolf_angry', 'zombie', 'skeleton', 'creeper', 'spider', 'spider_eyes', ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => 'moon' + i), ...[0, 1, 2, 3, 4, 5].map(i => 'panorama_' + i)])
    if (IMG[k]) TEXS[k] = mkTex(IMG[k], k == 'clouds' || k == 'rain' || k == 'snowfall', k.startsWith('panorama'));
  for (const k in IMG) if (k.startsWith('mob_') && IMG[k] && !TEXS[k]) TEXS[k] = mkTex(IMG[k]);
  const white = document.createElement('canvas'); white.width = white.height = 1; const wc = white.getContext('2d'); wc.fillStyle = '#fff'; wc.fillRect(0, 0, 1, 1); TEXS.white = mkTex(white);
}
// ---- old GPUs / browsers without WebGL2 (older Chromebooks, consoles, old phones) ----
let GL1 = false;
function toGLSL100(s, frag) {
  s = s.replace('#version 300 es\n', '').replace(/\btexture\(/g, 'texture2D(');
  if (frag) s = s.replace(/\bin\s+(vec|float)/g, 'varying $1').replace(/out vec4 o;\s*/, '').replace(/\bo\s*=/g, 'gl_FragColor =');
  else s = s.replace(/\bin\s+(vec|float)/g, 'attribute $1').replace(/\bout\s+(vec|float)/g, 'varying $1');
  return s;
}
function webgl1Shim(g) {
  const ext = g.getExtension('OES_vertex_array_object');
  if (ext) { g.createVertexArray = () => ext.createVertexArrayOES(); g.bindVertexArray = v => ext.bindVertexArrayOES(v); g.deleteVertexArray = v => ext.deleteVertexArrayOES(v); }
  else { // no VAO support at all: remember each "VAO"'s buffer + attribute layout and replay it on bind
    let cur = null; const vap = g.vertexAttribPointer.bind(g), bb = g.bindBuffer.bind(g);
    g.createVertexArray = () => ({ ptr: [], buf: null });
    g.bindBuffer = (t, b) => { if (cur && t == g.ARRAY_BUFFER) cur.buf = b; bb(t, b); };
    g.vertexAttribPointer = (...a) => { if (cur) cur.ptr[a[0]] = [a, cur.buf]; vap(...a); };
    g.bindVertexArray = v => { cur = v; if (v) for (const p of v.ptr) if (p) { bb(g.ARRAY_BUFFER, p[1]); g.enableVertexAttribArray(p[0][0]); vap(...p[0]); } };
    g.deleteVertexArray = () => { };
  }
}
const isPOT = n => (n & (n - 1)) == 0;
function mkTex(img, repeat, linear) {
  if (GL1 && repeat && !(isPOT(img.width) && isPOT(img.height))) { const c = document.createElement('canvas'); c.width = 1 << Math.ceil(Math.log2(img.width)); c.height = 1 << Math.ceil(Math.log2(img.height)); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height); img = c; }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  const f = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  return t;
}
// mesh: Float32Array of [x,y,z,u,v,shade,sky,block] * n
function mkMesh(arr, old) {
  const m = old || { vao: gl.createVertexArray(), buf: gl.createBuffer(), n: 0 };
  gl.bindVertexArray(m.vao); gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  if (!old) { gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20); }
  m.n = arr.length / 8; gl.bindVertexArray(null); return m;
}
function freeMesh(m) { if (!m) return; gl.deleteBuffer(m.buf); gl.deleteVertexArray(m.vao); }
const ID = M4.ident();
function drawMesh(m, tex, o = {}) {
  if (!m || !m.n) return; const u = PROG.u;
  gl.uniformMatrix4fv(u.uM, false, o.model || ID);
  gl.uniform1f(u.uFrames, o.frames || 1); gl.uniform1f(u.uFrame, o.frame || 0);
  gl.uniform1f(u.uAlphaTest, o.alphaTest ?? 0.5); gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uFull, o.full || 0);
  const t = o.tint || [0, 0, 0, 0]; gl.uniform4f(u.uTint, t[0], t[1], t[2], t[3]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TEXS[tex] || tex); gl.uniform1i(u.uTex, 0);
  gl.bindVertexArray(m.vao); gl.drawArrays(o.lines ? gl.LINES : gl.TRIANGLES, 0, m.n); gl.bindVertexArray(null);
}
// quad helper (4 corners ccw, uv rect) -> pushes 6 verts
function pushQuad(out, c, uv, L) {
  // c: [[x,y,z]*4], uv: [[u,v]*4], L: [[shade,sky,blk]*4] or single
  const ord = (L && L.length == 4 && (L[0][0] + L[2][0] < L[1][0] + L[3][0])) ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
  for (const i of ord) { const l = L.length == 4 ? L[i] : L; out.push(c[i][0], c[i][1], c[i][2], uv[i][0], uv[i][1], l[0], l[1], l[2]); }
}
function tileUV(t) { const c = REG.cols, r = REG.rows, x = t % c, y = Math.floor(t / c), e = 0.0004; return [x / c + e, y / r + e, (x + 1) / c - e, (y + 1) / r - e]; }
function itemUV(i) { const c = REG.icols, r = REG.irows, x = i % c, y = Math.floor(i / c), e = 0.0004; return [x / c + e, y / r + e, (x + 1) / c - e, (y + 1) / r - e]; }
