'use strict';
// Sound system: reads a Minecraft-format sound resource pack (.zip) chosen by the player, entirely in the browser.
const SND = {
  ctx: null, idx: null, buf: null, cache: new Map(), loading: new Map(), vol: { master: 1, music: .5, blocks: 1, mobs: 1, ambient: .7, ui: 1 },
  music: null, musicTimer: 30, rain: null, packName: '',
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ctx && this.ctx.state == 'suspended') this.ctx.resume(); return this.ctx; },
  async loadZip(blob, name) {
    const ab = await blob.arrayBuffer(), dv = new DataView(ab); let e = ab.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) != 0x06054b50) e--;
    if (e < 0) throw new Error('Not a zip file');
    let n = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true); const idx = new Map(), dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(off, true) != 0x02014b50) break;
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
      const fname = dec.decode(new Uint8Array(ab, off + 46, nl));
      const m = fname.match(/assets\/minecraft\/sounds\/(.+)\.ogg$/);
      if (m) idx.set(m[1], { method, csize, lo });
      off += 46 + nl + xl + cl;
    }
    if (!idx.size) throw new Error('No Minecraft sounds found in this zip');
    this.idx = idx; this.buf = ab; this.dv = dv; this.cache.clear(); this.packName = name || 'Sound pack'; this.variantCache = new Map();
    return idx.size;
  },
  addEmbedded(map) { if (!this.idx || !this.embedded) this.loadEmbedded({}); for (const k in map) this.idx.set(k, { b64: map[k] }); this.variantCache = new Map(); },
  loadEmbedded(map) {
    const idx = new Map(); for (const k in map) idx.set(k, { b64: map[k] });
    this.idx = idx; this.cache.clear(); this.variantCache = new Map(); this.packName = 'Built-in sounds'; this.embedded = true; return idx.size;
  },
  resolve(path) { // a mob sound name that is not in the pack: find the real file (mob/x/... vs entity/x/..., idle vs ambient, hit vs hurt)
    this.resCache = this.resCache || new Map(); if (this.resCache.has(path)) return this.resCache.get(path);
    const m = /^(?:mob|entity)\/([a-z_]+)\/(?:[a-z_]+\/)?([a-z_]+?)\d*$/.exec(path); let out = null;
    if (m && this.idx) { const nm = m[1], kind = m[2], syn = /ambient|idle|say|living|loop/.test(kind) ? ['ambient', 'idle', 'say', 'living', 'loop'] : /hurt|hit/.test(kind) ? ['hurt', 'hit'] : /death|die/.test(kind) ? ['death', 'die'] : /step/.test(kind) ? ['step', 'walk'] : [kind];
      const names = [nm, nm.replace(/_/g, ''), nm.replace(/_/g, '-')], keys = [...this.idx.keys()];
      for (const n2 of names) { for (const sy of syn) { const k = keys.find(k => (k.startsWith('mob/' + n2 + '/') || k.startsWith('entity/' + n2 + '/')) && k.slice(k.lastIndexOf('/') + 1).replace(/\d+$/, '') == sy) || keys.find(k => (k.startsWith('mob/' + n2 + '/') || k.startsWith('entity/' + n2 + '/')) && k.includes(sy)); if (k) { out = k.replace(/\d+$/, ''); break; } } if (out) break; } }
    this.resCache.set(path, out); return out;
  },
  variants(path) {
    if (!this.idx) return []; let v = this.variantCache.get(path); if (v) return v;
    v = []; if (this.idx.has(path)) v.push(path);
    for (let i = 1; i < 40; i++) if (this.idx.has(path + i)) v.push(path + i);
    this.variantCache.set(path, v); return v;
  },
  async decode(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const p = (async () => {
      const e = this.idx.get(key);
      if (e.b64) { const bin = atob(e.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const ab = await this.ctx.decodeAudioData(u.buffer); this.cache.set(key, ab); this.loading.delete(key); return ab; }
      const dv = this.dv, lo = e.lo; const nl = dv.getUint16(lo + 26, true), xl = dv.getUint16(lo + 28, true);
      let data = new Uint8Array(this.buf, lo + 30 + nl + xl, e.csize);
      if (e.method == 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else data = data.slice();
      const ab = await this.ctx.decodeAudioData(data.buffer); this.cache.set(key, ab); this.loading.delete(key); return ab;
    })().catch(err => { console.warn('sound', key, err); this.loading.delete(key); return null; });
    this.loading.set(key, p); return p;
  },
  ALIAS: { ui_click: ['random/click', 'ui'], pop: ['random/pop', 'blocks'], glass: ['random/glass', 'blocks'], eat: ['random/eat', 'mobs'], burp: ['random/burp', 'mobs'],
    hurt: ['damage/hit', 'mobs'], fallsmall: ['damage/fallsmall', 'mobs'], fallbig: ['damage/fallbig', 'mobs'], chestopen: ['random/chestopen', 'blocks'], chestclosed: ['random/chestclosed', 'blocks'],
    orb: ['random/orb', 'blocks'], levelup: ['random/levelup', 'blocks'], splash: ['liquid/splash', 'blocks'], swim: ['liquid/swim', 'blocks'], break: ['random/break', 'blocks'],
    thunder: ['ambient/weather/thunder', 'ambient'], cave: ['ambient/cave/cave', 'ambient'], fizz: ['random/fizz', 'blocks'], explode: ['random/explode', 'blocks'], fuse: ['random/fuse', 'blocks'], door: ['random/door_open', 'blocks'] },
  async play(name, vol = 1, pitch = 1, pos) {
    if (!this.idx || !this.ensure()) return;
    let path, cat = 'blocks'; const a = this.ALIAS[name];
    if (a) [path, cat] = a; else { path = name; cat = name.startsWith('mob/') ? 'mobs' : name.startsWith('ambient') ? 'ambient' : name == 'ui_click' ? 'ui' : 'blocks'; }
    let v = this.variants(path); if (!v.length && /^(mob|entity)\//.test(path)) { const r = this.resolve(path); if (r) v = this.variants(r); } if (!v.length) return;
    const ab = await this.decode(v[Math.floor(Math.random() * v.length)]); if (!ab) return;
    let g = vol * this.vol.master * (this.vol[cat] ?? 1);
    let pan = 0;
    if (pos && window.player) {
      const dx = pos[0] - player.x, dy = pos[1] - (player.y + 1.6), dz = pos[2] - player.z, d = Math.hypot(dx, dy, dz);
      g *= Math.pow(clamp(1 - d / 16, 0, 1), 1.5); if (g <= 0.01) return;
      if (d > .5) pan = clamp((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d, -1, 1) * .8;
      if (player.headWater) pitch *= .8;
    }
    const src = this.ctx.createBufferSource(); src.buffer = ab; src.playbackRate.value = pitch;
    const gn = this.ctx.createGain(); gn.gain.value = g; let node = src.connect(gn);
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    if (window.player && player.headWater) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; node = node.connect(f); }
    node.connect(this.ctx.destination); src.start(); return src;
  },
  async playMusic(kind) {
    if (!this.idx || !this.ensure() || this.music) return;
    const list = [...this.idx.keys()].filter(k => (kind == 'nether' ? k.startsWith('music/game/nether/') : k.startsWith(kind == 'menu' ? 'music/menu/' : kind == 'creative' ? 'music/game/creative/' : 'music/game/') && !k.includes('/nether/') && !k.includes('/end/') && (kind != 'game' || !k.includes('/creative/'))));
    if (!list.length) return;
    const ab = await this.decode(list[Math.floor(Math.random() * list.length)]); if (!ab || this.music) return;
    const src = this.ctx.createBufferSource(); src.buffer = ab; const gn = this.ctx.createGain(); gn.gain.value = this.vol.master * this.vol.music;
    src.connect(gn).connect(this.ctx.destination); src.start(); this.music = { src, gn, kind };
    src.onended = () => { if (this.music && this.music.src == src) { this.music = null; this.musicTimer = 60 + Math.random() * 120; } };
  },
  stopMusic() { if (this.music) { try { this.music.src.stop(); } catch (e) { } this.music = null; } this.musicTimer = 5; },
  setMusicVol() { if (this.music) this.music.gn.gain.value = this.vol.master * this.vol.music; },
  async setRain(on) {
    if (!this.idx || !this.ensure()) return;
    if (!on) { if (this.rain) { this.rain.forEach(s => { try { s.stop(); } catch (e) { } }); this.rain = null; } return; }
    if (this.rain) return; this.rain = [];
    const v = this.variants('ambient/weather/rain'); if (!v.length) return;
    const ab = await this.decode(v[0]); if (!ab || !this.rain) return;
    const src = this.ctx.createBufferSource(); src.buffer = ab; src.loop = true; const gn = this.ctx.createGain(); gn.gain.value = .4 * this.vol.master * this.vol.ambient;
    src.connect(gn).connect(this.ctx.destination); src.start(); this.rain.push(src);
  },
};
function soundMat(n) {
  if (!n) return 'stone';
  if (/coral/.test(n) && !/block/.test(n)) return 'coral';
  if (/(wool|carpet|cactus|cake)/.test(n)) return 'cloth';
  if (/(snow)/.test(n)) return 'snow';
  if (/sand/.test(n) && !/sandstone/.test(n) || /(concrete_powder|soul_soil)/.test(n)) return 'sand';
  if (/(gravel|dirt|farmland|clay|coarse|rooted|^mud$|path)/.test(n)) return 'gravel';
  if (/(planks|_log|wood|_stem|bookshelf|crafting_table|chest|barrel|lectern|composter|note_block|jukebox|loom|cartography|fletching|smithing|beehive|bee_nest|bamboo|campfire|pumpkin|melon|jack_o)/.test(n) && !/mushroom_stem/.test(n)) return 'wood';
  if (/(grass|leaves|sapling|fern|flower|tulip|poppy|dandelion|allium|bluet|orchid|daisy|cornflower|lily|rose|bush|kelp|seagrass|sugar_cane|mushroom|hay|moss|azalea|mycelium|podzol|vine|wheat|carrots|potatoes|beetroots|sponge|lilac|peony|sunflower|roots|fungus|sprouts|eyeblossom|torchflower|wither_rose|nylium|propagule|shrub)/.test(n)) return 'grass';
  return 'stone';
}
// Minecraft-style per-block sound groups (block/<group>/break|step|place); falls back to classic dig/step
function blockSoundGroup(n) {
  if (!n) return null;
  const R = [[/^deepslate_(bricks|tiles)|polished_deepslate|chiseled_deepslate|cracked_deepslate/, 'deepslate_bricks'], [/deepslate/, 'deepslate'], [/copper/, 'copper'], [/moss/, 'moss'],
    [/tuff/, 'tuff'], [/calcite/, 'calcite'], [/amethyst_cluster|amethyst_bud/, 'amethyst_cluster'], [/amethyst/, 'amethyst'], [/basalt/, 'basalt'], [/bone_block/, 'bone_block'],
    [/nether_(gold|quartz)_ore/, 'nether_ore'], [/netherrack/, 'netherrack'], [/nether_bricks/, 'nether_bricks'], [/soul_sand/, 'soul_sand'], [/soul_soil/, 'soul_soil'], [/nylium/, 'nylium'],
    [/shroomlight/, 'shroomlight'], [/ancient_debris/, 'ancient_debris'], [/netherite/, 'netherite'], [/lodestone/, 'lodestone'], [/dripstone/, 'dripstone'], [/sculk_sensor/, 'sculk_sensor'],
    [/sculk/, 'sculk'], [/honey_block/, 'honeyblock'], [/bamboo/, 'bamboo'], [/azalea_leaves/, 'azalea_leaves'], [/azalea/, 'azalea'], [/rooted_dirt/, 'rooted_dirt'], [/powder_snow/, 'powder_snow'],
    [/_roots$/, 'roots'], [/hanging_roots/, 'hanging_roots'], [/fungus/, 'fungus'], [/nether_sprouts/, 'nether_sprouts'], [/wart/, 'netherwart'], [/lantern/, 'lantern'], [/chain/, 'chain'],
    [/sweet_berry/, 'sweet_berry_bush'], [/scaffolding/, 'scaffold'], [/candle/, 'candle'], [/respawn_anchor/, 'respawn_anchor'], [/spore_blossom/, 'spore_blossom'], [/vine/, 'vine'], [/lily_pad/, 'waterlily'],
    [/shulker_box/, 'shulker_box'], [/_stem$|hyphae|^(pumpkin|melon)$/, 'stem']];
  for (const [re, g] of R) if (re.test(n)) return g;
  return null;
}
function blockSound(n, kind, vol, pitch, pos) {
  const g = blockSoundGroup(n);
  if (g) { const k = kind == 'place' && !SND.variants('block/' + g + '/place').length ? 'break' : kind; if (SND.variants('block/' + g + '/' + k).length) return SND.play('block/' + g + '/' + k, vol, pitch, pos); }
  if (kind != 'step' && isGlassy(n) && kind == 'break') return SND.play('glass', vol, pitch, pos);
  return SND.play((kind == 'step' ? 'step/' : 'dig/') + soundMat(n), vol, pitch, pos);
}
const isGlassy = n => /(glass|^ice$|packed_ice|blue_ice|glowstone|sea_lantern|beacon)/.test(n || '');
// persist the chosen pack between visits (IndexedDB holds the original file locally)
const PackStore = {
  db() { return new Promise((res, rej) => { try { const r = indexedDB.open('blockcraft', 1); r.onupgradeneeded = () => r.result.createObjectStore('packs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async save(file) { try { const db = await this.db(); db.transaction('packs', 'readwrite').objectStore('packs').put(file, 'sound'); } catch (e) { } },
  async load() { try { const db = await this.db(); return await new Promise(res => { const r = db.transaction('packs').objectStore('packs').get('sound'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); } catch (e) { return null; } },
  async clear() { try { const db = await this.db(); db.transaction('packs', 'readwrite').objectStore('packs').delete('sound'); } catch (e) { } },
};
