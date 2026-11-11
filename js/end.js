// ---- The End: a stronghold with an end portal room, eyes of ender, the End dimension (main island, obsidian pillars,
// the ender dragon, the exit portal, an end gateway to the outer islands with chorus plants) ----
const END_PILLARS = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return { x: Math.round(Math.cos(a) * 43), z: Math.round(Math.sin(a) * 43), r: 2 + i % 3, h: 76 + 3 * ((i * 7) % 10) }; });
function strongholdPos(w) { const h = w.N.hash(17, 3, 29), a = h * Math.PI * 2, d = 640 + w.N.hash(5, 9, 11) * 300; return [Math.round(Math.cos(a) * d), 30, Math.round(Math.sin(a) * d)]; }
World.prototype.generateEnd = function (cx, cz) {
  const d = new Uint16Array(CV), N = this.N, ES = BYNAME.end_stone, OB = BYNAME.obsidian, BR = BYNAME.bedrock, CP = BYNAME.chorus_plant, CF = BYNAME.chorus_flower;
  for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    const x = cx * 16 + lx, z = cz * 16 + lz, r = Math.hypot(x, z); let top = -1, bot = 0;
    if (r < 88) { const k = 1 - (r / 88) ** 2; top = Math.floor(56 + k * 9 + N.n2(x / 30, z / 30) * 2); bot = Math.floor(top - 6 - k * 38 - N.n2(x / 17 + 5, z / 17) * 4); }
    else if (r > 760) { const v = N.n2(x / 110 + 9, z / 110 - 3) + N.n2(x / 37, z / 37) * .3; if (v > .45) { top = Math.floor(58 + (v - .45) * 22); bot = Math.floor(top - 3 - (v - .45) * 70); } }
    if (top > 0) { for (let y = Math.max(1, bot); y <= top; y++) d[lidx(lx, y, lz)] = ES;
      if (r > 760 && N.hash(x, 77, z) < .006 && lx > 0 && lx < 15 && lz > 0 && lz < 15) { const h = 2 + Math.floor(N.hash(x, 78, z) * 5); for (let y = 1; y <= h; y++) d[lidx(lx, top + y, lz)] = CP; d[lidx(lx, top + h + 1, lz)] = CF; } }
    for (const p of END_PILLARS) { const dd = Math.hypot(x - p.x, z - p.z); if (dd <= p.r + .3) { for (let y = 40; y <= p.h; y++) d[lidx(lx, y, lz)] = OB; if (x == p.x && z == p.z) d[lidx(lx, p.h + 1, lz)] = BR; } }
    // exit portal fountain (bedrock), lit when the dragon dies
    if (r < 3.6) { const base = 60; if (r < 3.6) d[lidx(lx, base, lz)] = BR; if (r > 2.5) d[lidx(lx, base + 1, lz)] = BR; if (x == 0 && z == 0) for (let y = base + 1; y <= base + 4; y++) d[lidx(lx, y, lz)] = BR; }
  }
  return d;
};
const _wgen = World.prototype.generate, _wbio = World.prototype.biome, _wh = World.prototype.height;
World.prototype.generate = function (cx, cz, lite) {
  if (this.dim == 'end') { const d = this.generateEnd(cx, cz), c = { cx, cz, d, dirty: true, meshes: null }; const ed = this.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k]; this.chunks.set(cx + ',' + cz, c); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.chunk(cx + a, cz + b); if (n) n.dirty = true; } return c; }
  const c = _wgen.call(this, cx, cz, lite);
  if (c && (this.dim == 'overworld' || !this.dim) && !this.meta.flat && !this.meta.map && !lite) stampStronghold(this, c);
  return c;
};
World.prototype.biome = function (x, z) { return this.dim == 'end' ? 'the_end' : _wbio.call(this, x, z); };
if (_wh) World.prototype.height = function (x, z) { return this.dim == 'end' ? { h: 60, bio: 'the_end' } : _wh.call(this, x, z); };
// the portal room: stone bricks around a ring of 12 end portal frames over lava, with a silverfish spawner
function stampStronghold(w, c) {
  const [SX, SY, SZ] = strongholdPos(w); if (Math.abs(c.cx * 16 + 8 - SX) > 20 || Math.abs(c.cz * 16 + 8 - SZ) > 20) return;
  const ed = w.edits[c.cx + ',' + c.cz] || {}, put = (x, y, z, n, st) => { if ((x >> 4) != c.cx || (z >> 4) != c.cz) return; const li = lidx(x & 15, y, z & 15); if (ed[li] !== undefined) return; c.d[li] = BYNAME[n] || 0; if (st) w.state[x + ',' + y + ',' + z] = st; };
  const H = w.N.hash, bricks = ['stone_bricks', 'stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks'];
  for (let x = SX - 6; x <= SX + 6; x++) for (let z = SZ - 8; z <= SZ + 8; z++) for (let y = SY - 1; y <= SY + 7; y++) {
    const wall = x == SX - 6 || x == SX + 6 || z == SZ - 8 || z == SZ + 8 || y == SY - 1 || y == SY + 7;
    put(x, y, z, wall ? bricks[Math.floor(H(x, y, z) * 4)] : 'air'); }
  // stairs up to the portal and the lava pool under it
  for (let x = SX - 1; x <= SX + 1; x++) for (let z = SZ - 1; z <= SZ + 1; z++) { put(x, SY, z, 'lava'); put(x, SY - 1, z, 'stone_bricks'); }
  for (let i = -2; i <= 2; i++) for (const [x, z] of [[SX + i, SZ - 2], [SX + i, SZ + 2], [SX - 2, SZ + i], [SX + 2, SZ + i]]) put(x, SY, z, 'stone_bricks');
  const F = BL[BYNAME.end_portal_frame];
  const frame = (x, z, fd) => { const eye = H(x, 91, z) < .1; put(x, SY + 1, z, eye ? 'end_portal_frame_eye' : 'end_portal_frame', F.fy && F.fy[fd] ? { fd, fr: F.fy[fd] } : null); };
  for (let i = -1; i <= 1; i++) { frame(SX + i, SZ - 2, 'south'); frame(SX + i, SZ + 2, 'north'); frame(SX - 2, SZ + i, 'east'); frame(SX + 2, SZ + i, 'west'); }
  put(SX, SY, SZ + 6, 'spawner'); for (const [x, z] of [[SX - 5, SZ - 7], [SX + 5, SZ - 7], [SX - 5, SZ + 7], [SX + 5, SZ + 7]]) put(x, SY + 3, z, 'wall_torch');
  // a shaft of stone bricks up to the surface so the room can be found by digging down where the eye falls
}
function portalRingComplete(x, y, z) { // x,y,z = a frame; look for a 3x3 center ring of 12 eyed frames
  const E = BYNAME.end_portal_frame_eye;
  for (let cx = x - 2; cx <= x + 2; cx++) for (let cz = z - 2; cz <= z + 2; cz++) { let ok = true;
    for (let i = -1; i <= 1 && ok; i++) for (const [a, b] of [[cx + i, cz - 2], [cx + i, cz + 2], [cx - 2, cz + i], [cx + 2, cz + i]]) if (world.get(a, y, b) != E) { ok = false; break; }
    if (ok) { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) world.set(cx + i, y, cz + j, BYNAME.end_portal); SND.play('block/end_portal/endportal', 1, 1, [cx, y, cz]); return true; } }
  return false;
}
const _useItem = useItem;
useItem = function (hit, tm, h) {
  const n = h ? keyName(h.k) : '';
  if (n == 'ender_eye' && hit && BL[hit.b]?.n == 'end_portal_frame') { // put the eye in the frame
    const k = hit.x + ',' + hit.y + ',' + hit.z, st = world.state[k]; world.set(hit.x, hit.y, hit.z, BYNAME.end_portal_frame_eye); if (st) world.state[k] = st;
    if (player.mode == 'survival') { h.c--; if (!h.c) player.inv[player.sel] = null; } SND.play('block/end_portal/eyeplace', 1, 1, [hit.x + .5, hit.y + .5, hit.z + .5]); portalRingComplete(hit.x, hit.y, hit.z); return; }
  if (n == 'ender_eye' && !hit && world.dim != 'end') { // throw it: it floats toward the stronghold, then drops (or shatters)
    const [SX, , SZ] = strongholdPos(world), dx = SX - player.x, dz = SZ - player.z, d = Math.hypot(dx, dz) || 1;
    if (player.mode == 'survival') { h.c--; if (!h.c) player.inv[player.sel] = null; }
    SND.play('entity/endereye/endereye_launch', 1);
    const near = d < 12; eyes.push({ x: player.x, y: player.y + 1.5, z: player.z, vx: near ? 0 : dx / d * 6, vz: near ? 0 : dz / d * 6, vy: near ? -2 : 4, t: 0, k: h.k });
    if (near) chat('§5The eye sinks into the ground: the stronghold is below you'); return; }
  return _useItem(hit, tm, h);
};
const eyes = [];
function eyeTick(dt) { for (const e of eyes) { e.t += dt; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; e.vy *= .96; if (Math.random() < .6) try { spark('portal', e.x, e.y, e.z); } catch (er) { }
  if (e.t > 2.2) { e.dead = 1; if (Math.random() < .8) dropItem(e.k, 1, e.x, e.y, e.z); else SND.play('entity/endereye/dead', 1, 1, [e.x, e.y, e.z]); } }
  for (let i = eyes.length - 1; i >= 0; i--) if (eyes[i].dead) eyes.splice(i, 1); }
function goDim(dim, place, title) {
  saveWorld(); world.switchDim(dim); mobs = []; items = []; arrows = []; particles = []; tnts = [];
  player.vx = player.vy = player.vz = 0; player.portalT = 0; player.portalCool = 4; player.fallStart = null;
  S.loadTitle = title; S.loadSub = 'Building terrain'; S.loadP = 0; startLoad(); go('loading'); SND.play('portal/travel', .4);
  S.afterLoad = place;
}
function arriveEnd() { // the obsidian platform at 100, 49, 0
  const OB = BYNAME.obsidian; for (let x = 98; x <= 102; x++) for (let z = -2; z <= 2; z++) { world.set(x, 48, z, OB); for (let y = 49; y <= 51; y++) world.set(x, y, z, 0); }
  player.x = 100.5; player.y = 49; player.z = .5; player.yaw = Math.PI / 2;
  if (!world.meta.dragonDead && !mobs.some(m => m.type == 'ender_dragon')) { const d = spawnMob('ender_dragon', 0, 90, 0); d.home = [0, 0]; d.persist = 1; world.meta.dragonSpawned = 1; chat('§5The Ender Dragon awakens'); }
}
function endExitPortal() { const BR = BYNAME.bedrock, EP = BYNAME.end_portal; for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const r = Math.hypot(x, z); if (r < 2.6 && !(x == 0 && z == 0)) world.set(x, 61, z, EP); }
  world.set(0, 65, 0, BYNAME.dragon_egg); }
let endT = 0;
const _updWorld = updateWorld;
updateWorld = function (dt) {
  _updWorld(dt); if (!world || !player || S.screen == 'loading') return; eyeTick(dt);
  if (player.portalCool > 0) player.portalCool -= dt;
  const fb = BL[world.get(Math.floor(player.x), Math.floor(player.y + .2), Math.floor(player.z))]?.n;
  if (fb == 'end_portal' && !(player.portalCool > 0)) {
    if (world.dim == 'end') { const sp = player.spawn; goDim('overworld', () => { const s = player.spawn || sp || findSpawn(world); player.x = s[0]; player.y = s[1]; player.z = s[2]; if (world.collides(player.x, player.y, player.z, .3, 1.8)) player.y = world.topY(Math.floor(player.x), Math.floor(player.z)) + 1; }, 'Leaving the End'); if (world.meta.dragonDead && !world.meta.creditsSeen) { world.meta.creditsSeen = 1; chat('§dThe End. Thanks for playing!'); } }
    else goDim('end', arriveEnd, 'Entering the End');
    return; }
  if (fb == 'end_gateway' && world.dim == 'end' && !(player.portalCool > 0)) { // to the outer islands and back
    const a = Math.atan2(player.z, player.x), far = Math.hypot(player.x, player.z) < 500, R = far ? 1000 : 96;
    let tx = Math.round(Math.cos(a) * R), tz = Math.round(Math.sin(a) * R); player.portalCool = 3;
    if (far) { let ty = 0; for (let i = 0; i < 40 && !ty; i++) { const y = world.topY(tx, tz); if (y > 30) ty = y; else { tx += Math.round(Math.cos(a) * 8); tz += Math.round(Math.sin(a) * 8); } }
      if (!ty) { ty = 60; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) world.set(tx + x, ty, tz + z, BYNAME.end_stone); }
      world.set(tx, ty + 1, tz + 1, BYNAME.end_gateway); player.x = tx + .5; player.y = ty + 1; player.z = tz + .5; }
    else { player.x = tx + 2.5; player.y = world.topY(tx + 2, tz) + 1; player.z = tz + .5; }
    SND.play('portal/travel', .3); return; }
  if (world.dim == 'end' && world.meta.dragonSpawned && !world.meta.dragonDead && (endT += dt) > 2) { endT = 0;
    if (!mobs.some(m => m.type == 'ender_dragon' && !m.dead)) { world.meta.dragonDead = 1; endExitPortal(); SND.play('mob/enderdragon/end', 1);
      const a = Math.random() * Math.PI * 2, gx = Math.round(Math.cos(a) * 96), gz = Math.round(Math.sin(a) * 96); world.set(gx, 75, gz, BYNAME.end_gateway); for (const [x, y, z] of [[0, 1, 0], [0, -1, 0]]) world.set(gx + x, 75 + y, gz + z, BYNAME.bedrock);
      if (typeof addXp == 'function') addXp(500); chat('§5The Ender Dragon has been slain. The exit portal is open.'); } }
  if (player.y < -64 && world.dim == 'end' && player.mode != 'creative' && !player.dead) hurtPlayer(4, 'fell out of the world', true);
};
if (MOBDEF.ender_dragon) MOBDEF.ender_dragon.drop = []; // the egg appears on the exit portal instead
