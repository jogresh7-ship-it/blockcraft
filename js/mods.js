'use strict';
// ---------- Mods & mod packs ----------
// A mod is plain JavaScript that receives the `api` object below. Import a .js file, or a .zip with
// mod.js (+ optional mod.json {name, description}) or a mod pack .zip with modpack.json {name, mods:[...files]}.
const MODS = { handlers: {}, cmds: {}, loaded: [], errors: [] };
const api = {
  on(ev, fn) { (MODS.handlers[ev] || (MODS.handlers[ev] = [])).push(fn); },
  command(name, fn, help) { MODS.cmds[name] = { fn, help }; },
  recipe(pattern, key, out, count = 1) { R(pattern, key, out, count); }, shapeless(ingr, out, count = 1) { RS(ingr, out, count); },
  chat: m => chat(m), give: (n, c = 1) => { const k = itemKey(n) || itemKey('item:' + n); if (k) giveItem(k, c); return !!k; },
  get player() { return player; }, get ctx() { return cx2; }, get screen() { return S.screen; }, text: (s, x, y, c, sh) => text(s, x, y, c, sh), textW: s => textW(s), get world() { return world; }, get mobs() { return mobs; },
  getBlock: (x, y, z) => BL[world.get(x, y, z)]?.n, setBlock: (x, y, z, n) => { const b = BYNAME[n]; if (b !== undefined) world.set(x, y, z, b); },
  spawn: (t, x, y, z) => MOBDEF[t] ? spawnMob(t, x, y, z) : null, sound: (p, v, pi) => SND.play(p, v, pi), settings: { timeScale: 1, keepInventory: false, noFallDamage: false, fullbright: false, jumpBoost: 1, dropMultiplier: 1, instantMine: false },
};
function modEmit(ev, ...a) { let r; for (const f of MODS.handlers[ev] || []) { try { const v = f(...a); if (v !== undefined) r = v; } catch (e) { console.warn('mod error', e); } } return r; }
const BUILTIN_MODS = {
  mobhealth: ['Mob Health Bars', 'Shows hearts and a health % bar above every mob so you know how close it is to dying', `
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
function heart(c, x, y, f) { for (let r = 0; r < 6; r++) for (let q = 0; q < 7; q++) if (HEART[r][q] == '#') { c.fillStyle = q / 7 < f ? (r == 1 && q == 1 ? '#FF9A9A' : '#E0201E') : '#3A1010'; c.fillRect(x + q, y + r, 1, 1); } }
api.on('hud', (c, W, H) => {
  const PV = NET.PV; if (!PV || api.screen != 'game') return; const p = api.player;
  for (const m of api.mobs) { const d = MOBDEF[m.type]; if (!d || d.cart || m.dead || !(m.hp > 0)) continue;
    const dist = Math.hypot(m.x - p.x, m.y - p.y, m.z - p.z); if (dist > 24) continue;
    const q = [m.x, m.y + (m.h || 1) + .45, m.z], o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) o[i] = PV[i] * q[0] + PV[4 + i] * q[1] + PV[8 + i] * q[2] + PV[12 + i];
    if (o[3] <= .1) continue; const sx = Math.round((o[0] / o[3] * .5 + .5) * W), sy = Math.round((1 - (o[1] / o[3] * .5 + .5)) * H); if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) continue;
    const max = d.hp * (m.size || 1) * (m.size || 1), hp = Math.max(0, Math.min(max, m.hp)), pct = hp / max, hearts = Math.ceil(max / 2), shown = Math.min(hearts, 10);
    const bw = 40, label = Math.ceil(hp) + '/' + max + ' (' + Math.round(pct * 100) + '%)', tw = api.textW(label);
    c.globalAlpha = Math.max(.35, 1 - dist / 30); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(sx - Math.max(bw, tw, shown * 8) / 2 - 2, sy - 22, Math.max(bw, tw, shown * 8) + 4, 23);
    for (let i = 0; i < shown; i++) heart(c, sx - shown * 4 + i * 8, sy - 20, Math.max(0, Math.min(1, pct * shown - i)));
    c.fillStyle = '#300'; c.fillRect(sx - bw / 2, sy - 12, bw, 3); c.fillStyle = pct > .5 ? '#3FD13F' : pct > .25 ? '#F2C12E' : '#E0301E'; c.fillRect(sx - bw / 2, sy - 12, Math.round(bw * pct), 3);
    api.text(label, Math.round(sx - tw / 2), sy - 8, '#FFFFFF', true); c.globalAlpha = 1; }
});` ] };
const MODPACKS = {};
const MODCFG = Object.assign({ enabled: [], imported: {}, pack: 'vanilla' }, store.get('mods', {}));
if (!MODCFG.hpDefault) { MODCFG.hpDefault = 1; if (!MODCFG.enabled.includes('mobhealth')) MODCFG.enabled.push('mobhealth'); }
const saveMods = () => store.set('mods', MODCFG);
MODCFG.enabled = MODCFG.enabled.filter(id => MODCFG.imported[id] || BUILTIN_MODS[id]); if (!MODCFG.imported[MODCFG.pack]) MODCFG.pack = 'none';
function loadMods() {
  for (const id of MODCFG.enabled) {
    const src = BUILTIN_MODS[id] ? BUILTIN_MODS[id][2] : MODCFG.imported[id]?.code; if (!src) continue;
    try { new Function('api', src)(api); MODS.loaded.push(BUILTIN_MODS[id] ? BUILTIN_MODS[id][0] : MODCFG.imported[id].name); } catch (e) { MODS.errors.push(id + ': ' + e.message); console.warn('mod', id, e); }
  }
}
async function importMod(file) {
  S.modmsg = '§eReading ' + file.name + '...';
  try {
    if (/\.js$/i.test(file.name)) { const code = await file.text(), id = 'u_' + file.name.replace(/\W/g, '_'); MODCFG.imported[id] = { name: file.name.replace(/\.js$/i, ''), desc: 'Imported mod', code }; if (!MODCFG.enabled.includes(id)) MODCFG.enabled.push(id); }
    else {
      const z = await zipReader(file), files = [...z.idx.keys()], txt = async n => n && (await z.get(n))?.text();
      const mpName = files.find(f => /(^|\/)modpack\.json$/i.test(f)), base = n => n.replace(/[^/]*$/, '');
      if (mpName) { const mp = JSON.parse(await txt(mpName)); const ids = []; for (const f of mp.mods || []) { const code = await txt(base(mpName) + f); if (!code) continue; const id = 'u_' + (mp.name + '_' + f).replace(/\W/g, '_'); MODCFG.imported[id] = { name: f.replace(/\.js$/i, ''), desc: 'From ' + (mp.name || 'mod pack'), code }; ids.push(id); } MODCFG.imported['pack_' + mp.name] = { name: mp.name, desc: mp.description || '', pack: ids }; MODCFG.enabled = ids; MODCFG.pack = 'pack_' + mp.name; }
      else { const mj = files.find(f => /(^|\/)mod\.json$/i.test(f)), mjs = files.find(f => /(^|\/)mod\.js$/i.test(f)) || files.find(f => /\.js$/i.test(f)); if (!mjs) throw new Error('No mod.js found in the zip'); const meta = mj ? JSON.parse(await txt(mj)) : {}; const id = 'u_' + (meta.name || file.name).replace(/\W/g, '_'); MODCFG.imported[id] = { name: meta.name || file.name.replace(/\.zip$/i, ''), desc: meta.description || 'Imported mod', code: await txt(mjs) }; if (!MODCFG.enabled.includes(id)) MODCFG.enabled.push(id); }
    }
    saveMods(); S.modmsg = '§aImported. Press Apply & Restart to load it.'; S.modDirty = true;
  } catch (e) { S.modmsg = '§c' + e.message; }
}
function scrMods() {
  screenBg(); header('Mods');
  const tabs = ['Mods', 'Mod Packs']; S.modtab = S.modtab || 0; tabs.forEach((t, i) => { if (tabBtn(t, UW / 2 - 70 + i * 70, 24, 70, S.modtab == i)) { S.modtab = i; S.scroll = 0; } });
  const top = 50, bottom = UH - 64, x = UW / 2 - 150; listFrame(top, bottom);
  let rows;
  if (S.modtab == 0) rows = [...Object.entries(BUILTIN_MODS).map(([id, m]) => ({ id, name: m[0], desc: m[1] })), ...Object.entries(MODCFG.imported).filter(([, m]) => !m.pack).map(([id, m]) => ({ id, name: m.name, desc: m.desc, user: 1 }))];
  else rows = [...Object.entries(MODPACKS).map(([id, p]) => ({ id, name: p[0], desc: p[1], mods: p[2] })), ...Object.entries(MODCFG.imported).filter(([, m]) => m.pack).map(([id, m]) => ({ id, name: m.name, desc: m.desc, mods: m.pack, user: 1 }))];
  if (mouse.wheel) S.scroll = clamp(S.scroll + mouse.wheel * 20, 0, Math.max(0, rows.length * 30 - (bottom - top)));
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  rows.forEach((r, i) => {
    const y = top + 4 + i * 30 - S.scroll, on = S.modtab == 0 ? MODCFG.enabled.includes(r.id) : MODCFG.pack == r.id, hv = hover(x, y, 300, 26) && mouse.y > top && mouse.y < bottom;
    if (hv) { cx2.fillStyle = 'rgba(255,255,255,.08)'; cx2.fillRect(x - 2, y - 2, 304, 30); }
    spr(on ? 'widget_checkbox_selected' : 'widget_checkbox', x, y + 3, 20, 20); text(r.name + (r.user ? ' §7(imported)' : ''), x + 26, y + 3, '#FFFFFF'); let d = r.desc; while (textW(d) > 270) d = d.slice(0, -1); text(d, x + 26, y + 14, '#A0A0A0', false);
    if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); S.modDirty = true;
      if (S.modtab == 0) { MODCFG.enabled = on ? MODCFG.enabled.filter(e => e != r.id) : [...MODCFG.enabled, r.id]; MODCFG.pack = 'custom'; }
      else { MODCFG.pack = r.id; MODCFG.enabled = r.mods.slice(); }
      saveMods(); }
    if (r.user && hover(x + 284, y + 6, 14, 14)) { S.tip = ['Delete']; if (mouse.click && !clickUsed) { clickUsed = true; delete MODCFG.imported[r.id]; MODCFG.enabled = MODCFG.enabled.filter(e => e != r.id); saveMods(); S.modDirty = true; } }
    if (r.user) text('x', x + 288, y + 8, '#FF5555');
  });
  if (!rows.length) textC(S.modtab == 0 ? '§7No mods installed' : '§7No mod packs installed', UW / 2, top + 30, '#FFFFFF');
  cx2.restore();
  textC(S.modmsg || (MODS.errors.length ? '§cMod errors: ' + MODS.errors[0] : '§7Loaded: ' + (MODS.loaded.join(', ') || 'none') + '. Only import mods you trust.'), UW / 2, bottom + 4, '#FFFFFF');
  if (button('Import Mod / Pack', UW / 2 - 154, UH - 50, 150)) { const inp = document.getElementById('modfile'); inp.value = ''; inp.click(); }
  if (button('Apply & Restart', UW / 2 + 4, UH - 50, 150, 20, !!S.modDirty)) { if (world) saveWorld(); location.reload(); }
  if (button('Done', UW / 2 - 100, UH - 26)) go(world ? 'pause' : 'title');
}
