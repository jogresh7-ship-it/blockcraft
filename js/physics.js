'use strict';
// ---------- Minecraft-style fluids, falling blocks, doors/trapdoors/slabs ----------
const FL = { q: new Map(), t: { 1: 0, 2: 0 } };
const fkey = (x, y, z) => x + ',' + y + ',' + z;
function fluidId(kind, lvl) { return lvl == 0 ? BYNAME[kind == 1 ? 'water' : 'lava'] : BYNAME[(kind == 1 ? 'water_' : 'lava_') + lvl]; }
function replaceableByFluid(b) { return !b || (SHAPE[b] == 2 && !/^(sugar_cane|bamboo)/.test(BL[b].n)) || SHAPE[b] == 6 || /^(snow|short_grass|fern|dead_bush)$/.test(BL[b].n); }
function fluidWake(x, y, z) { for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (FLUID[world.get(X, Y, Z)]) FL.q.set(fkey(X, Y, Z), [X, Y, Z]); } }
function fluidSet(x, y, z, id) {
  const old = world.get(x, y, z);
  if (old && SHAPE[old] == 2 && player.mode == 'survival') for (const [k, c] of drops(old)) dropItem(k, c, x + .5, y + .5, z + .5);
  world.set(x, y, z, id); fluidWake(x, y, z);
}
function lavaMeetsWater(x, y, z, lavaId) { // returns replacement block or 0
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) if (FLUID[world.get(x + dx, y + dy, z + dz)] == 1) { SND.play('random/fizz', .5, 1, [x, y, z]); for (let i = 0; i < 6; i++) particles.push({ x: x + Math.random(), y: y + 1, z: z + Math.random(), vx: 0, vy: 1, vz: 0, life: .6, tile: TEX[B('light_gray_wool') * 4], g: -1, s: .08 }); return FLVL[lavaId] == 0 ? B('obsidian') : B('cobblestone'); }
  return 0;
}
function fluidTick(dt) {
  const nether = world.dim == 'nether';
  for (const kind of [1, 2]) {
    FL.t[kind] -= dt; if (FL.t[kind] > 0) continue; FL.t[kind] = kind == 1 ? .25 : nether ? .5 : 1.5;
    const items = [...FL.q.values()].filter(([x, y, z]) => FLUID[world.get(x, y, z)] == kind).slice(0, 400);
    for (const [x, y, z] of items) FL.q.delete(fkey(x, y, z));
    const drop = kind == 1 ? 1 : nether ? 1 : 2, maxL = kind == 1 ? 7 : nether ? 7 : 6;
    for (const [x, y, z] of items) {
      const b = world.get(x, y, z); if (FLUID[b] != kind) continue; let L = FLVL[b];
      if (kind == 2) { const r = lavaMeetsWater(x, y, z, b); if (r) { world.set(x, y, z, r); continue; } }
      // 1) recompute level of flowing fluid from neighbours
      if (L != 0) {
        const up = world.get(x, y + 1, z); let want;
        if (FLUID[up] == kind) want = 8;
        else { let best = 99, src = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = world.get(x + dx, y, z + dz); if (FLUID[n] == kind) { const l = FLVL[n] == 8 ? 0 : FLVL[n]; if (FLVL[n] == 0) src++; best = Math.min(best, l); } }
          want = best + drop; if (want > maxL) want = -1;
          if (kind == 1 && src >= 2 && (SOLID[world.get(x, y - 1, z)] || FLVL[world.get(x, y - 1, z)] == 0 && FLUID[world.get(x, y - 1, z)] == 1)) want = 0; }
        if (want == -1) { fluidSet(x, y, z, 0); continue; }
        if (want != L) { fluidSet(x, y, z, fluidId(kind, want)); L = want; }
      }
      // 2) spread
      const below = world.get(x, y - 1, z);
      if (y > 0 && replaceableByFluid(below)) { fluidSet(x, y - 1, z, fluidId(kind, 8)); continue; }
      if (y > 0 && FLUID[below] && FLUID[below] != kind) { if (kind == 1 && FLUID[below] == 2) { world.set(x, y - 1, z, FLVL[below] == 0 ? B('obsidian') : B('cobblestone')); SND.play('random/fizz', .5, 1, [x, y, z]); } if (kind == 2 && FLUID[below] == 1) { world.set(x, y - 1, z, B('stone')); SND.play('random/fizz', .5, 1, [x, y, z]); } continue; }
      if (FLUID[below] == kind && FLVL[below] != 0 && L != 0) continue; // flowing onto flowing: wait
      const nl = (L == 8 ? 0 : L) + drop; if (nl > maxL) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Z = z + dz, n = world.get(X, y, Z);
        if (replaceableByFluid(n)) fluidSet(X, y, Z, fluidId(kind, nl));
        else if (FLUID[n] == kind && FLVL[n] != 0 && FLVL[n] != 8 && FLVL[n] > nl) fluidSet(X, y, Z, fluidId(kind, nl));
        else if (FLUID[n] && FLUID[n] != kind) { if (kind == 2) { world.set(X, y, Z, FLVL[n] == 0 ? B('obsidian') : B('cobblestone')); SND.play('random/fizz', .5, 1, [X, y, Z]); } else { world.set(X, y, Z, FLVL[n] == 0 ? B('obsidian') : B('cobblestone')); SND.play('random/fizz', .5, 1, [X, y, Z]); } }
      }
    }
  }
}
// push entities with the current
function fluidPush(e) {
  const x = Math.floor(e.x), y = Math.floor(e.y + .2), z = Math.floor(e.z), b = world.get(x, y, z); if (FLUID[b] != 1) return [0, 0];
  const lv = n => FLUID[n] == 1 ? (FLVL[n] == 8 ? 0 : FLVL[n]) : null, L = lv(b); let px = 0, pz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = world.get(x + dx, y, z + dz), l = lv(n); if (l !== null && l > L) { px += dx * (l - L); pz += dz * (l - L); } else if (!n || (l === null && !SOLID[n] && FLUID[world.get(x + dx, y - 1, z + dz)] == 1)) { px += dx; pz += dz; } }
  const m = Math.hypot(px, pz); return m ? [px / m * 1.6, pz / m * 1.6] : [0, 0];
}
// ---------- falling blocks ----------
let falling = [];
function checkFall(x, y, z) {
  const b = world.get(x, y, z); if (!b || !GRAVITY_B(BL[b].n)) return;
  const below = world.get(x, y - 1, z); if (y <= 0 || !(replaceableByFluid(below) || FLUID[below])) return;
  world.set(x, y, z, 0); falling.push({ k: b, x: x + .5, y, z: z + .5, vx: 0, vy: 0, vz: 0, r: .49, h: .98 });
  checkFall(x, y + 1, z);
}
function updateFalling(dt) {
  for (const f of falling) {
    f.vy = Math.max(f.vy - 30 * dt, -40); const r = moveBody(world, f, dt);
    if (r.ground || f.y < -10) { f.dead = true; const x = Math.floor(f.x), y = Math.floor(f.y + .1), z = Math.floor(f.z), here = world.get(x, y, z);
      if (replaceableByFluid(here) || FLUID[here]) { world.set(x, y, z, f.k); blockSound(BL[f.k].n, 'place', .8, 1, [x, y, z]); } else dropItem(f.k, 1, f.x, f.y + .5, f.z);
      if (Math.abs(f.x - player.x) < .7 && Math.abs(f.z - player.z) < .7 && player.y < y + 1 && player.y + 1.8 > y) hurtPlayer(2, 'was squashed by a falling block', true); }
  }
  falling = falling.filter(f => !f.dead);
}
// ---------- doors / trapdoors / slabs ----------
function doorBase(n) { return n.replace(/_top/, '').replace(/_open/, ''); }
function toggleDoor(x, y, z, sound = true) {
  const n = BL[world.get(x, y, z)].n, isTrap = /trapdoor/.test(n);
  if (isTrap) { const open = n.endsWith('_open'); world.set(x, y, z, BYNAME[open ? n.replace('_open', '') : n + '_open']); if (sound) SND.play(/iron|copper/.test(n) ? 'block/iron_trapdoor/' + (open ? 'close' : 'open') : 'block/wooden_trapdoor/' + (open ? 'close' : 'open'), 1, 1, [x, y, z]); return; }
  const top = /_top/.test(n), by = top ? y - 1 : y, base = doorBase(n), open = n.endsWith('_open');
  world.set(x, by, z, BYNAME[base + (open ? '' : '_open')]); world.set(x, by + 1, z, BYNAME[base + '_top' + (open ? '' : '_open')]);
  if (sound) SND.play(/iron/.test(n) ? 'block/iron_door/' + (open ? 'close' : 'open') : 'block/wooden_door/' + (open ? 'close' : 'open'), 1, 1, [x, y, z]);
}
function setDoorPowered(x, y, z, on) {
  const n = BL[world.get(x, y, z)].n, open = n.endsWith('_open');
  if (on != open) toggleDoor(x, y, z);
}
// placement helper: returns true if handled
function placeSpecial(h, hit, p) {
  const n = keyName(h.k);
  if (/_slab$/.test(n)) {
    const tb = BL[hit.b].n;
    // stack onto existing slab = double slab (full block)
    if (BL[h.k].slab && ((tb == n && hit.n[1] == 1) || (tb == n + '_top' && hit.n[1] == -1))) { world.set(hit.x, hit.y, hit.z, BYNAME[BL[h.k].slab]); return 'ok'; }
    const pb = world.get(...p); if (BL[h.k].slab && (pb == h.k || pb == BYNAME[n + '_top'])) { if (pb == h.k && hit.n[1] != 1 || true) { world.set(...p, BYNAME[BL[h.k].slab]); return 'ok'; } }
    const f = fwd(), eyeY = player.y + 1.62; let hy = hit.n[1] == -1 ? 1 : hit.n[1] == 1 ? 0 : -1;
    if (hy == -1) { // side face: use hit position height
      const d = (hit.t || 1); const yy = eyeY + f[1] * d - hit.y; hy = yy > .5 ? 1 : 0; }
    return hy == 1 && BYNAME[n + '_top'] ? BYNAME[n + '_top'] : h.k;
  }
  if (/_door$/.test(n)) { if (world.get(p[0], p[1] + 1, p[2])) return 'fail'; return 'door'; }
  if (/_trapdoor$/.test(n)) return h.k;
  return 0;
}
// automatic step-up (Java step height 0.6)
function stepUp(e, dt, ox, oz) {
  if (!e.ground) return;
  const tx = ox + e.vx * dt, tz = oz + e.vz * dt;
  for (const s of [.5625, .6]) {
    if (!world.collides(tx, e.y + s, tz, e.r, e.h) && world.collides(tx, e.y, tz, e.r, e.h)) {
      let y = e.y + s; while (y > e.y && !world.collides(tx, y - .0625, tz, e.r, e.h)) y -= .0625;
      e.x = tx; e.z = tz; e.y = y; return true;
    }
  }
  return false;
}
