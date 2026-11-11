// ---- block stages and random ticks: crops grow through their real stages, saplings become trees, cane/cactus/bamboo/kelp grow up,
// grass spreads, stems grow melons and pumpkins, berries ripen, cocoa swells, farmland dries out ----
// A block's growth lives in world.state['x,y,z'].age. No age = fully grown (old worlds and generated villages keep their mature crops).
const STAGE_DEF = {
  wheat: { max: 7, tiles: a => 'wheat_stage' + a },
  carrots: { max: 7, tiles: a => 'carrots_stage' + [0, 0, 1, 1, 2, 2, 2, 3][a] },
  potatoes: { max: 7, tiles: a => 'potatoes_stage' + [0, 0, 1, 1, 2, 2, 2, 3][a] },
  beetroots: { max: 3, tiles: a => 'beetroots_stage' + a, slow: 3 },
  nether_wart: { max: 3, tiles: a => 'nether_wart_stage' + [0, 1, 1, 2][a], slow: 10, soil: 'soul_sand' },
  sweet_berry_bush: { max: 3, tiles: a => 'sweet_berry_bush_stage' + a, slow: 5, soil: 'any' },
  cocoa: { max: 2, tiles: a => 'cocoa_stage' + a, slow: 5, soil: 'any' },
  torchflower_crop: { max: 2, tiles: a => 'torchflower_crop_stage' + Math.min(1, a), done: 'torchflower' },
  melon_stem: { max: 7, fruit: 'melon' }, pumpkin_stem: { max: 7, fruit: 'pumpkin' },
};
let TREMAP = null; // tile -> tile while one staged block is meshed
const stageMap = {};
function stageRemap(b, st) { const d = STAGE_DEF[BL[b].n]; if (!d || !d.tiles || !st || st.age == null) return null; const k = b + ':' + st.age; if (stageMap[k] !== undefined) return stageMap[k];
  const m = {}, t0 = REG.tiles[d.tiles(0)], ta = REG.tiles[d.tiles(Math.min(st.age, d.max))]; if (t0 != null && ta != null) { m[t0] = ta; const tm = REG.tiles[d.tiles(d.max)]; if (tm != null) m[tm] = ta; }
  return stageMap[k] = m; }
const _tileUV = tileUV; tileUV = function (t) { return _tileUV(TREMAP && TREMAP[t] != null ? TREMAP[t] : t); };
function ageOf(x, y, z) { const st = world.state[x + ',' + y + ',' + z]; return st && st.age != null ? st.age : null; }
function setAge(x, y, z, a) { const k = x + ',' + y + ',' + z; const st = world.state[k] || (world.state[k] = {}); st.age = a; world.set(x, y, z, world.get(x, y, z)); }
function isMature(b, x, y, z) { const d = STAGE_DEF[BL[b]?.n]; if (!d) return true; const a = ageOf(x, y, z); return a == null || a >= d.max; }
function plantAt(x, y, z, id) { world.set(x, y, z, id); const d = STAGE_DEF[BL[id].n]; if (d) setAge(x, y, z, 0); }
// bone meal on a crop: +2..5 stages (berries/cocoa +1)
function boneMealCrop(x, y, z) { const b = world.get(x, y, z), d = STAGE_DEF[BL[b]?.n]; if (!d) return false; let a = ageOf(x, y, z); if (a == null) a = d.max; if (a >= d.max) return false;
  a = Math.min(d.max, a + (d.max <= 3 ? 1 : 2 + (Math.random() * 4 | 0))); setAge(x, y, z, a); if (a >= d.max && d.done) { world.set(x, y, z, BYNAME[d.done]); delete world.state[x + ',' + y + ',' + z]; } return true; }
const TALL_GROW = { sugar_cane: 3, cactus: 3, bamboo: 16, kelp: 25 };
function rtBlock(x, y, z) {
  const b = world.get(x, y, z); if (!b) return; const n = BL[b].n, d = STAGE_DEF[n];
  if (d) { const below = BL[world.get(x, y - 1, z)]?.n;
    if (!d.soil && below != 'farmland') return; if (d.soil == 'soul_sand' && below != 'soul_sand') return;
    let a = ageOf(x, y, z); if (a == null || Math.random() * (d.slow || 1) > 1) return;
    if (a < d.max) { setAge(x, y, z, a + 1); if (a + 1 >= d.max && d.done) { world.set(x, y, z, BYNAME[d.done]); delete world.state[x + ',' + y + ',' + z]; } return; }
    if (d.fruit) { const D = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0], fx = x + D[0], fz = z + D[1];
      if (!world.get(fx, y, fz) && /^(dirt|grass_block|farmland|coarse_dirt|podzol|moss_block|mud)$/.test(BL[world.get(fx, y - 1, fz)]?.n || '') && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a2, c2]) => BL[world.get(x + a2, y, z + c2)]?.n == d.fruit)) world.set(fx, y, fz, BYNAME[d.fruit]); }
    return; }
  if (/_sapling$|^mangrove_propagule$/.test(n)) { if (Math.random() < .12 && typeof growTree == 'function') { const bio = n.startsWith('birch') ? 'birch' : n.startsWith('spruce') ? 'taiga' : n.startsWith('cherry') ? 'cherry' : n.startsWith('jungle') ? 'jungle' : n.startsWith('acacia') ? 'savanna' : n.startsWith('dark_oak') ? 'dark_forest' : 'plains'; world.set(x, y, z, 0); growTree(x, y, z, bio); } return; }
  if (TALL_GROW[n] != null) { if (world.get(x, y + 1, z) != (n == 'kelp' ? BYNAME.water : 0) && !(n == 'kelp' && BL[world.get(x, y + 1, z)]?.n == 'water')) return; if (Math.random() > .25) return;
    let h = 1; while (h < 30 && world.get(x, y - h, z) == b) h++; if (h < TALL_GROW[n]) world.set(x, y + 1, z, b); return; }
  if (n == 'grass_block' || n == 'mycelium') { const ab = world.get(x, y + 1, z); if (ab && OPAQUE[ab]) { world.set(x, y, z, BYNAME.dirt); return; }
    for (let i = 0; i < 2; i++) { const tx = x + (Math.random() * 3 | 0) - 1, ty = y + (Math.random() * 5 | 0) - 3, tz = z + (Math.random() * 3 | 0) - 1; if (world.get(tx, ty, tz) == BYNAME.dirt && !OPAQUE[world.get(tx, ty + 1, tz)]) world.set(tx, ty, tz, b); } return; }
  if (n == 'farmland') { let wet = false; for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (BL[world.get(x + dx, y + dy, z + dz)]?.n == 'water') { wet = true; break; }
    if (!wet && !world.meta.rain && !STAGE_DEF[BL[world.get(x, y + 1, z)]?.n] && Math.random() < .3) world.set(x, y, z, BYNAME.dirt); return; }
  if (/^(ice)$/.test(n) && world.dim == 'nether') world.set(x, y, z, BYNAME.water);
}
let rtAcc = 0;
function randomTicks(dt) { // vanilla: 3 random blocks per 16x16x16 section per tick (20 tps) within 8 chunks
  if (!world || !player || world.meta.map && !(window.MAPS && MAPS[world.meta.map] || {}).free) return;
  rtAcc += dt * 20; const ticks = Math.min(4, rtAcc | 0); rtAcc -= ticks; if (!ticks) return;
  const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4, R = 6, secs = WH >> 4;
  for (let t = 0; t < ticks; t++) for (let cx = pcx - R; cx <= pcx + R; cx++) for (let cz = pcz - R; cz <= pcz + R; cz++) { if (!world.chunks.get(cx + ',' + cz)) continue;
    for (let s = 0; s < secs; s++) for (let i = 0; i < 3; i++) rtBlock(cx * 16 + (Math.random() * 16 | 0), s * 16 + (Math.random() * 16 | 0), cz * 16 + (Math.random() * 16 | 0)); }
}
function immatureDrops(b, a) { const n = BL[b].n, I = k => itemKey(k) || itemKey('item:' + k);
  const seed = { wheat: 'wheat_seeds', carrots: 'carrot', potatoes: 'potato', beetroots: 'beetroot_seeds', nether_wart: 'nether_wart', cocoa: 'cocoa_beans', torchflower_crop: 'torchflower_seeds', melon_stem: 'melon_seeds', pumpkin_stem: 'pumpkin_seeds' }[n];
  if (n == 'sweet_berry_bush') return a >= 2 ? [[I('sweet_berries'), 1 + (Math.random() * 2 | 0)]] : [];
  return seed && I(seed) ? [[I(seed), 1]] : []; }
// right-click a ripe berry bush: pick the berries, the bush goes back to stage 1
function useCrop(x, y, z) { const b = world.get(x, y, z), n = BL[b]?.n; if (n != 'sweet_berry_bush') return false; let a = ageOf(x, y, z); if (a == null) a = 3; if (a < 2) return false;
  dropItem(itemKey('item:sweet_berries') || itemKey('sweet_berries'), a == 3 ? 2 + (Math.random() * 2 | 0) : 1 + (Math.random() * 2 | 0), x + .5, y + .5, z + .5); setAge(x, y, z, 1); SND.play('item/sweet_berries/pick_from_bush1', 1, 1, [x + .5, y + .5, z + .5]); return true; }
