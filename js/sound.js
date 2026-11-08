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
    if (!this.ensure()) return;
    let path, cat = 'blocks'; const a = this.ALIAS[name];
    if (a) [path, cat] = a; else { path = name; cat = name.startsWith('mob/') ? 'mobs' : name.startsWith('ambient') ? 'ambient' : name == 'ui_click' ? 'ui' : 'blocks'; }
    const v = this.variants(path);
    const ab = v.length ? await this.decode(v[Math.floor(Math.random() * v.length)]) : SYNTH.get(this.ctx, path); if (!ab) return;
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
    if (!this.ensure()) return;
    if (!on) { if (this.rain) { this.rain.forEach(s => { try { s.stop(); } catch (e) { } }); this.rain = null; } return; }
    if (this.rain) return; this.rain = [];
    const v = this.variants('ambient/weather/rain');
    const ab = v.length ? await this.decode(v[0]) : SYNTH.get(this.ctx, 'ambient/weather/rain'); if (!ab || !this.rain) return;
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
// ---------- Built-in synthesized sounds ----------
// Used whenever a sound isn't in a loaded sound pack (e.g. the public GitHub/online version, which ships no Mojang audio).
const SYNTH = {
  cache: new Map(),
  get(ctx, path) {
    const base = path.replace(/\d+$/, ''), v = Math.floor(Math.random() * 3), key = base + '#' + v;
    if (this.cache.has(key)) return this.cache.get(key);
    let r = null; try { r = this.make(ctx, base, v); } catch (e) { console.warn('synth', base, e); }
    this.cache.set(key, r); return r;
  },
  make(ctx, p, v) {
    const SR = ctx.sampleRate, rnd = (() => { let s = 1 + v * 7919 + p.length * 104729; for (const c of p) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; })();
    const buf = (dur, fn) => { const n = Math.max(1, Math.floor(dur * SR)), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0); let pk = 0; for (let i = 0; i < n; i++) { const x = fn(i / SR, i); d[i] = x; pk = Math.max(pk, Math.abs(x)); } if (pk > 0) { const g = .9 / pk; for (let i = 0; i < n; i++) d[i] *= g; } return b; };
    const lp = f => { let y = 0; const a = 1 - Math.exp(-2 * Math.PI * f / SR); return x => (y += a * (x - y)); };
    const hp = f => { const l = lp(f); return x => x - l(x); };
    const bp = (f, q = 1) => { const l = lp(f * (1 + .5 / q)), h = hp(f / (1 + .5 / q)); return x => l(h(x)); };
    const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
    const sin = (f, t) => Math.sin(2 * Math.PI * f * t), saw = (ph) => 2 * (ph - Math.floor(ph + .5));
    const j = 1 + v * .07; // variant pitch jitter
    // ---- block materials ----
    const mat = (p.match(/^(?:dig|step)\/(\w+)/) || [])[1] || (p.match(/^block\/(\w+)\//) || [])[1];
    const step = /^step\/|\/step$/.test(p), place = /\/place$/.test(p);
    if (mat || /^random\/break$/.test(p)) {
      const m = mat || 'stone', dur = step ? .12 : .22;
      const M = { stone: [1800, 'bp', .035], deepslate: [1200, 'bp', .04], gravel: [3000, 'hp', .06], sand: [4500, 'hp', .07], grass: [3800, 'hp', .05], wood: [650, 'lp', .05], cloth: [900, 'lp', .05], snow: [5000, 'hp', .08], glass: [6000, 'hp', .03], coral: [2200, 'bp', .05], ladder: [700, 'lp', .04], metal: [2500, 'bp', .06] }[/wood|stem|bamboo|scaffold|ladder/.test(m) ? 'wood' : /grass|moss|azalea|vine|root|fungus|sprout|wart|lily|berry|spore/.test(m) ? 'grass' : /gravel|dirt|soul|mud/.test(m) ? 'gravel' : /sand/.test(m) ? 'sand' : /snow/.test(m) ? 'snow' : /cloth|wool|candle/.test(m) ? 'cloth' : /copper|chain|lantern|netherite|anvil|metal|lodestone/.test(m) ? 'metal' : /deepslate|basalt|tuff|nether/.test(m) ? 'deepslate' : m] || [1800, 'bp', .035];
      const f = M[0] * j * (step ? .8 : 1), flt = M[1] == 'lp' ? lp(f) : M[1] == 'hp' ? hp(f) : bp(f, 1.4), d2 = M[2] * (step ? .6 : 1);
      const knock = m == 'wood' ? 160 * j : m == 'metal' ? 900 * j : 0;
      return buf(dur * (place ? .8 : 1), (t) => { const e = env(t, .002, d2); let x = flt(rnd()) * e; if (!step && t > .05) x += flt(rnd()) * env(t - .05, .002, d2 * .7) * .6; if (knock) x += sin(knock, t) * env(t, .001, .03) * (m == 'metal' ? .3 : .8); return x; });
    }
    // ---- UI / items / world ----
    if (/random\/click|^ui/.test(p)) return buf(.05, t => (sin(1400, t) * .6 + (t < .002 ? rnd() : 0)) * env(t, .0005, .01));
    if (/random\/pop/.test(p)) return buf(.09, t => sin((350 + t * 9000) * j, t) * env(t, .002, .025));
    if (/random\/glass/.test(p)) { const fs = [2900, 3700, 4400, 5300, 6100].map(f => f * j * (1 + rnd() * .05)); return buf(.45, t => fs.reduce((s, f, k) => s + sin(f, t) * env(t - k * .015, .001, .06 + k * .02) * (t > k * .015), 0) + hp(5000)(rnd()) * env(t, .001, .02)); }
    if (/random\/(eat|burp)/.test(p)) { const burp = /burp/.test(p), f = lp(burp ? 500 : 2200); return buf(burp ? .35 : .22, t => burp ? saw((95 - t * 60) * t) * env(t, .02, .12) * .8 + f(rnd()) * .2 * env(t, .01, .1) : f(rnd()) * (Math.abs(Math.sin(t * 70)) > .3 ? 1 : .2) * env(t, .005, .06)); }
    if (/damage\/hit|^hurt|player\/hurt/.test(p)) { const f = lp(1400); return buf(.25, t => (f(rnd()) * .6 + sin((240 - t * 500) * j, t)) * env(t, .002, .06)); }
    if (/damage\/fall/.test(p)) { const big = /big/.test(p), f = lp(big ? 300 : 500); return buf(big ? .4 : .2, t => (f(rnd()) + sin(70, t) * .7) * env(t, .001, big ? .12 : .05)); }
    if (/random\/orb|experience/.test(p)) { const f = (1700 + rnd() * 400) * j; return buf(.35, t => (sin(f, t) + sin(f * 1.5, t) * .4) * env(t, .002, .08)); }
    if (/random\/levelup/.test(p)) return buf(1, t => { const n = [523, 659, 784, 1046], k = Math.min(3, Math.floor(t / .12)); return (sin(n[k], t) + sin(n[k] * 2, t) * .3) * env(t - k * .12, .003, k == 3 ? .35 : .1); });
    if (/note\//.test(p)) return buf(.8, t => (sin(440, t) + sin(880, t) * .35 + sin(1320, t) * .1) * env(t, .003, .25));
    if (/liquid\/(splash|swim)|bucket/.test(p)) { const sw = /swim/.test(p), f = lp(1200), g = bp(700, .8); return buf(sw ? .35 : .7, t => (f(rnd()) * env(t, .01, sw ? .1 : .25) + g(rnd()) * Math.max(0, Math.sin(t * 35 + rnd() * .5)) * env(t, .05, .2) * .5)); }
    if (/random\/fizz|extinguish/.test(p)) { const f = hp(3000); return buf(.5, t => f(rnd()) * env(t, .005, .18)); }
    if (/explode/.test(p)) { const f = lp(180), g = lp(900); return buf(1.6, t => f(rnd()) * 3 * env(t, .005, .45) + g(rnd()) * env(t, .001, .08)); }
    if (/fuse|fire\/ignite/.test(p)) { const ign = /ignite/.test(p), f = hp(ign ? 1500 : 2500); return buf(ign ? .3 : 1.4, t => f(rnd()) * (ign ? env(t, .002, .08) : .8 + .2 * Math.sin(t * 40))); }
    if (/door|chest|trapdoor|fence_gate|barrel/.test(p)) { const close = /close/.test(p), f = bp(500, 2); return buf(.4, t => (close ? 0 : f(rnd()) * Math.max(0, Math.sin(t * 90)) * env(t, .02, .1) * .5) + (sin(120 * j, t) + lp(800)(rnd()) * .4) * env(t - (close ? 0 : .12), .001, .05) * (t > (close ? 0 : .12))); }
    if (/piston/.test(p)) { const f = bp(400, 1); return buf(.3, t => (f(rnd()) + sin(90, t) * .5) * env(t, .005, .07)); }
    if (/random\/bow(?!hit)/.test(p)) { const f = bp(900, 2); return buf(.35, t => f(rnd()) * env(t, .02, .08) + sin(180 - t * 200, t) * env(t, .005, .1) * .3); }
    if (/bowhit|arrow/.test(p)) return buf(.12, t => (sin(300, t) + lp(2000)(rnd()) * .5) * env(t, .001, .03));
    if (/item\/(hoe|shovel|axe|bonemeal)|shear/.test(p)) { const f = /shear/.test(p) ? hp(4000) : bp(1500, 1); return buf(.22, t => f(rnd()) * env(t, .003, .05) + (t > .08 ? f(rnd()) * env(t - .08, .003, .04) : 0)); }
    if (/armor|equip/.test(p)) return buf(.3, t => (sin(1200 * j, t) * .5 + bp(2500, 1)(rnd())) * env(t, .002, .06));
    if (/portal/.test(p)) return buf(2.5, t => sin(110 + 60 * Math.sin(t * 3), t) * .5 * Math.sin(Math.PI * t / 2.5) + sin(220.5 + 80 * Math.sin(t * 2.3), t) * .3 * Math.sin(Math.PI * t / 2.5));
    if (/thunder/.test(p)) { const f = lp(120), g = lp(500); return buf(3.5, t => f(rnd()) * 4 * env(t, .02, 1.2) * (1 + .5 * Math.sin(t * 9)) + g(rnd()) * env(t, .002, .15)); }
    if (/weather\/rain/.test(p)) { const f = hp(1200), g = lp(5000); return buf(4, (t, i) => { const fade = Math.min(1, t / .3, (4 - t) / .3); return g(f(rnd())) * (.6 + .4 * fade) + (rnd() > .9985 ? rnd() * 2 : 0); }); }
    if (/ambient\/(cave|nether)|mood/.test(p)) { const f = lp(300); return buf(4, t => (sin(55 * j + 4 * Math.sin(t * 1.7), t) * .6 + f(rnd()) * .5) * Math.sin(Math.PI * t / 4)); }
    // ---- mobs: a simple "voice" per mob ----
    const mm = p.match(/^mob\/(\w+)\/(\w+)/);
    if (mm) {
      const [, mob, kind] = mm;
      if (/step/.test(kind)) { const f = lp(mob == 'spider' ? 2500 : 900); return buf(.1, t => f(rnd()) * env(t, .002, .025)); }
      const death = /death/.test(kind), hurt = /hurt|hit/.test(kind);
      const V = { zombie: [95, 'saw', 1.1, 5], husk: [85, 'saw', 1.1, 5], drowned: [90, 'saw', 1, 4], skeleton: [0, 'rattle', .45], stray: [0, 'rattle', .45], creeper: [0, 'hiss', .7], spider: [0, 'hiss', .5],
        cow: [115, 'saw', 1.1, 2], mooshroom: [115, 'saw', 1.1, 2], pig: [260, 'saw', .28, 0], sheep: [330, 'saw', .7, 7], chicken: [900, 'saw', .1, 0], wolf: [420, 'saw', .2, 0], endermen: [140, 'warble', 1.2], ghast: [500, 'warble', 1.3], slime: [0, 'squish', .25], villager: [240, 'saw', .4, 3], piglin: [180, 'saw', .4, 3], blaze: [0, 'hiss', .8], cat: [600, 'saw', .5, 2], horse: [300, 'saw', .7, 8] }[mob] || [200, 'saw', .4, 2];
      let [f0, type, dur, vib] = V; dur *= death ? 1.5 : hurt ? .5 : 1; f0 *= (hurt ? 1.25 : death ? .85 : 1) * j;
      if (type == 'rattle') { const f = bp(2500, 3); return buf(dur, t => f(rnd()) * (Math.sin(t * 2 * Math.PI * 22) > .4 ? 1 : 0) * env(t, .005, dur * .4)); }
      if (type == 'hiss') { const f = hp(2000), g = bp(1200, 1); return buf(dur, t => (f(rnd()) * .7 + g(rnd()) * .5) * Math.sin(Math.PI * Math.min(1, t / dur))); }
      if (type == 'squish') { const f = lp(500); return buf(dur, t => (f(rnd()) + sin(90 + 200 * env(t, 0, .05), t)) * env(t, .005, .06)); }
      const fm1 = bp(f0 * 4.5 + 300, 2), fm2 = bp(f0 * 9 + 900, 2.5); let ph = 0;
      return buf(dur, t => {
        const fr = type == 'warble' ? f0 * (1 + .25 * Math.sin(t * 13)) : f0 * (1 + (vib ? .04 * Math.sin(t * 2 * Math.PI * vib) : 0)) * (death ? 1 - t / dur * .4 : 1) * (mob == 'cow' ? 1 - t * .15 : 1);
        ph += fr / SR; const s = saw(ph), shape = Math.sin(Math.PI * Math.min(1, t / dur)) ** .6;
        const oink = mob == 'pig' ? (Math.sin(t * 2 * Math.PI * 9) > 0 ? 1 : .3) : 1, cluck = mob == 'chicken' ? (Math.sin(t * 2 * Math.PI * 25) > .2 ? 1 : 0) : 1;
        return (fm1(s) + fm2(s) * .6 + s * .15) * shape * oink * cluck;
      });
    }
    return null;
  },
};
