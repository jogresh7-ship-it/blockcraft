'use strict';
const CS = 16, WH = 128, SEA = 62, CV = CS * CS * WH;
const lidx = (x, y, z) => x + CS * (z + CS * y);
let WLOG, WATER_ID, LEAF;
function initWorldTables() { WLOG = new Uint8Array(NB); LEAF = new Uint8Array(NB); WATER_ID = BYNAME.water; BL.forEach((b, i) => { if (/^(seagrass|kelp|kelp_plant|tall_seagrass|sea_pickle)$|coral/.test(b.n) && SHAPE[i] == 2) WLOG[i] = 1; if (b.n.endsWith('leaves')) LEAF[i] = 1; }); }
const B = n => BYNAME[n] || 0;

class World {
  constructor(meta) {
    this.power = {};
    this.meta = meta; this.seed = meta.seed; this.N = makeNoise(meta.seed);
    this.chunks = new Map(); this.dim = meta.dim || 'overworld'; meta.dimEdits = meta.dimEdits || {}; meta.dimEdits.overworld = (meta.edits && Object.keys(meta.edits).length ? meta.edits : null) || meta.dimEdits.overworld || {}; delete meta.edits; /* an empty `edits` used to wipe the saved changes on load */ this.edits = meta.dimEdits[this.dim] || (meta.dimEdits[this.dim] = {}); this.containers = meta.containers || {}; this.state = meta.state || (meta.state = {});
    if (!meta.gen) meta.gen = meta.created && meta.created < 1794091000000 ? 1 : 2; // worlds created before the realistic-terrain update use the old generator
    if (meta.gen == 1) { this.height = this.heightV1; this.biome = this.biomeV1; this.generate = this.generateV1; this.tree = this.treeV1; }
    this.ids = {}; for (const n of ['stone', 'dirt', 'grass_block', 'snowy_grass_block', 'sand', 'sandstone', 'gravel', 'water', 'lava', 'bedrock', 'deepslate', 'oak_log', 'oak_leaves',
      'birch_log', 'birch_leaves', 'spruce_log', 'spruce_leaves', 'cherry_log', 'cherry_leaves', 'cactus', 'dead_bush', 'short_grass', 'tall_grass', 'fern', 'coal_ore', 'iron_ore', 'copper_ore',
      'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore', 'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_gold_ore', 'deepslate_redstone_ore', 'deepslate_lapis_ore',
      'deepslate_diamond_ore', 'deepslate_copper_ore', 'snow_block', 'ice', 'clay', 'seagrass', 'pumpkin', 'sugar_cane', 'kelp_plant', 'poppy', 'dandelion', 'cornflower', 'azure_bluet', 'oxeye_daisy',
      'allium', 'orange_tulip', 'pink_tulip', 'red_tulip', 'white_tulip', 'lily_of_the_valley', 'blue_orchid', 'brown_mushroom', 'red_mushroom', 'sweet_berry_bush', 'moss_block', 'tuff',
      'granite', 'diorite', 'andesite', 'terracotta', 'red_sand', 'cobblestone', 'mossy_cobblestone', 'jungle_log', 'jungle_leaves', 'acacia_log', 'acacia_leaves', 'podzol', 'packed_ice', 'calcite'])
      this.ids[n] = B(n);
  }
  key(cx, cz) { return cx + ',' + cz; }
  switchDim(d) { for (const c of this.chunks.values()) if (c.meshes) c.meshes.forEach(freeMesh); this.chunks.clear(); this.dim = d; this.meta.dim = d; this.edits = this.meta.dimEdits[d] || (this.meta.dimEdits[d] = {}); }
  generateNether(cx, cz) {
    const d = new Uint16Array(CV), N = this.N, H = N.hash, x0 = cx * CS, z0 = cz * CS, I = this.ids, b = n => BYNAME[n];
    const NR = b('netherrack'), LAVA = I.lava, BR = I.bedrock, GS = b('glowstone'), SS = b('soul_sand'), SSO = b('soul_soil'), QZ = b('nether_quartz_ore'), NG = b('nether_gold_ore'), MG = b('magma'), BAS = b('basalt'), BLK = b('blackstone');
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const wx = x0 + lx, wz = z0 + lz, bio = N.n2(wx / 180 + 40, wz / 180), soul = N.n2(wx / 90 - 70, wz / 90) > .3;
      for (let y = 0; y < WH; y++) {
        let v = 0;
        if (y == 0 || y == WH - 1 || (y < 4 && H(wx, y, wz) < .5) || (y > WH - 5 && H(wx, y, wz) < .5)) v = BR;
        else {
          const dens = N.n3(wx / 46, y / 22, wz / 46) * 1.1 + N.n3(wx / 16, y / 12, wz / 16) * .3 + Math.max(0, (36 - y) / 30) + Math.max(0, (y - (WH - 30)) / 18);
          if (dens > .1) { v = NR; const r = H(wx, y, wz); if (r < .015) v = QZ; else if (r < .025) v = NG; else if (y < 38 && r < .03) v = MG; if (soul && y < 50) v = H(wx, y, wz + 7) < .5 ? SS : SSO; if (bio < -.35 && y > 40) v = r < .5 ? BAS : BLK; }
          else if (y <= 31) v = LAVA;
        }
        d[lidx(lx, y, lz)] = v;
      }
    }
    // surface decoration
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const wx = x0 + lx, wz = z0 + lz, bio = N.n2(wx / 180 + 40, wz / 180);
      for (let y = 2; y < WH - 2; y++) {
        const i = lidx(lx, y, lz), v = d[i], up = d[lidx(lx, y + 1, lz)], dn = d[lidx(lx, y - 1, lz)];
        if (v == NR && up == 0) { const r = H(wx, y + 1, wz);
          if (bio > .25) { d[i] = b('crimson_nylium'); if (r < .1) d[lidx(lx, y + 1, lz)] = r < .03 ? b('crimson_fungus') : b('crimson_roots'); else if (r < .012 && lx > 1 && lx < 14 && lz > 1 && lz < 14) this.netherTree(d, lx, y + 1, lz, 'crimson'); }
          else if (bio < -.15 && bio > -.35) { d[i] = b('warped_nylium'); if (r < .1) d[lidx(lx, y + 1, lz)] = r < .03 ? b('warped_fungus') : b('warped_roots'); }
          else if (r < .02) d[lidx(lx, y + 1, lz)] = b('fire'); }
        if (v == 0 && up == NR && H(wx, y, wz) < .006) { for (let k = 0; k < 4; k++) { const yy = y - k; if (yy > 1 && !d[lidx(lx, yy, lz)]) d[lidx(lx, yy, lz)] = GS; } }
      }
    }
    return d;
  }
  netherTree(d, x, y, z, k) { const st = BYNAME[k + '_stem'], wr = BYNAME[k == 'crimson' ? 'nether_wart_block' : 'warped_wart_block'], sh = BYNAME.shroomlight, h = 5 + (x * 3 + z) % 3;
    for (let a = -2; a <= 2; a++) for (let b2 = -2; b2 <= 2; b2++) for (let c = h - 2; c <= h + 1; c++) { if (Math.abs(a) + Math.abs(b2) > 3 - (c > h ? 1 : 0)) continue; const xx = x + a, zz = z + b2; if (xx < 0 || zz < 0 || xx > 15 || zz > 15 || y + c >= WH) continue; d[lidx(xx, y + c, zz)] = (a * 7 + b2 * 3 + c) % 11 == 0 ? sh : wr; }
    for (let c = 0; c < h; c++) if (y + c < WH) d[lidx(x, y + c, z)] = st; }
  chunk(cx, cz) { return this.chunks.get(cx + ',' + cz); }
  get(x, y, z) {
    if (y < 0 || y >= WH) return 0; const c = this.chunks.get((x >> 4) + ',' + (z >> 4)); if (!c) return 0;
    return c.d[lidx(x & 15, y, z & 15)];
  }
  getOr(x, y, z, def) { if (y < 0) return def; if (y >= WH) return 0; const c = this.chunks.get((x >> 4) + ',' + (z >> 4)); if (!c) return def; return c.d[lidx(x & 15, y, z & 15)]; }
  set(x, y, z, v, record = true) {
    if (y < 0 || y >= WH) return; const cx = x >> 4, cz = z >> 4, c = this.chunk(cx, cz); if (!c) return;
    const li = lidx(x & 15, y, z & 15); c.d[li] = v; c.dirty = true; c.lightDirty = true; if (this.onSet) this.onSet(x, y, z);
    if (record) { const k = cx + ',' + cz; (this.edits[k] || (this.edits[k] = {}))[li] = v; }
    const lx = x & 15, lz = z & 15;
    const mark = (a, b) => { const n = this.chunk(a, b); if (n) n.dirty = true; };
    mark(cx - 1, cz); mark(cx + 1, cz); mark(cx, cz - 1); mark(cx, cz + 1);
    if (lx && lx < 15 && lz && lz < 15) { /* neighbours only needed for light spill */ }
  }
  // ---- original (v1) world generator, kept so worlds made before the terrain update load exactly as they were ----
  heightV1(x, z) { // terrain height & biome
    const N = this.N;
    const cont = N.fbm(x / 420, z / 420, 4), ero = N.fbm(x / 160 + 300, z / 160, 3);
    let h = SEA + 2 + cont * 26 + N.fbm(x / 50, z / 50, 3) * 7;
    const m = Math.max(0, N.fbm(x / 240 - 200, z / 240 + 90, 4) - 0.05); h += m * m * 260 * (0.5 + ero);
    const temp = N.fbm(x / 600 + 1000, z / 600 - 400, 2) + (h > 95 ? -0.4 : 0), wet = N.fbm(x / 500 - 900, z / 500 + 700, 2);
    let bio = 'plains';
    if (h < SEA - 1) bio = temp < -0.25 ? 'frozen_ocean' : 'ocean';
    else if (h > 100) bio = 'mountains';
    else if (temp > 0.22) bio = wet > 0.1 ? 'jungle' : wet < -0.15 ? 'badlands' : 'desert';
    else if (temp < -0.22) bio = 'taiga';
    else if (wet > 0.15) bio = N.n2(x / 200, z / 200) > 0.25 ? 'cherry' : 'forest';
    else if (wet > 0.0) bio = 'birch';
    else if (temp > 0.12) bio = 'savanna';
    return { h: Math.floor(h), bio };
  }
  biomeV1(x, z) { if (this.dim == 'nether') { const b = this.N.n2(x / 180 + 40, z / 180); return b > .25 ? 'crimson_forest' : b < -.35 ? 'basalt_deltas' : b < -.15 ? 'warped_forest' : this.N.n2(x / 90 - 70, z / 90) > .3 ? 'soul_sand_valley' : 'nether_wastes'; } return this.heightV1(x, z).bio; }
  generateV1(cx, cz) {
    if (this.dim == 'nether') { const d = this.generateNether(cx, cz); const c = { cx, cz, d, dirty: true, meshes: null }; const ed = this.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k]; this.chunks.set(cx + ',' + cz, c); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.chunk(cx + a, cz + b); if (n) n.dirty = true; } return c; }
    const d = new Uint16Array(CV), I = this.ids, N = this.N, H = N.hash, x0 = cx * CS, z0 = cz * CS;
    const hm = new Int16Array(256), bm = [];
    for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
      const wx = x0 + lx, wz = z0 + lz, { h, bio } = this.heightV1(wx, wz); hm[lx + lz * 16] = h; bm[lx + lz * 16] = bio;
      const beach = h >= SEA - 2 && h <= SEA + 1 && bio != 'mountains' && bio != 'taiga';
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let v = 0;
        if (y <= h) {
          if (y == 0 || (y < 4 && H(wx, y, wz) < 0.5)) v = I.bedrock;
          else if (y < h - 3) {
            v = y < 12 ? I.deepslate : I.stone;
            if (v == I.stone) { const s = N.n3(wx / 24, y / 16, wz / 24); if (s > 0.55) v = I.granite; else if (s < -0.55) v = I.diorite; else if (N.n3(wx / 20 + 50, y / 20, wz / 20) > 0.6) v = I.andesite; else if (y < 20 && N.n3(wx / 16, y / 16 + 30, wz / 16) > 0.6) v = I.tuff; }
            const r = H(wx, y, wz), dp = y < 12;
            if (r < 0.012 && y < 110) v = dp ? I.deepslate_coal_ore : I.coal_ore;
            else if (r < 0.019 && y < 64) v = dp ? I.deepslate_iron_ore : I.iron_ore;
            else if (r < 0.024 && y < 70 && y > 20) v = I.copper_ore;
            else if (r < 0.0265 && y < 32) v = dp ? I.deepslate_gold_ore : I.gold_ore;
            else if (r < 0.031 && y < 16) v = dp ? I.deepslate_redstone_ore : I.redstone_ore;
            else if (r < 0.033 && y < 30) v = dp ? I.deepslate_lapis_ore : I.lapis_ore;
            else if (r < 0.0345 && y < 15) v = dp ? I.deepslate_diamond_ore : I.diamond_ore;
            else if (r < 0.036 && bio == 'mountains' && y > 60) v = I.emerald_ore;
          } else if (y < h) {
            v = bio == 'desert' ? (y < h - 2 ? I.sandstone : I.sand) : bio == 'badlands' ? I.terracotta : (bio == 'ocean' || bio == 'frozen_ocean') ? (H(wx, 7, wz) < .3 ? I.gravel : I.sand) : beach ? I.sand : bio == 'mountains' && h > 115 ? I.stone : I.dirt;
          } else {
            v = bio == 'desert' ? I.sand : bio == 'badlands' ? I.red_sand : (bio == 'ocean' || bio == 'frozen_ocean') ? (H(wx, 7, wz) < .3 ? I.gravel : H(wx, 8, wz) < .1 ? I.clay : I.sand) : beach ? I.sand
              : bio == 'mountains' ? (h > 118 ? I.snow_block : h > 108 ? I.stone : I.grass_block) : bio == 'taiga' ? I.snowy_grass_block : (bio == 'jungle' && H(wx, 3, wz) < .2) ? I.podzol : I.grass_block;
          }
          // caves
          if (v && v != I.bedrock && y > 4 && y < h - 1) {
            const c1 = N.n3(wx / 40, y / 24, wz / 40), c2 = N.n3(wx / 40 + 77, y / 24 + 33, wz / 40 - 15);
            if (c1 * c1 + c2 * c2 < 0.004 || N.n3(wx / 70, y / 30, wz / 70) > 0.62) v = y < 11 ? I.lava : 0;
          }
        } else if (y <= SEA) v = (bio == 'frozen_ocean' && y == SEA) ? I.ice : I.water;
        d[lidx(lx, y, lz)] = v;
      }
    }
    // decorations
    const put = (x, y, z, v, rep) => { if (x < 0 || z < 0 || x > 15 || z > 15 || y < 1 || y >= WH) return; const i = lidx(x, y, z); if (rep || d[i] == 0) d[i] = v; };
    for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
      const wx = x0 + lx, wz = z0 + lz, h = hm[lx + lz * 16], bio = bm[lx + lz * 16], top = d[lidx(lx, h, lz)], r = H(wx, 999, wz), above = d[lidx(lx, h + 1, lz)];
      if (above != 0) { if (above == I.water && (top == I.sand || top == I.gravel) && r < 0.18) put(lx, h + 1, lz, I.seagrass, 1); if (above == I.water && r > 0.97 && h < SEA - 4) for (let k = 1; k < Math.min(5, SEA - h); k++) put(lx, h + k, lz, I.kelp_plant, 1); continue; }
      const inner = lx > 1 && lx < 14 && lz > 1 && lz < 14;
      if (top == I.grass_block || top == I.snowy_grass_block || top == I.podzol) {
        const tc = { forest: .045, birch: .04, taiga: .035, jungle: .09, cherry: .03, plains: .004, savanna: .006, mountains: .01 }[bio] || 0;
        if (inner && r < tc) { this.treeV1(put, lx, h + 1, lz, bio, H(wx, 5, wz)); d[lidx(lx, h, lz)] = I.dirt; continue; }
        const r2 = H(wx, 77, wz);
        if (bio == 'taiga') { if (r2 < .08) put(lx, h + 1, lz, I.fern); else if (r2 < .1) put(lx, h + 1, lz, I.sweet_berry_bush); continue; }
        if (r2 < .22) { const v = r2 < .03 ? I.tall_grass : r2 < .05 && bio == 'jungle' ? I.fern : I.short_grass; put(lx, h + 1, lz, v); if (v == I.tall_grass) put(lx, h + 2, lz, BYNAME.tall_grass_top); }
        else if (r2 < .25 + (bio == 'plains' || bio == 'cherry' ? .03 : 0)) { const fl = ['poppy', 'dandelion', 'cornflower', 'azure_bluet', 'oxeye_daisy', 'allium', 'orange_tulip', 'pink_tulip', 'red_tulip', 'white_tulip', 'lily_of_the_valley', 'blue_orchid']; put(lx, h + 1, lz, I[fl[Math.floor(H(wx >> 3, 4, wz >> 3) * fl.length)]]); }
        else if (r2 < .2515) put(lx, h + 1, lz, I.pumpkin);
        else if (r2 < .256 && bio == 'forest') put(lx, h + 1, lz, r2 < .2535 ? I.brown_mushroom : I.red_mushroom);
        // sugar cane near water
        if (r2 > .9 && h == SEA) { let wn = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (lx + a >= 0 && lx + a < 16 && lz + b >= 0 && lz + b < 16 && d[lidx(lx + a, h, lz + b)] == I.water) wn = true; if (wn) for (let k = 1; k <= 1 + Math.floor(r2 * 30) % 3; k++) put(lx, h + k, lz, I.sugar_cane); }
      } else if (top == I.sand && (bio == 'desert' || bio == 'badlands')) {
        if (r < .006 && inner) { const hh = 1 + Math.floor(H(wx, 6, wz) * 3); for (let k = 1; k <= hh; k++) put(lx, h + k, lz, I.cactus); }
        else if (r < .02) put(lx, h + 1, lz, I.dead_bush);
      } else if (top == I.red_sand && r < .02) put(lx, h + 1, lz, I.dead_bush);
    }
    const c = { cx, cz, d, dirty: true, meshes: null, hm };
    const ed = this.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k];
    this.chunks.set(cx + ',' + cz, c);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.chunk(cx + a, cz + b); if (n) n.dirty = true; }
    return c;
  }
  treeV1(put, x, y, z, bio, r) {
    const I = this.ids;
    if (bio == 'taiga' || (bio == 'mountains' && r < .7)) {
      const h = 6 + Math.floor(r * 4);
      for (let k = 0; k < h; k++) put(x, y + k, z, I.spruce_log, 1);
      for (let k = 2; k < h + 1; k++) { const rad = k == h ? 0 : ((h - k) % 2 == 0 ? 2 : 1) - (k > h - 2 ? 1 : 0); for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) if (Math.abs(a) + Math.abs(b) <= rad + 1 && (a || b || k >= h)) put(x + a, y + k, z + b, I.spruce_leaves); }
      put(x, y + h, z, I.spruce_leaves); return;
    }
    const kind = bio == 'birch' || (bio == 'forest' && r < .3) ? ['birch_log', 'birch_leaves'] : bio == 'cherry' ? ['cherry_log', 'cherry_leaves'] : bio == 'jungle' ? ['jungle_log', 'jungle_leaves'] : bio == 'savanna' ? ['acacia_log', 'acacia_leaves'] : ['oak_log', 'oak_leaves'];
    const h = (bio == 'jungle' ? 6 : 4) + Math.floor(r * 3), L = I[kind[1]];
    for (let k = -3; k <= 0; k++) { const rad = k >= -1 ? 1 : 2; for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) { if (Math.abs(a) == rad && Math.abs(b) == rad && (k == 0 || ((x * 7 + a * 3 + b * 5 + k) & 3) == 0)) continue; put(x + a, y + h + k, z + b, L); } }
    put(x, y + h + 1, z, L); put(x + 1, y + h + 1, z, L); put(x - 1, y + h + 1, z, L); put(x, y + h + 1, z + 1, L); put(x, y + h + 1, z - 1, L);
    for (let k = 0; k < h; k++) put(x, y + k, z, I[kind[0]], 1);
  }
  height(x, z) { // realistic terrain: continents, eroded mountains with ridges, winding river valleys, coasts
    const N = this.N, ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const qx = x + N.fbm(x / 310 + 11, z / 310 - 7, 3) * 70, qz = z + N.fbm(x / 310 - 31, z / 310 + 19, 3) * 70; // domain warp = natural, non-blobby shapes
    const cont = N.fbm(qx / 900, qz / 900, 5) * 1.6 + .12, ero = N.fbm(qx / 420 + 300, qz / 420, 4) * 1.5;
    // continental base height (deep ocean -> shelf -> coast -> inland plateau)
    let h = cont < -.45 ? 34 + (cont + 1) * 18 : cont < -.12 ? lerp(44, 58, (cont + .45) / .33) : cont < .02 ? lerp(58, 64, (cont + .12) / .14) : 64 + Math.min(cont - .02, .6) * 22;
    const land = ss(-.02, .12, cont), mtn = land * ss(.18, -.3, ero) * ss(.02, .25, cont);
    // ridged mountains: sharp crests, wide eroded valleys
    const r1 = 1 - Math.abs(N.fbm(qx / 260 - 200, qz / 260 + 90, 5) * 1.5), r2 = 1 - Math.abs(N.fbm(qx / 110 + 70, qz / 110 - 40, 3) * 1.4);
    const ridge = Math.pow(clamp(r1, 0, 1), 2.4) * .8 + Math.pow(clamp(r2, 0, 1), 3) * .25;
    h += ridge * 62 * mtn + mtn * 10;
    // rolling hills & small bumps (fewer where it is flat and eroded)
    const hills = land * (1 - mtn) * (.4 + ss(-.2, .6, -ero) * .6);
    h += N.fbm(qx / 120 + 500, qz / 120, 4) * 16 * hills + N.fbm(x / 28, z / 28, 2) * 2.2 + N.fbm(x / 9, z / 9, 1) * .6;
    // rivers: winding, carve a valley then a channel below sea level
    const rv = Math.abs(N.fbm(qx / 760 - 900, qz / 760 + 400, 4)), riv = land * ss(.75, .2, mtn);
    let river = 0;
    if (riv > 0) { const bank = ss(.06, .022, rv), ch = ss(.022, .008, rv); h = lerp(h, Math.min(h, SEA + 1 + (rv * 60)), bank * riv); h = lerp(h, SEA - 3 - ch * 2, ch * riv); river = ch * riv; }
    // swamps sit in flat lowlands just above sea level
    const temp = N.fbm(x / 800 + 1000, z / 800 - 400, 3) * 1.4 - Math.max(0, h - 82) * .012, wet = N.fbm(x / 650 - 900, z / 650 + 700, 3) * 1.4, wild = N.n2(x / 230, z / 230);
    if (land > .5 && wet > .38 && temp > -.15 && temp < .3 && mtn < .1 && h < SEA + 9) h = lerp(h, SEA + N.fbm(x / 14, z / 14, 2) * 2.2, ss(.38, .5, wet));
    h = Math.min(h, WH - 6);
    let bio;
    if (river > .4 && h < SEA) bio = temp < -.35 ? 'frozen_river' : 'river';
    else if (h < SEA - 1 && cont < .02) bio = temp < -.35 ? 'frozen_ocean' : cont < -.45 ? 'deep_ocean' : 'ocean';
    else if (h > 98 + wild * 6) bio = temp < -.15 || h > 113 ? 'snowy_mountains' : 'mountains';
    else if (mtn > .35 && h > 84) bio = temp < -.35 ? 'snowy_mountains' : wet > .05 ? 'meadow' : 'mountains';
    else if (cont < .045 && river < .05 && h <= SEA + 2 && h >= SEA - 2) bio = temp < -.35 ? 'snowy_beach' : 'beach';
    else if (land > .5 && wet > .38 && temp > -.15 && temp < .3 && h < SEA + 9) bio = 'swamp';
    else if (temp > .34) bio = wet > .12 ? 'jungle' : wet < -.22 ? 'badlands' : wet < .02 ? 'desert' : 'savanna';
    else if (temp < -.38) bio = wet > .05 ? 'snowy_taiga' : 'snowy_plains';
    else if (temp < -.16) bio = wet > .2 ? 'old_growth_taiga' : 'taiga';
    else if (wet > .3) bio = wild > .2 ? 'dark_forest' : 'forest';
    else if (wet > .12) bio = wild > .35 ? 'cherry' : wild < -.3 ? 'birch' : 'forest';
    else if (wet > -.05) bio = wild > .25 ? 'flower_forest' : 'plains';
    else bio = temp > .18 ? 'savanna' : 'plains';
    return { h: Math.floor(h), bio, river };
  }
  biome(x, z) { if (this.dim == 'nether') { const b = this.N.n2(x / 180 + 40, z / 180); return b > .25 ? 'crimson_forest' : b < -.35 ? 'basalt_deltas' : b < -.15 ? 'warped_forest' : this.N.n2(x / 90 - 70, z / 90) > .3 ? 'soul_sand_valley' : 'nether_wastes'; } return this.height(x, z).bio; }
  generate(cx, cz, lite) { // lite = far away: only what can be seen from above (surface, cliffs, trees); the underground is filled in when you come close
    if (this.dim == 'nether') { const d = this.generateNether(cx, cz); const c = { cx, cz, d, dirty: true, meshes: null }; const ed = this.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k]; this.chunks.set(cx + ',' + cz, c); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.chunk(cx + a, cz + b); if (n) n.dirty = true; } return c; }
    const d = new Uint16Array(CV), I = this.ids, N = this.N, H = N.hash, x0 = cx * CS, z0 = cz * CS, X = n => BYNAME[n] || 0;
    // sample a padded 24x24 grid so trees and slopes continue seamlessly across chunk borders
    const P = 4, PW = CS + P * 2, ph = new Int16Array(PW * PW), pb = new Array(PW * PW);
    for (let a = 0; a < PW; a++) for (let b = 0; b < PW; b++) { const r = this.height(x0 + a - P, z0 + b - P); ph[a + b * PW] = r.h; pb[a + b * PW] = r.bio; }
    const HP = (lx, lz) => ph[(lx + P) + (lz + P) * PW], BP = (lx, lz) => pb[(lx + P) + (lz + P) * PW];
    const slopeAt = (lx, lz) => { const h = HP(lx, lz); return Math.max(Math.abs(HP(lx + 1, lz) - h), Math.abs(HP(lx - 1, lz) - h), Math.abs(HP(lx, lz + 1) - h), Math.abs(HP(lx, lz - 1) - h)); };
    const WATERY = /ocean|river/, SNOWY = /snowy|frozen/;
    // what the surface of a column is made of (shared by blocks and tree placement)
    const surface = (lx, lz) => {
      const wx = x0 + lx, wz = z0 + lz, h = HP(lx, lz), bio = BP(lx, lz), sl = slopeAt(lx, lz), n = N.n2(wx / 7, wz / 7), r = H(wx, 7, wz);
      const snowLine = 104 + n * 5;
      if (h < SEA) { if (bio == 'swamp') return [X('mud'), I.dirt]; if (/deep_ocean/.test(bio)) return [r < .5 ? I.gravel : I.sand, I.gravel]; if (/river/.test(bio)) return [n > .2 ? I.gravel : r < .08 ? I.clay : I.sand, I.sand]; return [n > .35 ? I.gravel : r < .04 ? I.clay : I.sand, I.sand]; }
      if (/mountains/.test(bio) || h > 92) {
        if (h > snowLine || (bio == 'snowy_mountains' && sl < 3)) return [sl > 3 ? (r < .5 ? I.packed_ice : I.stone) : I.snow_block, I.stone];
        if (sl >= 3) return [n > .45 ? I.andesite : n < -.5 ? I.calcite : r < .12 ? I.gravel : I.stone, I.stone];
        return [bio == 'snowy_mountains' ? I.snowy_grass_block : I.grass_block, I.dirt];
      }
      if (bio == 'desert') return [I.sand, I.sandstone];
      if (bio == 'badlands') return sl >= 2 ? [I.terracotta, I.terracotta] : [I.red_sand, I.terracotta];
      if (/beach/.test(bio)) return sl >= 3 ? [I.stone, I.stone] : [bio == 'snowy_beach' ? I.snow_block : I.sand, I.sand];
      if (sl >= 4) return [n > .3 ? I.andesite : I.stone, I.stone];
      if (sl == 3 && r < .4) return [I.dirt, I.dirt];
      if (bio == 'swamp') return [n > .45 ? X('mud') : I.grass_block, I.dirt];
      if (/snowy/.test(bio)) return [I.snowy_grass_block, I.dirt];
      if (bio == 'old_growth_taiga') return [n > .25 ? I.podzol : n < -.45 ? X('coarse_dirt') : I.grass_block, I.dirt];
      if (bio == 'taiga') return [n > .5 ? I.podzol : I.grass_block, I.dirt];
      if (bio == 'jungle') return [n > .45 ? I.podzol : I.grass_block, I.dirt];
      if (bio == 'savanna') return [n > .55 ? X('coarse_dirt') : I.grass_block, I.dirt];
      if (h <= SEA + 1 && sl <= 1 && N.n2(wx / 30, wz / 30) > .3) return [I.sand, I.sand];
      return [I.grass_block, I.dirt];
    };
    const hm = new Int16Array(256), bm = [];
    for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
      const wx = x0 + lx, wz = z0 + lz, h = HP(lx, lz), bio = BP(lx, lz); hm[lx + lz * 16] = h; bm[lx + lz * 16] = bio;
      const [top, sub] = surface(lx, lz), depth = 3 + Math.floor(H(wx, 3, wz) * 3) + (top == I.sand && bio == 'desert' ? 3 : 0);
      const hidden = lite ? Math.min(h, HP(lx + 1, lz), HP(lx - 1, lz), HP(lx, lz + 1), HP(lx, lz - 1)) - depth - 3 : -1; // below this nothing is visible from outside
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let v = 0;
        if (y <= h) {
          if (y == 0 || (y < 4 && H(wx, y, wz) < 0.5)) v = I.bedrock;
          else if (y < hidden) v = y < 8 ? I.deepslate : I.stone;
          else if (y < h - depth) {
            v = y < 8 ? I.deepslate : y < 14 ? (H(wx, y + 500, wz) < (14 - y) / 6 ? I.deepslate : I.stone) : I.stone;
            if (v == I.stone) { const s = N.n3(wx / 24, y / 16, wz / 24); if (s > 0.55) v = I.granite; else if (s < -0.55) v = I.diorite; else if (N.n3(wx / 20 + 50, y / 20, wz / 20) > 0.6) v = I.andesite; else if (y < 20 && N.n3(wx / 16, y / 16 + 30, wz / 16) > 0.6) v = I.tuff; else if (N.n3(wx / 10 - 80, y / 10, wz / 10 + 9) > .72) v = y < 50 ? I.gravel : I.dirt; }
            if (bio == 'badlands' && y > SEA - 4) { const band = ['terracotta', 'orange_terracotta', 'terracotta', 'yellow_terracotta', 'brown_terracotta', 'terracotta', 'red_terracotta', 'white_terracotta', 'orange_terracotta', 'light_gray_terracotta', 'terracotta', 'red_terracotta']; v = X(band[((y + Math.floor(N.n2(wx / 60, wz / 60) * 3)) % band.length + band.length) % band.length]) || I.terracotta; }
            else if (bio == 'desert' && y > h - depth - 4) v = I.sandstone;
            // ores in veins (clusters), with realistic depth ranges
            const vein = (s, sc, th) => N.n3(wx / sc + s, y / sc - s, wz / sc + s * 2) > th, dp = v == I.deepslate;
            if (v == I.stone || v == I.deepslate || v == I.granite || v == I.diorite || v == I.andesite || v == I.tuff) {
              if (y > 5 && y < 120 && vein(11, 3.2, .62) && H(wx, y, wz) < .75) v = dp ? I.deepslate_coal_ore : I.coal_ore;
              else if (y < 72 && vein(37, 2.6, .64) && H(wx, y, wz) < .7) v = dp ? I.deepslate_iron_ore : I.iron_ore;
              else if (y > 20 && y < 80 && vein(53, 3, .66)) v = dp ? I.deepslate_copper_ore : I.copper_ore;
              else if (y < 32 && vein(71, 2.2, .7)) v = dp ? I.deepslate_gold_ore : I.gold_ore;
              else if (y < 16 && vein(91, 2.2, .68)) v = dp ? I.deepslate_redstone_ore : I.redstone_ore;
              else if (y < 30 && y > 4 && vein(113, 2, .72)) v = dp ? I.deepslate_lapis_ore : I.lapis_ore;
              else if (y < 15 && vein(131, 1.8, .74)) v = dp ? I.deepslate_diamond_ore : I.diamond_ore;
              else if (/mountains/.test(bio) && y > 70 && H(wx, y + 77, wz) < .004) v = I.emerald_ore;
            }
          } else if (y < h) v = sub;
          else v = top;
          // caves: spaghetti tunnels + big cheese caverns, rarely breaking the surface (and never under water)
          if (!lite && v && v != I.bedrock && y > 4 && y < h - (h < SEA + 2 ? 6 : 1)) {
            const c1 = N.n3(wx / 42, y / 22, wz / 42), c2 = N.n3(wx / 42 + 77, y / 22 + 33, wz / 42 - 15);
            const cheese = N.n3(wx / 64, y / 28, wz / 64) + (y > 40 ? (y - 40) * .012 : 0);
            if (c1 * c1 + c2 * c2 < 0.0035 || cheese < -.58) v = y < 10 ? I.lava : 0;
          }
        } else if (y <= SEA) v = (SNOWY.test(bio) && y == SEA && H(wx, 1, wz) < .95) ? I.ice : I.water;
        d[lidx(lx, y, lz)] = v;
      }
      // dripstone & moss in some caves
    }
    const put = (x, y, z, v, rep) => { if (x < 0 || z < 0 || x > 15 || z > 15 || y < 1 || y >= WH) return; const i = lidx(x, y, z); if (rep || d[i] == 0 || (LEAF[d[i]] && !LEAF[v]) || SHAPE[d[i]] == 2) d[i] = v; };
    // ---- trees: origins over the padded area so canopies cross chunk borders ----
    const density = { forest: .035, flower_forest: .025, birch: .035, dark_forest: .09, taiga: .045, old_growth_taiga: .06, snowy_taiga: .03, jungle: .1, cherry: .03, plains: .0025, meadow: .002, savanna: .008, swamp: .02, mountains: .006, snowy_plains: .0015 };
    for (let a = -P + 1; a < CS + P - 1; a++) for (let b = -P + 1; b < CS + P - 1; b++) {
      const wx = x0 + a, wz = z0 + b, bio = BP(a, b), h = HP(a, b);
      let dn = density[bio] || 0; if (!dn || h < SEA || h > 100) continue;
      dn *= .35 + 1.3 * clamp(N.n2(wx / 48 + 5, wz / 48 - 3) + .5, 0, 1.2); // natural groves and clearings
      const r = H(wx, 999, wz); if (r >= dn) continue;
      const [top] = surface(a, b); if (top != I.grass_block && top != I.snowy_grass_block && top != I.podzol && top != X('coarse_dirt') && top != X('mud')) continue;
      if (slopeAt(a, b) > 2) continue;
      // keep trunks from touching: skip if a neighbour cell also spawns a tree
      if (H(wx + 1, 999, wz) < dn || H(wx, 999, wz + 1) < dn) continue;
      this.tree(put, a, h + 1, b, bio, H(wx, 5, wz), H(wx, 6, wz));
      if (a >= 0 && a < 16 && b >= 0 && b < 16 && top != X('mud')) d[lidx(a, h, b)] = I.dirt;
    }
    // ---- ground cover, flowers, boulders, water plants ----
    for (let lx = 0; lx < CS; lx++) for (let lz = 0; lz < CS; lz++) {
      const wx = x0 + lx, wz = z0 + lz, h = hm[lx + lz * 16], bio = bm[lx + lz * 16], top = d[lidx(lx, h, lz)], r = H(wx, 999, wz), above = h + 1 < WH ? d[lidx(lx, h + 1, lz)] : 0;
      if (above == I.water) {
        if ((top == I.sand || top == I.gravel || top == I.clay || top == X('mud')) && r < (bio == 'river' || bio == 'swamp' ? .3 : .16)) { if (SEA - h >= 3 && r < .05 && X('tall_seagrass')) { put(lx, h + 1, lz, X('tall_seagrass'), 1); } else put(lx, h + 1, lz, I.seagrass, 1); }
        if (r > .95 && h < SEA - 4 && !/river|frozen/.test(bio)) { const kh = Math.min(SEA - h - 1, 3 + Math.floor(H(wx, 4, wz) * 10)); for (let k = 1; k <= kh; k++) put(lx, h + k, lz, I.kelp_plant, 1); }
        continue;
      }
      if (above != 0) continue;
      const r2 = H(wx, 77, wz), patch = N.n2(wx / 11, wz / 11), fpatch = N.n2(wx / 6 + 40, wz / 6);
      // mossy boulders in taiga/forest, stone boulders in mountains
      if ((bio == 'old_growth_taiga' || bio == 'taiga' || bio == 'mountains') && r2 > .9985 && lx > 1 && lx < 14 && lz > 1 && lz < 14) { const rad = 1 + Math.floor(H(wx, 8, wz) * 2), bl = bio == 'mountains' ? I.cobblestone : I.mossy_cobblestone; for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) for (let c = -1; c <= rad; c++) if (a * a + b * b + c * c <= rad * rad + 1) put(lx + a, h + c, lz + b, H(wx + a, h + c, wz + b) < .3 ? I.cobblestone : bl, 1); continue; }
      if (top == I.grass_block || top == I.snowy_grass_block || top == I.podzol || top == X('coarse_dirt')) {
        if (bio == 'snowy_plains' || bio == 'snowy_taiga' || bio == 'snowy_mountains') { if (r2 < .03) put(lx, h + 1, lz, I.short_grass); else if (bio == 'snowy_taiga' && r2 < .05) put(lx, h + 1, lz, I.sweet_berry_bush); continue; }
        if (/taiga/.test(bio)) { if (r2 < .12 && patch > -.2) put(lx, h + 1, lz, I.fern); else if (r2 < .16 && X('large_fern')) { put(lx, h + 1, lz, X('large_fern')); put(lx, h + 2, lz, X('large_fern_top')); } else if (r2 < .2) put(lx, h + 1, lz, I.short_grass); else if (r2 < .208) put(lx, h + 1, lz, I.sweet_berry_bush); else if (r2 < .212) put(lx, h + 1, lz, r2 < .21 ? I.brown_mushroom : I.red_mushroom); continue; }
        // biome-specific ground cover: leaf litter under forests, petals in cherry groves, wildflowers in meadows, dry grass in savanna
        if (/forest|birch/.test(bio) && bio != 'flower_forest' && patch < -.3 && r2 < .45 + (-.3 - patch)) { put(lx, h + 1, lz, X('leaf_litter')); continue; }
        if (bio == 'cherry' && fpatch > -.1 && r2 < .4) { put(lx, h + 1, lz, X('pink_petals')); continue; }
        if ((bio == 'meadow' || bio == 'birch' || bio == 'flower_forest' || bio == 'plains') && fpatch < -.35 && r2 < (bio == 'plains' ? .12 : .35)) { put(lx, h + 1, lz, X('wildflowers')); continue; }
        if (bio == 'savanna' && r2 < .1 && patch > 0) { put(lx, h + 1, lz, X(r2 < .03 ? 'tall_dry_grass' : 'short_dry_grass')); continue; }
        if ((bio == 'plains' || bio == 'forest' || bio == 'birch' || bio == 'meadow') && r2 > .975 && r2 < .985) { put(lx, h + 1, lz, X('bush')); continue; }
        if (bio == 'swamp' && r2 > .97 && r2 < .98) { put(lx, h + 1, lz, X('firefly_bush')); continue; }
        const grassChance = { plains: .45, savanna: .4, meadow: .55, jungle: .4, swamp: .35, forest: .3, birch: .3, flower_forest: .25, dark_forest: .15, cherry: .3, mountains: .2 }[bio] ?? .25;
        const flowerChance = bio == 'flower_forest' || bio == 'meadow' ? .2 : bio == 'plains' ? .03 : bio == 'cherry' ? .05 : /forest|birch/.test(bio) ? .015 : .006;
        if (fpatch > .25 && r2 < flowerChance + (fpatch - .25) * .3) {
          // flowers grow in clumps of one kind
          const fl = bio == 'swamp' ? ['blue_orchid'] : bio == 'meadow' ? ['allium', 'azure_bluet', 'cornflower', 'oxeye_daisy', 'dandelion', 'poppy'] : bio == 'cherry' ? ['pink_tulip', 'allium', 'lily_of_the_valley'] : bio == 'savanna' ? ['dandelion', 'poppy'] : bio == 'plains' ? ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'orange_tulip', 'red_tulip', 'white_tulip', 'pink_tulip'] : ['dandelion', 'poppy', 'lily_of_the_valley', 'allium', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'orange_tulip', 'red_tulip', 'white_tulip', 'pink_tulip'];
          const big = { rose_bush: 1, peony: 1, lilac: 1, sunflower: 1 }; const pick = (bio == 'plains' && H(wx >> 4, 9, wz >> 4) < .25) ? 'sunflower' : (bio == 'forest' || bio == 'flower_forest') && H(wx >> 3, 10, wz >> 3) < .3 ? ['rose_bush', 'peony', 'lilac'][Math.floor(H(wx >> 3, 11, wz >> 3) * 3)] : fl[Math.floor(H(wx >> 3, 4, wz >> 3) * fl.length)];
          if (big[pick] && X(pick + '_top')) { put(lx, h + 1, lz, X(pick)); put(lx, h + 2, lz, X(pick + '_top')); } else put(lx, h + 1, lz, I[pick] || X(pick));
        } else if (r2 < grassChance * (.55 + patch * .6)) { const tall = r2 < grassChance * .12; if (tall) { put(lx, h + 1, lz, I.tall_grass); put(lx, h + 2, lz, X('tall_grass_top')); } else put(lx, h + 1, lz, bio == 'jungle' && r2 < grassChance * .3 ? I.fern : I.short_grass); }
        else if (bio == 'jungle' && r2 > .985 && X('bush')) put(lx, h + 1, lz, X('bush'));
        else if (r2 > .9993 && (bio == 'plains' || bio == 'forest')) put(lx, h + 1, lz, I.pumpkin);
        else if (r2 > .993 && /dark_forest|swamp|forest/.test(bio)) put(lx, h + 1, lz, r2 > .9965 ? I.brown_mushroom : I.red_mushroom);
        else if (r2 > .99 && bio == 'swamp' && X('firefly_bush')) put(lx, h + 1, lz, X('firefly_bush'));
        // sugar cane on river and lake shores
        if (r2 > .88 && h == SEA) { let wn = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (lx + a >= 0 && lx + a < 16 && lz + b >= 0 && lz + b < 16 && d[lidx(lx + a, h, lz + b)] == I.water) wn = true; if (wn) for (let k = 1; k <= 1 + Math.floor(r2 * 30) % 3; k++) put(lx, h + k, lz, I.sugar_cane, 1); }
      } else if (top == I.sand || top == I.red_sand) {
        if (bio == 'desert' || bio == 'badlands') { if (r < .004 && lx > 0 && lx < 15 && lz > 0 && lz < 15) { const hh = 1 + Math.floor(H(wx, 6, wz) * 3); for (let k = 1; k <= hh; k++) put(lx, h + k, lz, I.cactus); if (H(wx, 12, wz) < .3) put(lx, h + hh + 1, lz, X('cactus_flower')); } else if (r < .012) put(lx, h + 1, lz, I.dead_bush); else if (r < .03) put(lx, h + 1, lz, X('short_dry_grass')); else if (r < .036) put(lx, h + 1, lz, X('tall_dry_grass')); }
        else if (h == SEA && r > .97) { let wn = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (lx + a >= 0 && lx + a < 16 && lz + b >= 0 && lz + b < 16 && d[lidx(lx + a, h, lz + b)] == I.water) wn = true; if (wn) for (let k = 1; k <= 2; k++) put(lx, h + k, lz, I.sugar_cane, 1); }
      }
    }
    const c = { cx, cz, d, dirty: true, meshes: null, hm, lite: !!lite };
    const ed = this.edits[cx + ',' + cz]; if (ed) for (const k in ed) d[+k] = ed[k];
    this.chunks.set(cx + ',' + cz, c);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.chunk(cx + a, cz + b); if (n) n.dirty = true; }
    return c;
  }
  tree(put, x, y, z, bio, r, r2 = .5) {
    const I = this.ids, X = n => BYNAME[n] || 0;
    const blob = (cx, cy, cz, rx, ry, L, ragged = .35) => { for (let a = -rx; a <= rx; a++) for (let b = -ry; b <= ry; b++) for (let c = -rx; c <= rx; c++) { const dd = a * a / (rx * rx + .5) + b * b / (ry * ry + .5) + c * c / (rx * rx + .5); if (dd <= 1 && !(dd > .6 && this.N.hash(x * 31 + a + cx, y + b + cy, z * 17 + c + cz) < ragged)) put(cx + a, cy + b, cz + c, L); } };
    const spruce = (mega) => {
      const h = mega ? 14 + Math.floor(r * 9) : 7 + Math.floor(r * 6), L = I.spruce_leaves, w = mega ? 2 : 1;
      for (let k = 0; k < h - 1; k++) for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(x + a, y + k, z + b, I.spruce_log, 1);
      const start = mega ? Math.floor(h * .45) : 2 + Math.floor(r2 * 2), maxR = mega ? 4 : 2 + (h > 10 ? 1 : 0);
      for (let k = start; k <= h; k++) {
        const t = (h - k) / (h - start), layer = (h - k) % 2 == 0, rad = k >= h - 1 ? (mega ? 1 : 0) : Math.max(1, Math.round(t * maxR) + (layer ? 0 : -1));
        for (let a = -rad; a <= rad + w - 1; a++) for (let b = -rad; b <= rad + w - 1; b++) { const da = a < 0 ? -a : a > w - 1 ? a - w + 1 : 0, db = b < 0 ? -b : b > w - 1 ? b - w + 1 : 0; if (da + db <= rad + (rad > 1 ? 1 : 0) && !(da == rad && db == rad && rad > 0)) put(x + a, y + k, z + b, L); }
      }
      put(x, y + h, z, L); put(x, y + h + 1, z, L);
      if (mega) for (const [a, b] of [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [2, 1], [1, -1], [1, 2]]) put(x + a, y - 1, z + b, X('podzol') || I.podzol, 1);
    };
    if (bio == 'old_growth_taiga') return spruce(r < .45);
    if (/taiga/.test(bio) || bio == 'mountains' || bio == 'snowy_plains') return spruce(false);
    if (bio == 'dark_forest' && r < .75) { // 2x2 dark oak with a wide, low canopy
      const h = 6 + Math.floor(r2 * 3), L = I.dark_oak_leaves || X('dark_oak_leaves'), W = X('dark_oak_log');
      for (let k = 0; k < h; k++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x + a, y + k, z + b, W, 1);
      blob(x, y + h - 1, z, 4, 2, L, .25); blob(x + 1, y + h, z + 1, 3, 1, L, .2); return;
    }
    if (bio == 'swamp') { const h = 5 + Math.floor(r * 3); blob(x, y + h - 1, z, 3, 1, I.oak_leaves, .3); for (let k = 0; k < h; k++) put(x, y + k, z, I.oak_log, 1); return; }
    if (bio == 'savanna') { // acacia: leaning trunk with flat canopies
      const h = 5 + Math.floor(r * 3), dx = r2 < .5 ? 1 : -1, dz = r2 < .25 || r2 > .75 ? 1 : -1; let px = x, pz = z;
      for (let k = 0; k < h; k++) { if (k > 2 && k % 2) { px += dx; if (k == h - 1) pz += dz; } put(px, y + k, pz, I.acacia_log, 1); }
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Math.abs(a) + Math.abs(b) <= 4) put(px + a, y + h, pz + b, I.acacia_leaves); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(px + a, y + h + 1, pz + b, I.acacia_leaves);
      if (r > .5) { put(x - dx, y + 3, z, I.acacia_log, 1); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) <= 3) put(x - dx * 2 + a, y + 4, z + b, I.acacia_leaves); }
      return;
    }
    if (bio == 'jungle') { // tall jungle trees, sometimes giant
      const giant = r < .2, h = giant ? 18 + Math.floor(r2 * 10) : 7 + Math.floor(r2 * 6), w = giant ? 2 : 1, L = I.jungle_leaves;
      for (let k = 0; k < h; k++) for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(x + a, y + k, z + b, I.jungle_log, 1);
      blob(x, y + h, z, giant ? 5 : 3, 2, L, .3);
      if (giant) for (let k = Math.floor(h * .5); k < h - 3; k += 4) { const ang = this.N.hash(x, k, z) * 6.28, bx = x + Math.round(Math.cos(ang) * 3), bz = z + Math.round(Math.sin(ang) * 3); put(bx, y + k, bz, I.jungle_log, 1); blob(bx, y + k + 1, bz, 2, 1, L, .3); }
      return;
    }
    const kind = bio == 'birch' || ((bio == 'forest' || bio == 'flower_forest') && r < .3) ? 'birch' : bio == 'cherry' ? 'cherry' : 'oak';
    const L = I[kind + '_leaves'], W = I[kind + '_log'];
    if (kind == 'birch') { const h = 5 + Math.floor(r2 * 4) + (r < .1 ? 4 : 0); for (let k = 0; k < h; k++) put(x, y + k, z, W, 1); blob(x, y + h - 1, z, 2, 2, L, .35); put(x, y + h + 1, z, L); return; }
    if (kind == 'cherry') { const h = 5 + Math.floor(r * 3); for (let k = 0; k < h; k++) put(x, y + k, z, W, 1); for (const s of [-1, 1]) { put(x + s, y + h - 1, z, W, 1); put(x + s * 2, y + h, z, W, 1); blob(x + s * 2, y + h + 1, z, 3, 1, L, .3); } return; }
    // oak: small, normal, or a big branched oak
    if (r2 > .88) {
      const h = 9 + Math.floor(r * 5); for (let k = 0; k < h; k++) put(x, y + k, z, W, 1);
      for (let i = 0; i < 4; i++) { const ang = (i + r) * 1.57, len = 2 + Math.floor(this.N.hash(x, i, z) * 2), by = y + h - 4 + i % 2 * 2; let bx = x, bz = z; for (let s = 1; s <= len; s++) { bx = x + Math.round(Math.cos(ang) * s); bz = z + Math.round(Math.sin(ang) * s); put(bx, by + (s >> 1), bz, W, 1); } blob(bx, by + (len >> 1) + 1, bz, 2, 2, L, .3); }
      blob(x, y + h, z, 3, 2, L, .3); return;
    }
    const h = 4 + Math.floor(r * 3);
    for (let k = -3; k <= 0; k++) { const rad = k >= -1 ? 1 : 2; for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) { if (Math.abs(a) == rad && Math.abs(b) == rad && (k == 0 || this.N.hash(x * 7 + a, k, z * 5 + b) < .5)) continue; put(x + a, y + h + k, z + b, L); } }
    put(x, y + h + 1, z, L); put(x + 1, y + h + 1, z, L); put(x - 1, y + h + 1, z, L); put(x, y + h + 1, z + 1, L); put(x, y + h + 1, z - 1, L);
    for (let k = 0; k < h; k++) put(x, y + k, z, W, 1);
  }
  // ---- lighting (per chunk, sky+block 0..15, sampled at neighbours) ----
  light(c) {
    const L = new Uint8Array(CV), d = c.d, q = [];
    const sky = this.dim != 'nether';
    for (let x = 0; x < 16 && sky; x++) for (let z = 0; z < 16; z++) {
      // sunlight falls straight down; each leaf block it passes through dims it by one (shade under trees), water by one too
      let s = 15; for (let y = WH - 1; y >= 0; y--) { const b = d[lidx(x, y, z)]; if (OPAQUE[b]) break; if (LEAF[b] || FLUID[b] == 1) s = Math.max(0, s - 1); L[lidx(x, y, z)] = s << 4; }
    }
    // seed the spread from every lit cell that borders a darker one (overhangs, under branches, cave mouths, tree shade)
    for (let i = 0; i < CV && sky; i++) {
      const s = L[i] >> 4; if (s < 2) continue; const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      if ((x < 15 && (L[i + 1] >> 4) < s - 1 && !OPAQUE[d[i + 1]]) || (x > 0 && (L[i - 1] >> 4) < s - 1 && !OPAQUE[d[i - 1]]) || (z < 15 && (L[i + 16] >> 4) < s - 1 && !OPAQUE[d[i + 16]]) || (z > 0 && (L[i - 16] >> 4) < s - 1 && !OPAQUE[d[i - 16]]) || (y > 0 && (L[i - 256] >> 4) < s - 1 && !OPAQUE[d[i - 256]])) q.push(i);
    }
    const spread = (shift, queue) => {
      while (queue.length) {
        const i = queue.pop(), lv = (L[i] >> shift) & 15; if (lv <= 1) continue;
        const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
        const nb = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
        for (const [a, b2, e] of nb) {
          if (a < 0 || a > 15 || e < 0 || e > 15 || b2 < 0 || b2 >= WH) continue;
          const j = lidx(a, b2, e), bb = d[j]; if (OPAQUE[bb]) continue;
          const dec = (SHAPE[bb] == 3 || LEAF[bb]) ? 2 : 1;
          const cur = (L[j] >> shift) & 15; if (cur < lv - dec) { L[j] = (L[j] & (shift ? 15 : 240)) | ((lv - dec) << shift); queue.push(j); }
        }
      }
    };
    // import light from neighbouring chunk edges so overhangs/caves near borders aren't black
    const nb4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [ox, oz] of nb4) { const n = this.chunk(c.cx + ox, c.cz + oz); if (!n || !n.L) continue;
      for (let y = 0; y < WH; y++) for (let k = 0; k < 16; k++) { const x = ox == -1 ? 0 : ox == 1 ? 15 : k, z = oz == -1 ? 0 : oz == 1 ? 15 : k, i = lidx(x, y, z); if (OPAQUE[d[i]]) continue;
        const nl = n.L[lidx(ox == -1 ? 15 : ox == 1 ? 0 : x, y, oz == -1 ? 15 : oz == 1 ? 0 : z)]; const s = (nl >> 4) - 1, bl = (nl & 15) - 1;
        if (s > (L[i] >> 4)) { L[i] = (L[i] & 15) | (s << 4); q.push(i); } if (bl > (L[i] & 15)) { L[i] = (L[i] & 240) | bl; this._bq = this._bq || []; this._bq.push(i); } } }
    spread(4, q);
    const bq = this._bq || []; this._bq = null; for (let i = 0; i < CV; i++) if (EMIT[d[i]]) { L[i] = (L[i] & 240) | (BL[d[i]].n == 'redstone_wire' ? 0 : 14); if (BL[d[i]].n != 'redstone_wire') bq.push(i); }
    spread(0, bq);
    c.L = L;
  }
  // ---- meshing ----
  mesh(c) {
    if (!c.L || c.lightDirty || !c.meshes) { this.light(c); c.lightDirty = false; }
    c.dirty = false;
    const out = [[], [], [], []]; // solid, translucent, water, lava
    const d = c.d, L = c.L, x0 = c.cx * 16, z0 = c.cz * 16;
    const nbs = [this.chunk(c.cx - 1, c.cz), this.chunk(c.cx + 1, c.cz), this.chunk(c.cx, c.cz - 1), this.chunk(c.cx, c.cz + 1)];
    for (const n of nbs) if (n && (!n.L || n.lightDirty)) { this.light(n); n.lightDirty = false; }
    const getB = (x, y, z) => {
      if (y < 0) return 1; if (y >= WH) return 0;
      if (x >= 0 && x < 16 && z >= 0 && z < 16) return d[lidx(x, y, z)];
      const n = x < 0 ? nbs[0] : x > 15 ? nbs[1] : z < 0 ? nbs[2] : nbs[3];
      if (!n || (x < 0 || x > 15) && (z < 0 || z > 15)) return this.getOr(x0 + x, y, z0 + z, 1);
      return n.d[lidx(x & 15, y, z & 15)];
    };
    const getL = (x, y, z) => {
      if (y >= WH) return 240; if (y < 0) return 0;
      if (x >= 0 && x < 16 && z >= 0 && z < 16) return L[lidx(x, y, z)];
      const n = x < 0 ? nbs[0] : x > 15 ? nbs[1] : z < 0 ? nbs[2] : z > 15 ? nbs[3] : null;
      if (n && n.L && !((x < 0 || x > 15) && (z < 0 || z > 15))) return n.L[lidx(x & 15, y, z & 15)];
      return L[lidx(clamp(x, 0, 15), y, clamp(z, 0, 15))];
    };
    const lv = v => Math.pow(0.86, 15 - v);
    const FACES = [
      { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], f: 2, s: .6 }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], f: 2, s: .6 },
      { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], f: 0, s: 1 }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], f: 1, s: .5 },
      { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], f: 3, s: .8 }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], f: 2, s: .8 }];
    const aoT = [0.45, 0.65, 0.82, 1];
    for (let y = 0; y < WH; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let b = d[lidx(x, y, z)]; if (!b) continue; let sh = SHAPE[b]; const wx = x0 + x, wz = z0 + z;
      if (sh == 2) { // cross
        const l = getL(x, y, z), uv = tileUV(TEX[b * 4]), ll = [1, lv(l >> 4), EMIT[b] ? 1 : lv(l & 15)];
        const o = out[0], j = (this.N.hash(wx, y, wz) - .5) * .3;
        const U = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]];
        pushQuad(o, [[wx + .15 + j, y, wz + .15], [wx + .85 + j, y, wz + .85], [wx + .85 + j, y + 1, wz + .85], [wx + .15 + j, y + 1, wz + .15]], U, ll);
        pushQuad(o, [[wx + .85 + j, y, wz + .15], [wx + .15 + j, y, wz + .85], [wx + .15 + j, y + 1, wz + .85], [wx + .85 + j, y + 1, wz + .15]], U, ll);
        if (!WLOG[b]) continue; b = WATER_ID; sh = 3;
      }
      if (sh == 6 || sh == 7) {
        const l = getL(x, y, z), uv = tileUV(TEX[b * 4]), pw = sh == 6 && BL[b].n == 'redstone_wire' ? (this.power[(wx) + ',' + y + ',' + (wz)] || 0) : 15;
        const ll = [sh == 6 ? .45 + .55 * pw / 15 : 1, lv(l >> 4), EMIT[b] && sh == 7 ? 1 : sh == 6 && BL[b].n == 'redstone_wire' ? Math.max(lv(l & 15), .3 + pw / 20) : lv(l & 15)];
        if (sh == 6) {
          const F = (t, yy, rot) => { const u = tileUV(t), U = [[u[0], u[3]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]]]; pushQuad(out[0], [[wx, y + yy, wz + 1], [wx + 1, y + yy, wz + 1], [wx + 1, y + yy, wz], [wx, y + yy, wz]], rot ? [U[1], U[2], U[3], U[0]] : U, ll); };
          if (BL[b].n != 'redstone_wire') { F(TEX[b * 4], .02); continue; }
          const isW = (X, Y, Z) => { const n = getB(X, Y, Z); return BL[n] && /redstone_wire|redstone_torch|lever|button|pressure_plate|redstone_block|repeater|redstone_lamp|piston|note_block|tnt/.test(BL[n].n); };
          const ew = isW(x + 1, y, z) || isW(x - 1, y, z) || isW(x + 1, y - 1, z) || isW(x - 1, y - 1, z) || isW(x + 1, y + 1, z) || isW(x - 1, y + 1, z);
          const ns = isW(x, y, z + 1) || isW(x, y, z - 1) || isW(x, y - 1, z + 1) || isW(x, y - 1, z - 1) || isW(x, y + 1, z + 1) || isW(x, y + 1, z - 1);
          const L0 = REG.tiles.redstone_line0_red, L1 = REG.tiles.redstone_line1_red, DOT = TEX[b * 4];
          if (!ew && !ns) { F(DOT, .015); }
          else { if (ew) F(L0, .02, 1); if (ns) F(L0, .025); if (ew && ns) F(DOT, .015); }
          continue;
        }
        if (BL[b].mm) { // full Minecraft model with block rotation (pistons)
          const st = this.state[wx + ',' + y + ',' + wz] || {}; let f = st.f;
          if (!f && /piston_head/.test(BL[b].n)) for (const d of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { const ps = this.state[(wx - d[0]) + ',' + (y - d[1]) + ',' + (wz - d[2])]; if (ps && ps.f && ps.f[0] == d[0] && ps.f[1] == d[1] && ps.f[2] == d[2]) { f = d; break; } }
          emitMM(out[0], st.ext && BL[b].mmx ? BL[b].mmx : st.open && BL[b].mmo ? BL[b].mmo : BL[b].mm, wx, y, wz, f || [0, 1, 0], ll, /piston/.test(BL[b].n) ? null : st.fr || BL[b].mr || null);
          continue;
        }
        if (BL[b].mp) { emitMP(out[0], b, mpConn(b, getB, wx - x0, y, wz - z0), wx, y, wz, ll); continue; }
        for (const [BB, TT, FF] of (BL[b].bx || [[BL[b].bb, TEX[b * 4]]])) {
        const uv = tileUV(TT), uvS = BL[b].sidev ? tileUV(TEX[b * 4 + 2]) : uv;
        const bb = BB.map(v => v / 16), X0 = wx + bb[0], Y0 = y + bb[1], Z0 = wz + bb[2], X1 = wx + bb[3], Y1 = y + bb[4], Z1 = wz + bb[5];
        let fi = 0; // with a vanilla model (FF), each face has its own texture/uv, and missing faces are skipped
        const Q = (C, u0, v0, u1, v1, s) => { let U = s == 1 || s == .5 ? uv : uvS; if (FF) { const fc = FF[fi++]; if (!fc) return; U = tileUV(fc[0]); if (fc.length == 5) { u0 = fc[1]; v0 = fc[2]; u1 = fc[3]; v1 = fc[4]; } } const f = (a, b2) => [lerp(U[0], U[2], a), lerp(U[1], U[3], b2)]; pushQuad(out[0], C, [f(u0, v1), f(u1, v1), f(u1, v0), f(u0, v0)], [s, ll[1], ll[2]]); };
        Q([[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], bb[0], bb[2], bb[3], bb[5], 1); Q([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], bb[0], bb[2], bb[3], bb[5], .5);
        Q([[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], bb[0], 1 - bb[4], bb[3], 1 - bb[1], .8); Q([[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], bb[0], 1 - bb[4], bb[3], 1 - bb[1], .8);
        Q([[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], bb[2], 1 - bb[4], bb[5], 1 - bb[1], .6); Q([[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], bb[2], 1 - bb[4], bb[5], 1 - bb[1], .6);
        }
        continue;
      }
      let above = getB(x, y + 1, z); if (WLOG[above]) above = WATER_ID;
      for (const F of FACES) {
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2]; let nb = getB(nx, ny, nz); if (WLOG[nb]) nb = WATER_ID;
        if (sh == 3) { if (FLUID[nb] == 1 || OPAQUE[nb] || (F.n[1] == -1 && nb)) continue; if (F.n[1] == 1 && SOLID[nb]) continue; }
        else if (sh == 4) { if (FLUID[nb] == 2 || OPAQUE[nb]) continue; }
        else if (sh == 5) { if (F.n[1] && OPAQUE[nb]) continue; }
        else { if (OPAQUE[nb]) continue; if (nb == b && !LEAF[b]) continue; if (ALPHA[b] == 0 && SHAPE[nb] == 3 && false) continue; }
        const tex = sh >= 3 && sh <= 4 ? 0 : TEX[b * 4 + F.f];
        const uv = sh == 3 || sh == 4 ? [0, 0, 1, 1] : tileUV(tex);
        const lc = getL(nx, ny, nz);
        const C = [], U = [], LL = [];
        const ax = F.n[0] ? 0 : F.n[1] ? 1 : 2, ua = ax == 0 ? 2 : 0, va = ax == 1 ? 2 : 1;
        for (let k = 0; k < 4; k++) {
          const cc = F.c[k]; let px = wx + cc[0], py = y + cc[1], pz = wz + cc[2];
          if ((sh == 3 || sh == 4) && cc[1] == 1 && FLUID[above] != FLUID[b]) { const L = FLVL[b]; py -= (L == 0 || L == 8) ? 0.12 : 1 - (8 - L) / 9; }
          if (sh == 5 && F.n[1] == 0) { if (F.n[0]) px -= F.n[0] * 0.0625; else pz -= F.n[2] * 0.0625; }
          C.push([px, py, pz]);
          // uv: sides vertical
          const uu = F.n[1] ? cc[0] : (F.n[0] ? (F.n[0] > 0 ? 1 - cc[2] : cc[2]) : (F.n[2] > 0 ? cc[0] : 1 - cc[0]));
          const vv = F.n[1] ? cc[2] : 1 - cc[1];
          U.push([lerp(uv[0], uv[2], uu), lerp(uv[1], uv[3], vv)]);
          let ao = 3;
          if (sh == 1 && ALPHA[b] != 2) {
            const su = cc[ua] ? 1 : -1, sv = cc[va] ? 1 : -1; const p = [nx, ny, nz];
            const a1 = p.slice(), a2 = p.slice(), a3 = p.slice(); a1[ua] += su; a2[va] += sv; a3[ua] += su; a3[va] += sv;
            const s1 = OPAQUE[getB(a1[0], a1[1], a1[2])], s2 = OPAQUE[getB(a2[0], a2[1], a2[2])], s3 = OPAQUE[getB(a3[0], a3[1], a3[2])];
            ao = s1 && s2 ? 0 : 3 - s1 - s2 - s3;
          }
          LL.push([F.s * aoT[ao], lv(lc >> 4), EMIT[b] ? 1 : lv(lc & 15)]);
        }
        pushQuad(out[sh == 3 ? 2 : sh == 4 ? 3 : ALPHA[b] == 2 ? 1 : 0], C, U, LL);
      }
    }
    if (!c.meshes) c.meshes = [null, null, null, null];
    for (let i = 0; i < 4; i++) {
      if (out[i].length) c.meshes[i] = mkMesh(new Float32Array(out[i]), c.meshes[i]);
      else if (c.meshes[i]) { freeMesh(c.meshes[i]); c.meshes[i] = null; }
    }
  }
  // a far (lite) chunk came close: generate its underground, keep the old mesh on screen until the new one is ready
  upgrade(c) { const n = this.generate(c.cx, c.cz, false); n.meshes = c.meshes; n.lite = false; return n; }
  unload(c) { if (c.meshes) c.meshes.forEach(freeMesh); this.chunks.delete(c.cx + ',' + c.cz); }
  raycast(ox, oy, oz, dx, dy, dz, max) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (sx > 0 ? x + 1 - ox : ox - x) * tdx, ty = (sy > 0 ? y + 1 - oy : oy - y) * tdy, tz = (sz > 0 ? z + 1 - oz : oz - z) * tdz, n = [0, 0, 0], t = 0;
    while (t <= max) {
      const b = this.get(x, y, z); if (b && SHAPE[b] != 3) return { x, y, z, n, b, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; } else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; } else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
  collides(px, py, pz, r, h) {
    for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++) for (let y = Math.floor(py); y <= Math.floor(py + h - 0.001); y++) for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++)
      { const b = this.getOr(x, y, z, 1); if (SOLID[b]) return true; if (SBOX[b]) { let bb = BL[b].bb; if (BL[b].mmo || BL[b].fy) { const st = this.state[x + ',' + y + ',' + z]; if (st && st.open) continue; if (st && (st.fd == 'east' || st.fd == 'west')) bb = [bb[2], bb[1], bb[0], bb[5], bb[4], bb[3]]; } if (px + r > x + bb[0] / 16 && px - r < x + bb[3] / 16 && py + h > y + bb[1] / 16 && py < y + bb[4] / 16 && pz + r > z + bb[2] / 16 && pz - r < z + bb[5] / 16) return true; } }
    return false;
  }
  topY(x, z) { for (let y = WH - 1; y > 0; y--) { const b = this.get(x, y, z); if (SOLID[b] || SHAPE[b] == 3) return y; } return 0; }
}

// physics body move with AABB collision; returns {ground, hitH}
function moveBody(w, e, dt) {
  const r = e.r, h = e.h; let ground = false, hitH = false;
  const tryAx = (ax, d) => {
    if (!d) return false; const steps = Math.ceil(Math.abs(d) / 0.4), s = d / steps;
    for (let i = 0; i < steps; i++) {
      const o = { x: e.x, y: e.y, z: e.z }; o[ax] += s;
      if (w.collides(o.x, o.y, o.z, r, h)) {
        if (ax == 'y') { if (s < 0) e.y = Math.floor(e.y + s) + 1; } return true;
      }
      e[ax] = o[ax];
    }
    return false;
  };
  if (tryAx('y', e.vy * dt)) { if (e.vy < 0) ground = true; e.vy = 0; }
  if (tryAx('x', e.vx * dt)) { hitH = true; if (e.sneak) { } }
  if (tryAx('z', e.vz * dt)) hitH = true;
  return { ground, hitH };
}
// ---- Minecraft-style model baking: element faces with uv + rotation, then block rotation from a facing vector ----
const MMF = { // corners TL,TR,BR,BL for each face of box (x0,y0,z0)-(x1,y1,z1)
  north: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]],
  south: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]],
  west: (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], b[2]], [a[0], a[1], a[2]]],
  east: (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]]],
  up: (a, b) => [[a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]],
  down: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], a[1], a[2]], [a[0], a[1], a[2]]],
};
const MMN = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
// facing vector -> blockstate rotation (models face north by default)
function facingRot(f) { return f[1] == 1 ? [270, 0] : f[1] == -1 ? [90, 0] : f[2] == 1 ? [0, 180] : f[0] == 1 ? [0, 90] : f[0] == -1 ? [0, 270] : [0, 0]; }
function rotPt(p, rx, ry) { // around block centre (8,8,8); x first, then y (Minecraft order)
  let [x, y, z] = [p[0] - 8, p[1] - 8, p[2] - 8];
  for (let k = 0; k < rx / 90; k++) [y, z] = [z, -y];
  for (let k = 0; k < ry / 90; k++) [x, z] = [-z, x];
  return [x + 8, y + 8, z + 8];
}
// rotate a model element point around its own pivot (element "rotation": origin, axis, angle, rescale)
function elemRot(p, r) {
  if (!r) return p; const [ox, oy, oz, ax, ang, resc] = r, a = ang * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), k = resc ? 1 / c : 1;
  let x = p[0] - ox, y = p[1] - oy, z = p[2] - oz;
  if (ax == 'y') { [x, z] = [x * c + z * sn, -x * sn + z * c]; x *= k; z *= k; }
  else if (ax == 'x') { [y, z] = [y * c - z * sn, y * sn + z * c]; y *= k; z *= k; }
  else { [x, y] = [x * c - y * sn, x * sn + y * c]; x *= k; y *= k; }
  return [x + ox, y + oy, z + oz];
}
function emitMM(out, els, wx, y, wz, facing, ll, rot) {
  const [rx, ry] = rot || facingRot(facing);
  for (const e of els) for (const d in e.faces) {
    const [t, u0, v0, u1, v1, r] = e.faces[d], T = tileUV(t), C = MMF[d](e.f, e.t).map(p => rotPt(elemRot(p, e.r), rx, ry));
    let nv = MMN[d].map(v => v * 8 + 8); if (e.r) nv = elemRot(nv.map((v, i) => v - 8 + [e.r[0], e.r[1], e.r[2]][i]), e.r).map((v, i) => v + 8 - [e.r[0], e.r[1], e.r[2]][i]);
    const n = rotPt(nv, rx, ry).map(v => Math.round((v - 8) / 8)), s = n[1] > 0 ? 1 : n[1] < 0 ? .5 : n[2] ? .8 : .6;
    let uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; for (let k = 0; k < (r || 0) / 90; k++) uv = [uv[3], uv[0], uv[1], uv[2]];
    const U = uv.map(([u, v]) => [lerp(T[0], T[2], u / 16), lerp(T[1], T[3], v / 16)]);
    // pushQuad wants counter-clockwise corners; MC order TL,TR,BR,BL is clockwise seen from outside -> reverse
    pushQuad(out, [C[3], C[2], C[1], C[0]].map(p => [wx + p[0] / 16, y + p[1] / 16, wz + p[2] / 16]), [U[3], U[2], U[1], U[0]], [s, ll[1], ll[2]]);
  }
}
// ---- multipart blocks (fences, walls, panes, bars, vines): which parts show depends on the neighbours ----
const MP_DIRS = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const MP_DEF = { facing: 'north', has_bottle_0: 'false', has_bottle_1: 'false', has_bottle_2: 'false', age: '0', leaves: 'none', side_chain: 'unconnected', powered: 'false', slot_0_occupied: 'false', slot_1_occupied: 'false', slot_2_occupied: 'false' };
function mpConn(b, getB, x, y, z) {
  const k = BL[b].mpk, c = {};
  for (const d in MP_DIRS) {
    const [dx, dy, dz] = MP_DIRS[d], nb = getB(x + dx, y + dy, z + dz), nn = BL[nb] ? BL[nb].n : '';
    if (k == 'attach') { c[d] = !!(OPAQUE[nb] || (d == 'up' && LEAF[nb])); continue; }
    if (dy) { c[d] = false; continue; }
    const solid = OPAQUE[nb] && !LEAF[nb];
    if (k == 'fence') c[d] = solid || (BL[nb] && (BL[nb].mpk == 'fence' && /nether_brick/.test(nn) == /nether_brick/.test(BL[b].n)) || /fence_gate$/.test(nn));
    else if (k == 'wall') c[d] = solid || (BL[nb] && BL[nb].mpk == 'wall') || /fence_gate$/.test(nn);
    else if (k == 'pane') c[d] = solid || (BL[nb] && BL[nb].mpk == 'pane') || /glass$/.test(nn);
    else c[d] = false;
  }
  if (k == 'wall') { const ns = c.north && c.south && !c.east && !c.west, ew = c.east && c.west && !c.north && !c.south, tall = !!OPAQUE[getB(x, y + 1, z)]; c.up = !(ns || ew); for (const d of ['north', 'south', 'east', 'west']) c[d] = c[d] ? (tall ? 'tall' : 'low') : 'none'; }
  if (k == 'attach' && !c.north && !c.south && !c.east && !c.west && !c.up) c.down = true;
  return c;
}
function mpMatch(w, c) {
  if (!w) return true;
  if (w.OR) return w.OR.some(q => mpMatch(q, c));
  if (w.AND) return w.AND.every(q => mpMatch(q, c));
  for (const key in w) {
    const want = String(w[key]).split('|'); let have = key in c ? c[key] : MP_DEF[key];
    if (have === undefined) have = 'false'; if (have === true) have = 'true'; if (have === false) have = 'false';
    if (!want.includes(String(have))) return false;
  }
  return true;
}
function emitMP(out, b, c, wx, y, wz, ll) { for (const p of BL[b].mp) if (mpMatch(p.w, c)) emitMM(out, p.m, wx, y, wz, null, ll, [p.rx || 0, p.ry || 0]); }
