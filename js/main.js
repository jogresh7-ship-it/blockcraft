'use strict';
let world = null, player = null, mobs = [], items = [], particles = [], toasts = [], tnts = [];
let glc, keys = {}, locked = false, noLock = false, lastT = performance.now(), fps = 0, fcount = 0, ftime = 0, hideHud = false, debug = false, shotReq = false;
const DT_TICK = 1 / 20;
// ---------------- world lifecycle ----------------
function findSpawn(w) {
  for (let r = 0; r < 400; r += 8) for (let a = 0; a < 8; a++) { const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r); const h = w.height(x, z); if (h.h > SEA + 1 && h.h < 100 && h.bio != 'desert') return [x + .5, h.h + 1, z + .5]; }
  return [.5, 90, .5];
}
function newPlayer(meta) {
  return { name: 'Player', x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, r: .3, h: 1.8, ground: false, fly: false, mode: meta.mode == 'hardcore' ? 'survival' : meta.mode,
    hp: 20, food: 20, sat: 5, exh: 0, air: 300, xp: 0, lvl: 0, inv: Array(36).fill(null), armor: [null, null, null, null], offhand: null, craft2: [null, null, null, null], sel: 0,
    stats: { time: 0, mined: 0, placed: 0, walk: 0, fly: 0, jumps: 0, kills: 0, dmg: 0, deaths: 0, crafted: 0, smelted: 0, eaten: 0 }, adv: {}, spawn: null, score: 0, hurtT: 0, regenT: 0, starveT: 0 };
}
function openWorld(meta, fresh) {
  S.loadTitle = fresh ? 'Generating world' : 'Loading world'; S.loadSub = 'Building terrain'; S.loadP = 0; go('loading');
  const data = meta.remote ? NET.joinData : store.get('world_' + meta.id, null);
  if (data && !data.ib) { // saves from before there were 1000+ blocks stored items as 1000 + n
    const fix = o => { if (!o || typeof o != 'object') return; if (Array.isArray(o)) { o.forEach(fix); return; } if (typeof o.k == 'number' && typeof o.c == 'number' && o.k >= 1000 && o.k < 4096) o.k += 3096; for (const v of Object.values(o)) if (v && typeof v == 'object') fix(v); };
    fix(data.player); fix(data.containers); data.ib = 4096;
  }
  meta.time = data?.time ?? 1000; meta.rain = data?.rain || false; meta.weatherT = data?.weatherT ?? 600;
  world = new World(Object.assign(meta, { edits: data?.edits || {}, dimEdits: data?.dimEdits, dim: data?.dim || 'overworld', state: data?.state || {}, containers: data?.containers || {} }));
  if (meta.flat) { const hh = world.height.bind(world); world.height = (x, z) => world.dim == 'nether' ? hh(x, z) : ({ h: 4, bio: 'plains' }); }
  if (meta.flat) { const g = world.generate.bind(world); world.generate = (cx, cz) => { if (world.dim == 'nether') return g(cx, cz); const d = new Uint16Array(CV); for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { d[lidx(x, 0, z)] = B('bedrock'); d[lidx(x, 1, z)] = B('dirt'); d[lidx(x, 2, z)] = B('dirt'); d[lidx(x, 3, z)] = B('grass_block'); } const c = { cx, cz, d, dirty: true, meshes: null }; const ed = world.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k]; world.chunks.set(cx + ',' + cz, c); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = world.chunk(cx + a, cz + b); if (n) n.dirty = true; } return c; }; }
  world.onSet = (x, y, z) => { fluidWake(x, y, z); if (!S.inFall) { S.inFall = 1; checkFall(x, y + 1, z); checkFall(x, y, z); S.inFall = 0; } };
  falling = [];
  player = Object.assign(newPlayer(meta), data?.player || {});
  window.player = player;
  if (!data?.player) { const sp = findSpawn(world); player.x = sp[0]; player.y = sp[1]; player.z = sp[2]; player.spawn = sp; player.needGround = true; if (player.mode == 'creative') { } }
  mobs = (data?.mobs || []).map(m => Object.assign(makeMob(m.type, m.x, m.y, m.z), m)); items = []; particles = []; tnts = [];
  meta.last = Date.now(); store.set('worlds', S.worlds);
  startLoad();
  SND.stopMusic(); chatLog.length = 0;
  if (fresh) S.afterLoad = () => { const k = meta.kit || PROFILE.kit; if (k && KITS[k] && player.mode != 'creative') giveKit(k); else if (k && KITS[k] && meta.kit) giveKit(k); if (meta.startNether) { delete meta.startNether; setTimeout(() => travel(), 300); } };
}
function startLoad() {
  S.loadQueue = []; const cx = Math.floor(player.x / 16), cz = Math.floor(player.z / 16), R = Math.min(opts.rd, 4);
  for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) S.loadQueue.push([cx + dx, cz + dz]);
  S.loadQueue.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz)); S.loadTotal = S.loadQueue.length;
}
function loadingTick() {
  const t0 = performance.now();
  while (S.loadQueue.length && performance.now() - t0 < 30) { const [x, z] = S.loadQueue.shift(); if (!world.chunk(x, z)) { const px = Math.floor((player ? player.x : 0) / 16), pz = Math.floor((player ? player.z : 0) / 16); naturalSpawn(world.generate(x, z, (x - px) ** 2 + (z - pz) ** 2 > 16)); } }
  S.loadP = 1 - S.loadQueue.length / S.loadTotal * 0.8; S.loadSub = S.loadQueue.length ? 'Building terrain' : 'Preparing spawn area';
  if (!S.loadQueue.length) {
    let pending = 0; const R = Math.min(opts.rd, 4), cx = Math.floor(player.x / 16), cz = Math.floor(player.z / 16);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const c = world.chunk(cx + dx, cz + dz); if (c && c.dirty) { if (performance.now() - t0 < 40) world.mesh(c); else pending++; } }
    S.loadP = 0.8 + 0.2 * (1 - pending / ((2 * R + 1) ** 2));
    if (!pending) {
      if (player.needGround) { player.y = world.topY(Math.floor(player.x), Math.floor(player.z)) + 1; player.needGround = false; player.spawn = [player.x, player.y, player.z]; }
      if (world.meta.mode == 'hardcore' && world.meta.dead) player.mode = 'spectator';
      if (S.afterLoad) { const f = S.afterLoad; S.afterLoad = null; f(); for (const c of world.chunks.values()) if (c.dirty) world.mesh(c); }
      go('game'); chat(TOUCH.on ? '§7Left thumb: move. Drag right side: look. §fTap§7 to place/use, §fhold§7 to break. §f...§7 = inventory' : '§7Press §fE§7 for inventory, §fT§7 to chat, §fF5§7 for third person'); modEmit('join'); if (world.meta.rain) SND.setRain(true);
    }
  }
}
function saveWorld() {
  if (!world || world.meta.remote) return true; // a friend's world is saved by the host
  const m = world.meta; m.last = Date.now();
  const data = { ib: 4096, player: Object.assign({}, player, { craft2: [null, null, null, null] }), time: m.time, rain: m.rain, weatherT: m.weatherT, dimEdits: m.dimEdits, dim: world.dim, state: m.state, containers: world.containers, mobs: mobs.slice(0, 60).map(o => ({ type: o.type, x: o.x, y: o.y, z: o.z, yaw: o.yaw, hp: o.hp, sheared: o.sheared, wool: o.wool })) };
  const ok = store.set('world_' + m.id, data);
  const meta = Object.assign({}, m); delete meta.edits; delete meta.containers; delete meta.dimEdits; delete meta.state;
  S.iconCache = {}; S.worlds = S.worlds.map(w => w.id == m.id ? meta : w); store.set('worlds', S.worlds);
  if (!ok) chat('§cCould not save: browser storage is full or unavailable');
  return ok;
}
function captureIcon() {
  try { const c = document.createElement('canvas'); c.width = c.height = 64; const s = Math.min(glc.width, glc.height); c.getContext('2d').drawImage(glc, (glc.width - s) / 2, (glc.height - s) / 2, s, s, 0, 0, 64, 64); world.meta.icon = c.toDataURL('image/jpeg', .8); } catch (e) { }
}
function quitWorld() {
  netStop(); NET.server = null; NET.bot = false;
  if (S.screen != 'death') { render(0); captureIcon(); }
  saveWorld(); SND.setRain(false); SND.stopMusic();
  for (const c of world.chunks.values()) if (c.meshes) c.meshes.forEach(freeMesh);
  world = null; player = null; window.player = null; mobs = []; items = []; go('title');
}
function respawn() {
  player.stats.deaths++;
  const sp = player.spawn || findSpawn(world); Object.assign(player, { x: sp[0], y: sp[1], z: sp[2], vx: 0, vy: 0, vz: 0, hp: 20, food: 20, sat: 5, air: 300, dead: false, fallStart: null, xp: 0, lvl: 0, score: 0 });
}
// ---------------- entities ----------------
const MOBDEF = {
  pig: { tex: 'pig', w: .9, h: .9, hp: 10, drop: [['item:porkchop', 1, 3]], sound: 'mob/pig/say', step: 'mob/pig/step', death: 'mob/pig/death', hurt: 'mob/pig/say',
    parts: [{ box: [10, 16, 8], uv: [28, 8], pos: [0, 10, 0], rot: [Math.PI / 2, 0, 0] }, { box: [8, 8, 8], uv: [0, 0], pos: [0, 12, -11], head: 1 }, { box: [4, 3, 1], uv: [16, 16], pos: [0, 10.5, -15.5], head: 1, hp: [0, 12, -11] },
      ...[[-3, -5, 0], [3, -5, 1], [-3, 7, 1], [3, 7, 0]].map(([x, z, ph]) => ({ box: [4, 6, 4], uv: [0, 16], pos: [x, 3, z], pivot: [x, 6, z], leg: ph }))] },
  cow: { tex: 'cow', w: .9, h: 1.4, hp: 10, drop: [['item:beef', 1, 3], ['item:leather', 0, 2]], sound: 'mob/cow/say', step: 'mob/cow/step', hurt: 'mob/cow/hurt', death: 'mob/cow/hurt',
    parts: [{ box: [12, 18, 10], uv: [18, 4], pos: [0, 17, 1], rot: [Math.PI / 2, 0, 0] }, { box: [8, 8, 6], uv: [0, 0], pos: [0, 20, -10], head: 1 },
      { box: [1, 3, 1], uv: [22, 0], pos: [-4.5, 24.5, -11], head: 1, hp: [0, 20, -10] }, { box: [1, 3, 1], uv: [22, 0], pos: [4.5, 24.5, -11], head: 1, hp: [0, 20, -10] }, { box: [6, 3, 1], uv: [1, 33], pos: [0, 17.5, -13.5], head: 1, hp: [0, 20, -10] },
      ...[[-4, -6, 0], [4, -6, 1], [-4, 7, 1], [4, 7, 0]].map(([x, z, ph]) => ({ box: [4, 12, 4], uv: [0, 16], pos: [x, 6, z], pivot: [x, 12, z], leg: ph }))] },
  sheep: { tex: 'sheep', w: .9, h: 1.3, hp: 8, drop: [['item:mutton', 1, 2], ['white_wool', 1, 1, 'wool']], sound: 'mob/sheep/say', step: 'mob/sheep/step', hurt: 'mob/sheep/say', death: 'mob/sheep/say',
    parts: [{ box: [8, 16, 6], uv: [28, 8], pos: [0, 16, 0], rot: [Math.PI / 2, 0, 0] }, { box: [6, 6, 8], uv: [0, 0], pos: [0, 20, -10], head: 1 },
      ...[[-3, -5, 0], [3, -5, 1], [-3, 7, 1], [3, 7, 0]].map(([x, z, ph]) => ({ box: [4, 12, 4], uv: [0, 16], pos: [x, 6, z], pivot: [x, 12, z], leg: ph })),
      { box: [8, 16, 6], uv: [28, 8], pos: [0, 16, 0], rot: [Math.PI / 2, 0, 0], inf: 1.75, tex: 'sheep_wool', wool: 1 }, { box: [6, 6, 6], uv: [0, 0], pos: [0, 20.5, -9], inf: .6, tex: 'sheep_wool', wool: 1, head: 1 }] },
};
// humanoid (Java model layout). wide = 64x64 skin with separate left limbs + hat layer
const HUM = (limb, armFwd, wide) => [{ box: [8, 8, 8], uv: [0, 0], pos: [0, 28, 0], pivot: [0, 24, 0], head: 1 }, { box: [8, 12, 4], uv: [16, 16], pos: [0, 18, 0] },
  { box: [limb, 12, limb], uv: [40, 16], pos: [-4 - limb / 2, 18, 0], pivot: [-4 - limb / 2, 22, 0], arm: 0, fwd: armFwd, hand: 1 }, { box: [limb, 12, limb], uv: wide ? [32, 48] : [40, 16], pos: [4 + limb / 2, 18, 0], pivot: [4 + limb / 2, 22, 0], arm: 1, fwd: armFwd },
  { box: [limb, 12, limb], uv: [0, 16], pos: [-2, 6, 0], pivot: [-2, 12, 0], leg: 0 }, { box: [limb, 12, limb], uv: wide ? [16, 48] : [0, 16], pos: [2, 6, 0], pivot: [2, 12, 0], leg: 1 },
  ...(wide ? [{ box: [8, 8, 8], uv: [32, 0], pos: [0, 28, 0], pivot: [0, 24, 0], head: 1, inf: .5 }] : [])];
Object.assign(MOBDEF, {
  zombie: { tex: 'zombie', w: .6, h: 1.95, hp: 20, hostile: 1, speed: 1.6, dmg: [0, 2, 3, 4], burns: 1, drop: [['item:rotten_flesh', 0, 2]], sound: 'mob/zombie/say', step: 'mob/zombie/step', hurt: 'mob/zombie/hurt', death: 'mob/zombie/death', parts: HUM(4, true, true) },
  skeleton: { tex: 'skeleton', w: .6, h: 1.99, hp: 20, hostile: 1, speed: 1.7, ranged: 1, dmg: [0, 2, 3, 4], burns: 1, drop: [['item:bone', 0, 2], ['item:arrow', 0, 2]], sound: 'mob/skeleton/say', step: 'mob/skeleton/step', hurt: 'mob/skeleton/hurt', death: 'mob/skeleton/death', parts: HUM(2, false), hold: 'item:bow' },
  creeper: { tex: 'creeper', w: .6, h: 1.7, hp: 20, hostile: 1, speed: 1.7, creeper: 1, drop: [['item:gunpowder', 0, 2]], sound: null, step: 'step/grass', hurt: 'mob/creeper/say', death: 'mob/creeper/death',
    parts: [{ box: [8, 8, 8], uv: [0, 0], pos: [0, 22, 0], pivot: [0, 18, 0], head: 1 }, { box: [8, 12, 4], uv: [16, 16], pos: [0, 12, 0] },
      ...[[-2, -4, 0], [2, -4, 1], [-2, 4, 1], [2, 4, 0]].map(([x, z, ph]) => ({ box: [4, 6, 4], uv: [0, 16], pos: [x, 3, z], pivot: [x, 6, z], leg: ph }))] },
  spider: { tex: 'spider', w: 1.4, h: .9, hp: 16, hostile: 1, speed: 2.4, dmg: [0, 2, 2, 3], nightOnly: 1, climbs: 1, drop: [['item:string', 0, 2], ['item:spider_eye', 0, 1]], sound: 'mob/spider/say', step: 'mob/spider/step', hurt: 'mob/spider/say', death: 'mob/spider/death',
    parts: [{ box: [6, 6, 6], uv: [0, 0], pos: [0, 9, 0] }, { box: [10, 8, 12], uv: [0, 12], pos: [0, 9, 9] }, { box: [8, 8, 8], uv: [32, 4], pos: [0, 9, -7], pivot: [0, 9, -3], head: 1 },
      { box: [8, 8, 8], uv: [32, 4], pos: [0, 9, -7.01], pivot: [0, 9, -3], head: 1, tex: 'spider_eyes', inf: .05, glow: 1 },
      ...[-1, 0, 1, 2].flatMap((zi, i) => [-1, 1].map(sd => ({ box: [16, 2, 2], uv: [18, 0], pos: [sd * 11, 9, zi * 1.5 - .5], pivot: [sd * 3, 9, zi * 1.5 - .5], rz: -sd * .7, ry: -sd * (.6 - i * .4), sleg: (i + (sd > 0 ? 1 : 0)) % 2 })))] },
});
Object.assign(MOBDEF, {
  enderman: { tex: 'enderman', w: .6, h: 2.9, hp: 40, hostile: 1, neutral: 1, speed: 2.6, dmg: [0, 4, 7, 10], drop: [['item:ender_pearl', 0, 1]], sound: 'mob/endermen/idle', step: 'step/stone', hurt: 'mob/endermen/hit', death: 'mob/endermen/death', teleport: 1,
    parts: [{ box: [8, 8, 8], uv: [0, 0], pos: [0, 46, 0], pivot: [0, 42, 0], head: 1 }, { box: [8, 12, 4], uv: [32, 16], pos: [0, 36, 0] },
      { box: [2, 30, 2], uv: [56, 0], pos: [-5, 27, 0], pivot: [-5, 41, 0], arm: 0 }, { box: [2, 30, 2], uv: [56, 0], pos: [5, 27, 0], pivot: [5, 41, 0], arm: 1 },
      { box: [2, 30, 2], uv: [56, 0], pos: [-2, 15, 0], pivot: [-2, 30, 0], leg: 0 }, { box: [2, 30, 2], uv: [56, 0], pos: [2, 15, 0], pivot: [2, 30, 0], leg: 1 }] },
  slime: { tex: 'slime', w: .52, h: .52, hp: 4, hostile: 1, speed: 1.8, dmg: [0, 2, 3, 4], slime: 1, drop: [['item:slime_ball', 0, 2]], sound: null, step: 'mob/slime/small', hurt: 'mob/slime/small', death: 'mob/slime/small',
    parts: [{ box: [6, 6, 6], uv: [0, 16], pos: [0, 4, 0] }, { box: [2, 2, 2], uv: [32, 0], pos: [-1.5, 5.5, -3] }, { box: [2, 2, 2], uv: [32, 4], pos: [1.5, 5.5, -3] }, { box: [1, 1, 1], uv: [32, 8], pos: [0, 3, -3] }, { box: [8, 8, 8], uv: [0, 0], pos: [0, 4, 0], trans: 1 }] },
  wolf: { tex: 'wolf', w: .6, h: .85, hp: 8, neutral: 1, hostile: 0, speed: 2, dmg: [2, 3, 4, 5], drop: [], sound: 'mob/wolf/bark', step: 'mob/wolf/step', hurt: 'mob/wolf/hurt', death: 'mob/wolf/death', wolf: 1,
    parts: [{ box: [6, 6, 4], uv: [0, 0], pos: [0, 10.5, -7], pivot: [0, 10.5, -5], head: 1 }, { box: [3, 3, 4], uv: [0, 10], pos: [0, 9, -10], pivot: [0, 10.5, -5], head: 1 },
      { box: [2, 2, 1], uv: [16, 14], pos: [-2, 14.5, -6.5], pivot: [0, 10.5, -5], head: 1 }, { box: [2, 2, 1], uv: [16, 14], pos: [2, 14.5, -6.5], pivot: [0, 10.5, -5], head: 1 },
      { box: [6, 9, 6], uv: [18, 14], pos: [0, 10, 4.5], rot: [Math.PI / 2, 0, 0] }, { box: [8, 6, 7], uv: [21, 0], pos: [0, 10.5, -3], rot: [Math.PI / 2, 0, 0] },
      { box: [2, 8, 2], uv: [9, 18], pos: [0, 8, 9], pivot: [0, 12, 8], tail: 1 },
      ...[[-1.5, 7, 0], [1.5, 7, 1], [-1.5, -4, 1], [1.5, -4, 0]].map(([x, z, ph]) => ({ box: [2, 8, 2], uv: [0, 18], pos: [x, 4, z], pivot: [x, 8, z], leg: ph }))] },
  zombified_piglin: { tex: 'zombified_piglin', w: .6, h: 1.95, hp: 20, hostile: 1, neutral: 1, speed: 2, dmg: [0, 5, 8, 12], drop: [['item:rotten_flesh', 0, 1], ['item:gold_nugget', 0, 1]], sound: 'mob/zombiepig/zpig', step: 'mob/zombie/step', hurt: 'mob/zombiepig/zpighurt', death: 'mob/zombiepig/zpigdeath',
    parts: (() => { const p = HUM(4, false, true); p[0] = { box: [10, 8, 8], uv: [0, 0], pos: [0, 28, 0], pivot: [0, 24, 0], head: 1 }; p.pop(); return p; })(), hold: 'item:golden_sword' },
  ghast: { tex: 'ghast', w: 4, h: 4, hp: 10, hostile: 1, fly: 1, scale: 4.5 / 1.6, speed: 1, ghast: 1, drop: [['item:ghast_tear', 0, 1], ['item:gunpowder', 0, 2]], sound: 'mob/ghast/moan', step: null, hurt: 'mob/ghast/scream', death: 'mob/ghast/death',
    parts: [{ box: [16, 16, 16], uv: [0, 0], pos: [0, 14, 0] }, ...[...Array(9)].map((_, i) => { const L = 7 + (i * 5) % 7; return { box: [2, L, 2], uv: [0, 0], pos: [(i % 3 - 1) * 5 - (i % 3 - 1) * .5, 6 - L / 2, (Math.floor(i / 3) - 1) * 5], pivot: [(i % 3 - 1) * 5, 6, (Math.floor(i / 3) - 1) * 5], tent: i }; })] },
});
// texture variants sharing a model
for (const [n, base, tex, ext] of [['husk', 'zombie', 'husk', { burns: 0 }], ['drowned', 'zombie', 'drowned', {}], ['stray', 'skeleton', 'stray', {}], ['wither_skeleton', 'skeleton', 'wither_skeleton', { hold: 'item:stone_sword', ranged: 0, dmg: [0, 5, 8, 11], scale: 1.2, burns: 0, drop: [['item:coal', 0, 1], ['item:bone', 0, 2]] }], ['bogged', 'skeleton', 'bogged', {}],
  ['cave_spider', 'spider', 'cave_spider', { scale: .7, hp: 12 }], ['mooshroom', 'cow', 'mooshroom_red', {}], ['piglin', 'zombified_piglin', 'piglin', { neutral: 1, drop: [['item:gold_ingot', 0, 1]] }], ['piglin_brute', 'zombified_piglin', 'piglin_brute', { neutral: 0, hostile: 1, dmg: [0, 7, 13, 19] }]])
  MOBDEF[n] = Object.assign({}, MOBDEF[base], { tex }, ext, { parts: MOBDEF[base].parts.map(p => Object.assign({}, p, p.tex ? {} : {})) });
// ---- more mobs (Java model layouts) ----
{
  const P2 = Math.PI / 2, LEGS = (box, uv, xs, zs, y, uvB) => xs.flatMap(x => zs.map((z, j) => ({ box, uv: j && uvB ? uvB : uv, pos: [x, y, z], pivot: [x, y + box[1] / 2, z], leg: (xs.indexOf(x) + j) % 2 })));
  const VHEAD = (y = 29) => [{ box: [8, 10, 8], uv: [0, 0], pos: [0, y, 0], pivot: [0, y - 5, 0], head: 1 }, { box: [2, 4, 2], uv: [24, 0], pos: [0, y - 3, -5], head: 1, hp: [0, y - 5, 0] }];
  const VILL = () => [...VHEAD(), { box: [8, 12, 6], uv: [16, 20], pos: [0, 18, 0] }, { box: [8, 18, 6], uv: [0, 38], pos: [0, 15, 0], inf: .5 },
    { box: [8, 4, 4], uv: [40, 38], pos: [0, 19, -4] }, { box: [4, 8, 4], uv: [44, 22], pos: [-6, 20, -2] }, { box: [4, 8, 4], uv: [44, 22], pos: [6, 20, -2] },
    { box: [4, 12, 4], uv: [0, 22], pos: [-2, 6, 0], pivot: [-2, 12, 0], leg: 0 }, { box: [4, 12, 4], uv: [0, 22], pos: [2, 6, 0], pivot: [2, 12, 0], leg: 1 }];
  const ILL = () => [...VHEAD(), { box: [8, 12, 6], uv: [16, 20], pos: [0, 18, 0] },
    { box: [4, 12, 4], uv: [40, 46], pos: [-6, 18, 0], pivot: [-6, 22, 0], arm: 0, hand: 1 }, { box: [4, 12, 4], uv: [40, 46], pos: [6, 18, 0], pivot: [6, 22, 0], arm: 1 },
    { box: [4, 12, 4], uv: [0, 22], pos: [-2, 6, 0], pivot: [-2, 12, 0], leg: 0 }, { box: [4, 12, 4], uv: [0, 22], pos: [2, 6, 0], pivot: [2, 12, 0], leg: 1 }];
  const snd = (base, say = 'idle', hurt = 'hit', death = 'death') => ({ sound: base + say, hurt: base + hurt, death: base + death });
  const HORSE = () => [{ box: [10, 10, 22], uv: [0, 32], pos: [0, 16, 0] }, { box: [4, 12, 7], uv: [0, 35], pos: [0, 24, -10], pivot: [0, 20, -9], head: 1 },
    { box: [5, 5, 7], uv: [0, 13], pos: [0, 29, -14], head: 1, hp: [0, 20, -9] }, { box: [2, 3, 1], uv: [19, 16], pos: [-1.5, 33, -11.5], head: 1, hp: [0, 20, -9] }, { box: [2, 3, 1], uv: [19, 16], pos: [1.5, 33, -11.5], head: 1, hp: [0, 20, -9] },
    { box: [3, 14, 4], uv: [42, 36], pos: [0, 13, 12.5], pivot: [0, 20, 11], tail: 1 }, ...LEGS([4, 11, 4], [48, 21], [-3, 3], [-8, 8], 5.5)];
  Object.assign(MOBDEF, {
    chicken: { tex: 'mob_chicken', w: .4, h: .7, hp: 4, speed: 1, drop: [['item:chicken', 1, 1], ['item:feather', 0, 2]], ...snd('mob/chicken/', 'say', 'hurt', 'hurt'), step: 'mob/chicken/step', chicken: 1,
      parts: [{ box: [4, 6, 3], uv: [0, 0], pos: [0, 12, -4], pivot: [0, 9, -4], head: 1 }, { box: [4, 2, 2], uv: [14, 0], pos: [0, 12.5, -6.5], head: 1, hp: [0, 9, -4] }, { box: [2, 2, 2], uv: [14, 4], pos: [0, 10, -6], head: 1, hp: [0, 9, -4] },
        { box: [6, 8, 6], uv: [0, 9], pos: [0, 8, 0], rot: [P2, 0, 0] }, { box: [1, 4, 6], uv: [24, 13], pos: [-3.5, 9, 0] }, { box: [1, 4, 6], uv: [24, 13], pos: [3.5, 9, 0] },
        { box: [3, 5, 3], uv: [26, 0], pos: [-1.5, 2.5, 1], pivot: [-1.5, 5, 1], leg: 0 }, { box: [3, 5, 3], uv: [26, 0], pos: [1.5, 2.5, 1], pivot: [1.5, 5, 1], leg: 1 }] },
    villager: { tex: 'mob_villager', w: .6, h: 1.95, hp: 20, speed: 1, drop: [], ...snd('mob/villager/'), step: 'step/grass', parts: VILL() },
    wandering_trader: { tex: 'mob_wandering_trader', w: .6, h: 1.95, hp: 20, speed: 1, drop: [], ...snd('mob/wandering_trader/', 'idle', 'hurt', 'death'), step: 'step/grass', parts: VILL() },
    witch: { tex: 'mob_witch', w: .6, h: 1.95, hp: 26, hostile: 1, ranged: 1, speed: 1.4, dmg: [0, 2, 3, 4], drop: [['item:glass_bottle', 0, 2], ['item:redstone', 0, 2], ['item:glowstone_dust', 0, 2], ['item:sugar', 0, 2]], ...snd('mob/witch/', 'ambient', 'hurt', 'death'), step: 'step/grass',
      parts: [...VILL(), { box: [10, 2, 10], uv: [0, 64], pos: [0, 34.5, 0], head: 1, hp: [0, 24, 0] }, { box: [7, 4, 7], uv: [0, 76], pos: [0, 37.5, .5], head: 1, hp: [0, 24, 0] }, { box: [4, 4, 4], uv: [0, 87], pos: [0, 41, 1.5], head: 1, hp: [0, 24, 0] }] },
    zombie_villager: { tex: 'mob_zombie_villager', w: .6, h: 1.95, hp: 20, hostile: 1, speed: 1.6, dmg: [0, 2, 3, 4], burns: 1, drop: [['item:rotten_flesh', 0, 2]], ...snd('mob/zombie_villager/', 'say', 'hurt', 'death'), step: 'mob/zombie/step',
      parts: [...VHEAD(), { box: [8, 12, 4], uv: [16, 20], pos: [0, 18, 0] }, { box: [4, 12, 4], uv: [44, 22], pos: [-6, 18, 0], pivot: [-6, 22, 0], arm: 0, fwd: true, hand: 1 }, { box: [4, 12, 4], uv: [44, 22], pos: [6, 18, 0], pivot: [6, 22, 0], arm: 1, fwd: true },
        { box: [4, 12, 4], uv: [0, 22], pos: [-2, 6, 0], pivot: [-2, 12, 0], leg: 0 }, { box: [4, 12, 4], uv: [0, 22], pos: [2, 6, 0], pivot: [2, 12, 0], leg: 1 }] },
    pillager: { tex: 'mob_pillager', w: .6, h: 1.95, hp: 24, hostile: 1, ranged: 1, speed: 1.6, dmg: [0, 3, 4, 5], drop: [['item:arrow', 0, 2]], ...snd('mob/pillager/', 'idle', 'hurt', 'death'), step: 'step/grass', parts: ILL(), hold: 'item:crossbow_standby' },
    vindicator: { tex: 'mob_vindicator', w: .6, h: 1.95, hp: 24, hostile: 1, speed: 1.8, dmg: [0, 7, 13, 19], drop: [['item:emerald', 0, 1]], ...snd('mob/vindication_illager/', 'idle', 'hurt', 'death'), step: 'step/grass', parts: ILL(), hold: 'item:iron_axe' },
    evoker: { tex: 'mob_evoker', w: .6, h: 1.95, hp: 24, hostile: 1, speed: 1.6, dmg: [0, 3, 6, 9], drop: [['item:totem_of_undying', 1, 1], ['item:emerald', 0, 1]], ...snd('mob/evocation_illager/', 'idle', 'hurt', 'death'), step: 'step/grass', parts: ILL() },
    iron_golem: { tex: 'mob_iron_golem', w: 1.4, h: 2.7, hp: 100, neutral: 1, speed: 1, dmg: [7, 11, 21, 31], drop: [['item:iron_ingot', 3, 5], ['poppy', 0, 2]], ...snd('mob/irongolem/', 'hit', 'hit', 'death'), step: 'mob/irongolem/walk',
      parts: [{ box: [8, 10, 8], uv: [0, 0], pos: [0, 38, -3], pivot: [0, 33, -2], head: 1 }, { box: [2, 4, 2], uv: [24, 0], pos: [0, 35, -8], head: 1, hp: [0, 33, -2] },
        { box: [18, 12, 11], uv: [0, 40], pos: [0, 27, 0] }, { box: [9, 5, 6], uv: [0, 70], pos: [0, 18.5, 0] },
        { box: [4, 30, 6], uv: [60, 21], pos: [-11, 18, 0], pivot: [-11, 32, 0], arm: 0 }, { box: [4, 30, 6], uv: [60, 58], pos: [11, 18, 0], pivot: [11, 32, 0], arm: 1 },
        { box: [6, 16, 5], uv: [37, 0], pos: [-4, 8, 0], pivot: [-4, 16, 0], leg: 0 }, { box: [6, 16, 5], uv: [60, 0], pos: [5, 8, 0], pivot: [5, 16, 0], leg: 1 }] },
    snow_golem: { tex: 'mob_snow_golem', w: .7, h: 1.9, hp: 4, speed: 1, drop: [['item:snowball', 0, 15]], ...snd('mob/snowgolem/', 'ambient', 'hurt', 'death'), step: 'step/snow',
      parts: [{ box: [8, 8, 8], uv: [0, 0], pos: [0, 25, 0], pivot: [0, 21, 0], head: 1 }, { box: [10, 10, 10], uv: [0, 16], pos: [0, 16, 0] }, { box: [12, 12, 12], uv: [0, 36], pos: [0, 6, 0] },
        { box: [12, 2, 2], uv: [32, 0], pos: [-10, 19, 0] }, { box: [12, 2, 2], uv: [32, 0], pos: [10, 19, 0] }] },
    blaze: { tex: 'mob_blaze', w: .6, h: 1.8, hp: 20, hostile: 1, fly: 1, ranged: 1, speed: 1.4, dmg: [0, 4, 6, 9], drop: [['item:blaze_rod', 0, 1]], ...snd('mob/blaze/', 'breathe', 'hit', 'death'), step: null,
      parts: [{ box: [8, 8, 8], uv: [0, 0], pos: [0, 24, 0], pivot: [0, 20, 0], head: 1 }, ...[[9, 17], [7, 10], [5, 3]].flatMap(([r, y], ring) => [0, 1, 2, 3].map(i => { const a = (i + ring * .5) * P2; return { box: [2, 8, 2], uv: [0, 16], pos: [Math.cos(a) * r, y, Math.sin(a) * r], tent: i + ring * 4 }; }))] },
    squid: { tex: 'mob_squid', w: .8, h: 1.2, hp: 10, speed: .6, drop: [['item:ink_sac', 1, 3]], ...snd('mob/squid/', 'ambient', 'hurt', 'death'), step: null,
      parts: [{ box: [12, 16, 12], uv: [0, 0], pos: [0, 20, 0] }, ...[...Array(8)].map((_, i) => { const a = i / 8 * 6.283; return { box: [2, 18, 2], uv: [48, 0], pos: [Math.cos(a) * 5, 3, Math.sin(a) * 5], pivot: [Math.cos(a) * 5, 12, Math.sin(a) * 5], tent: i }; })] },
    horse: { tex: 'mob_horse', w: 1.4, h: 1.6, hp: 22, speed: 1.6, drop: [['item:leather', 0, 2]], ...snd('mob/horse/', 'idle', 'hit', 'death'), step: 'mob/horse/soft', parts: HORSE() },
    polar_bear: { tex: 'mob_polar_bear', w: 1.4, h: 1.4, hp: 30, neutral: 1, speed: 1.4, dmg: [4, 4, 6, 9], drop: [['item:cod', 0, 2]], ...snd('mob/polarbear/', 'idle', 'hurt', 'death'), step: 'mob/polarbear/step',
      parts: [{ box: [14, 14, 11], uv: [0, 19], pos: [0, 14, 2], rot: [P2, 0, 0] }, { box: [7, 7, 7], uv: [0, 0], pos: [0, 16, -12], pivot: [0, 16, -9], head: 1 }, ...LEGS([4, 10, 8], [50, 22], [-4.5, 4.5], [-6, 8], 5, [50, 40])] },
    hoglin: { tex: 'mob_hoglin', w: 1.4, h: 1.4, hp: 40, hostile: 1, speed: 1.6, dmg: [0, 3, 6, 9], drop: [['item:porkchop', 2, 4], ['item:leather', 0, 1]], ...snd('mob/hoglin/', 'ambient', 'hurt', 'death'), step: 'mob/hoglin/step',
      parts: [{ box: [16, 14, 26], uv: [1, 1], pos: [0, 17, 0] }, { box: [14, 6, 19], uv: [61, 1], pos: [0, 14, -16], pivot: [0, 16, -8], head: 1 }, ...LEGS([6, 14, 6], [66, 42], [-4, 4], [-8, 9], 7, [41, 42])] },
    silverfish: { tex: 'mob_silverfish', w: .4, h: .3, hp: 8, hostile: 1, speed: 1.6, dmg: [0, 1, 1, 1], drop: [], ...snd('mob/silverfish/', 'say', 'hit', 'kill'), step: 'mob/silverfish/step',
      parts: [{ box: [3, 2, 2], uv: [0, 0], pos: [0, 1, -3.5] }, { box: [4, 3, 2], uv: [0, 4], pos: [0, 1.5, -1.5] }, { box: [6, 4, 3], uv: [0, 9], pos: [0, 2, 1] }, { box: [3, 3, 3], uv: [0, 16], pos: [0, 1.5, 4] }, { box: [2, 2, 3], uv: [0, 22], pos: [0, 1, 7] }] },
    endermite: { tex: 'mob_endermite', w: .4, h: .3, hp: 8, hostile: 1, speed: 1.6, dmg: [0, 2, 2, 2], drop: [], ...snd('mob/endermite/', 'say', 'hit', 'kill'), step: 'mob/endermite/step',
      parts: [{ box: [4, 3, 2], uv: [0, 0], pos: [0, 1.5, -3] }, { box: [6, 4, 5], uv: [0, 5], pos: [0, 2, .5] }, { box: [3, 3, 1], uv: [0, 14], pos: [0, 1.5, 3.5] }, { box: [1, 2, 1], uv: [0, 18], pos: [0, 1, 4.5] }] },
  });
// horse, villager and witch: geometry measured from the reference models, rigged and UV-mapped onto the real Minecraft textures
MOBDEF.horse.parts = [{box: [10, 10, 22], uv: [0, 32], pos: [0.0, 16.004, 1.019]}, {box: [4, 12, 7], uv: [0, 35], pos: [0.0, 19.549, -7.826], rot: [-0.4364, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [6, 5, 7], uv: [0, 13], pos: [0.0, 27.252, -11.418], rot: [-0.4363, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [2, 3, 1], uv: [19, 16], pos: [1.5, 32.145, -10.39], rot: [-0.1144, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [2, 3, 1], uv: [19, 16], pos: [-1.5, 32.145, -10.39], rot: [-0.1144, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [2, 16, 2], uv: [56, 36], pos: [0.0, 24.622, -5.227], rot: [-0.312, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [4, 5, 5], uv: [0, 25], pos: [0.0, 23.81, -16.433], rot: [-0.4365, 0, 0], head: 1, pivot: [0, 22, -9]}, {box: [4, 11, 4], uv: [48, 21], pos: [3.0, 5.504, -7.981], leg: 1, pivot: [3.0, 11, -7.981]}, {box: [4, 11, 4], uv: [48, 21], pos: [-3.0, 5.504, -7.981], leg: 0, pivot: [-3.0, 11, -7.981]}, {box: [4, 11, 4], uv: [48, 21], pos: [3.0, 5.504, 9.019], leg: 0, pivot: [3.0, 11, 9.019]}, {box: [4, 11, 4], uv: [48, 21], pos: [-3.0, 5.504, 9.019], leg: 1, pivot: [-3.0, 11, 9.019]}, {box: [3, 14, 4], uv: [42, 36], pos: [0.0, 12.702, 14.524], rot: [-0.5236, 0, 0]}];
MOBDEF.villager.parts = [{box: [8, 10, 8], uv: [0, 0], pos: [0.0, 29.0, 0.0], head: 1, pivot: [0, 24, 0]}, {box: [8, 18, 6], uv: [0, 38], pos: [0.0, 14.0, 0.0], inf: 0.5}, {box: [4, 8, 4], uv: [44, 22], pos: [6.0, 19.644, -1.867], rot: [0.7854, 0, 0]}, {box: [8, 4, 4], uv: [40, 38], pos: [0.0, 18.23, -3.281], rot: [0.7854, 0, 0]}, {box: [4, 8, 4], uv: [44, 22], pos: [-6.0, 19.644, -1.867], rot: [0.7854, 0, 0]}, {box: [4, 12, 4], uv: [0, 22], pos: [-2.0, 6.0, 0.0], leg: 0, pivot: [-2.0, 12, 0]}, {box: [4, 12, 4], uv: [0, 22], pos: [2.0, 6.0, 0.0], leg: 1, pivot: [2.0, 12, 0]}, {box: [8, 12, 6], uv: [16, 20], pos: [0.0, 18.0, 0.0]}, {box: [2, 4, 2], uv: [24, 0], pos: [0.0, 25.0, -5.0], head: 1, pivot: [0, 24, 0]}];
MOBDEF.witch.parts = [{box: [8, 10, 8], uv: [0, 0], pos: [0.0, 29.0, 0.0], head: 1, pivot: [0, 24, 0]}, {box: [8, 18, 6], uv: [0, 38], pos: [0.0, 14.0, 0.0], inf: 0.5}, {box: [4, 8, 4], uv: [44, 22], pos: [6.0, 19.644, -1.867], rot: [0.7854, 0, 0]}, {box: [8, 4, 4], uv: [40, 38], pos: [0.0, 18.23, -3.281], rot: [0.7854, 0, 0]}, {box: [4, 8, 4], uv: [44, 22], pos: [-6.0, 19.644, -1.867], rot: [0.7854, 0, 0]}, {box: [4, 12, 4], uv: [0, 22], pos: [-2.0, 6.0, 0.0], leg: 0, pivot: [-2.0, 12, 0]}, {box: [4, 12, 4], uv: [0, 22], pos: [2.0, 6.0, 0.0], leg: 1, pivot: [2.0, 12, 0]}, {box: [8, 12, 6], uv: [16, 20], pos: [0.0, 18.0, 0.0]}, {box: [2, 4, 2], uv: [24, 0], pos: [0.0, 25.0, -5.0], head: 1, pivot: [0, 24, 0]}, {box: [10, 2, 10], uv: [0, 64], pos: [0.0, 33.072, 0.0], head: 1, pivot: [0, 24, 0]}, {box: [7, 4, 7], uv: [0, 76], pos: [0.0, 35.733, 0.266], rot: [0.0874, 0, 0], head: 1, pivot: [0, 24, 0]}, {box: [4, 4, 4], uv: [0, 87], pos: [0.0, 39.524, 0.677], rot: [0.1746, 0, 0], head: 1, pivot: [0, 24, 0]}, {box: [1, 2, 1], uv: [0, 95], pos: [0.0, 42.402, 1.298], rot: [0.2615, 0, 0], inf: 0.25, head: 1, pivot: [0, 24, 0]}, {box: [1, 1, 1], uv: [0, 0], pos: [-0.5, 24.5, -6.25], inf: -0.25, head: 1, pivot: [0, 24, 0]}];
// illagers share the villager body (same texture layout) plus the hat layer; pillagers and vindicators use free arms to hold their weapon
{ const V = MOBDEF.villager.parts, hatL = { box: [8, 10, 8], uv: [32, 0], pos: [0, 29, 0], inf: .45, head: 1, pivot: [0, 24, 0] };
  const noArms = V.filter(p => !(p.uv[0] == 44 && p.uv[1] == 22) && !(p.uv[0] == 40 && p.uv[1] == 38));
  const free = [{ box: [4, 12, 4], uv: [40, 46], pos: [-6, 18, 0], pivot: [-6, 22, 0], arm: 0, hand: 1 }, { box: [4, 12, 4], uv: [40, 46], pos: [6, 18, 0], pivot: [6, 22, 0], arm: 1 }];
  MOBDEF.evoker.parts = [...V, hatL];
  MOBDEF.pillager.parts = [...noArms, hatL, ...free]; MOBDEF.vindicator.parts = [...noArms, hatL, ...free];
  MOBDEF.zombie_villager.parts = [...noArms, hatL, { box: [4, 12, 4], uv: [44, 22], pos: [-6, 18, 0], pivot: [-6, 22, 0], arm: 0, fwd: true, hand: 1 }, { box: [4, 12, 4], uv: [44, 22], pos: [6, 18, 0], pivot: [6, 22, 0], arm: 1, fwd: true }];
}
  for (const [n, base, tex, ext] of [['glow_squid', 'squid', 'mob_glow_squid', {}], ['donkey', 'horse', 'mob_donkey', { hp: 20 }], ['mule', 'horse', 'mob_mule', {}], ['skeleton_horse', 'horse', 'mob_skeleton_horse', { drop: [['item:bone', 0, 2]] }],
    ['zombie_horse', 'horse', 'mob_zombie_horse', { drop: [['item:rotten_flesh', 0, 2]] }], ['zoglin', 'hoglin', 'mob_zoglin', { drop: [['item:rotten_flesh', 1, 3]] }]])
    MOBDEF[n] = Object.assign({}, MOBDEF[base], { tex }, ext);
  MOBDEF.magma_cube = Object.assign({}, MOBDEF.slime, { tex: 'magmacube', drop: [['item:magma_cream', 0, 1]], burns: 0 });
}
MOBDEF.player = { tex: 'steve', w: .6, h: 1.8, hp: 20, parts: [...HUM(4, false, true), { box: [8, 12, 4], uv: [16, 32], pos: [0, 18, 0], inf: .25 }] };
for (const [n, d] of Object.entries(MOBDEF)) for (const p of d.parts || []) {
  if (n == 'chicken' && p.box[0] == 1 && p.box[1] == 4 && p.box[2] == 6) { p.wing = p.pos[0] < 0 ? 1 : -1; p.pivot = [p.pos[0], p.pos[1] + 2, p.pos[2]]; }
  if (n == 'blaze' && p.tent !== undefined) { p.orbit = (p.tent >> 2) % 2 ? -1 : 1; p.pivot = [0, p.pos[1], 0]; delete p.tent; }
}
MOBDEF.horse.horse = 1; for (const n of ['donkey', 'mule', 'skeleton_horse', 'zombie_horse']) if (MOBDEF[n]) MOBDEF[n].horse = 1;
const MODELS = {};
function boxVerts(out, size, uv, tw, th, inf = 0) {
  const [w, h, d] = size, [u, v] = uv, x0 = -w / 2 - inf, x1 = w / 2 + inf, y0 = -h / 2 - inf, y1 = h / 2 + inf, z0 = -d / 2 - inf, z1 = d / 2 + inf;
  const R = (a, b, c, e) => [a / tw, b / th, (a + c) / tw, (b + e) / th];
  const q = (C, r, s) => { const [a, b, c, e] = r; pushQuad(out, C, [[a, e], [c, e], [c, b], [a, b]], [s, 1, 0]); };
  q([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], R(u + d, v + d, w, h), .9);      // front -z
  q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], R(u + 2 * d + w, v + d, w, h), .9); // back +z
  q([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], R(u, v + d, d, h), .7);          // +x
  q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], R(u + d + w, v + d, d, h), .7);  // -x
  q([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]].map(p => p), R(u + d, v, w, d).map((x, i) => x), 1); // top
  q([[x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0]], R(u + d + w, v, w, d), .5);      // bottom
}
// some packs ship old 64x32-style skins inside a square image (the bottom half is empty): use the mirrored right arm/leg
const LEGACY = new Map();
function legacySkin(im) {
  if (LEGACY.has(im)) return LEGACY.get(im); let r = false;
  try { if (im.height == im.width) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, im.height / 2, im.width, im.height / 2).data; r = true; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) { r = false; break; } } } catch (e) { }
  LEGACY.set(im, r); return r;
}
function getModel(type) {
  if (MODELS[type]) return MODELS[type];
  const def = MOBDEF[type]; const parts = def.parts.map(p => {
    if (!IMG[p.tex || def.tex]) return null;
    const im = IMG[p.tex || def.tex], ref = ORIG[p.tex || def.tex] || im; const tw = ref.width / 2, th = tw * im.height / im.width; if ((th <= 32 || legacySkin(im)) && p.uv[1] >= 32) { const alt = { '32,48': [40, 16], '16,48': [0, 16] }[p.uv.join(',')]; if (!alt) return null; p = Object.assign({}, p, { uv: alt }); } const arr = []; boxVerts(arr, p.box, p.uv, tw, th, p.inf || 0);
    return Object.assign({}, p, { mesh: mkMesh(new Float32Array(arr)), tex: p.tex || def.tex });
  });
  return MODELS[type] = parts.filter(Boolean);
}
function makeMob(type, x, y, z) { const d = MOBDEF[type]; const sz = d.slime ? [1, 2, 4][Math.random() * 3 | 0] : 1; return { size: sz, type, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, r: d.w / 2 * sz, h: d.h * sz, hp: d.hp * sz * sz, walk: 0, wt: 0, mv: 0, hurtT: 0, panic: 0, sayT: 5 + Math.random() * 15, ground: false }; }
function spawnMob(type, x, y, z) { const m = makeMob(type, x, y, z); mobs.push(m); return m; }
function updateMobs(dt) {
  for (const m of mobs) {
    if (m.ghost) continue; // a copy of the host's mob
    const c = world.chunk(Math.floor(m.x / 16), Math.floor(m.z / 16)); if (!c || !c.meshes) continue;
    const D = MOBDEF[m.type]; m.target = null;
    if (D.wolf && m.tamed) { const dx = player.x - m.x, dz = player.z - m.z, dist = Math.hypot(dx, dz); if (dist > 3) { m.yawT = Math.atan2(-dx, -dz); m.mv = dist > 6 ? 1.8 : 1; m.wt = 1; } else if (m.mv > 1) m.mv = 0; if (dist > 20) { m.x = player.x + 1; m.y = player.y; m.z = player.z + 1; } }
    if (D.hostile || (D.neutral && m.provoked)) {
      const dx = player.x - m.x, dz = player.z - m.z, dy = player.y - m.y, dist = Math.hypot(dx, dy, dz);
      const angry = player.mode == 'survival' && !player.dead && dist < (D.ghast ? 60 : 20) && (!D.nightOnly || skyState().day < .5 || m.provoked) && (!D.neutral || m.provoked) && !m.tamed;
      if (angry) {
        m.target = player; m.yawT = Math.atan2(-dx, -dz); m.lookP = Math.atan2(dy + .5, Math.hypot(dx, dz)); m.wt = 1;
        m.mv = D.ranged ? (dist > 10 ? 1 : dist < 5 ? -0.6 : 0) : D.creeper && m.fuse > 0 ? 0 : 1; m.speedMul = D.speed / 1.1;
        m.atkCd = (m.atkCd || 0) - dt; if (m.atkT > 0) m.atkT -= dt * 3;
        if (D.dmg && !D.ranged && dist < 1.6 && Math.abs(dy) < 1.5 && m.atkCd <= 0) { m.atkCd = 1; m.atkT = 1; hurtPlayer(D.dmg[world.meta.diff], 'was slain by ' + m.type[0].toUpperCase() + m.type.slice(1), false, [m.x, m.y, m.z]); }
        if (D.ranged && dist < 16 && m.atkCd <= 0) { m.atkCd = 2 + Math.random(); shootArrow(m, player); }
        if (D.ghast) { m.mv = dist > 20 ? .6 : 0; if (m.shootT > 0) { m.shootT -= dt; if (m.shootT <= 0) shootFireball(m, player); } else if (m.atkCd <= 0) { m.atkCd = 3 + Math.random() * 2; m.shootT = .5; SND.play('mob/ghast/charge', 1, 1, [m.x, m.y, m.z]); } }
        if (D.slime && m.ground && m.atkCd <= 0) { m.atkCd = 1 + Math.random(); m.vy = 7; m.kx = -Math.sin(m.yaw) * 2; m.kz = -Math.cos(m.yaw) * 2; SND.play(m.size > 1 ? 'mob/slime/big' : 'mob/slime/small', .5, 1, [m.x, m.y, m.z]); }
        if (D.teleport && dist > 12 && Math.random() < dt * .3) tpMob(m, player.x, player.z, 4);
        if (D.creeper) { if (dist < 3 || m.fuse > 0) { if (!(m.fuse > 0)) { m.fuse = 1.5; SND.play('fuse', 1, 1, [m.x, m.y, m.z]); } if (dist > 7) m.fuse = 0; else { m.fuse -= dt; if (m.fuse <= 0) { m.dead = true; explode(m.x, m.y + .5, m.z, 3, 1); } } } }
      } else { m.speedMul = 1; if (m.fuse > 0) m.fuse = 0; }
      if (D.burns && skyState().day > .8 && !world.meta.rain && world.topY(Math.floor(m.x), Math.floor(m.z)) < m.y + 1 && !(SHAPE[world.get(Math.floor(m.x), Math.floor(m.y + .5), Math.floor(m.z))] == 3)) { m.burnT = (m.burnT || 0) - dt; if (m.burnT <= 0) { m.burnT = 1; m.hurtT = 0; hurtMob(m, 1, 0, 0, true); } }
    }
    if (!m.target) mobVsMob(m, D, dt);
    mobLife(m, D, dt);
    if (m.mt) { m.wt = Math.max(m.wt, .5); }
    m.wt -= dt; if (m.wt <= 0) { m.wt = 2 + Math.random() * 5; m.mv = Math.random() < .6 ? 1 : 0; m.yawT = m.yaw + (Math.random() - .5) * 3; }
    if (m.panic > 0) { m.panic -= dt; m.mv = 1.8; if (Math.random() < dt * 2) m.yawT = Math.random() * 6.28; }
    else if (m.mv > 1) m.mv = 1;
    if (m.yawT !== undefined) { let d = m.yawT - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * Math.min(1, dt * 6); }
    const sp = m.mv * 1.1 * (m.speedMul || 1); const inW = SHAPE[world.get(Math.floor(m.x), Math.floor(m.y + .3), Math.floor(m.z))] == 3;
    m.vx = -Math.sin(m.yaw) * sp; m.vz = -Math.cos(m.yaw) * sp; m.vx += m.kx || 0; m.vz += m.kz || 0; m.kx = (m.kx || 0) * .8; m.kz = (m.kz || 0) * .8;
    if (D.fly) { const gy = (world.topY(Math.floor(m.x), Math.floor(m.z)) || 30) + 12; m.vy = clamp((gy - m.y) * .5, -2, 2); if (m.target) m.vy = clamp((player.y + 6 - m.y) * .5, -2, 2); }
    else m.vy = inW ? Math.min(m.vy + 12 * dt, 1.5) : m.vy - 28 * dt;
    if (D.slime && !m.target) { m.mv = 0; if (m.ground && Math.random() < dt * .4) { m.vy = 6; m.kx = -Math.sin(m.yaw) * 1.5; m.kz = -Math.cos(m.yaw) * 1.5; m.yawT = Math.random() * 6.28; } }
    const mox = m.x, moz = m.z; const r = moveBody(world, m, dt); if (r.ground) m.ground = true; else if (m.vy != 0) m.ground = false; if (r.hitH && m.ground && stepUp(m, dt, mox, moz)) r.hitH = false;
    if (r.hitH && m.ground && m.mv && !D.slime) { m.vy = 8.2; m.ground = false; }
    if (D.teleport && (inW || (m.hurtT > .45 && Math.random() < .3))) tpMob(m, m.x, m.z, 12); if (r.hitH && MOBDEF[m.type].climbs && m.mv) m.vy = 3;
    m.walk += Math.hypot(m.vx, m.vz) * dt * 3;
    if (m.hurtT > 0) m.hurtT -= dt;
    m.sayT -= dt; if (m.sayT <= 0 && MOBDEF[m.type].sound) { m.sayT = 8 + Math.random() * 20; SND.play(MOBDEF[m.type].sound, .7, .9 + Math.random() * .2, [m.x, m.y, m.z]); }
    if (m.mv && m.ground && D.step && (m.stepT = (m.stepT || 0) - dt) <= 0) { m.stepT = .5; SND.play(MOBDEF[m.type].step, .15, 1, [m.x, m.y, m.z]); }
    if (m.y < -10) m.dead = true;
  }
  mobs = mobs.filter(m => !m.dead && Math.hypot(m.x - player.x, m.z - player.z) < (MOBDEF[m.type].hostile ? 100 : 160) && !(MOBDEF[m.type].hostile && world.meta.diff == 0));
  updateArrows(dt); hostileSpawn(dt);
}
// ---- things mobs do on their own, like in Minecraft ----
function mobLife(m, D, dt) {
  const bx = Math.floor(m.x), by = Math.floor(m.y), bz = Math.floor(m.z), below = BL[world.get(bx, by - 1, bz)]?.n;
  if (D.slime) m.sq = m.ground ? Math.max(0, (m.sq || 0) - dt * 3) : clamp((m.vy || 0) / 14, -.3, .35);
  // sheep and cows graze; sheep eat the grass (it turns to dirt) and grow their wool back
  if (/^(sheep|cow|horse|donkey|mule|goat)$/.test(m.type)) {
    if (m.eatT > 0) { m.eatT -= dt; m.mv = 0; if (m.eatT <= 0 && m.type == 'sheep' && below == 'grass_block') { world.set(bx, by - 1, bz, BYNAME.dirt); m.sheared = false; } }
    else if (!m.panic && !m.target && Math.random() < dt / (m.type == 'sheep' && m.sheared ? 6 : 40) && /grass_block|short_grass/.test(below || '')) m.eatT = 2;
  }
  // chickens lay an egg every 5-10 minutes
  if (m.type == 'chicken') { m.eggT = (m.eggT ?? 300 + Math.random() * 300) - dt; if (m.eggT <= 0) { m.eggT = 300 + Math.random() * 300; dropItem(itemKey('item:egg'), 1, m.x, m.y + .3, m.z); SND.play('mob/chicken/plop', .6, 1, [m.x, m.y, m.z]); } if (!m.ground && m.vy < -1.5) m.vy = -1.5; } // chickens flutter down slowly
  // snow golems leave snow behind (not in hot places)
  if (m.type == 'snow_golem' && Math.random() < dt * 2 && !world.get(bx, by, bz) && OPAQUE[world.get(bx, by - 1, bz)] && BYNAME.snow !== undefined) world.set(bx, by, bz, BYNAME.snow);
  // ranged attacks that are not arrows
  if (m.target == player && player.mode == 'survival') {
    const d = Math.hypot(player.x - m.x, player.z - m.z); m.spT = (m.spT || 2) - dt;
    if (m.type == 'blaze' && d < 16 && m.spT <= 0) { m.spT = 3; for (let i = 0; i < 3; i++) setTimeout(() => { if (!m.dead && world) shootFireball(m, player); }, i * 300); SND.play('mob/blaze/breathe', .8, 1, [m.x, m.y, m.z]); }
    if (m.type == 'witch' && d < 10 && m.spT <= 0) { m.spT = 3; for (let i = 0; i < 12; i++) particles.push({ x: player.x + (Math.random() - .5), y: player.y + 1, z: player.z + (Math.random() - .5), vx: (Math.random() - .5) * 2, vy: Math.random() * 2, vz: (Math.random() - .5) * 2, life: .8, tile: TEX[(BYNAME.purple_concrete || 1) * 4] }); SND.play('random/glass', .8, 1, [player.x, player.y, player.z]); hurtPlayer(3 + world.meta.diff, 'was killed by magic', true); }
    if (m.type == 'evoker' && d < 14 && m.spT <= 0) { m.spT = 5; m.mv = 0; // a line of evoker fangs snapping up toward you
      const ux = (player.x - m.x) / (d || 1), uz = (player.z - m.z) / (d || 1);
      for (let i = 1; i <= 16; i++) setTimeout(() => { if (!world) return; const fx = m.x + ux * i * 1.1, fz = m.z + uz * i * 1.1; for (let k = 0; k < 5; k++) particles.push({ x: fx + (Math.random() - .5) * .5, y: m.y + Math.random() * .8, z: fz + (Math.random() - .5) * .5, vx: 0, vy: 2 + Math.random() * 2, vz: 0, life: .5, g: .2, tile: TEX[(BYNAME.bone_block || 1) * 4] }); SND.play('mob/evocation_fangs/attack', .4, 1, [fx, m.y, fz]); if (Math.hypot(player.x - fx, player.z - fz) < 1 && Math.abs(player.y - m.y) < 2) hurtPlayer(6, 'was bitten by evoker fangs', true); }, i * 60);
      SND.play('mob/evocation_illager/prepare_attack', 1, 1, [m.x, m.y, m.z]); }
  }
}
// ---- mobs fighting each other, like in Minecraft ----
const UNDEAD = /^(zombie|husk|drowned|zombie_villager|skeleton|stray|wither_skeleton|bogged|zombified_piglin|zoglin)$/;
const PREY = { // who hunts whom
  wolf: n => /^(sheep|rabbit|fox|skeleton|stray|wither_skeleton|bogged)$/.test(n),
  fox: n => /^(chicken|rabbit)$/.test(n), cat: n => /^(chicken|rabbit)$/.test(n), ocelot: n => /^(chicken)$/.test(n),
  iron_golem: n => MOBDEF[n] && MOBDEF[n].hostile && n != 'creeper' && n != 'ghast', snow_golem: n => MOBDEF[n] && MOBDEF[n].hostile && n != 'creeper',
  zombie: n => /^(villager|wandering_trader|iron_golem|turtle)$/.test(n), husk: n => /^(villager|wandering_trader|iron_golem)$/.test(n), drowned: n => /^(villager|wandering_trader|iron_golem|turtle)$/.test(n), zombie_villager: n => /^(villager|wandering_trader|iron_golem)$/.test(n),
  pillager: n => /^(villager|wandering_trader|iron_golem)$/.test(n), vindicator: n => /^(villager|wandering_trader|iron_golem)$/.test(n), evoker: n => /^(villager|wandering_trader|iron_golem)$/.test(n),
  skeleton: n => n == 'iron_golem', polar_bear: n => n == 'fox', axolotl: n => /^(squid|glow_squid|drowned|cod|salmon)$/.test(n),
};
const FEARS = { villager: /^(zombie|husk|drowned|zombie_villager|pillager|vindicator|evoker|vex|zoglin)$/, wandering_trader: /^(zombie|husk|drowned|zombie_villager|pillager|vindicator|evoker)$/, skeleton: /^wolf$/, stray: /^wolf$/, creeper: /^(cat|ocelot)$/, rabbit: /^(wolf|fox)$/, sheep: /^wolf$/, chicken: /^(fox|cat|ocelot)$/ };
function mobVsMob(m, D, dt) {
  m.mtT = (m.mtT || 0) - dt;
  if (m.mtT <= 0) { m.mtT = .6 + Math.random() * .4; m.mt = null; m.fear = null;
    const hunt = m.tamed ? (n => MOBDEF[n] && MOBDEF[n].hostile && n != 'creeper') : PREY[m.type], fear = FEARS[m.type];
    let best = 16 * 16, fb = 8 * 8;
    for (const o of mobs) { if (o == m || o.dead || o.ghost) continue; const d2 = (o.x - m.x) ** 2 + (o.y - m.y) ** 2 + (o.z - m.z) ** 2; if (d2 > 256) continue;
      if (hunt && hunt(o.type) && d2 < best && !(o.tamed && m.tamed)) { if (m.tamed && Math.hypot(o.x - player.x, o.z - player.z) > 12) continue; best = d2; m.mt = o; }
      if (fear && fear.test(o.type) && d2 < fb && !o.tamed) { fb = d2; m.fear = o; } }
  }
  if (m.fear && !m.fear.dead) { const f = m.fear; m.yawT = Math.atan2(m.x - f.x, m.z - f.z); m.mv = 1.6; m.wt = 1; m.mt = null; return; }
  const o = m.mt; if (!o || o.dead) { m.mt = null; return; }
  const dx = o.x - m.x, dz = o.z - m.z, dist = Math.hypot(dx, dz);
  m.yawT = Math.atan2(-dx, -dz); m.mv = dist > 1.2 ? 1.3 : 0; m.wt = 1; m.speedMul = (D.speed || 1.1) / 1.1;
  m.atkCd = (m.atkCd || 0) - dt; if (m.atkT > 0) m.atkT -= dt * 3;
  const reach = (D.w || .6) / 2 + (MOBDEF[o.type].w || .6) / 2 + .8;
  if (D.ranged && dist < 14 && m.atkCd <= 0) { m.atkCd = 2; hurtMob(o, 3, dx / (dist || 1) * .3, dz / (dist || 1) * .3); return; }
  if (dist < reach && Math.abs(o.y - m.y) < 1.5 && m.atkCd <= 0) {
    m.atkCd = m.type == 'iron_golem' ? 1.2 : 1; m.atkT = 1;
    const dmg = m.type == 'iron_golem' ? 10 : m.type == 'wolf' ? 4 : D.dmg ? (D.dmg[2] || 3) : 2;
    hurtMob(o, dmg, dx / (dist || 1) * .4, dz / (dist || 1) * .4);
    if (m.type == 'iron_golem') o.vy = 9;
    if (o.hp > 0 && PREY[o.type] && PREY[o.type](m.type) && !o.mt) o.mt = m; // fights back
  }
}
function hurtMob(m, dmg, kx, kz, quiet) {
  if (m.hurtT > 0) return; m.hp -= dmg; m.hurtT = .5; if (!MOBDEF[m.type].hostile && !/^(iron_golem|wolf|polar_bear|snow_golem)$/.test(m.type)) m.panic = 4; m.provoked = true; m.kx = kx * 8; m.kz = kz * 8; if (!quiet) m.vy = 5.5;
  const d = MOBDEF[m.type];
  if (d.neutral) for (const o of mobs) if (o.type == m.type && Math.hypot(o.x - m.x, o.z - m.z) < 16 && !o.tamed) o.provoked = true;
  if (m.hp <= 0) {
    if (d.slime && m.size > 1) for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) { const s = spawnMob('slime', m.x + (Math.random() - .5), m.y + .5, m.z + (Math.random() - .5)); s.size = m.size / 2; s.r = MOBDEF.slime.w / 2 * s.size; s.h = MOBDEF.slime.h * s.size; s.hp = 4 * s.size * s.size; }
    m.dead = true; SND.play(d.death, 1, 1, [m.x, m.y, m.z]); player.stats.kills++; player.score++; award('kill'); earn(d.hostile ? 5 : 2, d.hostile ? 'Defeated a ' + m.type.replace(/_/g, ' ') : ''); addXp(MOBDEF[m.type].hostile ? 5 : 1 + (Math.random() * 3 | 0));
    for (const [n, a, b, cond] of d.drop) { if (cond == 'wool' && m.sheared) continue; const c = a + Math.floor(Math.random() * (b - a + 1)); if (c > 0) dropItem(itemKey(n), c * api.settings.dropMultiplier, m.x, m.y + .5, m.z); }
    for (let i = 0; i < 12; i++) particles.push({ x: m.x + (Math.random() - .5) * m.r * 2, y: m.y + Math.random() * m.h, z: m.z + (Math.random() - .5) * m.r * 2, vx: (Math.random() - .5), vy: Math.random() + .5, vz: (Math.random() - .5), life: .6 + Math.random() * .4, tile: TEX[BYNAME.light_gray_wool * 4], g: 0, s: .08 });
  } else SND.play(d.hurt, 1, 1.2, [m.x, m.y, m.z]);
}
function naturalSpawn(c) {
  if (NET.role == 'client') return; // the host's mobs are streamed in
  if (mobs.length > 40 || world.meta.flat && Math.random() < .5) return;
  const H = world.N.hash(c.cx, 1234, c.cz); if (H > .12) return;
  if (world.dim == 'nether') return;
  const bio = world.biome(c.cx * 16 + 8, c.cz * 16 + 8), types = /snowy|frozen/.test(bio) ? ['polar_bear', 'sheep'] : /taiga|forest/.test(bio) ? ['pig', 'cow', 'sheep', 'wolf', 'chicken'] : /plains|savanna|meadow/.test(bio) ? ['pig', 'cow', 'sheep', 'chicken', 'horse', 'donkey'] : ['pig', 'cow', 'sheep', 'chicken'], t = types[Math.floor(world.N.hash(c.cx, 99, c.cz) * types.length)], n = t == 'wolf' || t == 'polar_bear' || t == 'horse' || t == 'donkey' ? 2 + Math.floor(H * 10) : 2 + Math.floor(H * 20);
  for (let i = 0; i < n; i++) {
    const lx = Math.floor(world.N.hash(c.cx, i, c.cz) * 16), lz = Math.floor(world.N.hash(c.cx, i + 50, c.cz) * 16), x = c.cx * 16 + lx, z = c.cz * 16 + lz;
    const y = world.topY(x, z); const b = world.get(x, y, z); if (b == B('grass_block') || b == B('snowy_grass_block')) { const m = spawnMob(t, x + .5, y + 1, z + .5); if (t == 'sheep') m.wool = 0; }
  }
}
// dropped items
function dropItem(k, c, x, y, z, throwIt) {
  if (!k || !c) return;
  if (x === undefined) { const f = fwd(); x = player.x + f[0] * .3; y = player.y + 1.4; z = player.z + f[2] * .3; throwIt = true; }
  const f = throwIt ? fwd() : [0, 0, 0];
  items.push({ k, c, x, y, z, vx: throwIt ? f[0] * 5 : (Math.random() - .5) * 2, vy: throwIt ? f[1] * 5 + 2 : 3, vz: throwIt ? f[2] * 5 : (Math.random() - .5) * 2, r: .125, h: .25, age: 0, pick: throwIt ? 2 : .5 });
}
function updateItems(dt) {
  for (const it of items) {
    it.age += dt; it.pick -= dt; it.vy -= 20 * dt; const r = moveBody(world, it, dt); if (r.ground) { it.vx *= .6; it.vz *= .6; }
    const d = Math.hypot(it.x - player.x, it.y - (player.y + .5), it.z - player.z);
    if (it.pick <= 0 && d < 1.8 && !player.dead && player.mode != 'spectator') {
      const left = giveItem(it.k, it.c, it.dmg); if (left < it.c) { SND.play('pop', .3, 1 + Math.random() * .8); const n = keyName(it.k); if (/_log$|_stem$/.test(n)) award('wood'); if (n == 'cobblestone') award('stone'); if (n == 'diamond') award('diamond'); }
      it.c = left; if (!left) it.dead = true;
    }
    if (it.age > 300 || it.y < -10) it.dead = true;
  }
  // merge nearby stacks
  items = items.filter(i => !i.dead);
}
function addXp(n) { player.xp += n / (player.lvl < 16 ? 2 * player.lvl + 7 : 5 * player.lvl - 38); SND.play('orb', .2, .6 + Math.random() * .8); while (player.xp >= 1) { player.xp -= 1; player.lvl++; if (player.lvl % 5 == 0) SND.play('levelup', .6); } player.score += n; }
// ---------------- player ----------------
const fwd = () => [-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)];
function armorPts() { return player.armor.reduce((s, a) => s + (a && ARMOR(a.k) ? ARMOR(a.k).pts : 0), 0); }
function hurtPlayer(dmg, msg, ignoreArmor, src) {
  if (player.mode != 'survival' || player.dead) return; if (world.meta.diff == 0 && msg == 'starved to death') return;
  if (!ignoreArmor) { const a = armorPts(); dmg *= 1 - Math.min(20, a) * .04; player.armor.forEach((s, i) => { if (s) { s.dmg = (s.dmg || 0) + 1; if (s.dmg >= toolDurability(s.k)) { player.armor[i] = null; SND.play('break'); } } }); }
  if (player.invuln > 0 && !ignoreArmor) return; player.invuln = .5; player.hp -= dmg; player.stats.dmg += dmg; player.hurtT = .5; SND.play('hurt', 1, 1);
  if (src) { const dx = player.x - src[0], dz = player.z - src[2], d = Math.hypot(dx, dz) || 1; player.vx += dx / d * 7; player.vz += dz / d * 7; player.vy = Math.max(player.vy, 5.5); player.ground = false; }
  if (player.hp <= 0) { player.hp = 0; player.dead = true; player.deathMsg = player.name + ' ' + msg; if (!api.settings.keepInventory) { for (const s of [...player.inv, ...player.armor, player.offhand]) if (s) dropItem(s.k, s.c, player.x, player.y + 1, player.z); player.inv.fill(null); player.armor.fill(null); player.offhand = null; } carried = null; go('death'); }
}
let breaking = null, useT = 0, eatT = 0, lastSpace = 0, lastW = 0, sprintTap = false, attackCd = 0, stepAcc = 0, swing = 0, placeCd = 0;
function held() { return player.inv[player.sel]; }
function updatePlayer(dt) {
  const P = player, spect = P.mode == 'spectator', creative = P.mode == 'creative';
  const fx = Math.floor(P.x), fz = Math.floor(P.z);
  const feet = world.get(fx, Math.floor(P.y + .1), fz), headB = world.get(fx, Math.floor(P.y + 1.62), fz);
  const inWater = SHAPE[feet] == 3 || SHAPE[world.get(fx, Math.floor(P.y + .8), fz)] == 3, inLava = SHAPE[feet] == 4, headWater = SHAPE[headB] == 3;
  P.inWater = inWater; P.headWater = headWater;
  const active = S.screen == 'game';
  let f = 0, s = 0; if (active) { f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); }
  const sneak = active && (keys.ShiftLeft || keys.ShiftRight) && !P.fly;
  if (active && (keys.ControlLeft || sprintTap) && f > 0 && (P.food > 6 || P.mode != 'survival') && !sneak) P.sprint = true; if (f <= 0 || P.hitH) { P.sprint = false; sprintTap = false; }
  let sp = P.fly ? (P.sprint ? 21.6 : 10.9) : P.sprint ? 5.6 : sneak ? 1.3 : 4.317; if (inWater && !P.fly) sp *= .5; if (eatT > 0) sp *= .3;
  const under = BL[world.get(fx, Math.floor(P.y - .05), fz)]?.n || '', inWeb = world.get(fx, Math.floor(P.y + .2), fz) == B('cobweb') || world.get(fx, Math.floor(P.y + 1.2), fz) == B('cobweb');
  const icy = P.ground && /ice$/.test(under); if (P.ground && /^(soul_sand|honey_block)$/.test(under) && !P.fly) sp *= .45; if (inWeb && !P.fly) { sp *= .15; P.vy *= .3; P.fallStart = null; }
  const mx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * s, mz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s, ml = Math.hypot(mx, mz) || 1;
  const tvx = mx / ml * sp * (f || s ? 1 : 0), tvz = mz / ml * sp * (f || s ? 1 : 0);
  const acc = icy ? 1.2 : P.ground || P.fly || inWater ? 12 : 2.5; P.vx += (tvx - P.vx) * Math.min(1, acc * dt); P.vz += (tvz - P.vz) * Math.min(1, acc * dt);
  if (P.fly) { const up = active && keys.Space ? 1 : 0, dn = active && (keys.ShiftLeft || keys.ShiftRight) ? 1 : 0; P.vy += ((up - dn) * 8 - P.vy) * Math.min(1, 10 * dt); }
  else if (inWater || inLava) { P.vy -= 8 * dt; P.vy *= Math.pow(.2, dt); if (active && keys.Space) P.vy = Math.min(P.vy + 25 * dt, 2.5); if (P.vy < -3) P.vy = -3; }
  else { P.vy -= 32 * dt; P.vy *= Math.pow(.98, dt * 20); if (P.vy < -78) P.vy = -78; if (active && keys.Space && P.ground) { P.vy = 9 * Math.sqrt(api.settings.jumpBoost); P.ground = false; P.stats.jumps++; P.exh += P.sprint ? .2 : .05; if (P.sprint) { const fw = fwd(); P.vx -= Math.sin(P.yaw) * 2; P.vz -= Math.cos(P.yaw) * 2; } } }
  const ox = P.x, oy = P.y, oz = P.z;
  if (spect) { P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt; P.ground = false; }
  else {
    // sneak edge protection
    const pre = { x: P.x, z: P.z };
    const r = moveBody(world, P, dt); P.hitH = r.hitH;
    if (r.hitH && P.ground && !P.fly && stepUp(P, dt, pre.x, pre.z)) P.hitH = false;
    if (inWater && !P.fly) { const fp = fluidPush(P); P.vx += fp[0] * dt * 3; P.vz += fp[1] * dt * 3; }
    if (sneak && P.ground && !world.collides(P.x, P.y - .1, P.z, P.r, .1)) { P.x = pre.x; P.z = pre.z; P.vx = P.vz = 0; }
    if (r.hitH && P.ground && !P.fly && (f || s)) { // auto step up? (MC needs jump) - no
    }
    const was = P.ground; P.ground = r.ground || (P.ground && P.vy == 0 && world.collides(P.x, P.y - .05, P.z, P.r, .05));
    if (r.ground && P.fly && P.mode == 'creative') P.fly = false;
    // fall damage
    if (!P.ground && !inWater && !P.fly) { if (P.fallStart == null || P.y > P.fallStart) P.fallStart = Math.max(P.fallStart ?? P.y, P.y); }
    if (inWater || P.fly) P.fallStart = null;
    if (P.ground && P.fallStart != null) { const d = P.fallStart - P.y - 3; if (d > 0 && P.mode == 'survival' && !api.settings.noFallDamage) { hurtPlayer(Math.floor(d), 'hit the ground too hard'); SND.play(d > 4 ? 'fallbig' : 'fallsmall'); } P.fallStart = null; }
  }
  const moved = Math.hypot(P.x - ox, P.z - oz); if (P.fly) P.stats.fly += moved; else P.stats.walk += moved;
  if (P.ground && moved > 0 && !sneak) { stepAcc += moved; if (stepAcc > 1.6 * (P.sprint ? 1.3 : 1)) { stepAcc = 0; const b = world.get(fx, Math.floor(P.y - .2), fz); if (b) blockSound(BL[b].n, 'step', .3, 1); } }
  if (inWater && moved > .02 && (P.swimT = (P.swimT || 0) - dt) <= 0) { P.swimT = .8; SND.play('swim', .1); }
  if (inWater && !P.wasInWater && P.vy < -4) SND.play('splash', .3); P.wasInWater = inWater;
  P.exh += moved * (P.sprint ? .1 : 0) + (inWater ? moved * .01 : 0);
  // survival needs
  if (P.mode == 'survival' && !P.dead) {
    if (headWater) { P.air -= dt * 20; if (P.air <= -20) { P.air = 0; hurtPlayer(2, 'drowned', true); } } else P.air = Math.min(300, P.air + dt * 100);
    if (inLava) { P.lavaT = (P.lavaT || 0) - dt; if (P.lavaT <= 0) { P.lavaT = .5; hurtPlayer(4, 'tried to swim in lava'); } }
    if (world.get(fx, Math.floor(P.y + .5), fz) == B('cactus') || [[.35, 0], [-.35, 0], [0, .35], [0, -.35]].some(([a, b]) => world.get(Math.floor(P.x + a), Math.floor(P.y + .5), Math.floor(P.z + b)) == B('cactus'))) { P.cacT = (P.cacT || 0) - dt; if (P.cacT <= 0) { P.cacT = .5; hurtPlayer(1, 'was pricked to death'); } }
    { // plants and blocks that hurt: sweet berry bush, wither rose, magma, campfires, pointed dripstone, powder snow
      const nb = (dy) => BL[world.get(fx, Math.floor(P.y + dy), fz)]?.n || '', feet = nb(.1), body = nb(.9), under = nb(-.1);
      const moving = Math.hypot(P.vx || 0, P.vz || 0) > .3, tick = (k, t, d, why) => { P[k] = (P[k] || 0) - dt; if (P[k] <= 0) { P[k] = t; hurtPlayer(d, why); } };
      if (feet == 'sweet_berry_bush' || body == 'sweet_berry_bush') { P.vx *= .5; P.vz *= .5; if (moving) tick('berT', .5, 1, 'was poked to death by a sweet berry bush'); }
      if (feet == 'wither_rose' || body == 'wither_rose') { P.wither = 2.5; }
      if (P.wither > 0) { P.wither -= dt; tick('witT', 2, 1, 'withered away'); }
      if (under == 'magma_block' && !keys.ShiftLeft) tick('magT', .5, 1, 'discovered the floor was lava');
      if (/campfire$/.test(feet) && BL[world.get(fx, Math.floor(P.y + .1), fz)]) tick('fireT', .5, /soul/.test(feet) ? 2 : 1, 'went up in flames');
      if (under == 'pointed_dripstone' && (P.fallStart || 0) - P.y > 1) { hurtPlayer(Math.ceil(((P.fallStart || 0) - P.y) * 2), 'was impaled on a stalagmite'); P.fallStart = P.y; }
    }
    if (world.meta.diff == 0) { P.exh = 0; P.food = 20; P.regenT += dt; if (P.regenT > 1 && P.hp < 20) { P.hp = Math.min(20, P.hp + 1); P.regenT = 0; } }
    if (P.exh >= 4) { P.exh -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else P.food = Math.max(0, P.food - 1); }
    if (P.food >= 18 && P.hp < 20) { P.regenT += dt; const t = P.food == 20 && P.sat > 0 ? .5 : 4; if (P.regenT >= t) { P.regenT = 0; P.hp = Math.min(20, P.hp + 1); P.exh += 6; } }
    if (P.food == 0) { P.starveT += dt; if (P.starveT >= 4) { P.starveT = 0; const lim = [20, 10, 1, 0][world.meta.diff]; if (P.hp > lim) hurtPlayer(1, 'starved to death', true); } }
  }
  if (P.portalCool > 0) P.portalCool -= dt;
  if (world.get(fx, Math.floor(P.y + .5), fz) == B('nether_portal') && !(P.portalCool > 0)) { if (!P.portalT) SND.play('portal/trigger', .3); P.portalT = (P.portalT || 0) + dt; if (P.portalT > (P.mode == 'creative' ? 1 : 4)) { travel(); return; } } else P.portalT = Math.max(0, (P.portalT || 0) - dt * 2);
  if (P.hurtT > 0) P.hurtT -= dt; if (P.invuln > 0) P.invuln -= dt;
  if (P.y < -64) { if (P.mode == 'survival') hurtPlayer(4, 'fell out of the world', true); else if (P.y < -128) { P.y = 120; P.vy = 0; } }
  if (P.y < 0 && P.y > -1 && false) { }
  if (P.y < 10 && P.y > 0 && !world.meta.flat) award('deep');
  // interaction
  if (!active || P.dead) { breaking = null; return; }
  attackCd -= dt; placeCd -= dt; if (swing > 0) swing -= dt * 3;
  const eye = [P.x, P.y + (sneak ? 1.27 : 1.62), P.z], d = fwd(), reach = creative ? 5 : 4.5;
  const hit = spect ? null : world.raycast(eye[0], eye[1], eye[2], d[0], d[1], d[2], reach);
  P.target = hit;
  // mob target
  let tm = null, tmd = hit ? hit.t : reach;
  if (!spect) for (const m of mobs) { const t = rayBox(eye, d, [m.x - m.r, m.y, m.z - m.r], [m.x + m.r, m.y + m.h, m.z + m.r]); if (t !== null && t < tmd && t < 3.5) { tm = m; tmd = t; } }
  P.targetMob = tm;
  if (mouse.down && !spect) {
    if (tm && attackCd <= 0) { attackCd = .5; swing = 1; const h = held(); { const crit = P.vy < -1 && !P.ground; hurtMob(tm, attackDamage(h && h.k) * (crit ? 1.5 : 1), d[0] * (P.sprint ? 1.6 : 1), d[2] * (P.sprint ? 1.6 : 1)); if (crit) for (let i = 0; i < 8; i++) particles.push({ x: tm.x, y: tm.y + tm.h * .7, z: tm.z, vx: (Math.random() - .5) * 4, vy: Math.random() * 3, vz: (Math.random() - .5) * 4, life: .5, tile: TEX[B('white_wool') * 4], g: 1, s: .05 }); SND.play(crit ? 'random/successful_hit' : 'damage/hit', .4, 1.2); } P.exh += .1; if (h && toolInfo(h.k)) wear(h, toolInfo(h.k).type == 'sword' ? 1 : 2); breaking = null; }
    else if (hit && !tm) {
      if (creative) { if (attackCd <= 0) { attackCd = .25; const h = held(); if (!(h && toolInfo(h.k) && toolInfo(h.k).type == 'sword')) netBegin(); doBreak(hit, false); netEnd(hit); swing = 1; } }
      else {
        if (!breaking || breaking.x != hit.x || breaking.y != hit.y || breaking.z != hit.z) breaking = { x: hit.x, y: hit.y, z: hit.z, p: 0, b: hit.b, snd: 0 };
        const t = api.settings.instantMine && blockProps(hit.b).h >= 0 ? 0 : breakTime(hit.b, held() && held().k, headWater, P.ground || P.fly);
        breaking.p += t == 0 ? 1 : dt / t; swing = Math.max(swing, .6); breaking.snd -= dt;
        if (breaking.snd <= 0) { breaking.snd = .25; blockSound(BL[hit.b].n, 'step', .3, .5, [hit.x + .5, hit.y + .5, hit.z + .5]); spawnBreakParticles(hit, 1); }
        if (breaking.p >= 1) { netBegin(); doBreak(hit, true); netEnd(hit); breaking = null; attackCd = .3; }
      }
    }
  } else breaking = null;
  // use / place
  const h = held();
  if (mouse.rdown) {
    const fv = h && foodVal(h.k);
    if (fv && (P.food < 20 || /golden_apple|chorus/.test(keyName(h.k)) || P.mode == 'creative')) {
      eatT += dt; if ((P.eatS = (P.eatS || 0) - dt) <= 0) { P.eatS = .22; SND.play('eat', .5, .8 + Math.random() * .4); spawnEatParticles(h.k); }
      if (eatT >= 1.6) { eatT = 0; P.food = Math.min(20, P.food + fv); P.sat = Math.min(P.food, P.sat + fv * 1.2); if (P.mode == 'survival') { h.c--; if (!h.c) P.inv[P.sel] = null; } P.stats.eaten++; SND.play('burp', .5); award('eat'); const n = keyName(h.k); if (/stew|soup/.test(n)) giveItem(itemKey('item:bowl'), 1); }
    } else if (placeCd <= 0) { eatT = 0; placeCd = .25; netBegin(); useItem(hit, tm, h); netEnd(hit); }
  } else { eatT = 0; placeCd = Math.min(placeCd, 0); }
  if (mouse.mclick && hit) { const k = hit.b; if (creative) { const i = P.inv.findIndex((s, i) => i < 9 && s && s.k == k); if (i >= 0) P.sel = i; else P.inv[P.sel] = { k, c: 1 }; } else { const i = P.inv.findIndex((s, i) => i < 9 && s && s.k == k); if (i >= 0) P.sel = i; } }
}
function wear(st, n) { if (player.mode != 'survival') return; st.dmg = (st.dmg || 0) + n; if (st.dmg >= toolDurability(st.k)) { const i = player.inv.indexOf(st); if (i >= 0) player.inv[i] = null; SND.play('break', .8); } }
function rayBox(o, d, mn, mx) { let t0 = 0, t1 = 1e9; for (let i = 0; i < 3; i++) { const inv = 1 / d[i]; let a = (mn[i] - o[i]) * inv, b = (mx[i] - o[i]) * inv; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t1 < t0) return null; } return t0; }
const GRAVITY_B = n => /^(sand|red_sand|gravel|.+_concrete_powder|suspicious_sand|suspicious_gravel)$/.test(n);
function doBreak(hit, survival) {
  const { x, y, z, b } = hit, n = BL[b].n;
  if (survival && blockProps(b).h < 0) return;
  if (!survival && /^(bedrock)$/.test(n) && false) return;
  if (/_door/.test(n) && !/trapdoor/.test(n)) { const oy = /_top/.test(n) ? y - 1 : y + 1; if (/_door/.test(BL[world.get(x, oy, z)]?.n || '')) world.set(x, oy, z, 0); }
  if (BL[b].bed) { // beds are two blocks: remove the other half too
    const st = world.state[x + ',' + y + ',' + z] || {}, D = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[st.fd || 'north'], head = /_bed_head$/.test(n), ox = x + (head ? -D[0] : D[0]), oz = z + (head ? -D[1] : D[1]);
    if (BL[world.get(ox, y, oz)]?.bed) { world.set(ox, y, oz, 0); delete world.state[ox + ',' + y + ',' + oz]; } }
  if (BL[b].top) { const below = world.get(x, y - 1, z); if (BYNAME[BL[below]?.n + '_top'] == b) { world.set(x, y - 1, z, 0); if (survival) for (const [k, c] of drops(below, held() && held().k)) dropItem(k, c, x + .5, y - .5, z + .5); } }
  modEmit('blockBreak', x, y, z, n);
  world.set(x, y, z, 0); player.stats.mined++; player.exh += .005; if (survival && player.stats.mined % 10 == 0) earn(1);
  blockSound(n, 'break', 1, .8 + Math.random() * .2, [x + .5, y + .5, z + .5]);
  spawnBreakParticles(hit, 14);
  const ck = [x, y, z].join(','), cont = world.containers[ck];
  if (cont) { for (const s of cont.slots) if (s) dropItem(s.k, s.c, x + .5, y + .5, z + .5); delete world.containers[ck]; }
  if (survival) {
    const h = held(); for (const [k, c] of drops(b, h && h.k)) if (k && c) dropItem(k, c * api.settings.dropMultiplier, x + .5, y + .3, z + .5);
    if (h && toolInfo(h.k) && blockProps(b).h > 0) wear(h, 1);
    if (/_ore$/.test(n) && !/iron|gold|copper/.test(n)) addXp(n.includes('coal') ? 1 : 3 + (Math.random() * 3 | 0));
  }
  if (/piston/.test(n) && !/head/.test(n) && (world.state[ck] || {}).ext) { const f = (world.state[ck] || {}).f || [0, 1, 0]; if (/piston_head/.test(BL[world.get(x + f[0], y + f[1], z + f[2])]?.n || '')) world.set(x + f[0], y + f[1], z + f[2], 0); }
  delete world.state[ck]; delete world.power[ck];
  afterRemove(x, y, z); rsNotify(x, y, z);
}
function afterRemove(x, y, z) {
  // plants on top pop off
  const above = world.get(x, y + 1, z); if (above && (SHAPE[above] == 2 && BL[above].n != 'hanging_roots' || BL[above].n == 'cactus' || BL[above].n == 'sugar_cane')) { const n = BL[above].n; world.set(x, y + 1, z, 0); if (player.mode == 'survival') if (!BL[above].top) for (const [k, c] of drops(above)) dropItem(k, c, x + .5, y + 1.3, z + .5); afterRemove(x, y + 1, z); }
}
function canPlaceAt(x, y, z) { const b = world.get(x, y, z); return !b || SHAPE[b] == 3 || SHAPE[b] == 4 || /^(short_grass|fern|tall_grass|dead_bush|seagrass|fire|snow)$/.test(BL[b].n) && BL[b].n != 'snow'; }
function useItem(hit, tm, h) {
  const n = h ? keyName(h.k) : '';
  const consume = () => { if (player.mode == 'survival') { h.c--; if (!h.c) player.inv[player.sel] = null; } };
  if (tm) { // shear sheep
    if (n == 'bone' && tm.type == 'wolf' && !tm.tamed) { consume(); if (Math.random() < .35) { tm.tamed = true; tm.provoked = false; for (let i = 0; i < 7; i++) particles.push({ x: tm.x, y: tm.y + 1, z: tm.z, vx: (Math.random() - .5), vy: 1, vz: (Math.random() - .5), life: .8, tile: TEX[B('red_wool') * 4], g: 0, s: .06 }); chat('§aWolf tamed!'); } return; }
    if (n == 'shears' && tm.type == 'sheep' && !tm.sheared) { tm.sheared = true; SND.play('mob/sheep/shear', 1); dropItem(itemKey('white_wool'), 1 + (Math.random() * 3 | 0), tm.x, tm.y + 1, tm.z); wear(h, 1); }
    else if (n == 'bucket' && tm.type == 'cow') { consume(); giveItem(itemKey('item:milk_bucket'), 1); }
    return;
  }
  if (n == 'milk_bucket') { if (player.mode == 'survival') player.inv[player.sel] = { k: itemKey('item:bucket'), c: 1 }; return; }
  if (/_spawn_egg$/.test(n)) { const t = n.replace('_spawn_egg', ''); if (MOBDEF[t]) { let sx, sy, sz; if (hit) { sx = hit.x + .5 + hit.n[0]; sy = hit.y + hit.n[1]; sz = hit.z + .5 + hit.n[2]; if (hit.n[1] == 0) sy = hit.y; } else { const f = fwd(); sx = player.x + f[0] * 3; sz = player.z + f[2] * 3; sy = world.topY(Math.floor(sx), Math.floor(sz)) + 1; } const mm = spawnMob(t, sx, sy, sz); if (MOBDEF[t].fly) mm.y += 3; consume(); } else chat('§7' + prettyName(h.k).replace(' Spawn Egg', '') + ' is not in the game yet'); return; }
  if (!hit) {
    if (n == 'bucket') { // pick water in line of sight
      const d = fwd(); for (let t = .5; t < 5; t += .25) { const x = Math.floor(player.x + d[0] * t), y = Math.floor(player.y + 1.62 + d[1] * t), z = Math.floor(player.z + d[2] * t), b = world.get(x, y, z); if (FLUID[b] && FLVL[b] == 0) { world.set(x, y, z, 0); if (player.mode == 'survival') player.inv[player.sel] = { k: itemKey(SHAPE[b] == 3 ? 'item:water_bucket' : 'item:lava_bucket'), c: 1 }; SND.play(SHAPE[b] == 3 ? 'item/bucket/fill' : 'item/bucket/fill_lava', 1); return; } if (b) break; } }
    return;
  }
  const tb = BL[hit.b].n, sneak = keys.ShiftLeft || keys.ShiftRight;
  const pos = [hit.x, hit.y, hit.z], key = pos.join(',');
  if (!sneak && player.mode != 'spectator' && rsUse(hit)) { swing = 1; return; }
  if (!sneak && player.mode != 'spectator' && /(_door|_trapdoor)/.test(tb) && !/^iron_/.test(tb)) { toggleDoor(hit.x, hit.y, hit.z); swing = 1; return; }
  if (!sneak && player.mode != 'spectator' && BL[hit.b].mmo) { // fence gates
    const st = world.state[key] || (world.state[key] = {}); st.open = !st.open;
    if (st.open && !st.fd) st.fd = 'north';
    if (st.open) { const f = fwd(), look = Math.abs(f[0]) > Math.abs(f[2]) ? (f[0] > 0 ? 'east' : 'west') : (f[2] > 0 ? 'south' : 'north'); if ((st.fd == 'north' || st.fd == 'south') == (look == 'north' || look == 'south')) { st.fd = look; st.fr = BL[hit.b].fy[look]; } }
    const c = world.chunk(hit.x >> 4, hit.z >> 4); if (c) c.dirty = true; SND.play('block/wooden_door/' + (st.open ? 'open' : 'close'), 1, 1, pos); swing = 1; return; }
  if (!sneak && player.mode != 'spectator' && /_button$/.test(tb) && !BYNAME[tb + '_on']) { // every button: powers for 1 s (wood 1.5 s)
    if (!RSS.on.has(key)) { RSS.on.add(key); rsNotify(...pos); SND.play('random/click', .3, .6, pos); setTimeout(() => { RSS.on.delete(key); rsNotify(...pos); SND.play('random/click', .3, .5, pos); }, /stone|blackstone/.test(tb) ? 1000 : 1500); }
    swing = 1; return; }
  if (!sneak && player.mode != 'spectator') {
    if (/command_block$/.test(tb)) { if (!(player.mode == 'creative' || world.meta.cheats)) { chat('§cCommand blocks need Creative mode or cheats'); return; } const st = world.state[key] = world.state[key] || {}; S.cmdKey = key; S.cmdEdit = { cmd: st.cmd || '' }; S.contName = prettyName(hit.b); go('cmdblock'); return; }
    if (/^(dispenser|dropper|hopper|crafter)$/.test(tb)) { const n = tb == 'hopper' ? 5 : 9; S.cont = world.containers[key] || (world.containers[key] = { type: 'chest', slots: Array(n).fill(null) }); S.contName = prettyName(hit.b); S.cpos = null; SND.play('ui_click', .4); go('chest'); return; }
    if (tb == 'crafting_table') { S.grid3 = Array(9).fill(null); go('crafting'); return; }
    if (/^(furnace|furnace_lit|smoker|blast_furnace)$/.test(tb)) { S.cont = world.containers[key] || (world.containers[key] = { type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 1, cook: 0 }); S.contName = prettyName(hit.b); go('furnace'); return; }
    if (/^(chest|barrel)$/.test(tb) || /shulker_box$|_chest$/.test(tb)) { const ck = tb == 'ender_chest' ? 'ender' : key; S.cont = world.containers[ck] || (world.containers[ck] = { type: 'chest', slots: Array(27).fill(null) }); S.contName = prettyName(hit.b); S.cpos = [hit.x, hit.y, hit.z]; SND.play('chestopen', .5); go('chest'); return; }
    if (tb == 'tnt' && /flint_and_steel|fire_charge/.test(n)) { world.set(hit.x, hit.y, hit.z, 0); tnts.push({ x: hit.x + .5, y: hit.y, z: hit.z + .5, vx: 0, vy: 3, vz: 0, r: .49, h: .98, fuse: 4 }); SND.play('fuse'); wear(h, 1); return; }
    if (tb == 'note_block') { SND.play('note/harp', 1, Math.pow(2, ((world.N.hash(hit.x, hit.y, hit.z) * 24 | 0) - 12) / 12)); return; }
    if (tb == 'jukebox') { chat('§7Insert a music disc... (not available)'); return; }
  }
  if (!h) return;
  const p = [hit.x + hit.n[0], hit.y + hit.n[1], hit.z + hit.n[2]];
  if (/_hoe$/.test(n) && /^(grass_block|dirt|dirt_path|coarse_dirt)$/.test(tb) && !world.get(hit.x, hit.y + 1, hit.z)) { world.set(hit.x, hit.y, hit.z, B('farmland')); SND.play('item/hoe/till', 1); wear(h, 1); swing = 1; return; }
  if (/_shovel$/.test(n) && tb == 'grass_block' && hit.n[1] == 1) { world.set(hit.x, hit.y, hit.z, B('dirt_path')); SND.play('item/shovel/flatten', 1); wear(h, 1); swing = 1; return; }
  if (/_axe$/.test(n) && BYNAME['stripped_' + tb]) { world.set(hit.x, hit.y, hit.z, BYNAME['stripped_' + tb]); SND.play('item/axe/strip', 1); wear(h, 1); swing = 1; return; }
  if (n == 'bone_meal') {
    if (/_sapling$/.test(tb)) { const bio = tb.startsWith('birch') ? 'birch' : tb.startsWith('spruce') ? 'taiga' : tb.startsWith('cherry') ? 'cherry' : tb.startsWith('jungle') ? 'jungle' : tb.startsWith('acacia') ? 'savanna' : 'plains'; world.set(hit.x, hit.y, hit.z, 0); growTree(hit.x, hit.y, hit.z, bio); consume(); SND.play('item/bonemeal/bonemeal', 1); return; }
    if (tb == 'grass_block') { for (let i = 0; i < 14; i++) { const x = hit.x + Math.round((Math.random() - .5) * 6), z = hit.z + Math.round((Math.random() - .5) * 6); if (world.get(x, hit.y, z) == B('grass_block') && !world.get(x, hit.y + 1, z)) world.set(x, hit.y + 1, z, Math.random() < .8 ? B('short_grass') : B(['poppy', 'dandelion', 'cornflower'][Math.random() * 3 | 0])); } consume(); for (let i = 0; i < 8; i++) particles.push({ x: hit.x + Math.random(), y: hit.y + 1.2, z: hit.z + Math.random(), vx: 0, vy: .5, vz: 0, life: 1, tile: TEX[B('lime_wool') * 4], g: 0, s: .05 }); return; }
  }
  if (n == 'water_bucket' || n == 'lava_bucket') { if (canPlaceAt(...p)) { world.set(...p, B(n == 'water_bucket' ? 'water' : 'lava')); if (player.mode == 'survival') player.inv[player.sel] = { k: itemKey('item:bucket'), c: 1 }; SND.play(n == 'water_bucket' ? 'item/bucket/empty' : 'item/bucket/empty_lava', 1); } return; }
  if (n == 'bucket') { const b = world.get(...p); if (FLUID[b] && FLVL[b] == 0) { world.set(...p, 0); if (player.mode == 'survival') player.inv[player.sel] = { k: itemKey(SHAPE[b] == 3 ? 'item:water_bucket' : 'item:lava_bucket'), c: 1 }; } return; }
  if (n == 'flint_and_steel' && tb == 'obsidian' && tryPortal(...p)) { wear(h, 1); return; }
  if (n == 'flint_and_steel') { if (canPlaceAt(...p) && SOLID[world.get(p[0], p[1] - 1, p[2])]) { world.set(...p, B('fire')); SND.play('fire/ignite', 1); wear(h, 1); } return; }
  // seeds
  const seedMap = { redstone: 'redstone_wire', wheat_seeds: 'wheat', carrot: 'carrots', potato: 'potatoes', beetroot_seeds: 'beetroots', sweet_berries: 'sweet_berry_bush' };
  let place = h.k < ITEM_BASE ? h.k : seedMap[n] && (tb == 'farmland' || n == 'sweet_berries' || n == 'redstone') && hit.n[1] == 1 ? B(seedMap[n]) : 0;
  if (!place) { const alt = { oak_sign: 0, ladder: 0 }; return; }
  if (canPlaceAt(hit.x, hit.y, hit.z) && SHAPE[hit.b] != 1 && !SBOX[hit.b]) { p[0] = hit.x; p[1] = hit.y; p[2] = hit.z; }
  { const sp = placeSpecial(h, hit, p); if (sp == 'ok') { blockSound(BL[h.k].n, 'place', 1, .8, [hit.x + .5, hit.y + .5, hit.z + .5]); swing = 1; player.stats.placed++; consume(); return; } if (sp == 'fail') return;
    if (sp == 'door') { if (!canPlaceAt(...p)) return; world.set(...p, h.k); world.set(p[0], p[1] + 1, p[2], BYNAME[BL[h.k].n + '_top']); SND.play('block/wooden_door/close', .6, 1, p); swing = 1; consume(); return; }
    if (sp) place = sp; }
  // torches, coral fans and signs placed on the side of a block become their wall version
  let wallFacing = null;
  { const pn = BL[place].n, WALL = { torch: 'wall_torch', soul_torch: 'soul_wall_torch', redstone_torch: 'redstone_wall_torch', copper_torch: 'copper_wall_torch' };
    const wn = WALL[pn] || (/_coral_fan$/.test(pn) ? pn.replace('_coral_fan', '_coral_wall_fan') : /_sign$/.test(pn) && !/hanging|_wall_/.test(pn) ? pn.replace('_sign', '_wall_sign') : /_banner$/.test(pn) && !/_wall_/.test(pn) ? pn.replace('_banner', '_wall_banner') : /(_head|_skull)$/.test(pn) && !/_wall_/.test(pn) ? pn.replace(/_(head|skull)$/, '_wall_$1') : BL[place].fyw ? pn : null);
    if (wn && BYNAME[wn] && hit.n[1] == 0) { place = BYNAME[wn]; wallFacing = hit.n[0] > 0 ? 'east' : hit.n[0] < 0 ? 'west' : hit.n[2] > 0 ? 'south' : 'north'; } }
  if (!canPlaceAt(...p) || p[1] < 0 || p[1] >= WH) return;
  // only small things that sit on something need a block under them (any block, not just full cubes); everything else can go anywhere
  { const pn = BL[place].n, below = world.get(p[0], p[1] - 1, p[2]), above = world.get(p[0], p[1] + 1, p[2]), hangs = hit.n[1] == -1;
    const needsFloor = SHAPE[place] == 6 || /carpet$|pressure_plate$|rail$|^redstone_wire$|^repeater|^comparator|candle$|flower_pot$|^potted_|_head$|_skull$|_banner$|_sign$|dripleaf$|_coral(_fan)?$|^sea_pickle$|^frogspawn$/.test(pn) && !/wall_|hanging_sign/.test(pn);
    if (!wallFacing && needsFloor && (!below || FLUID[below])) return;
    if (/hanging_sign$/.test(pn) && (!above || FLUID[above])) return;
    if (BL[place].mmh && !hangs && (!below || FLUID[below]) && above && !FLUID[above]) { /* lantern under a block hangs */ } }
  if (SHAPE[place] == 2 && !/fire|hanging|vines|propagule_hanging/.test(BL[place].n) && !SOLID[world.get(p[0], p[1] - 1, p[2])] && !/kelp|seagrass/.test(BL[place].n)) return;
  if (SOLID[place]) {
    const bb = [p[0], p[1], p[2], p[0] + 1, p[1] + 1, p[2] + 1];
    const inter = e => e.x + e.r > bb[0] && e.x - e.r < bb[3] && e.y + e.h > bb[1] && e.y < bb[4] && e.z + e.r > bb[2] && e.z - e.r < bb[5];
    if (inter(player) && player.mode != 'spectator' || mobs.some(inter)) return;
  }
  const TOP = BYNAME[BL[place].n + '_top'];
  if (TOP && world.get(p[0], p[1] + 1, p[2])) return;
  let bedHead = null;
  if (BL[place].bed) { const f = fwd(), look = Math.abs(f[0]) > Math.abs(f[2]) ? (f[0] > 0 ? 'east' : 'west') : (f[2] > 0 ? 'south' : 'north'), D = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[look];
    bedHead = [p[0] + D[0], p[1], p[2] + D[1], look]; if (!canPlaceAt(bedHead[0], bedHead[1], bedHead[2]) || !BYNAME[BL[place].n + '_head']) return; }
  world.set(...p, place); if (TOP) world.set(p[0], p[1] + 1, p[2], TOP); rsPlaced(...p, place); rsNotify(...p); swing = 1; player.stats.placed++;
  if (wallFacing && BL[place].fy) world.state[p.join(',')] = { fd: wallFacing, fr: BL[place].fy[wallFacing] };
  { // upside-down stairs, buttons on walls/ceilings, hanging lanterns
    const B0 = BL[place], key0 = p.join(','), st0 = world.state[key0] || {}, f = fwd(), look = Math.abs(f[0]) > Math.abs(f[2]) ? (f[0] > 0 ? 'east' : 'west') : (f[2] > 0 ? 'south' : 'north');
    const side = hit.n[0] > 0 ? 'east' : hit.n[0] < 0 ? 'west' : hit.n[2] > 0 ? 'south' : hit.n[2] < 0 ? 'north' : null;
    if (B0.fyt && hit.n[1] == -1 && st0.fd) { st0.fr = B0.fyt[st0.fd]; st0.top = 1; world.state[key0] = st0; }
    if (B0.fyw2 && side) world.state[key0] = Object.assign(st0, { fd: side, fr: B0.fyw2[side] });
    else if (B0.fyc && hit.n[1] == -1) world.state[key0] = Object.assign(st0, { fd: look, fr: B0.fyc[look] });
    if (B0.mmh && (hit.n[1] == -1 || !world.get(p[0], p[1] - 1, p[2]))) world.state[key0] = Object.assign(st0, { hang: 1 });
    const c0 = world.chunk(p[0] >> 4, p[2] >> 4); if (c0) c0.dirty = true; }
  if (bedHead) { const [hx, hy, hz, look] = bedHead, hb = BYNAME[BL[place].n + '_head']; world.set(hx, hy, hz, hb); world.state[p.join(',')] = { fd: look, fr: BL[place].fy[look] }; world.state[hx + ',' + hy + ',' + hz] = { fd: look, fr: BL[hb].fy[look] }; }
  blockSound(BL[place].n, 'place', 1, .8, [p[0] + .5, p[1] + .5, p[2] + .5]);
  consume();
}
function tryPortal(x, y, z) {
  const OB = B('obsidian'), P = B('nether_portal');
  for (const ax of [0, 2]) {
    const seen = new Set(), st = [[x, y, z]], cells = []; let ok = true;
    while (st.length && ok) { const [a, b, c] = st.pop(), k = a + ',' + b + ',' + c; if (seen.has(k)) continue; seen.add(k); const v = world.get(a, b, c);
      if (v == OB) continue; if (v && BL[v].n != 'fire') { ok = false; break; } cells.push([a, b, c]); if (cells.length > 21 * 21) { ok = false; break; }
      const d = ax == 0 ? [[1, 0, 0], [-1, 0, 0]] : [[0, 0, 1], [0, 0, -1]]; for (const [dx, dy, dz] of [...d, [0, 1, 0], [0, -1, 0]]) st.push([a + dx, b + dy, c + dz]); }
    if (ok && cells.length >= 6) { for (const c of cells) world.set(c[0], c[1], c[2], P); SND.play('fire/ignite', 1); return true; }
  }
  return false;
}
function travel() {
  const target = world.dim == 'nether' ? 'overworld' : 'nether', f = target == 'nether' ? 1 / 8 : 8;
  saveWorld(); const tx = Math.floor(player.x * f), tz = Math.floor(player.z * f);
  world.switchDim(target); mobs = []; items = []; arrows = []; particles = []; tnts = [];
  player.x = tx + .5; player.z = tz + .5; player.vx = player.vy = player.vz = 0; player.portalT = 0; player.portalCool = 6; player.fallStart = null;
  S.loadTitle = target == 'nether' ? 'Entering the Nether' : 'Leaving the Nether'; S.loadSub = 'Building terrain'; S.loadP = 0; startLoad(); go('loading'); SND.play('portal/travel', .5);
  S.afterLoad = () => { placeArrivalPortal(tx, tz); };
}
function placeArrivalPortal(x, z) {
  const P = B('nether_portal'), OB = B('obsidian');
  for (let r = 0; r <= 12; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let y = 4; y < WH - 4; y++) if (world.get(x + dx, y, z + dz) == P && world.get(x + dx, y - 1, z + dz) == OB) { player.x = x + dx + .5; player.y = y; player.z = z + dz + 1.5; if (world.collides(player.x, player.y, player.z, .3, 1.8)) player.z -= 2; return; }
  let y;
  if (world.dim == 'nether') { y = 0; for (let yy = 100; yy > 33; yy--) if (!world.get(x, yy, z) && !world.get(x, yy + 1, z) && !world.get(x, yy + 2, z) && SOLID[world.get(x, yy - 1, z)]) { y = yy; break; } if (!y) y = 64; }
  else y = world.topY(x, z) + 1;
  for (let a = -1; a <= 4; a++) for (let c = -1; c <= 1; c++) { for (let b = 0; b <= 4; b++) world.set(x + a, y + b, z + c, 0); if (!SOLID[world.get(x + a, y - 1, z + c)]) world.set(x + a, y - 1, z + c, OB); }
  for (let a = 0; a <= 3; a++) for (let b = -1; b <= 3; b++) { const edge = a == 0 || a == 3 || b == -1 || b == 3; world.set(x + a, y + b, z, edge ? OB : P); }
  player.x = x + 1.5; player.y = y; player.z = z + 1.5;
}
function growTree(x, y, z, bio) {
  const put = (a, b2, c, v, rep) => { if (rep || !world.get(a, b2, c) || SHAPE[world.get(a, b2, c)] == 2) world.set(a, b2, c, v); };
  world.tree((a, b2, c, v, rep) => put(x + a, b2, z + c, v, rep), 0, y, 0, bio, Math.random());
}
function explode(x, y, z, R0, power) {
  SND.play('explode', 1, .8 + Math.random() * .3, [x, y, z]);
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
    const d = Math.hypot(dx, dy, dz); if (d > R0 * (0.7 + Math.random() * .5)) continue;
    const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz, b = world.get(bx, by, bz);
    if (!b || SHAPE[b] == 3 || blockProps(b).h < 0 || blockProps(b).h >= 50) continue;
    if (BL[b].n == 'tnt') { world.set(bx, by, bz, 0); tnts.push({ x: bx + .5, y: by, z: bz + .5, vx: (Math.random() - .5) * 4, vy: 4, vz: (Math.random() - .5) * 4, r: .49, h: .98, fuse: .5 + Math.random() }); continue; }
    world.set(bx, by, bz, 0); if (Math.random() < .3) for (const [k, c] of drops(b)) dropItem(k, c, bx + .5, by + .5, bz + .5);
  }
  for (let i = 0; i < 40; i++) particles.push({ x: x + (Math.random() - .5) * 4, y: y + Math.random() * 3, z: z + (Math.random() - .5) * 4, vx: (Math.random() - .5) * 2, vy: Math.random() * 2, vz: (Math.random() - .5) * 2, life: 1 + Math.random(), tile: TEX[B('light_gray_wool') * 4], g: -1, s: .3 });
  const rr = R0 * 2; const pd = Math.hypot(player.x - x, player.y - y, player.z - z);
  if (pd < rr) { const f = 1 - pd / rr; hurtPlayer(Math.round(f * 22 * power), 'blew up', false, [x, y - 1, z]); player.vx += (player.x - x) / (pd || 1) * f * 12; player.vy += 7 * f; player.vz += (player.z - z) / (pd || 1) * f * 12; }
  for (const m of mobs) { const md = Math.hypot(m.x - x, m.y - y, m.z - z); if (md < rr && !m.dead) { m.hurtT = 0; hurtMob(m, (1 - md / rr) * 20, (m.x - x) / (md || 1), (m.z - z) / (md || 1)); } }
  S.shake = .4;
}
let arrows = [];
function tpMob(m, cx, cz, r) { for (let i = 0; i < 16; i++) { const x = Math.floor(cx + (Math.random() - .5) * 2 * r), z = Math.floor(cz + (Math.random() - .5) * 2 * r), y = world.topY(x, z) + 1; if (y > 1 && SHAPE[world.get(x, y - 1, z)] != 3 && !world.collides(x + .5, y, z + .5, m.r, m.h)) { SND.play('mob/endermen/portal', 1, 1, [m.x, m.y, m.z]); for (let k = 0; k < 10; k++) particles.push({ x: m.x, y: m.y + Math.random() * m.h, z: m.z, vx: (Math.random() - .5), vy: Math.random(), vz: (Math.random() - .5), life: .7, tile: TEX[B('purple_wool') * 4], g: 0, s: .04 }); m.x = x + .5; m.y = y; m.z = z + .5; return; } } }
function shootFireball(m, t) { const sx = m.x, sy = m.y + 2, sz = m.z, dx = t.x - sx, dy = t.y + 1 - sy, dz = t.z - sz, d = Math.hypot(dx, dy, dz) || 1; arrows.push({ x: sx, y: sy, z: sz, vx: dx / d * 12, vy: dy / d * 12, vz: dz / d * 12, life: 10, fire: 1 }); SND.play('mob/ghast/fireball4', 1, 1, [m.x, m.y, m.z]); }
function shootArrow(m, t) {
  const sx = m.x, sy = m.y + 1.5, sz = m.z, dx = t.x - sx, dz = t.z - sz, dh = Math.hypot(dx, dz), dy = t.y + 1.2 - sy;
  const sp = 22, vy = dy / dh * sp + dh * .08 * 9.8 / sp * 2;
  arrows.push({ x: sx - Math.sin(m.yaw) * .5, y: sy, z: sz - Math.cos(m.yaw) * .5, vx: dx / dh * sp + (Math.random() - .5) * 1.5, vy: vy + (Math.random() - .5), vz: dz / dh * sp + (Math.random() - .5) * 1.5, life: 30, from: m });
  SND.play('random/bow', 1, .9 + Math.random() * .3, [m.x, m.y, m.z]);
}
function updateArrows(dt) {
  for (const a of arrows) {
    a.life -= dt; if (a.stuck) continue;
    if (a.reflect === undefined) for (const mm of mobs) if (a.byPlayer && !mm.dead && Math.abs(a.x - mm.x) < mm.r + .2 && a.y > mm.y && a.y < mm.y + mm.h && Math.abs(a.z - mm.z) < mm.r + .2) { a.life = 0; hurtMob(mm, 6, a.vx / 20, a.vz / 20); }
    if (!a.fire) a.vy -= 20 * dt; else if (Math.random() < .5) particles.push({ x: a.x, y: a.y, z: a.z, vx: 0, vy: .3, vz: 0, life: .4, tile: TEX[B('gray_wool') * 4], g: 0, s: .15 }); const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
    if (a.fire && (SOLID[world.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))] || Math.hypot(nx - player.x, ny - player.y - 1, nz - player.z) < 1.2)) { a.life = 0; explode(nx, ny, nz, 1.6, .5); continue; }
    if (SOLID[world.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { a.stuck = true; a.life = Math.min(a.life, 20); SND.play('random/bowhit', .5, 1, [nx, ny, nz]); continue; }
    a.x = nx; a.y = ny; a.z = nz;
    if (Math.abs(a.x - player.x) < .4 && a.y > player.y && a.y < player.y + 1.8 && Math.abs(a.z - player.z) < .4 && player.mode == 'survival' && !a.fire) { a.life = 0; hurtPlayer([0, 2, 3, 4][world.meta.diff] + (Math.random() * 2 | 0), 'was shot by Skeleton', false, [a.x - a.vx, a.y, a.z - a.vz]); }
  }
  arrows = arrows.filter(a => a.life > 0);
}
function hostileSpawn(dt) {
  if (world.meta.diff == 0 || player.mode == 'spectator') return;
  S.spawnT = (S.spawnT ?? 2) - dt; if (S.spawnT > 0) return; S.spawnT = 1.5;
  const host = mobs.filter(m => MOBDEF[m.type].hostile).length, night = world.dim == 'nether' || skyState().day < .45;
  if (host >= 20) return;
  const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 24, x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.chunk(x >> 4, z >> 4)) return;
  let y;
  if (world.dim == 'nether') { y = 33 + Math.floor(Math.random() * 60); while (y > 32 && !(world.get(x, y, z) == 0 && world.get(x, y + 1, z) == 0 && SOLID[world.get(x, y - 1, z)])) y--; if (y <= 32) return; }
  else if (night && Math.random() < .7) { y = world.topY(x, z) + 1; if (SHAPE[world.get(x, y - 1, z)] == 3) return; }
  else { // dark caves
    y = 5 + Math.floor(Math.random() * Math.max(5, world.topY(x, z) - 10)); if (world.get(x, y, z) || world.get(x, y + 1, z) || !SOLID[world.get(x, y - 1, z)]) return;
    const c = world.chunk(x >> 4, z >> 4); if (!c.L) return; const l = c.L[lidx(x & 15, y, z & 15)]; if ((l >> 4) > 4 || (l & 15) > 0) return;
  }
  let types = ['zombie', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman']; if (y < 40 && Math.random() < .25) types = ['slime'];
  if (world.dim == 'nether') { types = Math.random() < .2 ? ['ghast'] : ['zombified_piglin']; if (types[0] == 'ghast') y = y + 8; }
  const t = types[Math.random() * types.length | 0];
  if (world.collides(x + .5, y, z + .5, MOBDEF[t].w / 2, MOBDEF[t].h)) return;
  spawnMob(t, x + .5, y, z + .5);
}
// TNT
function updateTnt(dt) {
  for (const t of tnts) {
    t.fuse -= dt; t.vy -= 25 * dt; moveBody(world, t, dt);
    if (t.fuse <= 0) { t.dead = true; explode(t.x, t.y + .5, t.z, 3.5, 1); }
  }
  tnts = tnts.filter(t => !t.dead);
}
// particles
function spawnBreakParticles(hit, n) {
  const tile = SHAPE[hit.b] >= 3 && SHAPE[hit.b] <= 4 ? TEX[B('stone') * 4] : TEX[hit.b * 4 + 2];
  for (let i = 0; i < n; i++) particles.push({ x: hit.x + Math.random(), y: hit.y + Math.random(), z: hit.z + Math.random(), vx: (Math.random() - .5) * 3, vy: Math.random() * 3, vz: (Math.random() - .5) * 3, life: .4 + Math.random() * .6, tile, g: 1, s: .04 + Math.random() * .03, ou: Math.random() * .75, ov: Math.random() * .75 });
}
function spawnEatParticles(k) {
  const f = fwd(); for (let i = 0; i < 4; i++) particles.push({ x: player.x + f[0] * .5, y: player.y + 1.4, z: player.z + f[2] * .5, vx: (Math.random() - .5) * 2, vy: 1.5, vz: (Math.random() - .5) * 2, life: .5, item: k, g: 1, s: .04, ou: Math.random() * .75, ov: Math.random() * .75 });
}
// ---------------- world tick ----------------
function updateWorld(dt) {
  const m = world.meta; m.time = (m.time + dt * 20 * api.settings.timeScale) % 24000; player.stats.time += dt; modEmit('tick', dt); netTick(dt);
  if (world.dim == 'nether') m.rain = false;
  m.weatherT -= dt; if (m.weatherT <= 0 && world.dim != 'nether') { m.rain = !m.rain && Math.random() < .5; m.thunder = m.rain && Math.random() < .3; m.weatherT = m.rain ? 300 + Math.random() * 400 : 600 + Math.random() * 1200; SND.setRain(m.rain); }
  if (m.thunder && Math.random() < dt / 20) { S.flash = .3; setTimeout(() => SND.play('thunder', .7), 600); }
  tickFurnaces(dt); rsTick(dt); fluidTick(dt); updateFalling(dt);
  // chunk loading
  const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16), R = opts.rd;
  let gen = 0, msh = 0, upg = 0; const t0 = performance.now(); const FULL_R = 4; // chunks within 4 get their full underground
  const order = []; for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) if (dx * dx + dz * dz <= (R + 1.5) ** 2) order.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
  order.sort((a, b) => a[0] - b[0]);
  for (const [d2, cx, cz] of order) {
    let c = world.chunk(cx, cz);
    if (!c) { if (gen < (opts.rd > 12 ? 6 : 2) && performance.now() - t0 < (opts.rd > 12 ? 18 : 12)) { c = world.generate(cx, cz, d2 > FULL_R * FULL_R); gen++; if (d2 > 4) naturalSpawn(c); } continue; }
    if (c.lite && d2 <= FULL_R * FULL_R && !upg && performance.now() - t0 < 14) { c = world.upgrade(c); upg = 1; }
    if (c.dirty && d2 <= (R + .5) ** 2 && msh < (opts.rd > 12 ? 6 : 3) && performance.now() - t0 < (opts.rd > 12 ? 24 : 16)) {
      if (world.chunk(cx + 1, cz) && world.chunk(cx - 1, cz) && world.chunk(cx, cz + 1) && world.chunk(cx, cz - 1)) { world.mesh(c); msh++; }
    }
  }
  // urgent: dirty chunks near player (edits)
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const c = world.chunk(pcx + dx, pcz + dz); if (c && c.dirty && c.meshes) world.mesh(c); }
  for (const c of [...world.chunks.values()]) if (Math.abs(c.cx - pcx) > R + 3 || Math.abs(c.cz - pcz) > R + 3) world.unload(c);
  // particles
  for (const p of particles) { p.life -= dt; p.vy -= (p.g ?? 1) * 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.g && SOLID[world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))]) { p.vy = 0; p.vx *= .5; p.vz *= .5; p.y = Math.ceil(p.y); } }
  particles = particles.filter(p => p.life > 0);
  // ambience
  if ((S.caveT = (S.caveT ?? 60) - dt) <= 0) { S.caveT = 60 + Math.random() * 240; if (world.dim == 'nether') SND.play('ambient/nether/nether_wastes/mood', .5); else if (player.y < 50) SND.play('cave', .5); }
  if (!SND.music) { SND.musicTimer -= dt; if (SND.musicTimer <= 0) SND.playMusic(world.dim == 'nether' ? 'nether' : player.mode == 'creative' ? 'creative' : 'game'); }
  if ((S.saveT = (S.saveT ?? 30) - dt) <= 0) { S.saveT = 45; saveWorld(); }
  for (const t of toasts) t.t += dt; toasts = toasts.filter(t => t.t < 5);
}
// ---------------- rendering ----------------
let dyn = {};
function dynMesh(name, arr) { dyn[name] = mkMesh(new Float32Array(arr), dyn[name]); return dyn[name]; }
function skyState() {
  if (world && world.dim == 'nether') return { a: 0, day: 0, sky: [.2, .03, .03], fog: [.2, .04, .03], sunset: 0, nether: 1 };
  const t = world ? world.meta.time : 6000, a = (t / 24000) * Math.PI * 2, sy = Math.sin(a);
  let day = clamp(sy * 2.5 + .5, 0, 1); if (world && world.meta.rain) day *= .7;
  const nightC = [.02, .03, .08], dayC = world && world.meta.rain ? [.45, .5, .58] : [.47, .65, 1], sunset = Math.max(0, 1 - Math.abs(sy) * 4) * (world && world.meta.rain ? .3 : 1);
  const c = dayC.map((v, i) => lerp(nightC[i], v, day));
  const fog = c.map((v, i) => lerp(v, [1, .55, .3][i], sunset * .5));
  return { a, day: Math.max(day, .22), sky: c, fog, sunset };
}
function camMatrices(fovMul = 1) {
  const W = glc.width, H = glc.height; const P = player;
  if (P) P.fovK = lerp(P.fovK || 1, P.sprint ? (P.fly ? 1.1 : 1.08) : 1, .08); let fov = opts.fov * (P ? P.fovK : 1) * fovMul;
  const proj = M4.persp(fov * Math.PI / 180, W / H, .05, Math.max(1000, opts.rd * 24));
  return proj;
}
function render(dt) {
  animTick(performance.now());
  const W = glc.width, H = glc.height; gl.viewport(0, 0, W, H);
  if (!world || S.screen == 'loading') { renderPanorama(dt); return; }
  const P = player, sk = skyState(), u = PROG.u;
  const underwater = P.headWater, inLava = SHAPE[world.get(Math.floor(P.x), Math.floor(P.y + 1.62), Math.floor(P.z))] == 4;
  let fogC = underwater ? [.05, .15, .45].map(v => v * sk.day * 1.3) : inLava ? [.6, .1, 0] : sk.fog;
  const flash = S.flash > 0 ? S.flash : 0; if (flash) { S.flash -= dt; fogC = fogC.map(v => Math.min(1, v + flash)); }
  gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const sneak = (keys.ShiftLeft || keys.ShiftRight) && !P.fly && S.screen == 'game';
  P.eyeH = lerp(P.eyeH ?? 1.62, sneak ? 1.27 : 1.62, Math.min(1, dt * 12));
  // bobbing
  const spd = Math.hypot(P.vx, P.vz); P.bob = (P.bob || 0) + (P.ground ? spd * dt * 1.6 : 0); const bobA = opts.bob && P.ground && !P.fly ? Math.min(1, spd / 4.3) : 0; P.bobA = lerp(P.bobA || 0, bobA, Math.min(1, dt * 8));
  const bx = Math.sin(P.bob * Math.PI) * .05 * P.bobA, by = -Math.abs(Math.cos(P.bob * Math.PI)) * .08 * P.bobA;
  let eye = [P.x, P.y + P.eyeH, P.z]; const realEye = eye.slice();
  let camYaw = P.yaw, camPitch = P.pitch;
  if (P.view) { const f = fwd(), dir = P.view == 1 ? -1 : 1; let d = 4; for (let t = .3; t <= 4; t += .1) { const b = world.get(Math.floor(eye[0] + f[0] * t * dir), Math.floor(eye[1] + f[1] * t * dir), Math.floor(eye[2] + f[2] * t * dir)); if (OPAQUE[b]) { d = Math.max(.3, t - .3); break; } } eye = eye.map((v, i) => v + f[i] * d * dir); if (P.view == 2) { camYaw = P.yaw + Math.PI; camPitch = -P.pitch; } }
  const proj = camMatrices(underwater ? .9 : 1);
  const hurt = P.hurtT > 0 ? Math.sin(P.hurtT / .5 * Math.PI) * .25 : 0;
  const rot = M4.chain(M4.rx(-camPitch), M4.ry(-camYaw));
  const view = M4.mul(rot, M4.trans(-eye[0], -eye[1], -eye[2]));
  const PV = M4.mul(proj, view); NET.PV = PV;
  gl.useProgram(PROG.p); gl.uniformMatrix4fv(u.uPV, false, PV); gl.uniform3f(u.uCam, eye[0], eye[1], eye[2]);
  gl.uniform3f(u.uFog, fogC[0], fogC[1], fogC[2]);
  gl.uniform1f(u.uMinL, api.settings.fullbright ? 1 : sk.nether ? .28 : .09); const fogF = underwater ? 20 : inLava ? 2 : sk.nether ? Math.min(80, opts.rd * 12) : opts.rd * 16 * (world.meta.rain ? .8 : 1), fogN = underwater ? 0 : inLava ? 0 : fogF * .6;
  // sky objects
  gl.depthMask(false); gl.uniform1f(u.uFogN, 1e4); gl.uniform1f(u.uFogF, 2e4); gl.uniform1f(u.uDay, 1);
  if (!underwater && !sk.nether) {
    const a = sk.a, dir = [Math.cos(a), Math.sin(a), 0], up = [-Math.sin(a), Math.cos(a), 0], side = [0, 0, 1];
    const quad = (dist, size, d) => { const c = d.map((v, i) => eye[i] + v * dist), U = side.map(v => v * size), V = up.map(v => v * size); return [[c[0] - U[0] - V[0], c[1] - U[1] - V[1], c[2] - U[2] - V[2]], [c[0] + U[0] - V[0], c[1] + U[1] - V[1], c[2] + U[2] - V[2]], [c[0] + U[0] + V[0], c[1] + U[1] + V[1], c[2] + U[2] + V[2]], [c[0] - U[0] + V[0], c[1] - U[1] + V[1], c[2] - U[2] + V[2]]]; };
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    // stars
    const starA = clamp(1 - sk.day * 1.6, 0, 1) * (world.meta.rain ? 0 : 1);
    if (starA > 0) { if (!dyn.stars) { const arr = [], rnd = makeNoise(10842).hash; for (let i = 0; i < 1500; i++) { const th = rnd(i, 1, 2) * 6.283, ph = Math.acos(rnd(i, 3, 4) * 2 - 1), s = .15 + rnd(i, 5, 6) * .25; const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; const r = 100; const t1 = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; const ax = [d[1] * t1[2] - d[2] * t1[1], d[2] * t1[0] - d[0] * t1[2], d[0] * t1[1] - d[1] * t1[0]]; const al = Math.hypot(...ax); const A = ax.map(v => v / al * s), Bv = [d[1] * A[2] - d[2] * A[1], d[2] * A[0] - d[0] * A[2], d[0] * A[1] - d[1] * A[0]]; const c = d.map(v => v * r); pushQuad(arr, [[c[0] - A[0] - Bv[0], c[1] - A[1] - Bv[1], c[2] - A[2] - Bv[2]], [c[0] + A[0] - Bv[0], c[1] + A[1] - Bv[1], c[2] + A[2] - Bv[2]], [c[0] + A[0] + Bv[0], c[1] + A[1] + Bv[1], c[2] + A[2] + Bv[2]], [c[0] - A[0] + Bv[0], c[1] - A[1] + Bv[1], c[2] - A[2] + Bv[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]); } dyn.stars = mkMesh(new Float32Array(arr)); }
      drawMesh(dyn.stars, 'white', { model: M4.chain(M4.trans(eye[0], eye[1], eye[2]), M4.rz(sk.a)), alphaTest: 0, alpha: starA, full: 1 }); }
    const sa = world.meta.rain ? .3 : 1;
    const sun = []; pushQuad(sun, quad(100, 15, dir), [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]);
    drawMesh(dynMesh('sun', sun), 'sun', { alphaTest: 0, full: 1, alpha: sa });
    const moon = []; pushQuad(moon, quad(100, 10, dir.map(v => -v)), [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]);
    drawMesh(dynMesh('moon', moon), 'moon' + (Math.floor((world.meta.day || 0)) % 8 + 4) % 8, { alphaTest: 0, full: 1, alpha: sa });
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND);
  }
  gl.depthMask(true);
  gl.uniform1f(u.uFogN, fogN); gl.uniform1f(u.uFogF, fogF); gl.uniform1f(u.uDay, sk.day);
  // chunks
  const f = fwd(), vis = [];
  for (const c of world.chunks.values()) {
    if (!c.meshes) continue; const ccx = c.cx * 16 + 8 - eye[0], ccz = c.cz * 16 + 8 - eye[2], d = Math.hypot(ccx, ccz);
    if (d > (opts.rd + 1) * 16) continue;
    if (d > 24 && (ccx * f[0] + ccz * f[2]) / d < -0.5 + Math.min(0, f[1] * f[1] - .5) && Math.abs(f[1]) < .8) continue;
    vis.push([d, c]);
  }
  vis.sort((a, b) => a[0] - b[0]);
  for (const [, c] of vis) drawMesh(c.meshes[0], 'blocks', { alphaTest: .5 });
  // entities
  renderEntities(sk);
  // breaking overlay
  if (breaking && breaking.p > 0) { const st = Math.min(9, Math.floor(breaking.p * 10)), arr = []; cubeQuads(arr, breaking.x, breaking.y, breaking.z, tileUV(REG.tiles['destroy_stage_' + st]), 1.002); gl.enable(gl.BLEND); gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR); gl.depthMask(false); drawMesh(dynMesh('brk', arr), 'blocks', { alphaTest: .01, full: 1 }); gl.depthMask(true); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); }
  // selection box
  if (P.target && !hideHud && S.screen == 'game') { const t = P.target, e = .002, bb = BL[t.b].bb ? BL[t.b].bb.map(v => v / 16) : [0, 0, 0, 1, SHAPE[t.b] == 2 ? .8 : SHAPE[t.b] == 6 ? .0625 : 1, 1], x0 = t.x + bb[0] - e, y0 = t.y + bb[1] - e, z0 = t.z + bb[2] - e, x1 = t.x + bb[3] + e, y1 = t.y + bb[4] + e, z1 = t.z + bb[5] + e; const L = [], v = (x, y, z) => L.push(x, y, z, 0, 0, 1, 1, 1); const ed = [[x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1], [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1], [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1]]; for (const s of ed) { v(s[0], s[1], s[2]); v(s[3], s[4], s[5]); } gl.enable(gl.BLEND); drawMesh(dynMesh('sel', L), 'white', { lines: 1, tint: [0, 0, 0, 1], alpha: .5, alphaTest: 0, full: 1 }); gl.disable(gl.BLEND); }
  // translucent: clouds, water, glass
  gl.enable(gl.BLEND);
  for (let i = vis.length - 1; i >= 0; i--) { const c = vis[i][1]; drawMesh(c.meshes[1], 'blocks', { alphaTest: .01 }); }
  const fr = Math.floor(performance.now() / 100);
  for (let i = vis.length - 1; i >= 0; i--) { const c = vis[i][1]; if (c.meshes[3]) { gl.disable(gl.BLEND); drawMesh(c.meshes[3], 'lava', { frames: IMG.lava.height / IMG.lava.width, frame: Math.floor(fr / 2) % (IMG.lava.height / IMG.lava.width), alphaTest: 0, full: 1 }); gl.enable(gl.BLEND); } }
  for (let i = vis.length - 1; i >= 0; i--) { const c = vis[i][1]; drawMesh(c.meshes[2], 'water', { frames: IMG.water.height / IMG.water.width, frame: fr % (IMG.water.height / IMG.water.width), alphaTest: 0, alpha: 1.15 }); }
  renderParticles(view, sk);
  if (opts.clouds && !sk.nether) { const cy = 192.5, sz = 640, t = performance.now() / 1000 * .6 + world.meta.time * 0; const sc = 1 / (12 * 256), ox = (eye[0] + t) * sc, oz = eye[2] * sc, h = sz * sc; const arr = []; pushQuad(arr, [[eye[0] - sz, cy, eye[2] - sz], [eye[0] + sz, cy, eye[2] - sz], [eye[0] + sz, cy, eye[2] + sz], [eye[0] - sz, cy, eye[2] + sz]], [[ox - h, oz - h], [ox + h, oz - h], [ox + h, oz + h], [ox - h, oz + h]], [1, 1, 1]); gl.uniform1f(u.uFogN, 100); gl.uniform1f(u.uFogF, 500); gl.uniform1f(u.uDay, Math.max(.25, sk.day)); drawMesh(dynMesh('cloud', arr), 'clouds', { alphaTest: .3, alpha: .8, full: 0 }); gl.uniform1f(u.uFogN, fogN); gl.uniform1f(u.uFogF, fogF); gl.uniform1f(u.uDay, sk.day); }
  // rain / snow
  if (world.meta.rain && !sk.nether) renderRain(eye);
  gl.disable(gl.BLEND);
  // held item / hand
  if (!hideHud && P.mode != 'spectator' && !P.view) renderHand(proj, sk, dt);
}
function cubeQuads(arr, x, y, z, uv, s = 1) {
  const o = (1 - s) / 2, x0 = x + o, y0 = y + o, z0 = z + o, x1 = x + 1 - o, y1 = y + 1 - o, z1 = z + 1 - o, U = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]];
  for (const C of [[[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]]) pushQuad(arr, C, U, [1, 1, 1]);
}
const itemMeshCache = {};
function itemMesh(k) { // returns [mesh, tex] centered at origin, unit size
  if (itemMeshCache[k]) return itemMeshCache[k];
  const arr = []; let tex = 'blocks';
  if (k < ITEM_BASE && (SHAPE[k] == 1 || SHAPE[k] == 5)) {
    const F = [[[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], 2, .6], [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], 2, .6], [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5], 0, 1], [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], 1, .5], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5], 3, .8], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5], 2, .8]];
    for (const f of F) { const uv = tileUV(TEX[k * 4 + f[4]]); pushQuad(arr, f.slice(0, 4), [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]], [f[5], 1, 0]); }
  } else {
    let uv; const it = k >= ITEM_BASE ? k - ITEM_BASE : ITEMS.indexOf(BL[k].n);
    if (it >= 0) { uv = itemUV(it); tex = 'items'; } else if (SHAPE[k] == 3 || SHAPE[k] == 4) { uv = [0, 0, 1, 1 / 32]; tex = SHAPE[k] == 3 ? 'water' : 'lava'; } else uv = tileUV(TEX[k * 4]);
    // extruded sprite: front, back + thin sides
    const U = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]], d = 1 / 32;
    pushQuad(arr, [[-.5, -.5, d], [.5, -.5, d], [.5, .5, d], [-.5, .5, d]], U, [1, 1, 0]);
    pushQuad(arr, [[.5, -.5, -d], [-.5, -.5, -d], [-.5, .5, -d], [.5, .5, -d]], [U[1], U[0], U[3], U[2]], [.8, 1, 0]);
    const N = 16; for (let i = 0; i < N; i++) { const a = -.5 + i / N, b = a + 1 / N, ua = lerp(uv[0], uv[2], (i + .5) / N); for (let j = 0; j < 1; j++) { pushQuad(arr, [[a, -.5, -d], [a, -.5, d], [a, .5, d], [a, .5, -d]], [[ua, uv[3]], [ua, uv[3]], [ua, uv[1]], [ua, uv[1]]], [.7, 1, 0]); const va = lerp(uv[1], uv[3], (i + .5) / N); pushQuad(arr, [[-.5, .5 - i / N, -d], [.5, .5 - i / N, -d], [.5, .5 - i / N, d], [-.5, .5 - i / N, d]], [[uv[0], va], [uv[2], va], [uv[2], va], [uv[0], va]], [.9, 1, 0]); } }
  }
  return itemMeshCache[k] = [mkMesh(new Float32Array(arr)), tex];
}
function lightAt(x, y, z) { const c = world.chunk(Math.floor(x) >> 4, Math.floor(z) >> 4); if (!c || !c.L || y < 0 || y >= WH) return [1, 0]; const l = c.L[lidx(Math.floor(x) & 15, Math.floor(y), Math.floor(z) & 15)]; return [Math.pow(.82, 15 - (l >> 4)), Math.pow(.82, 15 - (l & 15))]; }
function renderEntities(sk) {
  const u = PROG.u, t = performance.now() / 1000;
  const P = player, pobj = P.view && P.mode != 'spectator' ? { type: 'player', x: P.x, y: P.y, z: P.z, yaw: P.yaw, walk: (P.bob || 0) * Math.PI, vx: P.vx, vz: P.vz, target: 1, lookP: P.pitch, hurtT: P.hurtT > 0 ? P.hurtT : 0, holdK: held() && held().k, sneak: (keys.ShiftLeft || keys.ShiftRight) && !P.fly, swingT: typeof swing != 'undefined' ? swing : 0, sprinting: P.sprint } : null;
  for (const m of [...mobs, ...netAvatarsFor(), ...(pobj ? [pobj] : [])]) {
    const L = lightAt(m.x, m.y + .5, m.z); gl.uniform1f(u.uDay, Math.max(sk.day * L[0], L[1]));
    const D0 = MOBDEF[m.type], sc = (D0.scale || 1) * (m.size || 1) / 16; const parts = getModel(m.type), base = M4.chain(M4.trans(m.x, m.y + (D0.fly ? Math.sin(t + m.x) * .1 : 0), m.z), M4.ry(m.yaw), D0.slime ? M4.scale(sc * (1 - (m.sq || 0) * .4), sc * (1 + (m.sq || 0)), sc * (1 - (m.sq || 0) * .4)) : M4.scale(sc, sc, sc));
    const sw = Math.sin(m.walk) * .7 * Math.min(1, Math.hypot(m.vx, m.vz));
    const fl = m.fuse > 0 && Math.floor(m.fuse * 8) % 2;
    if (m.fuse > 0) { const s = 1 + (1.5 - m.fuse) * .12; M4.mul; }
    for (const p of parts) {
      if (p.wool && m.sheared) continue;
      const pv = p.pivot || p.hp || p.pos; let ax = 0, ay = p.ry || 0;
      if (p.leg !== undefined) ax = p.leg ? sw : -sw;
      else if (p.arm !== undefined) ax = (p.fwd ? Math.PI / 2 : 0) + (p.arm ? -sw : sw) * (p.fwd ? .15 : .8) + (m.atkT > 0 ? Math.sin(m.atkT * Math.PI) * .9 : 0) + (MOBDEF[m.type].ranged && m.target ? Math.PI / 2 : 0);
      else if (p.head) ax = m.target ? clamp(m.lookP || 0, -.6, .6) : Math.sin(t * .7 + m.x) * .1;
      else if (p.sleg !== undefined) ay += (p.sleg ? sw : -sw) * .4;
      else if (p.tail) ax = .9 + Math.sin(t * 6) * .1;
      else if (p.tent !== undefined) ax = Math.sin(t * 2 + p.tent) * .25;
      let rzv = p.rz || 0;
      if (p.head && m.eatT > 0) ax = Math.min(1, Math.min(m.eatT, 2 - m.eatT) * 3) * 1.1 + (m.eatT > .4 && m.eatT < 1.6 ? Math.sin(t * 25) * .08 : 0); // grazing
      if (p.arm !== undefined && !p.fwd && !(m.atkT > 0)) rzv += (p.arm ? -1 : 1) * (Math.cos(t * 1.8 + m.x) * .05 + .05); // idle arm sway
      if (p.wing) rzv += p.wing * (m.ground === false || m.vy < -1 ? .6 + Math.sin(t * 28) * .6 : 0); // chickens flap while falling
      if (p.orbit) ay += t * 1.6 * (p.orbit > 0 ? 1 : -1); // blaze rods circle the body
      if (p.tail && m.tamed) { ay += Math.sin(t * 12) * .5; ax = .9 - (1 - (m.hp || 8) / 20) * .5; } // happy tail
      if (p.tail && D0.horse) { ay += Math.sin(t * 1.3 + m.x) * .25; }
      let pvv = pv, off = null;
      if (m.type == 'player' || D0.humanPose) { // the player's pose: sneaking leans the body forward, arms forward, legs back
        if (m.sneak) {
          if (p.leg !== undefined) off = [0, -.2, 4];
          else { off = [0, -3.2, 0]; if (p.arm !== undefined) ax += .4; else if (!p.head) { pvv = [0, 24, 0]; ax -= .5; } }
        }
        if (p.arm !== undefined && m.swingT > 0 && p.hand) ax += Math.sin(m.swingT * Math.PI) * 1.4; // punching / using an item
        if (p.arm !== undefined && m.sprinting) ax *= 1.25;
      }
      let M = M4.chain(base, off ? M4.trans(off[0], off[1], off[2]) : ID, M4.trans(...pvv), M4.ry(ay), M4.rz(rzv), M4.rx(ax), M4.trans(p.pos[0] - pvv[0], p.pos[1] - pvv[1], p.pos[2] - pvv[2]));
      if (p.rot) M = M4.mul(M, M4.rx(p.rot[0]));
      if (m.fuse > 0) { const s = 1 + (1.5 - m.fuse) * .1; M = M4.chain(M4.trans(m.x, m.y, m.z), M4.scale(s, s, s), M4.trans(-m.x, -m.y, -m.z), M); }
      const tx = p.tex == 'ghast' && m.shootT > 0 ? 'ghast_shooting' : p.tex == 'wolf' && m.tamed ? 'wolf_tame' : p.tex == 'wolf' && m.provoked ? 'wolf_angry' : p.tex;
      const txs = m.skinTex && (p.tex || 'steve') == MOBDEF.player.tex ? m.skinTex : null;
      if (p.trans) { gl.enable(gl.BLEND); drawMesh(p.mesh, tx, { model: M, alpha: .75, alphaTest: .05 }); gl.disable(gl.BLEND); continue; }
      if (p.hand && (m.holdK || D0.hold)) { const [im, it] = itemMesh(m.holdK || itemKey(D0.hold)); const HM = M4.chain(M, M4.trans(0, -p.box[1] / 2 - 1, -1), M4.rx(-Math.PI / 2), M4.ry(Math.PI / 2), M4.rz((m.holdK ? keyName(m.holdK) == 'bow' : D0.hold == 'item:bow') ? -Math.PI / 4 : Math.PI / 4 * 3), M4.scale(10, 10, 10)); drawMesh(im, it, { model: HM, alphaTest: .1, tint: m.hurtT > 0 ? [1, 0, 0, .4] : [0, 0, 0, 0] }); }
      drawMesh(p.mesh, txs || tx, { model: M, tint: m.hurtT > 0 ? [1, 0, 0, .4] : fl ? [1, 1, 1, .6] : [0, 0, 0, 0], alphaTest: .1, full: p.glow ? 1 : 0 });
    }
  }
  for (const it of items) {
    const [mesh, tex] = itemMesh(it.k), L = lightAt(it.x, it.y + .2, it.z); gl.uniform1f(u.uDay, Math.max(sk.day * L[0], L[1]));
    const s = it.k < ITEM_BASE && SHAPE[it.k] == 1 ? .25 : .4;
    const M = M4.chain(M4.trans(it.x, it.y + .15 + Math.sin(it.age * 2) * .05 + s / 2, it.z), M4.ry(it.age * 1.5), M4.scale(s, s, s));
    drawMesh(mesh, tex, { model: M });
    if (it.c > 1) drawMesh(mesh, tex, { model: M4.mul(M4.trans(.06, .06, .06), M) });
  }
  for (const a of arrows) { const [mesh, tex] = itemMesh(itemKey(a.fire ? 'item:fire_charge' : 'item:arrow')); const yaw = Math.atan2(a.vx, a.vz), pit = Math.atan2(a.vy, Math.hypot(a.vx, a.vz)); if (!a.stuck) { a.yaw = yaw; a.pit = pit; } gl.uniform1f(u.uDay, sk.day); drawMesh(mesh, tex, { model: M4.chain(M4.trans(a.x, a.y, a.z), M4.ry(a.yaw), M4.rx(-a.pit), M4.ry(Math.PI / 2), M4.rz(-Math.PI / 4), M4.scale(.5, .5, .5)) }); }
  for (const f of falling) { const [mesh, tex] = itemMesh(f.k); const L = lightAt(f.x, f.y + .5, f.z); gl.uniform1f(u.uDay, Math.max(sk.day * L[0], L[1])); drawMesh(mesh, tex, { model: M4.trans(f.x, f.y + .5, f.z) }); }
  for (const tn of tnts) { const [mesh, tex] = itemMesh(B('tnt')); const fl = Math.floor(tn.fuse * 4) % 2; const s = 1 + Math.max(0, .5 - tn.fuse) * .3; gl.uniform1f(u.uDay, 1); drawMesh(mesh, tex, { model: M4.chain(M4.trans(tn.x, tn.y + .5, tn.z), M4.scale(s, s, s)), tint: fl ? [1, 1, 1, .5] : [0, 0, 0, 0] }); }
  gl.uniform1f(u.uDay, sk.day);
}
function renderParticles(view, sk) {
  if (!particles.length) return;
  const R = [view[0], view[4], view[8]], U = [view[1], view[5], view[9]]; const arrB = [], arrI = [];
  for (const p of particles) {
    const s = p.s || .1, L = lightAt(p.x, p.y, p.z), l = [1, L[0], L[1]];
    const c = [[p.x - R[0] * s - U[0] * s, p.y - R[1] * s - U[1] * s, p.z - R[2] * s - U[2] * s], [p.x + R[0] * s - U[0] * s, p.y + R[1] * s - U[1] * s, p.z + R[2] * s - U[2] * s], [p.x + R[0] * s + U[0] * s, p.y + R[1] * s + U[1] * s, p.z + R[2] * s + U[2] * s], [p.x - R[0] * s + U[0] * s, p.y - R[1] * s + U[1] * s, p.z - R[2] * s + U[2] * s]];
    let uv; if (p.item) { const it = p.item >= ITEM_BASE ? p.item - ITEM_BASE : 0; uv = itemUV(it); } else uv = tileUV(p.tile);
    const ou = p.ou || 0, ov = p.ov || 0, fw = p.ou !== undefined ? .25 : 1, du = (uv[2] - uv[0]), dv = (uv[3] - uv[1]);
    const u0 = uv[0] + du * ou, v0 = uv[1] + dv * ov, u1 = u0 + du * fw, v1 = v0 + dv * fw;
    pushQuad(p.item ? arrI : arrB, c, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], l);
  }
  if (arrB.length) drawMesh(dynMesh('pb', arrB), 'blocks', { alphaTest: .5 }); if (arrI.length) drawMesh(dynMesh('pi', arrI), 'items', { alphaTest: .5 });
}
function renderRain(eye) {
  const snowy = /taiga|mountains|frozen/.test(world.biome(Math.floor(eye[0]), Math.floor(eye[2]))), desert = /desert|badlands|savanna/.test(world.biome(Math.floor(eye[0]), Math.floor(eye[2])));
  if (desert) return;
  const arr = [], t = performance.now() / 1000, R = 10;
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    if (x * x + z * z > R * R) continue; const wx = Math.floor(eye[0]) + x, wz = Math.floor(eye[2]) + z;
    const top = world.topY(wx, wz) + 1, y0 = Math.max(top, Math.floor(eye[1]) - 10), y1 = Math.floor(eye[1]) + 12; if (y1 <= y0) continue;
    const h = world.N.hash(wx, 0, wz), off = (t * (snowy ? .4 : 3) + h) % 1, rnd = Math.floor(h * 4) / 4;
    const a = h * Math.PI, dx = Math.cos(a) * .5, dz = Math.sin(a) * .5, cx = wx + .5, cz = wz + .5;
    const v0 = off + y0 / 8 * (snowy ? .3 : 1), v1 = off + y1 / 8 * (snowy ? .3 : 1);
    pushQuad(arr, [[cx - dx, y0, cz - dz], [cx + dx, y0, cz + dz], [cx + dx, y1, cz + dz], [cx - dx, y1, cz - dz]], [[rnd, -v0], [rnd + .25, -v0], [rnd + .25, -v1], [rnd, -v1]], [1, 1, 0]);
  }
  drawMesh(dynMesh('rain', arr), snowy ? 'snowfall' : 'rain', { alphaTest: .05, alpha: .7 });
}
function renderHand(proj, sk, dt) {
  gl.clear(gl.DEPTH_BUFFER_BIT); const u = PROG.u, P = player;
  gl.uniformMatrix4fv(u.uPV, false, M4.persp(70 * Math.PI / 180, glc.width / glc.height, .01, 10)); gl.uniform3f(u.uCam, 0, 0, 0); gl.uniform1f(u.uFogN, 100); gl.uniform1f(u.uFogF, 200);
  const L = lightAt(P.x, P.y + 1.6, P.z); gl.uniform1f(u.uDay, Math.max(sk.day * L[0], L[1]));
  const h = held(); const sw = swing > 0 ? Math.sin((1 - swing) * Math.PI) : 0, eat = eatT > 0 ? Math.sin(eatT * 20) * .03 : 0;
  P.hb = lerp(P.hb || 0, P.bob || 0, 1); const bob = opts.bob ? Math.sin(P.bob * Math.PI) * .03 * (P.bobA || 0) : 0, bobY = opts.bob ? -Math.abs(Math.cos(P.bob * Math.PI)) * .04 * (P.bobA || 0) : 0;
  if (h) {
    const [mesh, tex] = itemMesh(h.k), isBlock = h.k < ITEM_BASE && (SHAPE[h.k] == 1 || SHAPE[h.k] == 5);
    let M = M4.chain(M4.trans(.56 + bob - sw * .3, -.52 + bobY + sw * .2 - (eatT > 0 ? -.15 : 0) + eat, -.72 - sw * .2 - (eatT > 0 ? -.2 : 0)), M4.ry(isBlock ? .78 + sw * .6 : -.2 + sw * .8), M4.rx(-sw * .8 + (isBlock ? 0 : .1)), M4.rz(isBlock ? 0 : .35));
    M = M4.mul(M, M4.scale(isBlock ? .4 : .55, isBlock ? .4 : .55, isBlock ? .4 : .55));
    drawMesh(mesh, tex, { model: M, alphaTest: .1 });
  } else if (IMG.steve) {
    if (!dyn.arm) { const arr = []; boxVerts(arr, [4, 12, 4], [40, 16], 64, 64); dyn.arm = mkMesh(new Float32Array(arr)); }
    const M = M4.chain(M4.trans(.6 + bob - sw * .2, -.65 + bobY + sw * .15, -.75 - sw * .2), M4.ry(.3 - sw * .3), M4.rx(1.3 - sw * .9), M4.rz(-.2), M4.scale(1 / 16, 1 / 16, 1 / 16), M4.trans(0, -2, 0));
    drawMesh(dyn.arm, 'steve', { model: M, alphaTest: .1 });
  }
}
let pano = null, panoT = 0;
function renderPanorama(dt) {
  panoT += dt; gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!TEXS.panorama_0) return; const u = PROG.u;
  if (!pano) {
    const faces = [[[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[1, -1, 1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]]];
    pano = faces.map(c => { const arr = []; pushQuad(arr, c.map(p => p.map(v => v * 10)), [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]); return mkMesh(new Float32Array(arr)); });
  }
  const proj = M4.persp(85 * Math.PI / 180, glc.width / glc.height, .1, 100);
  gl.uniformMatrix4fv(u.uPV, false, M4.chain(proj, M4.rx(.25 + Math.sin(panoT * .02) * .05), M4.ry(panoT * .03)));
  gl.uniform3f(u.uCam, 0, 0, 0); gl.uniform1f(u.uFogN, 1e3); gl.uniform1f(u.uFogF, 2e3); gl.uniform1f(u.uDay, 1); gl.depthMask(false);
  pano.forEach((m, i) => drawMesh(m, 'panorama_' + i, { full: 1, alphaTest: 0 })); gl.depthMask(true);
}
// ---------------- HUD ----------------
function drawHUD(dt) {
  const P = player;
  if (P.portalT > 0) { cx2.fillStyle = `rgba(110,20,200,${Math.min(.75, P.portalT / 4)})`; cx2.fillRect(0, 0, UW, UH); }
  if (P.headWater && IMG.underwater) { cx2.globalAlpha = .25; cx2.drawImage(IMG.underwater, 0, 0, UW, UH); cx2.globalAlpha = 1; }
  // vignette
  const g = cx2.createRadialGradient(UW / 2, UH / 2, UH * .3, UW / 2, UH / 2, UH * .9); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); cx2.fillStyle = g; cx2.fillRect(0, 0, UW, UH);
  if (P.hurtT > 0) { cx2.fillStyle = `rgba(255,0,0,${P.hurtT * .3})`; cx2.fillRect(0, 0, UW, UH); }
  if (hideHud) return;
  // crosshair
  if (S.screen == 'game' || S.screen == 'chat') { cx2.save(); cx2.globalCompositeOperation = 'difference'; cx2.fillStyle = '#fff'; cx2.fillRect(Math.round(UW / 2) - 7, Math.round(UH / 2) - 1, 15, 1.5); cx2.fillRect(Math.round(UW / 2) - .75, Math.round(UH / 2) - 8, 1.5, 15); cx2.restore(); }
  const hx = Math.round(UW / 2 - 91), hy = UH - 22;
  spr('hud_hotbar', hx, hy, 182, 22); spr('hud_hotbar_selection', hx - 1 + P.sel * 20, hy - 1, 24, 23);
  for (let i = 0; i < 9; i++) drawStack(P.inv[i], hx + 3 + i * 20, hy + 3);
  if (P.offhand) { spr('hud_hotbar', hx - 29, hy - 1, 22, 23, 0, 0, 22, 22); drawStack(P.offhand, hx - 26, hy + 3); }
  if (P.mode == 'survival') {
    // xp
    spr('hud_experience_bar_background', hx, hy - 7, 182, 5); const w = Math.round(182 * P.xp); if (w) spr('hud_experience_bar_progress', hx, hy - 7, w, 5, 0, 0, w, 5);
    if (P.lvl) { const s = '' + P.lvl, x = Math.round(UW / 2 - textW(s) / 2); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) text(s, x + a, hy - 13 + b, '#000000', false); text(s, x, hy - 13, '#80FF20', false); }
    // hearts
    const hc = world.meta.mode == 'hardcore', blink = P.hurtT > .25 && (P.hurtT * 10 | 0) % 2;
    for (let i = 0; i < 10; i++) { const x = hx + i * 8, y = hy - 17 + (P.hp <= 4 ? Math.round(Math.sin(performance.now() / 50 + i * 2)) : 0); spr(blink ? 'hud_heart_container_blinking' : 'hud_heart_container', x, y, 9, 9); const v = P.hp - i * 2; if (v >= 2) spr(hc ? 'hud_heart_hardcore_full' : 'hud_heart_full', x, y, 9, 9); else if (v >= 1) spr(hc ? 'hud_heart_hardcore_half' : 'hud_heart_half', x, y, 9, 9); }
    const ap = armorPts(); if (ap) for (let i = 0; i < 10; i++) { const x = hx + i * 8, y = hy - 27, v = ap - i * 2; spr('hud_armor_empty' in IMG && v <= 0 ? 'hud_armor_empty' : 'hud_armor_empty', x, y, 9, 9); if (v > 0) { cx2.globalAlpha = 1; drawIcon(itemKey('item:iron_chestplate'), x, y, 9); } }
    for (let i = 0; i < 10; i++) { const x = hx + 182 - 9 - i * 8, y = hy - 17 + (P.sat <= 0 && (performance.now() / 100 | 0) % (P.food * 3 + 1) == 0 ? (Math.random() * 3 - 1 | 0) : 0); spr('hud_food_empty', x, y, 9, 9); const v = P.food - i * 2; if (v >= 2) spr('hud_food_full', x, y, 9, 9); else if (v >= 1) spr('hud_food_half', x, y, 9, 9); }
    if (P.headWater || P.air < 300) { const b = Math.ceil(P.air / 30); for (let i = 0; i < 10; i++) { const x = hx + 182 - 9 - i * 8, y = hy - 27; spr(i < b ? 'hud_air' : 'hud_air_empty', x, y, 9, 9); } }
  }
  // item name popup
  if (S.selT > 0) { S.selT -= dt; const h = P.inv[P.sel]; if (h) { cx2.globalAlpha = Math.min(1, S.selT); textC(prettyName(h.k), UW / 2, hy - (P.mode == 'survival' ? 38 : 22), '#FFFFFF'); cx2.globalAlpha = 1; } }
  if (P.mode == 'spectator') textC('Spectator Mode', UW / 2, hy + 6, '#AAAAAA');
  // chat
  const now = performance.now(), open = S.screen == 'chat'; let cy = UH - 48;
  for (let i = chatLog.length - 1; i >= 0 && cy > UH / 2 - 40; i--) { const c = chatLog[i], age = (now - c.t) / 1000; if (!open && age > 10) break; const a = open ? 1 : clamp((10 - age), 0, 1); cx2.globalAlpha = a; cx2.fillStyle = 'rgba(0,0,0,.5)'; cx2.fillRect(2, cy - 1, 320, 10); text(c.msg, 4, cy, '#FFFFFF'); cx2.globalAlpha = 1; cy -= 10; }
  // toasts
  toasts.forEach((t, i) => { const slide = Math.min(1, t.t * 4, (5 - t.t) * 4), x = UW - 160 * slide, y = i * 32; spr('toast', x, y, 160, 32); drawIcon(t.icon, x + 8, y + 8); text(t.title, x + 30, y + 7, '#FFFF00', false); text(t.name, x + 30, y + 18, '#FFFFFF', false); });
  // debug
  if (debug) {
    const t = P.target, f = fwd(), dir = Math.abs(f[0]) > Math.abs(f[2]) ? (f[0] > 0 ? 'east (Towards positive X)' : 'west (Towards negative X)') : (f[2] > 0 ? 'south (Towards positive Z)' : 'north (Towards negative Z)');
    const L = lightAt(P.x, P.y, P.z);
    const left = [`Blockcraft 1.0 (Faithful 32x)`, `${fps} fps  C: ${[...world.chunks.values()].filter(c => c.meshes).length} loaded`, `E: ${mobs.length} mobs, ${items.length} items, ${particles.length} particles`, '',
      `XYZ: ${P.x.toFixed(3)} / ${P.y.toFixed(5)} / ${P.z.toFixed(3)}`, `Block: ${Math.floor(P.x)} ${Math.floor(P.y)} ${Math.floor(P.z)}`, `Chunk: ${Math.floor(P.x) & 15} ${Math.floor(P.y)} ${Math.floor(P.z) & 15} in ${Math.floor(P.x) >> 4} ${Math.floor(P.y) >> 4} ${Math.floor(P.z) >> 4}`,
      `Facing: ${dir} (${(((-P.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180).toFixed(1)} / ${(-P.pitch * 180 / Math.PI).toFixed(1)})`, `Light: ${Math.round(Math.log(L[0]) / Math.log(.82) * -1 + 15)} sky, ${Math.round(Math.log(L[1] || 1e-9) / Math.log(.82) * -1 + 15)} block`,
      `Biome: minecraft:${world.biome(Math.floor(P.x), Math.floor(P.z))}`, `Local Difficulty: ${DIFFS[world.meta.diff]} // Day ${Math.floor((world.meta.day || 0))}`, `Time: ${world.meta.time | 0}${world.meta.rain ? ' (raining)' : ''}`, `Seed: ${world.seed}`];
    const right = [`Browser: ${navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0] || 'unknown'}`, `Display: ${glc.width}x${glc.height}`, `GUI scale: ${GS}`, `Sound pack: ${SND.idx ? SND.packName : 'none'}`, ''];
    if (t) { right.push('§nTargeted Block: ' + t.x + ', ' + t.y + ', ' + t.z, 'minecraft:' + BL[t.b].n); }
    if (P.targetMob) right.push('', 'Targeted Entity', 'minecraft:' + P.targetMob.type);
    left.forEach((s, i) => { if (!s) return; cx2.fillStyle = 'rgba(80,80,80,.56)'; cx2.fillRect(1, 1 + i * 9, textW(s) + 2, 9); text(s, 2, 2 + i * 9, '#E0E0E0', false); });
    right.forEach((s, i) => { if (!s) return; s = s.replace('§n', ''); const w = textW(s); cx2.fillStyle = 'rgba(80,80,80,.56)'; cx2.fillRect(UW - w - 3, 1 + i * 9, w + 2, 9); text(s, UW - w - 2, 2 + i * 9, '#E0E0E0', false); });
  } else if (opts.fps) text(fps + ' fps', 2, 2, '#FFFFFF');
  if (NET.PV && S.screen == 'game') netDrawNames(NET.PV);
  drawBotOverlay();
  if (!debug) modEmit('hud', cx2, UW, UH, dt); // mods can draw on the HUD
  if (S.screen == 'game' && !locked && !noLock && !PAD.on) { cx2.fillStyle = 'rgba(0,0,0,.45)'; cx2.fillRect(0, 0, UW, UH); textC('Click to continue playing', UW / 2, UH / 2 - 4, '#FFFFFF'); }
}
// ---------------- input ----------------
// the browser may refuse a lock (e.g. right after Esc or without a click); never give up - ask again on the next click
function lockPointer() { if (noLock || document.pointerLockElement === ui) return; try { const p = ui.requestPointerLock(); if (p && p.catch) p.catch(() => { S.needClick = true; }); } catch (e) { S.needClick = true; } }
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
function setupInput() {
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === ui; if (locked) S.needClick = false; if (!locked && S.screen == 'game' && !S.justClosed) go('pause'); S.justClosed = false; });
  document.addEventListener('pointerlockerror', () => { S.needClick = true; });
  addEventListener('mousemove', e => {
    if (PAD.on && Math.abs(e.movementX) + Math.abs(e.movementY) > 4) PAD.on = false; // back to mouse after using a controller
    const r = ui.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * devicePixelRatio / GS; mouse.y = (e.clientY - r.top) * devicePixelRatio / GS;
    if (S.screen == 'game' && player && (locked || noLock)) { const s = (opts.sens * .6 + .2) * .006; player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.5707, 1.5707); }
  });
  const md = e => {
    if (TOUCH.on && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    SND.ensure(); if (!SND.music && !world && SND.idx) SND.playMusic('menu');
    if (S.screen == 'game' && !locked && !noLock) { lockPointer(); return; }
    if (e.button == 0) { mouse.down = true; mouse.click = true; } if (e.button == 2) { mouse.rdown = true; mouse.rclick = true; } if (e.button == 1) { mouse.mclick = true; e.preventDefault(); }
    mouse.shift = e.shiftKey;
  };
  document.addEventListener('mousedown', md);
  addEventListener('mouseup', e => { if (e.button == 0) mouse.down = false; if (e.button == 2) mouse.rdown = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); if (S.screen == 'game' && player) { player.sel = (player.sel + Math.sign(e.deltaY) + 9) % 9; S.selT = 2; } }, { passive: true });
  addEventListener('keydown', e => {
    SND.ensure();
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F1', 'F2', 'F3', 'Slash', 'Quote'].includes(e.code) || (e.ctrlKey && e.code == 'KeyW')) e.preventDefault();
    if (e.key.length == 1 && !e.ctrlKey && !e.metaKey && (focus || S.screen == 'chat' || (S.screen == 'inventory' && focus == 'csearch'))) typed += e.key;
    keysPressed.push(e.key);
    if (focus && e.key.length == 1 && S.screen != 'game') { return; }
    const sc = S.screen;
    if (e.code == 'Escape') {
      if (sc == 'game') go('pause'); else if (sc == 'pause') go('game'); else if (sc == 'marketItem') go('market'); else if (sc == 'packs') go(world ? 'options' : 'title'); else if (sc == 'skins' || sc == 'mods') go(world ? 'pause' : 'title'); else if (sc == 'market') go(world ? 'pause' : 'title'); else if (['inventory', 'crafting', 'chest', 'furnace'].includes(sc)) closeContainer(); else if (sc == 'chat') { S.chat = null; go('game'); }
      else if (['options', 'stats', 'advancements'].includes(sc)) go(world ? 'pause' : 'title'); else if (['video', 'sound', 'controls', 'credits'].includes(sc)) go(world && sc != 'credits' ? 'options' : world ? 'options' : 'title'); else if (['worlds', 'multiplayer'].includes(sc)) go('title'); else if (['create', 'confirmdel', 'editworld'].includes(sc)) go('worlds');
      return;
    }
    if (sc == 'game') {
      if (keys[e.code]) return; keys[e.code] = true;
      if (e.code.startsWith('Digit') && e.code != 'Digit0') { player.sel = +e.code.slice(5) - 1; S.selT = 2; }
      if (e.code == 'KeyE' && player.mode != 'spectator') { S.ctab = S.ctab || 0; go('inventory'); }
      if (e.code == 'KeyT') { S.chat = { s: '' }; go('chat'); typed = ''; }
      if (e.code == 'Slash') { S.chat = { s: '/' }; go('chat'); typed = ''; }
      if (e.code == 'KeyQ') { const h = held(); if (h) { const n = e.ctrlKey ? h.c : 1; dropItem(h.k, n, undefined, undefined, undefined, true); if (player.items) { } items[items.length - 1].dmg = h.dmg; h.c -= n; if (!h.c) player.inv[player.sel] = null; } }
      if (e.code == 'F5') { player.view = ((player.view || 0) + 1) % 3; e.preventDefault(); }
      if (e.code == 'F1') hideHud = !hideHud; if (e.code == 'F3') debug = !debug; if (e.code == 'F2') shotReq = true;
      if (e.code == 'Space') { const n = performance.now(); if ((player.mode == 'creative') && n - lastSpace < 300) { player.fly = !player.fly; player.vy = 0; } lastSpace = n; }
      if (e.code == 'KeyW') { const n = performance.now(); if (n - lastW < 300) sprintTap = true; lastW = n; }
    } else if (sc == 'inventory' || sc == 'crafting' || sc == 'chest' || sc == 'furnace') {
      if (e.code == 'KeyE' && focus != 'csearch') closeContainer();
      if (/Digit[1-9]/.test(e.code) && S.hovSlot) { const i = +e.code.slice(5) - 1, a = S.hovSlot.get(); if (S.hovSlot.type == 'creative') { if (a) player.inv[i] = { k: a.k, c: MAXSTACK(a.k) }; } else if (S.hovSlot.set) { const b = player.inv[i]; player.inv[i] = a; S.hovSlot.set(b); } }
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { keys = {}; mouse.down = mouse.rdown = false; });
  addEventListener('beforeunload', () => { if (world) saveWorld(); });
  document.getElementById('packfile').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadPackFile(f, true); });
}
// ---------------- main loop ----------------
let SAFE = [0, 0, 0, 0]; // notch / home-bar insets in GUI units: top, right, bottom, left
function safeInsets() { try { let p = document.getElementById('safeprobe'); if (!p) { p = document.createElement('div'); p.id = 'safeprobe'; p.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(p); } const s = getComputedStyle(p); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(v => parseFloat(v) || 0); } catch (e) { return [0, 0, 0, 0]; } }
function resize() {
  const dpr = devicePixelRatio || 1, W = Math.floor(innerWidth * dpr), H = Math.floor(innerHeight * dpr);
  // phones: draw the 3D world at a lower resolution (much faster); the menus stay sharp
  const rs = (IS_MOBILE || LOW_END || S.forceScale) ? Math.min(1, (opts.mres || 1.5) / dpr) * (S.perfScale || 1) : 1;
  glc.width = Math.floor(W * rs); glc.height = Math.floor(H * rs); ui.width = W; ui.height = H;
  if (IS_MOBILE) GS = Math.max(2, Math.min(Math.floor(H / 205), Math.floor(W / 370))); // big, finger-sized GUI (like Bedrock on phones)
  else GS = Math.max(1, Math.min(Math.floor(W / 480), Math.floor(H / 330), 3));
  if (opts.gui) GS = Math.min(opts.gui + (IS_MOBILE ? 1 : 0), Math.max(1, Math.floor(Math.min(W / 320, H / 240))));
  SAFE = safeInsets().map(v => v * dpr / GS);
  UW = W / GS; UH = H / GS;
}
// automatic performance: on a slow computer, lower the 3D resolution, then the render distance, until it plays smoothly
function autoPerf() {
  if (!opts.autoPerf || S.screen != 'game' || !world || document.hidden) { S.slowS = 0; return; }
  S.slowS = fps < 24 ? (S.slowS || 0) + 1 : 0;
  if (S.slowS >= 4) { S.slowS = 0;
    if ((S.perfScale || 1) > .55) { S.perfScale = (S.perfScale || 1) * .8; if (!LOW_END) S.forceScale = 1; resize(); }
    else if (opts.rd > 3) { opts.rd--; saveOpts(); chat('§7Running slowly - render distance lowered to ' + opts.rd + ' (Video Settings)'); }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.25, (now - lastT) / 1000); lastT = now; fcount++; ftime += dt; if (ftime >= 1) { fps = fcount; fcount = 0; ftime = 0; autoPerf(); }
  if (glc.width != Math.floor(innerWidth * devicePixelRatio) || S.lastGui != opts.gui) { S.lastGui = opts.gui; resize(); }
  try {
    padFrame(dt); touchFrame();
    if (S.screen == 'loading' && world) loadingTick();
    const paused = ['skins', 'mods', 'packs', 'market', 'marketItem', 'pause', 'options', 'video', 'sound', 'controls', 'credits', 'stats', 'advancements'].includes(S.screen);
    if (world && player && S.screen != 'loading' && !paused) { const n = Math.ceil(dt / .05), sd = dt / n; for (let i = 0; i < n; i++) { updatePlayer(sd); if (!player.dead) { updateMobs(sd); updateItems(sd); updateTnt(sd); } if (i == n - 1) updateWorld(dt); } world.meta.day = Math.floor(player.stats.time / 1200); }
    render(dt);
    if (world && player && S.screen == 'game' && !world.meta.icon && player.stats.time > 3) captureIcon();
    if (shotReq) { shotReq = false; glc.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'blockcraft_' + new Date().toISOString().replace(/[:.]/g, '-') + '.png'; a.click(); }); chat('Saved screenshot'); }
    // GUI
    cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.clearRect(0, 0, ui.width, ui.height); cx2.setTransform(GS, 0, 0, GS, 0, 0); cx2.imageSmoothingEnabled = false;
    S.tip = null; clickUsed = false;
    if (world && player && S.screen != 'loading') drawHUD(dt);
    const scr = { title: scrTitle, worlds: scrWorlds, create: scrCreate, editworld: scrEditWorld, confirmdel: scrConfirmDel, options: scrOptions, video: scrVideo, sound: scrSound, controls: scrControls, credits: scrCredits, skins: scrSkins, mods: scrMods, packs: scrPacks, pause: scrPause, stats: scrStats, advancements: scrAdvancements, death: scrDeath, loading: scrLoading, inventory: scrInventory, crafting: scrCrafting, chest: scrChest, cmdblock: scrCommandBlock, furnace: scrFurnace, chat: scrChat, multiplayer: scrMultiplayer }[S.screen];
    drawTouchHUD();
    // menus were laid out for at least 250x380 GUI units; on short phone screens shrink the whole menu to fit (taps are mapped too)
    const fitH = { title: 0, chat: 0, loading: 0, inventory: 262, chest: 230 }[S.screen] ?? 250, fk = fitH ? Math.min(1, UH / fitH, UW / 380) : 1;
    const sv = [GS, UW, UH, mouse.x, mouse.y];
    if (fk < 1) { GS *= fk; UW /= fk; UH /= fk; mouse.x /= fk; mouse.y /= fk; cx2.setTransform(GS, 0, 0, GS, 0, 0); }
    try {
      // close button for inventory-style screens (phones have no E / Esc key); it gets the tap before the screen does
      const xb = /^(inventory|crafting|chest|furnace)$/.test(S.screen) ? [UW - 30, 6, 24, 24] : null, xhv = xb && hover(...xb);
      if (xhv && mouse.click) { mouse.click = false; SND.play('ui_click', .5); closeContainer(); }
      if (scr) scr();
      if (xb && /^(inventory|crafting|chest|furnace)$/.test(S.screen)) { nine(xhv ? 'widget_button_highlighted' : 'widget_button', ...xb, 3, 3, 3, 3); textC('X', xb[0] + 12, xb[1] + 8, xhv ? '#FFFFA0' : '#FFFFFF'); }
      if (S.tip) tooltip(S.tip, mouse.x, mouse.y);
      drawPadCursor(); drawPadHints();
    } finally { if (fk < 1) { [GS, UW, UH] = sv; mouse.x = sv[3]; mouse.y = sv[4]; cx2.setTransform(GS, 0, 0, GS, 0, 0); } }
    ui.style.cursor = (S.screen == 'game' || S.screen == 'chat') ? 'none' : 'default';
  } catch (e) { console.error(e); cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.fillStyle = '#f55'; cx2.font = '14px monospace'; cx2.fillText('Error: ' + e.message, 10, 20); }
  mouse.click = mouse.rclick = mouse.mclick = false; mouse.wheel = 0; typed = ''; keysPressed = [];
}
const BOOT_T0 = performance.now();
async function boot() {
  glc = document.getElementById('gl'); const uic = document.getElementById('ui');
  const pre = document.getElementById('pre'), fill = document.getElementById('prefill'), ptxt = document.getElementById('pretext');
  let target = 0; const MIN_T = 3000;
  const setLoad = (p, t) => { target = p; if (t) ptxt.textContent = t; };
  (function bar() { if (!pre.isConnected) return; fill.style.width = (Math.min(target, (performance.now() - BOOT_T0) / MIN_T) * 100).toFixed(1) + '%'; requestAnimationFrame(bar); })();
  try {
    await loadAssets(p => setLoad(p * .6, 'Loading textures... ' + Math.round(p * 100) + '%'));
    setLoad(.62, 'Building world data...'); await new Promise(r => setTimeout(r, 0));
    initGL(glc); initGUI(uic); initWorldTables(); applySkin(); buildIcons(); setupRecipes(); loadMods(); buildCreativeTabs(); saveOpts();
  } catch (e) { ptxt.textContent = 'Failed to start: ' + (e.message || e); ptxt.style.color = '#f66'; console.error(e); return; }
  setupInput(); setupTouch(); snapshotOriginals();
  document.getElementById('modfile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importMod(f); });
  document.getElementById('texfile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importPackZip(f); });
  S.bedrock = IS_MOBILE; TOUCH.on = IS_MOBILE; if (IS_MOBILE) noLock = true;
  setFont(); setLoad(.7, 'Loading resource pack...');
  try { await restorePack(p => setLoad(.7 + p * .3, 'Loading resource pack... ' + Math.round(p * 100) + '%')); } catch (e) { console.warn(e); }
  if (!ANIMS.length) setupAnims(null);
  setLoad(1, 'Loading complete'); resize(); go('title'); netAutoStart();
  const shown = performance.now() - BOOT_T0; await new Promise(r => setTimeout(r, Math.max(400, MIN_T + 300 - shown)));
  window.BOOTED = 1; pre.classList.add('done'); setTimeout(() => pre.remove(), 1100);
  if (window.SOUND_FILES && SOUND_FILES.length) (async () => { let n = 0; for (const f of SOUND_FILES) { SND.loadingSounds = Math.round(n / SOUND_FILES.length * 100) + '%'; try { await new Promise(r => setTimeout(r, 50)); await loadScript(f); while (window.EMBED_SOUND_PARTS && EMBED_SOUND_PARTS.length) SND.addEmbedded(EMBED_SOUND_PARTS.shift()); } catch (e) { console.warn(e); S.pmsg = '§cSounds missing - keep the "sounds" folder next to Blockcraft.html'; break; } n++; if (n == 1 && !world) SND.playMusic('menu'); } SND.loadingSounds = null; })();
  else if (window.EMBED_SOUND_PARTS) for (const part of EMBED_SOUND_PARTS) SND.addEmbedded(part); else PackStore.load().then(f => { if (f) loadPackFile(f, false); });
  requestAnimationFrame(frame);
}
boot();
