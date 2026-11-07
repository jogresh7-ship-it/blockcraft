'use strict';
// ---------- Redstone: dust, levers, buttons, pressure plates, torches, lamps, TNT, pistons, note blocks ----------
const RSS = { q: [], timers: [], plates: new Set() };
const rsKey = (x, y, z) => x + ',' + y + ',' + z;
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function rsName(b) { return BL[b] ? BL[b].n : ''; }
function isSource(n) { return /^(redstone_block|redstone_torch|lever_on|stone_button_on|stone_pressure_plate_on|oak_pressure_plate_on)$/.test(n) || (n == 'daylight_detector' && world.dim == 'overworld' && skyState().day > .6); }
function isConsumer(n) { return /^(redstone_lamp|redstone_lamp_on|tnt|piston|sticky_piston|note_block|redstone_torch|redstone_torch_off)$/.test(n) || /_door(_open)?$|_trapdoor(_open)?$/.test(n); }
function rsNotify(x, y, z) { RSS.q.push([x, y, z]); }
function rsTick(dt) {
  for (const t of RSS.timers) t.t -= dt;
  for (const t of RSS.timers.filter(t => t.t <= 0)) { if (world.get(t.x, t.y, t.z) == BYNAME[t.from]) { world.set(t.x, t.y, t.z, BYNAME[t.to]); rsNotify(t.x, t.y, t.z); } }
  RSS.timers = RSS.timers.filter(t => t.t > 0);
  // pressure plates
  const now = new Set(), ents = [player, ...mobs, ...items];
  for (const e of ents) { const x = Math.floor(e.x), y = Math.floor(e.y + .01), z = Math.floor(e.z), n = rsName(world.get(x, y, z)); if (/pressure_plate/.test(n) && !(e == player && player.mode == 'spectator')) now.add(rsKey(x, y, z)); }
  for (const k of now) { const [x, y, z] = k.split(',').map(Number), n = rsName(world.get(x, y, z)); if (!n.endsWith('_on')) { world.set(x, y, z, BYNAME[n + '_on']); SND.play('random/click', .3, .6, [x, y, z]); rsNotify(x, y, z); } }
  for (const k of RSS.plates) if (!now.has(k)) { const [x, y, z] = k.split(',').map(Number), n = rsName(world.get(x, y, z)); if (n.endsWith('_on')) RSS.timers.push({ x, y, z, t: .5, from: n, to: n.replace('_on', '') }); }
  RSS.plates = now;
  if (!RSS.q.length) return;
  const q = RSS.q.splice(0, 6); for (const [x, y, z] of q) rsUpdate(x, y, z);
}
function rsUpdate(cx, cy, cz) {
  const Rr = 15, wires = [], cons = [], srcs = [];
  for (let x = cx - Rr; x <= cx + Rr; x++) for (let y = Math.max(0, cy - 6); y <= Math.min(WH - 1, cy + 6); y++) for (let z = cz - Rr; z <= cz + Rr; z++) {
    const b = world.get(x, y, z); if (!b) continue; const n = rsName(b);
    if (n == 'redstone_wire') wires.push([x, y, z]); else if (isConsumer(n)) cons.push([x, y, z, n]);
    if (isSource(n)) srcs.push([x, y, z, n]);
  }
  if (!wires.length && !srcs.length && !cons.length) return;
  // torches are off when the block they stand on is powered (computed after first pass)
  const old = world.power, pw = {};
  const isW = (x, y, z) => rsName(world.get(x, y, z)) == 'redstone_wire';
  const queue = [];
  const srcAt = (x, y, z) => { const n = rsName(world.get(x, y, z)); return isSource(n); };
  for (const [x, y, z] of wires) {
    let lv = 0; for (const [dx, dy, dz] of N6) if (srcAt(x + dx, y + dy, z + dz)) lv = 15;
    // lever/button on the block beneath powers through it
    if (lv) { pw[rsKey(x, y, z)] = lv; queue.push([x, y, z]); }
  }
  while (queue.length) {
    const [x, y, z] = queue.shift(), l = pw[rsKey(x, y, z)];
    if (l <= 1) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dy of [0, 1, -1]) {
      const X = x + dx, Y = y + dy, Z = z + dz; if (!isW(X, Y, Z)) continue;
      if (dy == 1 && OPAQUE[world.get(x, y + 1, z)]) continue; if (dy == -1 && OPAQUE[world.get(X, y, Z)]) continue;
      const k = rsKey(X, Y, Z); if ((pw[k] || 0) < l - 1) { pw[k] = l - 1; queue.push([X, Y, Z]); }
    }
  }
  // apply wire brightness
  for (const [x, y, z] of wires) { const k = rsKey(x, y, z), v = pw[k] || 0; if ((old[k] || 0) != v) { const c = world.chunk(x >> 4, z >> 4); if (c) c.dirty = true; } if (v) old[k] = v; else delete old[k]; }
  const powered = (x, y, z) => {
    for (const [dx, dy, dz] of N6) { const X = x + dx, Y = y + dy, Z = z + dz, n = rsName(world.get(X, Y, Z)); if (isSource(n) && !(n == 'redstone_torch' && dy == -1 && false)) return true; if (n == 'redstone_wire' && (pw[rsKey(X, Y, Z)] || 0) > 0) return true;
      // block powered by a lever/button/torch attached to it (one block away through solid)
      if (OPAQUE[world.get(X, Y, Z)]) for (const [ex, ey, ez] of N6) { const nn = rsName(world.get(X + ex, Y + ey, Z + ez)); if (/^(lever_on|stone_button_on|redstone_block)$/.test(nn) || (nn == 'redstone_wire' && ey == 1 && (pw[rsKey(X + ex, Y + ey, Z + ez)] || 0) > 0)) return true; } }
    return false;
  };
  for (const [x, y, z, n] of cons) {
    const k = rsKey(x, y, z), st = world.state[k] || {};
    if (n == 'redstone_torch' || n == 'redstone_torch_off') {
      const below = [x, y - 1, z]; const p = OPAQUE[world.get(...below)] && poweredBlockNoTorch(below[0], below[1], below[2], pw, x, y, z);
      if (p && n == 'redstone_torch') RSS.timers.push({ x, y, z, t: .1, from: 'redstone_torch', to: 'redstone_torch_off' });
      if (!p && n == 'redstone_torch_off') RSS.timers.push({ x, y, z, t: .1, from: 'redstone_torch_off', to: 'redstone_torch' });
      continue;
    }
    const on = powered(x, y, z);
    if (n == 'redstone_lamp' && on) world.set(x, y, z, BYNAME.redstone_lamp_on);
    else if (n == 'redstone_lamp_on' && !on) world.set(x, y, z, BYNAME.redstone_lamp);
    else if (n == 'tnt' && on) { world.set(x, y, z, 0); tnts.push({ x: x + .5, y, z: z + .5, vx: 0, vy: 3, vz: 0, r: .49, h: .98, fuse: 4 }); SND.play('fuse', 1, 1, [x, y, z]); }
    else if (n == 'note_block') { if (on && !st.on) SND.play('note/harp', 1, Math.pow(2, ((st.note || 0) - 12) / 12), [x, y, z]); world.state[k] = Object.assign(st, { on }); }
    else if (/_door(_open)?$|_trapdoor(_open)?$/.test(n)) { if (!/_top/.test(n)) setDoorPowered(x, y, z, on || (/_door/.test(n) && !/trapdoor/.test(n) && powered(x, y + 1, z))); }
    else if (n == 'piston' || n == 'sticky_piston') { if (on && !st.ext) pistonExtend(x, y, z, n == 'sticky_piston'); else if (!on && st.ext) pistonRetract(x, y, z, n == 'sticky_piston'); }
  }
}
function poweredBlockNoTorch(x, y, z, pw, tx, ty, tz) {
  for (const [dx, dy, dz] of N6) { const X = x + dx, Y = y + dy, Z = z + dz; if (X == tx && Y == ty && Z == tz) continue; const n = rsName(world.get(X, Y, Z)); if (/^(lever_on|stone_button_on|redstone_block|stone_pressure_plate_on|oak_pressure_plate_on)$/.test(n)) return true; if (n == 'redstone_wire' && (pw[rsKey(X, Y, Z)] || 0) > 0) return true; }
  return false;
}
function pistonFacing(x, y, z) { return (world.state[rsKey(x, y, z)] || {}).f || [0, 1, 0]; }
function pushable(b) { if (!b) return true; const p = blockProps(b), n = rsName(b); return p.h >= 0 && p.h < 50 && !/piston_head|^(furnace|furnace_lit|chest|barrel|obsidian|bedrock|nether_portal)$/.test(n) && !world.containers; }
function canPush(b) { if (!b) return true; const p = blockProps(b), n = rsName(b); return p.h >= 0 && p.h < 50 && !/piston_head|^(furnace|furnace_lit|chest|barrel|obsidian|crying_obsidian|bedrock|nether_portal|enchanting_table|ender_chest)$/.test(n); }
function pistonExtend(x, y, z, sticky) {
  const [fx, fy, fz] = pistonFacing(x, y, z); const line = [];
  for (let i = 1; i <= 13; i++) { const X = x + fx * i, Y = y + fy * i, Z = z + fz * i, b = world.get(X, Y, Z); if (!b || SHAPE[b] == 3 || SHAPE[b] == 2) break; if (!canPush(b) || i == 13) return; line.push([X, Y, Z, b]); }
  for (let i = line.length - 1; i >= 0; i--) { const [X, Y, Z, b] = line[i]; world.set(X + fx, Y + fy, Z + fz, b); }
  world.set(x + fx, y + fy, z + fz, BYNAME[sticky ? 'sticky_piston_head' : 'piston_head']);
  world.state[rsKey(x, y, z)] = Object.assign(world.state[rsKey(x, y, z)] || {}, { ext: 1 });
  SND.play('tile/piston/out', .6, 1, [x, y, z]); SND.play('random/door_open', .3, 1.4, [x, y, z]);
  // push entities
  for (const e of [player, ...mobs]) if (Math.floor(e.x) == x + fx * (line.length + 1) && Math.floor(e.z) == z + fz * (line.length + 1) && Math.abs(e.y - (y + fy * (line.length + 1))) < 1.5) { e.x += fx; e.y += fy * 1.05; e.z += fz; }
}
function pistonRetract(x, y, z, sticky) {
  const [fx, fy, fz] = pistonFacing(x, y, z), hx = x + fx, hy = y + fy, hz = z + fz;
  if (/piston_head/.test(rsName(world.get(hx, hy, hz)))) world.set(hx, hy, hz, 0);
  if (sticky) { const b = world.get(hx + fx, hy + fy, hz + fz); if (b && canPush(b) && SHAPE[b] != 3) { world.set(hx + fx, hy + fy, hz + fz, 0); world.set(hx, hy, hz, b); } }
  world.state[rsKey(x, y, z)].ext = 0; SND.play('tile/piston/in', .6, 1, [x, y, z]);
}
// interaction: returns true if handled
function rsUse(hit) {
  const n = rsName(hit.b), { x, y, z } = hit;
  if (n == 'lever' || n == 'lever_on') { world.set(x, y, z, BYNAME[n == 'lever' ? 'lever_on' : 'lever']); SND.play('random/click', .4, n == 'lever' ? .6 : .5, [x, y, z]); rsNotify(x, y, z); return true; }
  if (n == 'stone_button') { world.set(x, y, z, BYNAME.stone_button_on); SND.play('random/click', .4, .6, [x, y, z]); RSS.timers.push({ x, y, z, t: 1, from: 'stone_button_on', to: 'stone_button' }); rsNotify(x, y, z); return true; }
  if (n == 'note_block') { const k = rsKey(x, y, z), st = world.state[k] = world.state[k] || {}; st.note = ((st.note || 0) + 1) % 25; SND.play('note/harp', 1, Math.pow(2, (st.note - 12) / 12), [x, y, z]); particles.push({ x: x + .5, y: y + 1.2, z: z + .5, vx: 0, vy: .5, vz: 0, life: .8, tile: TEX[BYNAME[['red_wool', 'orange_wool', 'yellow_wool', 'lime_wool', 'cyan_wool', 'blue_wool', 'purple_wool'][st.note % 7]] * 4], g: 0, s: .1 }); return true; }
  return false;
}
function rsPlaced(x, y, z, b) {
  const n = rsName(b);
  if (n == 'piston' || n == 'sticky_piston') { const f = fwd(); const a = [Math.abs(f[0]), Math.abs(f[1]), Math.abs(f[2])], i = a.indexOf(Math.max(...a)); const dir = [0, 0, 0]; dir[i] = Math.sign(f[i]); world.state[rsKey(x, y, z)] = { f: dir.map(v => -v) }; }
}
