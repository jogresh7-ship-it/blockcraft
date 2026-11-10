'use strict';
// ---------- items that do things: effects, bows, throwables, shields, totems, potions, spyglass, fishing, fireworks, horns, compass/clock, climbing ----------
// ---- status effects (like Java: name -> { t: seconds left, a: amplifier 0 = level I }) ----
const EFF_NAMES = { speed: 'Speed', slowness: 'Slowness', haste: 'Haste', strength: 'Strength', instant_health: 'Instant Health', instant_damage: 'Instant Damage', jump_boost: 'Jump Boost', regeneration: 'Regeneration', resistance: 'Resistance', fire_resistance: 'Fire Resistance', water_breathing: 'Water Breathing', invisibility: 'Invisibility', night_vision: 'Night Vision', hunger: 'Hunger', weakness: 'Weakness', poison: 'Poison', wither: 'Wither', absorption: 'Absorption', saturation: 'Saturation', levitation: 'Levitation', slow_falling: 'Slow Falling', glowing: 'Glowing' };
const EFF_COL = { speed: '#7CAFC6', slowness: '#5A6C81', strength: '#932423', jump_boost: '#22FF4C', regeneration: '#CD5CAB', resistance: '#99453A', fire_resistance: '#E49A3A', water_breathing: '#2E5299', invisibility: '#7F8392', night_vision: '#1F1FA1', hunger: '#587653', weakness: '#484D48', poison: '#4E9331', wither: '#352A27', absorption: '#2552A5', saturation: '#F82423', levitation: '#CEFFFF', slow_falling: '#FFEFD1', haste: '#D9C043' };
function eff(n) { const e = player && player.eff && player.eff[n]; return e && e.t > 0 ? e : null; }
function addEff(n, sec, a = 0) {
  const P = player; P.eff = P.eff || {};
  if (n == 'instant_health') { P.hp = Math.min(20, P.hp + 4 * 2 ** a); return; }
  if (n == 'instant_damage') { hurtPlayer(6 * 2 ** a, 'was killed by magic', true); return; }
  if (n == 'saturation') { P.food = Math.min(20, P.food + (a + 1)); P.sat = Math.min(P.food, P.sat + 2 * (a + 1)); return; }
  const o = P.eff[n]; if (!o || o.a < a || (o.a == a && o.t < sec)) P.eff[n] = { t: sec, a, max: sec };
  if (n == 'absorption') P.abs = Math.max(P.abs || 0, 4 * (a + 1));
}
function clearEff(only) { const P = player; if (!P.eff) return; if (only) delete P.eff[only]; else { P.eff = {}; P.abs = 0; } }
function effTick(dt) {
  const P = player; if (!P || P.dead) return; P.eff = P.eff || {};
  for (const n in P.eff) { const e = P.eff[n]; e.t -= dt; if (e.t <= 0) { delete P.eff[n]; if (n == 'absorption') P.abs = 0; continue; }
    e.acc = (e.acc || 0) + dt;
    if (n == 'regeneration') { const iv = Math.max(.25, 2.5 / 2 ** e.a); if (e.acc >= iv) { e.acc = 0; if (P.hp < 20) P.hp = Math.min(20, P.hp + 1); } }
    if (n == 'poison') { const iv = Math.max(.25, 1.25 / 2 ** e.a); if (e.acc >= iv) { e.acc = 0; if (P.hp > 1) hurtPlayer(1, 'was poisoned', true); } }
    if (n == 'wither') { const iv = Math.max(.25, 2 / 2 ** e.a); if (e.acc >= iv) { e.acc = 0; hurtPlayer(1, 'withered away', true); } }
    if (n == 'hunger') P.exh += .1 * (e.a + 1) * dt * 20 * .05;
    if (n == 'levitation') { P.vy = .9 * (e.a + 1); P.fallStart = P.y; }
    if (n == 'slow_falling') { if (P.vy < -1.6) P.vy = -1.6; P.fallStart = P.y; }
    if (n == 'water_breathing') P.air = 300;
  }
  if (!eff('absorption')) P.abs = 0;
  // arrows you shot that are stuck: walk over them to pick them back up
  for (const a of arrows) if (a.byPlayer && a.stuck && a.pick && Math.hypot(a.x - P.x, a.y - P.y - .5, a.z - P.z) < 1.3) { a.life = 0; giveItem(itemKey('item:arrow'), 1); SND.play('pop', .3, 1.6); }
  if (P.cool) for (const k in P.cool) P.cool[k] -= dt;
}
const effSpeed = () => (1 + .2 * ((eff('speed')?.a ?? -1) + 1)) * (1 - .15 * ((eff('slowness')?.a ?? -1) + 1));
const effJump = () => 1 + .22 * ((eff('jump_boost')?.a ?? -1) + 1);
const effStrength = () => 3 * ((eff('strength')?.a ?? -1) + 1) - 4 * ((eff('weakness')?.a ?? -1) + 1);
// damage from the world goes through here first: fire resistance, resistance, absorption hearts, shield, totem
function effDamage(dmg, msg, src) {
  const P = player;
  if (eff('fire_resistance') && /lava|flames|fire|burn|floor was lava/.test(msg || '')) return 0;
  if (src && shieldBlocks(src)) return 0;
  const r = eff('resistance'); if (r) dmg *= Math.max(0, 1 - .2 * (r.a + 1));
  if (P.abs > 0) { const t = Math.min(P.abs, dmg); P.abs -= t; dmg -= t; }
  return dmg;
}
function tryTotem() { // called when the player would die
  const P = player; let slot = null;
  if (P.offhand && keyName(P.offhand.k) == 'totem_of_undying') slot = 'off'; else { const h = P.inv[P.sel]; if (h && keyName(h.k) == 'totem_of_undying') slot = P.sel; }
  if (slot === null) return false;
  if (slot == 'off') P.offhand = null; else P.inv[slot] = null;
  P.hp = 1; P.dead = false; clearEff(); addEff('regeneration', 45, 1); addEff('absorption', 5, 1); addEff('fire_resistance', 40, 0);
  SND.play('item/totem/use', 1); S.totemT = 2;
  for (let i = 0; i < 60; i++) spark('glitter', P.x + (Math.random() - .5), P.y + .2 + Math.random() * 1.8, P.z + (Math.random() - .5), { vy: 3 + Math.random() * 4, vx: (Math.random() - .5) * 6, vz: (Math.random() - .5) * 6, life: 1.5 });
  award && award('totem'); return true;
}
// ---- shield ----
function shieldHeld() { const P = player, h = P.inv[P.sel]; if (h && keyName(h.k) == 'shield') return 'main'; if (P.offhand && keyName(P.offhand.k) == 'shield') return 'off'; return null; }
function shieldBlocks(src) {
  const P = player; if (!(P.blocking > .25) || !src) return false;
  const dx = src[0] - P.x, dz = src[2] - P.z, d = Math.hypot(dx, dz) || 1, f = [-Math.sin(P.yaw), -Math.cos(P.yaw)];
  if ((dx * f[0] + dz * f[1]) / d < .2) return false; // only from the front
  SND.play('item/shield/block', 1, .9 + Math.random() * .2); const s = shieldHeld() == 'off' ? P.offhand : P.inv[P.sel]; if (s) wear(s, 1); return true;
}
// ---- food & drink effects (Java values) ----
const FOOD_EFF = {
  golden_apple: [['regeneration', 5, 1], ['absorption', 120, 0]], enchanted_golden_apple: [['regeneration', 20, 1], ['absorption', 120, 3], ['resistance', 300, 0], ['fire_resistance', 300, 0]],
  pufferfish: [['hunger', 15, 2], ['poison', 60, 1]], spider_eye: [['poison', 5, 0]], rotten_flesh: [['hunger', 30, 0, .8]], chicken: [['hunger', 30, 0, .3]], poisonous_potato: [['poison', 5, 0, .6]],
  suspicious_stew: [['regeneration', 8, 0]], golden_carrot: [], honey_bottle: [], glow_berries: [['glowing', 10, 0]],
};
const DRINKS = { milk_bucket: 1, honey_bottle: 1, potion: 1, ominous_bottle: 1 };
function afterEat(n) {
  for (const [e, s, a, p] of FOOD_EFF[n] || []) if (Math.random() < (p ?? 1)) addEff(e, s, a);
  if (n == 'chorus_fruit') { const P = player; for (let i = 0; i < 16; i++) { const x = Math.floor(P.x + (Math.random() - .5) * 16), z = Math.floor(P.z + (Math.random() - .5) * 16); for (let y = Math.min(WH - 2, Math.floor(P.y) + 8); y > Math.floor(P.y) - 8; y--) if (SOLID[world.get(x, y - 1, z)] && !SOLID[world.get(x, y, z)] && !SOLID[world.get(x, y + 1, z)]) { P.x = x + .5; P.y = y; P.z = z + .5; P.vx = P.vy = P.vz = 0; P.fallStart = y; SND.play('item/chorus_fruit/teleport1', 1); return; } } }
}
function afterDrink(n, h) {
  const P = player, back = k => { if (P.mode == 'survival') giveItem(itemKey(k), 1); }; // the eat code already used up the item
  if (n == 'milk_bucket') { clearEff(); P.wither = 0; back('item:bucket'); }
  if (n == 'honey_bottle') { clearEff('poison'); P.food = Math.min(20, P.food + 6); P.sat = Math.min(P.food, P.sat + 1.2); back('item:glass_bottle'); }
  if (n == 'potion') { addEff('regeneration', 45, 0); addEff('instant_health', 0, 0); back('item:glass_bottle'); }
  if (n == 'ominous_bottle') { chat('§5You feel an ominous presence...'); }
}
// ---- right-click items: returns true when the item handled the click ----
function launch(k, sp, o = {}) { const P = player, f = fwd(); arrows.push(Object.assign({ x: P.x + f[0] * .6, y: P.y + 1.45 + f[1] * .6, z: P.z + f[2] * .6, vx: f[0] * sp + P.vx * .3, vy: f[1] * sp + (P.ground ? 0 : P.vy * .3), vz: f[2] * sp + P.vz * .3, life: 20, byPlayer: true, k: itemKey(k), grav: 14 }, o)); }
function useSpecial(h, hit) {
  const P = player, n = keyName(h.k), one = () => { if (P.mode == 'survival') { h.c--; if (!h.c) P.inv[P.sel] = null; } };
  P.cool = P.cool || {};
  if (P.cool[n] > 0) return true;
  if (n == 'snowball' || n == 'egg') { one(); SND.play('random/bow', .5, .5); launch('item:' + n, 22, { onHit: (m, x, y, z) => { for (let i = 0; i < 6; i++) spark('generic', x, y, z, { life: .4 }); if (m) hurtMob(m, m.type == 'blaze' && n == 'snowball' ? 3 : 0.01, 0, 0); if (n == 'egg' && Math.random() < .125) spawnMob('chicken', x, y, z); } }); P.cool[n] = .25; return true; }
  if (n == 'ender_pearl') { one(); SND.play('random/bow', .5, .5); P.cool[n] = 1; launch('item:ender_pearl', 22, { onHit: (m, x, y, z) => { P.x = x; P.y = y + .1; P.z = z; P.vx = P.vy = P.vz = 0; hurtPlayer(5, 'fell from a high place', true); P.fallStart = P.y; SND.play('mob/endermen/portal', .8); for (let i = 0; i < 20; i++) spark('spell', x + (Math.random() - .5), y + Math.random() * 2, z + (Math.random() - .5)); if (Math.random() < .05) spawnMob('endermite', x, y, z); } }); return true; }
  if (n == 'wind_charge') { one(); P.cool[n] = .5; SND.play('entity/wind_charge/wind_burst1', .6); launch('item:wind_charge', 30, { grav: 0, onHit: (m, x, y, z) => windBurst(x, y, z) }); return true; }
  if (n == 'splash_potion' || n == 'lingering_potion') { one(); SND.play('random/bow', .5, .5); launch('item:' + n, 14, { onHit: (m, x, y, z) => { SND.play('random/glass1', 1); for (let i = 0; i < 30; i++) spark('effect', x + (Math.random() - .5) * 3, y + Math.random(), z + (Math.random() - .5) * 3); if (Math.hypot(x - P.x, y - P.y, z - P.z) < 4) { addEff('instant_health', 0, 0); addEff('regeneration', 20, 0); } for (const mm of mobs) if (Math.hypot(mm.x - x, mm.z - z) < 4 && MOBDEF[mm.type].hostile && /zombie|skeleton|wither|drowned|husk|stray|phantom|zoglin|piglin/.test(mm.type)) hurtMob(mm, 6, 0, 0); } }); return true; }
  if (n == 'trident') { one(); SND.play('item/trident/throw1', 1); launch('item:trident', 26, { grav: 10, onHit: (m, x, y, z) => { if (m) hurtMob(m, 8, 0, 0); SND.play('item/trident/hit_ground1', .8); dropItem(itemKey('item:trident'), 1, x, y + .2, z); } }); P.cool[n] = .8; return true; }
  if (n == 'fire_charge' && !hit) { one(); SND.play('mob/ghast/fireball4', .8); const f = fwd(); arrows.push({ x: P.x + f[0], y: P.y + 1.5, z: P.z + f[2], vx: f[0] * 14, vy: f[1] * 14, vz: f[2] * 14, life: 6, fire: 1, byPlayer: true }); return true; }
  if (n == 'firework_rocket') { if (P.glide) { one(); P.boostT = 1.6; SND.play('fireworks/launch1', .8); return true; } if (hit) { one(); const x = hit.x + .5 + hit.n[0], y = hit.y + hit.n[1] + .5, z = hit.z + .5 + hit.n[2]; SND.play('fireworks/launch1', 1, 1, [x, y, z]); rockets.push({ x, y, z, t: 1.4 }); return true; } return false; }
  if (n == 'goat_horn') { P.cool[n] = 7; SND.play('item/goat_horn/call' + (Math.random() * 8 | 0), 1.5); chat('§7*the goat horn sounds*'); return true; }
  if (n == 'experience_bottle') { one(); launch('item:experience_bottle', 14, { onHit: (m, x, y, z) => { SND.play('random/glass1', 1); P.xp = (P.xp || 0) + 3 + (Math.random() * 9 | 0); SND.play('random/orb', .5); } }); return true; }
  if (n == 'fishing_rod') { if (P.fish) { // reel in
      const f = P.fish; P.fish = null; SND.play('random/bow', .4, .6); if (f.bite > 0) { const r = Math.random(), k = r < .6 ? 'item:cod' : r < .85 ? 'item:salmon' : r < .87 ? 'item:pufferfish' : r < .9 ? 'item:tropical_fish' : r < .95 ? 'item:nautilus_shell' : 'item:name_tag'; giveItem(itemKey(k) || itemKey('item:cod'), 1); P.xp = (P.xp || 0) + 1 + (Math.random() * 6 | 0); SND.play('random/orb', .4); SND.play('random/splash', .5); } wear(h, 1); return true; }
    const f = fwd(); let bx = P.x, by = P.y + 1.5, bz = P.z; for (let t = 0; t < 14; t += .25) { const x = P.x + f[0] * t, y = P.y + 1.5 + f[1] * t - t * t * .02, z = P.z + f[2] * t; const b = world.get(Math.floor(x), Math.floor(y), Math.floor(z)); bx = x; by = y; bz = z; if (FLUID[b] == 1 || SOLID[b]) break; }
    const wet = FLUID[world.get(Math.floor(bx), Math.floor(by), Math.floor(bz))] == 1; P.fish = { x: bx, y: wet ? Math.floor(by) + .9 : by, z: bz, wet, wait: 5 + Math.random() * 20, bite: 0 }; SND.play('random/bow', .4, .5); return true; }
  return false;
}
let rockets = [];
function windBurst(x, y, z) {
  SND.play('entity/wind_charge/wind_burst' + (1 + (Math.random() * 3 | 0)), 1, 1, [x, y, z]); for (let i = 0; i < 16; i++) spark('gust', x + (Math.random() - .5) * 2, y + Math.random() * 2, z + (Math.random() - .5) * 2, { life: .5 });
  const P = player, d = Math.hypot(P.x - x, P.y + .9 - y, P.z - z); if (d < 2.6) { const k = (2.6 - d) / 2.6; P.vx += (P.x - x) / (d || 1) * 10 * k; P.vy = Math.max(P.vy, 11 * k + 4); P.vz += (P.z - z) / (d || 1) * 10 * k; P.ground = false; P.fallStart = P.y + 2; }
  for (const m of mobs) { const md = Math.hypot(m.x - x, m.y - y, m.z - z); if (md < 2.6) { m.vx += (m.x - x) / (md || 1) * 8; m.vy = 9; m.vz += (m.z - z) / (md || 1) * 8; hurtMob(m, 1, 0, 0); } }
}
// ---- held-down items: bow / crossbow charge, shield, spyglass ----
function holdTick(h, dt, down) {
  const P = player, n0 = h ? keyName(h.k) : '', n = n0 == 'crossbow_standby' ? 'crossbow' : n0;
  P.blocking = down && shieldHeld() && !/bow|crossbow|spyglass/.test(n) && !foodVal(h?.k) ? (P.blocking || 0) + dt : 0;
  P.spy = down && n == 'spyglass'; if (P.spy && !P.spyWas) SND.play('item/spyglass/use', .6); P.spyWas = P.spy;
  const ranged = n == 'bow' || n == 'crossbow';
  if (ranged && down) { const hasArrow = P.mode == 'creative' || P.inv.some(s => s && keyName(s.k) == 'arrow'); if (!hasArrow) { P.draw = 0; return true; }
    if (n == 'crossbow' && P.loaded) { P.loaded = false; fireArrow(1, h, 'crossbow'); P.cbWait = .3; return true; }
    if (P.cbWait > 0) { P.cbWait -= dt; return true; }
    P.draw = (P.draw || 0) + dt; if (n == 'crossbow' && P.draw >= 1.25 && !P.loaded) { P.loaded = true; P.draw = 0; takeArrow(); SND.play('item/crossbow/loading_end', .8); } return true; }
  if (ranged && !down && P.draw > 0) { const d = P.draw; P.draw = 0; if (n == 'bow' && d > .1) { const pw = Math.min(1, (d * d + d * 2) / 3); takeArrow(); fireArrow(pw, h, 'bow'); } }
  return ranged || n == 'spyglass' || (down && !!shieldHeld() && !foodVal(h?.k) && !(h && h.k < ITEM_BASE));
}
function takeArrow() { const P = player; if (P.mode == 'creative') return; const i = P.inv.findIndex(s => s && keyName(s.k) == 'arrow'); if (i >= 0) { P.inv[i].c--; if (!P.inv[i].c) P.inv[i] = null; } }
function fireArrow(pw, h, kind) {
  const crit = pw >= 1; launch('item:arrow', kind == 'crossbow' ? 50 : 50 * pw, { grav: 20, life: 30, pick: player.mode == 'survival', dmg: Math.ceil((kind == 'crossbow' ? 9 : 6 * pw) + (crit ? Math.random() * 3 : 0)) });
  SND.play(kind == 'crossbow' ? 'item/crossbow/shoot1' : 'random/bow', 1, 1 / (Math.random() * .4 + 1.2) + pw * .5); wear(h, 1); player.stats.shots = (player.stats.shots || 0) + 1;
}
// ---- fishing bobber, firework rockets ----
function fishTick(dt) {
  const P = player, f = P.fish; if (!f) return; const h = held();
  if (!h || keyName(h.k) != 'fishing_rod' || Math.hypot(f.x - P.x, f.z - P.z) > 30) { P.fish = null; return; }
  if (f.wet) { if (f.bite > 0) { f.bite -= dt; if (f.bite <= 0) f.wait = 5 + Math.random() * 20; } else if ((f.wait -= dt) <= 0) { f.bite = .9; SND.play('random/splash', .4, 1, [f.x, f.y, f.z]); for (let i = 0; i < 8; i++) spark('splash', f.x + (Math.random() - .5) * .6, f.y + .2, f.z + (Math.random() - .5) * .6); } }
}
function rocketTick(dt) {
  const P = player; if (P.boostT > 0) { P.boostT -= dt; if (P.glide) { const f = fwd(); P.vx += (f[0] * 30 - P.vx) * dt * 3; P.vy += (f[1] * 30 - P.vy) * dt * 3; P.vz += (f[2] * 30 - P.vz) * dt * 3; if (Math.random() < .5) spark('spark', P.x, P.y, P.z, { life: .6 }); } }
  for (const r of rockets) { r.t -= dt; r.y += 18 * dt; if (Math.random() < .6) spark('spark', r.x, r.y - .5, r.z, { life: .5 }); if (r.t <= 0) { SND.play('fireworks/blast1', 1.4, 1, [r.x, r.y, r.z]); SND.play('fireworks/twinkle1', .8, 1, [r.x, r.y, r.z]); for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, b = Math.acos(Math.random() * 2 - 1); spark('spark', r.x, r.y, r.z, { vx: Math.sin(b) * Math.cos(a) * 9, vy: Math.cos(b) * 9, vz: Math.sin(b) * Math.sin(a) * 9, life: 1.2 }); } } }
  rockets = rockets.filter(r => r.t > 0);
}
// ---- climbing: ladders, vines, scaffolding, twisting/weeping/cave vines ----
const CLIMB_RE = /^(ladder|vine|scaffolding|twisting_vines|twisting_vines_plant|weeping_vines|weeping_vines_plant|cave_vines|cave_vines_plant|cave_vines_lit|cave_vines_plant_lit)$/;
function climbTick(dt, active) {
  const P = player; if (P.fly || P.mode == 'spectator') { P.climbing = false; return; }
  const at = dy => BL[world.get(Math.floor(P.x), Math.floor(P.y + dy), Math.floor(P.z))]?.n || '';
  const c = CLIMB_RE.test(at(.2)) || CLIMB_RE.test(at(1.2)); P.climbing = c; if (!c) return;
  P.fallStart = P.y; const sneak = keys.ShiftLeft || keys.ShiftRight, moving = active && (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || TOUCH?.joy);
  if (active && keys.Space || (moving && P.hitH)) P.vy = 2.35; else if (sneak) { if (P.vy < 0) P.vy = 0; } else if (P.vy < -2.35) P.vy = -2.35;
  if (at(.2) == 'scaffolding' && sneak) P.vy = -2.35;
}
// ---- first-person poses for held items ----
function handPose() { const P = player, n0 = held() ? keyName(held().k) : '', n = n0 == 'crossbow_standby' ? 'crossbow' : n0;
  if ((n == 'bow') && P.draw > 0) { const d = Math.min(1, P.draw / 1); return { dx: -.25 - d * .05, dy: .1, dz: .15 + d * .1, ry: -.6, rz: .25 + Math.sin(performance.now() / 40) * d * .015 }; }
  if (n == 'crossbow' && (P.draw > 0 || P.loaded)) return { dx: -.3, dy: .05, dz: .05 - (P.loaded ? 0 : Math.min(1, P.draw / 1.25) * .1), ry: -.3, rz: 0 };
  if (P.blocking > 0 && shieldHeld() == 'main') return { dx: -.3, dy: .1, dz: .1, ry: .6, rz: 0 };
  if (n == 'spyglass' && P.spy) return { dx: -.5, dy: .3, dz: .5, ry: 0, rz: 0, hide: 1 };
  if (n == 'goat_horn' && P.cool?.goat_horn > 5.5) return { dx: -.35, dy: .25, dz: .2, ry: -.4, rz: .6 };
  if (DRINKS[n] && eatT > 0) return { dx: -.35, dy: .15 + Math.sin(eatT * 18) * .02, dz: .1, ry: -.5, rz: .5 };
  return null; }
// ---- HUD bits: effects, totem pop, spyglass, compass/clock read-outs ----
function drawItemHud() {
  const P = player; if (!P) return;
  if (P.spy) { const r = Math.min(UW, UH) * .42, cx = UW / 2, cy = UH / 2; cx2.save(); cx2.fillStyle = '#000'; cx2.beginPath(); cx2.rect(0, 0, UW, UH); cx2.arc(cx, cy, r, 0, 6.283, true); cx2.fill(); cx2.strokeStyle = 'rgba(60,40,20,.9)'; cx2.lineWidth = 4; cx2.beginPath(); cx2.arc(cx, cy, r, 0, 6.283); cx2.stroke(); cx2.restore(); }
  let y = 4; for (const n in P.eff || {}) { const e = P.eff[n]; const s = Math.ceil(e.t), lbl = (EFF_NAMES[n] || n) + (e.a ? ' ' + ['', 'II', 'III', 'IV', 'V', 'VI'][e.a] : '') + ' ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), w = textW(lbl) + 16;
    cx2.fillStyle = 'rgba(0,0,0,.45)'; cx2.fillRect(UW - w - 4, y, w, 12); cx2.fillStyle = EFF_COL[n] || '#fff'; cx2.fillRect(UW - w - 1, y + 3, 7, 7); text(lbl, UW - w + 10, y + 2, e.t < 10 && (performance.now() / 250 | 0) % 2 ? '#AAAAAA' : '#FFFFFF', false); y += 14; }
  if (P.abs > 0) { const hx = UW / 2 - 91, hy = UH - 39 - 10; for (let i = 0; i < Math.ceil(P.abs / 2); i++) { cx2.fillStyle = '#E8C400'; cx2.fillRect(hx + i * 8 + 1, hy, 7, 6); } }
  const h = held(), n = h ? keyName(h.k) : '';
  if (/^compass|^recovery_compass/.test(n) || n == 'compass') { const dirs = ['North', 'North-West', 'West', 'South-West', 'South', 'South-East', 'East', 'North-East'], d = dirs[Math.round(((P.yaw % 6.283) + 6.283) % 6.283 / (6.283 / 8)) % 8], sp = P.spawn || [0, 0, 0]; textC('§eFacing ' + d + ' §7- spawn ' + Math.round(Math.hypot(sp[0] - P.x, sp[2] - P.z)) + ' blocks away', UW / 2, UH - 70, '#FFFFFF'); }
  if (/^clock/.test(n)) { const t = (world.meta.time + 6000) % 24000, hh = Math.floor(t / 1000), mm = Math.floor(t % 1000 * .06); textC('§e' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (t >= 6000 && t < 18000 ? ' §7(day)' : ' §7(night)'), UW / 2, UH - 70, '#FFFFFF'); }
  if (P.fish && P.fish.bite > 0) textC('§b! Fish on the line - right-click !', UW / 2, UH / 2 + 18, '#FFFFFF');
  if (S.totemT > 0) { S.totemT -= 1 / 60; const k = 2 - S.totemT, sc = Math.min(1, k * 3) * (1 + Math.max(0, k - 1.2) * .5), a = Math.min(1, S.totemT * 2), sz = 96 * sc; cx2.globalAlpha = a; const key = itemKey('item:totem_of_undying'); if (key && typeof drawIcon == 'function') drawIcon(key, UW / 2 - sz / 2, UH / 2 - sz / 2 - Math.sin(k * 3) * 10, sz); cx2.globalAlpha = 1; }
}
function drawFishLine(view) { /* the bobber is drawn as a small particle */ const f = player.fish; if (f && Math.random() < .5) spark('generic', f.x, f.y + (f.bite > 0 ? -.15 : Math.sin(performance.now() / 300) * .05), f.z, { life: .12, vy: 0, vx: 0, vz: 0, g: 0 }); }
