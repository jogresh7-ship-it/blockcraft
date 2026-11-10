'use strict';
// ---------- Texture / resource packs: built-in packs and user .zip resource packs (Java format) ----------
// Every image the game uses (block atlas, items, GUI, font, mobs, sky) is rebuilt from the active pack.
const ORIG = {};
const EXTRA_MAP = { husk: 'entity/zombie/husk.png', drowned: 'entity/zombie/drowned.png', stray: 'entity/skeleton/stray.png', wither_skeleton: 'entity/skeleton/wither_skeleton.png', bogged: 'entity/skeleton/bogged.png',
  cave_spider: 'entity/spider/cave_spider.png', mooshroom_red: 'entity/cow/mooshroom_red.png', piglin: 'entity/piglin/piglin.png', piglin_brute: 'entity/piglin/piglin_brute.png' };
for (const s of ['steve', 'alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri']) EXTRA_MAP['skin_' + s] = 'entity/player/wide/' + s + '.png';
const TINTS = { grass: [124, 189, 107], foliage: [89, 174, 48], spruce: [97, 153, 97], birch: [128, 167, 85], water: [63, 118, 228] };
function tintFor(n) {
  if (/leaves$/.test(n) && !/cherry|azalea|pale_oak|poplar/.test(n)) return /spruce/.test(n) ? TINTS.spruce : /birch/.test(n) ? TINTS.birch : TINTS.foliage;
  if (n == 'leaf_litter') return [178, 128, 72];
  if (/^(grass_block_top|short_grass|fern|tall_grass_bottom|tall_grass_top|large_fern_bottom|large_fern_top|sugar_cane|vine|lily_pad|bush|grass_block_side_overlay)$/.test(n)) return /grass|bush/.test(n) ? TINTS.grass : TINTS.foliage;
  if (/^water_(still|flow)$/.test(n)) return TINTS.water;
  return null;
}
// ---- pixel filters for built-in packs ----
function hsl2rgb(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0) * 255, f(8) * 255, f(4) * 255]; }
function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx == mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx == r ? (g - b) / d + (g < b ? 6 : 0) : mx == g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; }
// Only packs from files the player supplied. Files are listed in window.PACK_FILES and loaded on demand.
window.PACK_FILES = window.PACK_FILES || {};
const PACK_INFO = {
  vanilla: { name: 'Vanilla', desc: 'The original Minecraft textures (26.3 template): every block, item, menu and mob.', author: 'Mojang' },
  faithful64: { name: 'Faithful 64x', desc: 'Faithful 64x Release 15 by HARYA_ and many others. Double-resolution textures for every block, item, menu and mob. faithfulpack.net', author: 'Faithful Team (faithfulpack.net)' },
  barebones: { name: 'Bare Bones', desc: 'Bare Bones 1.21.11 - "Just like the trailers!" Simple, clean textures, plus its own title logo.', author: 'Bare Bones pack' },
};
const PACKS = ['vanilla', 'faithful64', 'barebones'].filter(id => PACK_FILES[id]).map(id => Object.assign({ id, zip: 1, price: 0, icon: 'packs/' + id + '_icon', preview: 'packs/' + id + '_preview' }, PACK_INFO[id]));
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src + ' - keep the "packs" folder next to Blockcraft.html')); document.head.appendChild(s); });
async function ensurePackData(id) { if (window.EMBED_PACKS && EMBED_PACKS[id] && EMBED_PACKS[id].length == PACK_FILES[id].length) return; for (const f of PACK_FILES[id]) await loadScript(f); }
const PS = { active: store.get('pack2', 'none'), custom: null, customName: '' };
// the offline version ships the Vanilla pack: use it by default (also for players who never picked a pack)
if (window.PACK_FILES && PACK_FILES.vanilla && !store.get('vanillaDefault', 0)) { store.set('vanillaDefault', 1); if (PS.active == 'none') { PS.active = 'vanilla'; store.set('pack2', 'vanilla'); } }
function snapshotOriginals() { for (const k in IMG) if (IMG[k]) ORIG[k] = IMG[k]; ORIG.font_pack = ORIG.font; }
function setFont() { if (ORIG.font_improved) ORIG.font = ORIG.font_improved; IMG.font = ORIG.font; fontCache.clear(); initGUI(ui); titleCanvas = null; }
function processImage(src, pack) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (pack.scale && src.width >= 8) { const sw = Math.max(1, Math.round(src.width / pack.scale)), sh = Math.max(1, Math.round(src.height / pack.scale)); const t = document.createElement('canvas'); t.width = sw; t.height = sh; const tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.drawImage(src, 0, 0, sw, sh); g.drawImage(t, 0, 0, src.width, src.height); }
  else g.drawImage(src, 0, 0);
  if (pack.px) { const d = g.getImageData(0, 0, c.width, c.height), p = d.data; for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const o = pack.px(p[i], p[i + 1], p[i + 2]); p[i] = o[0]; p[i + 1] = o[1]; p[i + 2] = o[2]; } g.putImageData(d, 0, 0); }
  return c;
}
async function zipReader(blob) {
  const ab = await blob.arrayBuffer(), dv = new DataView(ab); let e = ab.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) != 0x06054b50) e--; if (e < 0) throw new Error('Not a zip file');
  const n = dv.getUint16(e + 10, true); let off = dv.getUint32(e + 16, true); const idx = new Map(), dec = new TextDecoder();
  for (let i = 0; i < n; i++) { if (dv.getUint32(off, true) != 0x02014b50) break; const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true); const name = dec.decode(new Uint8Array(ab, off + 46, nl)); idx.set(name.replace(/^.*?assets\/minecraft\//, 'assets/minecraft/'), { method, csize, lo }); off += 46 + nl + xl + cl; }
  const get = async name => { const en = idx.get(name); if (!en) return null; const lnl = dv.getUint16(en.lo + 26, true), lxl = dv.getUint16(en.lo + 28, true); let data = new Uint8Array(ab, en.lo + 30 + lnl + lxl, en.csize); if (en.method == 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else data = data.slice(); return new Blob([data]); };
  return { idx, get };
}
const blobImg = b => (window.createImageBitmap ? createImageBitmap(b).catch(() => null) : new Promise(res => { const u = URL.createObjectURL(b), i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; }));
async function buildFromZip(zip, setP) {
  const T = 'assets/minecraft/textures/', out = {};
  // block atlas
  let TS = 32; { const sb = await zip.get(T + 'block/stone.png'); const si = sb && await blobImg(sb); if (si) TS = clamp(si.width, 16, 64) >= 64 ? 64 : 32; }
  const at = document.createElement('canvas'); at.width = REG.cols * TS; at.height = REG.rows * TS; const ag = at.getContext('2d'); ag.imageSmoothingEnabled = false; ag.drawImage(ORIG.blocks, 0, 0, at.width, at.height);
  const tile = (img, x, y) => { const s = img.width; ag.clearRect(x, y, TS, TS); ag.drawImage(img, 0, 0, s, s, x, y, TS, TS); };
  const tintTile = (x, y, c) => { const d = ag.getImageData(x, y, TS, TS), p = d.data; for (let i = 0; i < p.length; i += 4) { p[i] = p[i] * c[0] / 255; p[i + 1] = p[i + 1] * c[1] / 255; p[i + 2] = p[i + 2] * c[2] / 255; } ag.putImageData(d, x, y); };
  const names = Object.keys(REG.tiles).filter(n => zip.idx.has(T + 'block/' + (n == 'grass_block_side_tinted' ? 'grass_block_side' : n.replace(/_red$/, '').replace('redstone_line0', 'redstone_dust_line0').replace('redstone_line1', 'redstone_dust_line1')) + '.png')); let done = 0;
  const srcOf = n => n == 'grass_block_side_tinted' ? 'grass_block_side' : n.replace(/_red$/, '').replace('redstone_line0', 'redstone_dust_line0').replace('redstone_line1', 'redstone_dust_line1');
  const loaded = new Map();
  for (let i0 = 0; i0 < names.length; i0 += 48) { const part = names.slice(i0, i0 + 48); const imgs = await Promise.all(part.map(async n => blobImg(await zip.get(T + 'block/' + srcOf(n) + '.png')))); part.forEach((n, k) => loaded.set(n, imgs[k])); setP && setP(i0 / names.length * .6); }
  out.animOv = {};
  for (const n of names) {
    const src = srcOf(n), img = loaded.get(n); if (!img) continue;
    if (n == src) { if (img.height > img.width) { let meta = null; try { const mb = await zip.get(T + 'block/' + src + '.png.mcmeta'); if (mb) meta = JSON.parse(await mb.text()).animation; } catch (e) { } out.animOv[n] = { img, meta }; } else out.animOv[n] = null; }
    const i = REG.tiles[n], x = (i % REG.cols) * TS, y = Math.floor(i / REG.cols) * TS; tile(img, x, y);
    const tc = tintFor(src); if (tc) tintTile(x, y, tc); if (/_red$/.test(n)) tintTile(x, y, [255, 40, 30]);
    if (n == 'grass_block_side_tinted') { const ob = await zip.get(T + 'block/grass_block_side_overlay.png'); if (ob) { const oi = await blobImg(ob); const t = document.createElement('canvas'); t.width = t.height = TS; const tg = t.getContext('2d'); tg.imageSmoothingEnabled = false; tg.drawImage(oi, 0, 0, oi.width, oi.width, 0, 0, TS, TS); tg.globalCompositeOperation = 'multiply'; tg.fillStyle = 'rgb(124,189,107)'; tg.fillRect(0, 0, TS, TS); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(oi, 0, 0, oi.width, oi.width, 0, 0, TS, TS); ag.drawImage(t, x, y); } }
  }
  out.blocks = at;
  // items
  const it = document.createElement('canvas'); it.width = REG.icols * TS; it.height = REG.irows * TS; const ig = it.getContext('2d'); ig.imageSmoothingEnabled = false; ig.drawImage(ORIG.items, 0, 0, it.width, it.height);
  const iIdx = ITEMS.map((n, i) => i).filter(i => zip.idx.has(T + 'item/' + ITEMS[i] + '.png')); const iImg = new Map();
  for (let a = 0; a < iIdx.length; a += 48) { const part = iIdx.slice(a, a + 48); const imgs = await Promise.all(part.map(async i => blobImg(await zip.get(T + 'item/' + ITEMS[i] + '.png')))); part.forEach((i, k) => iImg.set(i, imgs[k])); setP && setP(.6 + a / iIdx.length * .25); }
  for (const i of iIdx) { const img = iImg.get(i); if (!img) continue; const x = (i % REG.icols) * TS, y = Math.floor(i / REG.icols) * TS; ig.clearRect(x, y, TS, TS); ig.drawImage(img, 0, 0, img.width, img.width, x, y, TS, TS); }
  out.items = it;
  // gui, font, entities, environment
  const map = Object.assign({}, REG.guimap, EXTRA_MAP);
  delete map.font;
  for (const k in map) { const b = await zip.get(T + map[k]); if (!b) continue; const img = await blobImg(b); if (!img) continue; const ref = ORIG[k], keep = /^(entity|environment)\//.test(map[k]) || k.startsWith('panorama') || !ref; const c = document.createElement('canvas'); c.width = keep ? img.width : ref.width; c.height = keep ? img.height : ref.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height); out[k] = c; }
  for (const [k, p] of [['water', 'block/water_still.png'], ['lava', 'block/lava_still.png']]) { const b = await zip.get(T + p); if (!b) continue; const img = await blobImg(b); if (!img) continue; const fr = Math.max(1, Math.round(img.height / img.width)); const c = document.createElement('canvas'); c.width = TS; c.height = TS * fr; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, TS, TS * fr); if (k == 'water') { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(63,118,228)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, TS, TS * fr); } out[k] = c; }
  for (const [k, p] of [['title_logo', 'gui/title/minecraft.png'], ['title_edition', 'gui/title/edition.png']]) { const b = await zip.get(T + p); if (b) { const im = await blobImg(b); if (im) out[k] = im; } }
  const pm = await zip.get('pack.png') || await zip.get([...zip.idx.keys()].find(k => /(^|\/)pack\.png$/.test(k)) || ''); if (pm) out.pack = await blobImg(pm);
  return out;
}
function uploadAll() {
  for (const k in TEXS) if (IMG[k] && k != 'white') { gl.bindTexture(gl.TEXTURE_2D, TEXS[k]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, IMG[k]); }
  fontCache.clear(); initGUI(ui); buildIcons(); titleCanvas = null; for (const k in MODELS) delete MODELS[k]; applySkin();
}
async function applyPack(id, setP) {
  const P = PACKS.find(p => p.id == id) || null;
  if (P && P.zip) await ensurePackData(id);
  for (const k in ORIG) IMG[k] = ORIG[k]; if (!ORIG.title_logo) delete IMG.title_logo; if (!ORIG.title_edition) delete IMG.title_edition;
  if (P && P.zip && window.EMBED_PACKS && EMBED_PACKS[id]) { const bin = atob(EMBED_PACKS[id].join('')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const z = await zipReader(new Blob([u])); const out = await buildFromZip(z, setP); Object.assign(IMG, out); }
  else if (id == 'custom' && PS.custom) { const out = await buildFromZip(PS.custom, setP); Object.assign(IMG, out); }
  else if (P && P.id != 'faithful' && !P.zip) { const keys = Object.keys(ORIG).filter(k => !/^font_/.test(k)); let i = 0; for (const k of keys) { if (k == 'font') { IMG[k] = P.scale ? ORIG[k] : processImage(ORIG[k], P); continue; } IMG[k] = processImage(ORIG[k], k.startsWith('panorama') ? Object.assign({}, P, { scale: 0 }) : P); if (++i % 25 == 0) { setP && setP(i / keys.length); await new Promise(r => setTimeout(r)); } } }
  IMG.font = ORIG.font; // the custom font is always used
  const ov = IMG.animOv; delete IMG.animOv; setupAnims(ov || null);
  PS.active = id; store.set('pack2', id); uploadAll();
}
async function importPackZip(file) {
  S.pmsg = '§eReading ' + file.name + '...';
  try { const z = await zipReader(file); const has = [...z.idx.keys()].some(k => k.startsWith('assets/minecraft/textures/')); if (!has) throw new Error('No Minecraft textures in this zip'); PS.custom = z; PS.customName = file.name.replace(/\.zip$/i, ''); store.set('customPackName', PS.customName); await PackStore.saveTex(file); await applyPack('custom', p => S.pmsg = '§eApplying... ' + Math.round(p * 100) + '%'); S.pmsg = '§aApplied ' + PS.customName; }
  catch (e) { S.pmsg = '§c' + e.message; }
}
PackStore.saveTex = async function (file) { try { const db = await this.db(); db.transaction('packs', 'readwrite').objectStore('packs').put(file, 'tex'); } catch (e) { } };
PackStore.loadTex = async function () { try { const db = await this.db(); return await new Promise(res => { const r = db.transaction('packs').objectStore('packs').get('tex'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); } catch (e) { return null; } };
async function restorePack(onP) {
  if (!PACKS.find(p => p.id == PS.active) && PS.active != 'custom') PS.active = 'none';
  if (PS.active == 'custom') { const f = await PackStore.loadTex(); if (f) { try { PS.custom = await zipReader(f); PS.customName = store.get('customPackName', 'My Pack'); } catch (e) { PS.active = 'none'; } } else PS.active = 'none'; }
  if (PS.active != 'none') { try { await applyPack(PS.active, p => { onP && onP(p); }); S.pmsg = ''; } catch (e) { S.pmsg = '§c' + e.message; chat('§c' + e.message); console.warn(e); } }
}
// preview thumbnails for pack cards
const packThumbs = {};
const packBanners = {};
function packBanner(p) { if (p.preview && IMG[p.preview]) return IMG[p.preview]; if (packBanners[p.id]) return packBanners[p.id]; const src = ORIG.panorama_0, c = document.createElement('canvas'); c.width = 384; c.height = 120; const g = c.getContext('2d'); if (src) g.drawImage(src, 0, src.height * .3, src.width, src.width * 120 / 384, 0, 0, 384, 120); return packBanners[p.id] = p.id == 'faithful' ? c : processImage(c, Object.assign({}, p, { scale: 0 })); }
function packThumb(p) {
  if (packThumbs[p.id]) return packThumbs[p.id];
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const src = ORIG.panorama_0; if (src) g.drawImage(src, src.width * .2, src.height * .35, src.width * .6, src.height * .6, 0, 0, 64, 64);
  const t = id => TEX[BYNAME[id] * 4 + 2] ?? 0; const tiles = [REG.tiles.grass_block_side_tinted, t('oak_log'), REG.tiles.stone, REG.tiles.diamond_ore];
  tiles.forEach((ti, i) => g.drawImage(ORIG.blocks, (ti % REG.cols) * 32, Math.floor(ti / REG.cols) * 32, 32, 32, 4 + i * 14, 44, 14, 14));
  return packThumbs[p.id] = p.icon && IMG[p.icon] ? IMG[p.icon] : p.id == 'faithful' ? c : processImage(c, p);
}
// ---------- Resource Packs screen (settings) ----------
function scrPacks() {
  screenBg(); header('Resource Packs');
  const owned = PACKS;
  const hideBase = PS.custom && REG.baseName != 'Bare Bones'; // once your own pack (e.g. Bare Bones) is imported, it replaces the built-in textures
  const all = [...(hideBase ? [] : [{ id: 'none', name: REG.baseName || 'Default', desc: 'Built-in textures', p: null, base: 1 }]), ...owned.map(p => ({ id: p.id, name: p.name, desc: p.author, p })), ...(PS.custom ? [{ id: 'custom', name: PS.customName, desc: 'Imported .zip', p: null }] : [])];
  const top = 34, bottom = UH - 64, wide = UW > 470, x = wide ? UW / 2 - 225 : UW / 2 - 140;
  listFrame(top, bottom);
  if (mouse.wheel) S.scroll = clamp(S.scroll + mouse.wheel * 20, 0, Math.max(0, all.length * 38 - (bottom - top)));
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  all.forEach((e, i) => {
    const y = top + 4 + i * 38 - S.scroll, hv = hover(x, y, 280, 34) && mouse.y > top && mouse.y < bottom, act = PS.active == e.id;
    if (act) { cx2.fillStyle = '#808080'; cx2.fillRect(x - 2, y - 2, 284, 38); cx2.fillStyle = '#000'; cx2.fillRect(x - 1, y - 1, 282, 36); }
    if (e.p) cx2.drawImage(packThumb(e.p), x, y, 32, 32); else if (ORIG.pack) cx2.drawImage(ORIG.pack, x, y, 32, 32);
    text(e.name, x + 38, y + 4, '#FFFFFF'); text(act ? '§aActive' : e.desc, x + 38, y + 18, '#808080', false);
    if (hv) S.pvw = e;
    if (hv && mouse.click && !clickUsed && !act) { clickUsed = true; SND.play('ui_click', .5); S.pmsg = '§eApplying ' + e.name + '...'; applyPack(e.id, p => S.pmsg = '§eApplying ' + e.name + '... ' + Math.round(p * 100) + '%').then(() => S.pmsg = '§aApplied ' + e.name).catch(err => S.pmsg = '§c' + err.message); }
  });
  cx2.restore();
  if (wide) { const e = S.pvw || all.find(q => q.id == PS.active) || all[0], px = UW / 2 + 70, pw = 160; nine('tooltip_background', px - 4, top + 4, pw + 8, 140, 10, 10, 10, 10);
    if (e.p) cx2.drawImage(packBanner(e.p), px, top + 8, pw, 90); else if (IMG.pack) cx2.drawImage(IMG.pack, px + pw / 2 - 45, top + 8, 90, 90);
    text(e.name, px, top + 102, '#FFFF55'); const d = e.p ? e.p.desc : e.base ? (REG.baseName == 'Bare Bones' ? 'Bare Bones - simple, clean textures, just like the trailers. The default pack.' : 'The default textures.') : 'Your imported resource pack'; let line = '', ly = top + 114; for (const w of d.split(' ')) { if (textW(line + w) > pw) { text(line, px, ly, '#C0C0C0', false); ly += 9; line = ''; if (ly > top + 136) break; } line += w + ' '; } if (ly <= top + 136) text(line, px, ly, '#C0C0C0', false); }
  textC(S.pmsg || '§7Click a pack to apply it, or import your own .zip.', UW / 2, bottom + 4, '#FFFFFF');
  if (button('Import Pack (.zip)', UW / 2 - 154, UH - 50, 150)) { const inp = document.getElementById('texfile'); inp.value = ''; inp.click(); }
  if (button('Skins', UW / 2 + 4, UH - 50, 150)) go('skins');
  if (button('Done', UW / 2 - 100, UH - 26)) go(world ? 'options' : 'title');
}
