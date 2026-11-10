'use strict';
// ---------- options & storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('blockcraft_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('blockcraft_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('blockcraft_' + k); } catch (e) { } },
};
const opts = Object.assign({ fov: 70, rd: LOW_END ? 4 : 6, mres: LOW_END && !IS_MOBILE ? 1 : 1.5, autoPerf: true, sens: .5, gui: 0, bob: false, clouds: true, fps: false, master: 1, music: .5, blocks: 1, mobs: 1, ambient: .7, ui: 1, smooth: true, font: 'improved' }, store.get('options2', {}));
function saveOpts() { store.set('options2', opts); Object.assign(SND.vol, { master: opts.master, music: opts.music, blocks: opts.blocks, mobs: opts.mobs, ambient: opts.ambient, ui: opts.ui }); SND.setMusicVol(); }
const SPLASHES = ['Faithful to the original!', 'Now with sound packs!', 'Made in a browser!', '32x textures!', 'Punch a tree!', 'Infinite terrain!', 'Also try the real thing!', 'Voxel-tastic!', 'WebGL2!', 'Pixel perfect!', 'Bitmap font included!', 'Cubes all the way down!', 'Don\'t dig straight down!', 'Mind the lava!', '545 blocks!', '677 items!', 'Sheep included!', 'Moo!', 'Oink!', 'Ambient occlusion!'];
const S = { screen: 'loading', prev: null, splash: SPLASHES[Math.random() * SPLASHES.length | 0], sel: -1, scroll: 0, cw: null, tab: 0, msg: '', loadP: 0, worlds: store.get('worlds', []), confirm: null, cscroll: 0, search: { q: '' }, ctab: 0 };
function go(s) { S.prev = S.screen; S.screen = s; focus = null; S.scroll = 0; if (s == 'game') { lockPointer(); if (typeof mouse != 'undefined') { mouse.down = false; mouse.rdown = false; mouse.click = false; mouse.rclick = false; } S.noBreak = performance.now() + 250; } else unlockPointer(); } // the click that closes a menu never breaks or places a block
const inGame = () => !!world;
function screenBg() { if (inGame()) { cx2.fillStyle = S.bedrock ? 'rgba(30,30,31,.75)' : 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH); } else tiledBg('menu_background', 0.55); }

// ---------- title ----------
let titleCanvas;
function drawTitleLogo(cx, y) {
  if (!titleCanvas) {
    const s = 'BLOCKCRAFT', sc = 5, w = textW(s, sc) + 10, h = 8 * sc + 14;
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const mask = document.createElement('canvas'); mask.width = c.width; mask.height = c.height; const mg = mask.getContext('2d'); mg.imageSmoothingEnabled = false;
    const saved = cx2; cx2 = mg; drawText(s, 2, 2, '#FFFFFF', sc * 2 / 1, false); cx2 = saved;
    // extrusion
    for (let i = 10; i > 0; i--) { g.globalAlpha = 1; g.drawImage(tint(mask, i == 10 ? '#000' : '#3b3b3b'), i, i); }
    // stone fill
    const fill = document.createElement('canvas'); fill.width = c.width; fill.height = c.height; const fg = fill.getContext('2d'); fg.imageSmoothingEnabled = false;
    const st = TEX[BYNAME.stone * 4], cob = TEX[BYNAME.cobblestone * 4];
    for (let x = 0; x < c.width; x += 32) for (let yy = 0; yy < c.height; yy += 32) { const t = (x / 32 + yy / 32) % 3 ? st : cob; { const bt = IMG.blocks.width / REG.cols; fg.drawImage(IMG.blocks, (t % REG.cols) * bt, (t / REG.cols | 0) * bt, bt, bt, x, yy, 32, 32); } }
    fg.globalCompositeOperation = 'destination-in'; fg.drawImage(mask, 0, 0);
    g.drawImage(fill, 0, 0);
    // top highlight
    g.globalCompositeOperation = 'source-atop'; const grd = g.createLinearGradient(0, 0, 0, c.height); grd.addColorStop(0, 'rgba(255,255,255,.25)'); grd.addColorStop(.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
    titleCanvas = c;
  }
  const w = titleCanvas.width / 2, h = titleCanvas.height / 2; cx2.drawImage(titleCanvas, Math.round(cx - w / 2), y, w, h); return { w, h };
}
function tint(src, col) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; }
function titleLogo(y) {
  if (IMG.title_logo) { const im = IMG.title_logo, w = Math.min(UW - 20, 256), h = w * im.height / im.width; cx2.drawImage(im, Math.round(UW / 2 - w / 2), y, w, h);
    if (IMG.title_edition && !S.bedrock) { const e = IMG.title_edition, ew = w / 2, eh = ew * e.height / e.width; cx2.drawImage(e, Math.round(UW / 2 - ew / 2), y + h - eh * .6, ew, eh); } else textC(S.bedrock ? 'BEDROCK EDITION' : '', UW / 2, y + h + 2, '#FFFFFF');
    return { w, h: h + (IMG.title_edition ? 4 : 10) }; }
  const lg = drawTitleLogo(UW / 2, y); textC(S.bedrock ? 'BEDROCK EDITION' : 'JAVA EDITION', UW / 2, y + lg.h + 2, '#E0E0E0'); return { w: lg.w, h: lg.h + 10 };
}
function iconButton(icon, x, y, tip) { const r = button('', x, y, 20, 20); drawIcon(itemKey(icon), x + 2, y + 2); if (hover(x, y, 20, 20)) S.tip = [tip]; return r; }
function scrTitle() {
  cx2.fillStyle = 'rgba(0,0,0,.15)'; cx2.fillRect(0, 0, UW, UH);
  const ly = Math.max(8, UH / 4 - 50); const lg = titleLogo(ly);
  cx2.save(); cx2.translate(UW / 2 + lg.w / 2 - 20, ly + lg.h - 12); cx2.rotate(-20 * Math.PI / 180); const sc = 1.8 - Math.abs(Math.sin(performance.now() / 1000 * Math.PI * 2)) * 0.1;
  const sw = textW(S.splash); const f = 100 / (sw + 32) * sc; cx2.scale(f, f); textC(S.splash, 0, -8, '#FFFF00'); cx2.restore();
  if (!SND.idx && !(window.SOUND_FILES && SOUND_FILES.length)) { const x = SAFE[3] + 6, y = 6; if (button(S.msg ? 'Loading...' : 'Load Sounds', x, y, 74, 18)) pickSoundPack(); if (hover(x, y, 74, 18)) S.tip = ['No sounds yet: pick "Blockcraft Sounds.zip"', 'once and it is remembered']; }
  if (S.bedrock) {
    // Bedrock home screen: big Play / Settings / Marketplace column in the middle, your character on the left with Profile under it
    const bw = Math.min(200, UW * .42), bx = UW / 2 - bw / 2, top = ly + lg.h + 10, step = clamp((UH - 40 - top) / 3.4, 22, 30), bh = Math.min(26, step - 4);
    let by = Math.max(top, Math.min(UH / 2 - 28, UH - 40 - 3 * step));
    if (button('Play', bx, by, bw, bh + 2)) go('worlds');
    if (button('Settings', bx, by + step + 2, bw, bh)) go('options');
    if (button('Marketplace', bx, by + 2 * step + 2, bw, bh)) go('market');
    // character + profile (left), like Bedrock
    const cw = Math.min(70, (UW / 2 - bw / 2) - 20), cx0 = Math.max(SAFE[3] + 12, UW / 2 - bw / 2 - cw - 26), ch = Math.min(110, UH - SAFE[2] - by - 64);
    if (cw > 30 && ch > 50) { cx2.fillStyle = 'rgba(0,0,0,.35)'; cx2.fillRect(cx0, by, cw, ch); drawPlayerDoll(cx0 + cw / 2, by + 6, ch - 30, IMG['skin_' + PROFILE.skin] || IMG.steve);
      textC(store.get('mpName', '') || 'Steve', cx0 + cw / 2, by + ch - 20, '#FFFFFF'); if (button('Profile', cx0, by + ch + 2, cw, 18)) go('skins'); }
    // small corner buttons
    { const qx = SAFE[3] + 6, qy = UH - SAFE[2] - 36; // small buttons in the bottom-left corner, like Bedrock
      const ib = (i, icon, tip, fn) => { const x = qx + i * 24; if (button('', x, qy, 20, 20)) fn(); drawIcon(itemKey(icon) || itemKey('item:book'), x + 2, qy + 2, 16); if (hover(x, qy, 20, 20)) S.tip = [tip]; };
      ib(0, 'player_head', 'Friends & Servers', () => go('multiplayer')); ib(1, 'item:knowledge_book', 'Mods', () => { S.modmsg = ''; go('mods'); }); ib(2, 'item:writable_book', 'Credits', () => go('credits')); }
  } else {
    // Java-style
    const by = UH / 4 + 48, bx = UW / 2 - 100;
    if (button('Singleplayer', bx, by)) go('worlds');
    if (button('Multiplayer', bx, by + 24, 200, 20)) go('multiplayer');
    if (button('Mods', bx, by + 48, 98)) { S.modmsg = ''; go('mods'); }
    if (button('Skins', bx + 102, by + 48, 98)) go('skins');
    if (button('Options...', bx, by + 84, 98)) go('options');
    if (button('Quit Game', bx + 102, by + 84, 98)) { S.quitMsg = performance.now(); }
    if (iconButton('item:book', bx - 24, by + 84, 'Credits')) go('credits');
    if (iconButton('note_block', bx + 204, by + 84, 'Music & Sounds')) go('sound');
    if (S.quitMsg && performance.now() - S.quitMsg < 2500) textC('§7Close this browser tab to quit', UW / 2, by + 110, '#FFFFFF');
  }
  text('Blockcraft ' + (S.bedrock ? 'Bedrock' : 'Java') + ' Edition 1.0', 2, UH - 10, '#FFFFFF');
  const c = PS.active == 'custom' ? PS.customName : ((PACKS.find(p => p.id == PS.active) || {}).name || REG.baseName || 'Default'); const msg = S.pmsg || ('Pack: ' + c); text(msg, UW - textW(msg) - 2, UH - 10, '#FFFFFF');
  if (SND.loadingSounds) { const s = 'Loading sounds... ' + SND.loadingSounds; text(s, 2, UH - 20, '#A0A0A0'); }
}
function scrCredits() {
  tiledBg('menu_background', .55); header('Credits');
  const L = ['§eBlockcraft§f - a browser voxel sandbox', '', '§6Textures', (REG.baseName == 'Bare Bones' ? 'Bare Bones resource pack (offline download only)' : 'Faithful resource packs by the Faithful team'), (REG.baseName == 'Bare Bones' ? '' : 'faithfulpack.net - used under the Faithful License'), '', '',
    '§6Sounds', 'Loaded at runtime from the sound pack you choose.', 'They stay on your computer and are not uploaded.', '', '§6Font', 'Bitmap font from the texture pack (font/ascii.png)', '',
    '§7Not affiliated with Mojang or Microsoft.'];
  L.forEach((l, i) => textC(l, UW / 2, 40 + i * 11, '#FFFFFF'));
  if (button('Done', UW / 2 - 100, UH - 30)) go('title');
}
// ---------- world list ----------
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`; }
function listFrame(top, bottom) {
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip(); tiledBg('menu_list_background', .2, S.scroll); cx2.restore(); sepLines(top, bottom);
}
function scrWorlds() {
  tiledBg('menu_background', .55); header(S.bedrock ? 'Play' : 'Select World');
  if (S.bedrock) { const tw = Math.min(150, UW / 2 - 12); if (button('Worlds', UW / 2 - tw - 2, 32, tw, 20, false)) { } if (button('Friends (Multiplayer)', UW / 2 + 2, 32, tw, 20)) go('multiplayer'); }
  const top = S.bedrock ? 56 : 32, bottom = UH - 64; listFrame(top, bottom);
  const W = S.worlds.slice().sort((a, b) => b.last - a.last);
  if (mouse.wheel && hover(0, top, UW, bottom - top)) S.scroll = clamp(S.scroll + mouse.wheel * 18, 0, Math.max(0, W.length * 36 - (bottom - top) + 8));
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  W.forEach((w, i) => {
    const x = UW / 2 - 110, y = top + 4 + i * 36 - S.scroll, hv = hover(x, y, 220, 32) && mouse.y > top && mouse.y < bottom;
    if (S.sel == w.id) { cx2.fillStyle = '#808080'; cx2.fillRect(x - 2, y - 2, 224, 36); cx2.fillStyle = '#000'; cx2.fillRect(x - 1, y - 1, 222, 34); }
    // world icon: pack.png
    if (w.icon) { S.iconCache = S.iconCache || {}; let im = S.iconCache[w.id]; if (!im) { im = new Image(); im.src = w.icon; S.iconCache[w.id] = im; } if (im.complete && im.naturalWidth) cx2.drawImage(im, x, y, 32, 32); else if (IMG.pack) cx2.drawImage(IMG.pack, x, y, 32, 32); } else if (IMG.pack) cx2.drawImage(IMG.pack, x, y, 32, 32);
    if (hv) { cx2.fillStyle = 'rgba(160,160,160,.5)'; cx2.fillRect(x, y, 32, 32); spr(hover(x, y, 32, 32) ? 'world_list_join_highlighted' : 'world_list_join', x, y, 32, 32); }
    text(w.name, x + 35, y + 1, '#FFFFFF'); text(`${w.name.replace(/\W/g, '')} (${fmtDate(w.last)})`, x + 35, y + 12, '#808080', false);
    text((w.mode == 'hardcore' ? '§cHardcore Mode!' : w.mode == 'creative' ? 'Creative Mode' : 'Survival Mode') + (w.flat ? ', Superflat' : '') + (w.dead ? ' §c(Dead)' : ''), x + 35, y + 22, '#808080', false);
    if (hv && mouse.click && !clickUsed) { clickUsed = true; if (S.sel == w.id && performance.now() - (S.lastClick || 0) < 400 || hover(x, y, 32, 32)) { openWorld(w); } S.sel = w.id; S.lastClick = performance.now(); SND.play('ui_click', .5); }
  });
  if (!W.length) textC('No worlds yet. Create one!', UW / 2, top + 30, '#A0A0A0');
  cx2.restore();
  const sel = W.find(w => w.id == S.sel), bx = UW / 2 - 154, by = UH - 52;
  if (button('Play Selected World', bx, by, 150, 20, !!sel)) openWorld(sel);
  if (button('Create New World', bx + 158, by, 150)) { S.cw = { name: 'New World', seed: '', mode: 'survival', diff: 2, cheats: false, flat: false, tab: 0 }; go('create'); }
  if (button('Edit', bx, by + 24, 72, 20, !!sel)) { S.edit = { w: sel, name: sel.name }; go('editworld'); }
  if (button('Delete', bx + 78, by + 24, 72, 20, !!sel)) { S.confirm = sel; go('confirmdel'); }
  if (button('Re-Create', bx + 158, by + 24, 72, 20, !!sel)) { S.cw = { name: sel.name + ' copy', seed: String(sel.seed), mode: sel.mode, diff: sel.diff ?? 2, cheats: !!sel.cheats, flat: !!sel.flat, tab: 0 }; go('create'); }
  if (button('Cancel', bx + 236, by + 24, 72)) go('title');
}
function scrEditWorld() {
  tiledBg('menu_background', .55); header('Edit World');
  text('World Name', UW / 2 - 100, 50, '#A0A0A0'); textField('ename', S.edit, 'name', UW / 2 - 100, 62, 200);
  if (button('Save', UW / 2 - 100, UH / 2 + 30, 98)) { S.edit.w.name = S.edit.name || 'World'; store.set('worlds', S.worlds); go('worlds'); }
  if (button('Cancel', UW / 2 + 2, UH / 2 + 30, 98)) go('worlds');
}
function scrConfirmDel() {
  tiledBg('menu_background', .55);
  textC('Are you sure you want to delete this world?', UW / 2, 70, '#FFFFFF');
  textC(`'${S.confirm.name}' will be lost forever! (A long time!)`, UW / 2, 90, '#A0A0A0');
  if (button('Delete', UW / 2 - 155, UH / 6 + 96, 150)) { store.del('world_' + S.confirm.id); S.worlds = S.worlds.filter(w => w.id != S.confirm.id); store.set('worlds', S.worlds); S.sel = -1; go('worlds'); }
  if (button('Cancel', UW / 2 + 5, UH / 6 + 96, 150)) go('worlds');
}
const DIFFS = ['Peaceful', 'Easy', 'Normal', 'Hard'];
function tabBtn(label, x, y, w, sel) {
  const hv = hover(x, y, w, 24);
  if (S.bedrock) { brButton(label, x, y + 2, w, 20, true, hv, sel); if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); return true; } return false; }
  nine(sel ? (hv ? 'widget_tab_selected_highlighted' : 'widget_tab_selected') : hv ? 'widget_tab_highlighted' : 'widget_tab', x, y, w, 24, 2, 2, 2, 2);
  textC(label, x + w / 2, y + 8, sel ? '#FFFFFF' : '#A0A0A0');
  if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); return true; } return false;
}
function scrCreate() {
  tiledBg('menu_background', .55); const c = S.cw;
  const tabs = ['Game', 'World', 'More']; const tw = 70, tx = UW / 2 - tabs.length * tw / 2;
  tabs.forEach((t, i) => { if (tabBtn(t, tx + i * tw, 0, tw, c.tab == i)) c.tab = i; });
  sepLines(24, UH - 36);
  const x = UW / 2 - 105, y = 40;
  if (c.tab == 0) {
    text('World Name', x, y, '#A0A0A0'); textField('wname', c, 'name', x, y + 12, 210);
    const modes = { survival: ['Survival', 'Search for resources, craft, gain', 'levels, health and hunger'], hardcore: ['Hardcore', 'Same as Survival Mode, locked at hardest', 'difficulty, and one life only'], creative: ['Creative', 'Unlimited resources, free flying and', 'destroy blocks instantly'] };
    if (button('Game Mode: ' + modes[c.mode][0], x, y + 40, 210)) c.mode = { survival: 'hardcore', hardcore: 'creative', creative: 'survival' }[c.mode];
    text(modes[c.mode][1], x, y + 64, '#A0A0A0', false); text(modes[c.mode][2], x, y + 74, '#A0A0A0', false);
    if (button('Difficulty: ' + (c.mode == 'hardcore' ? 'Hard' : DIFFS[c.diff]), x, y + 90, 210, 20, c.mode != 'hardcore')) c.diff = (c.diff + 1) % 4;
    if (button('Allow Commands: ' + (c.cheats || c.mode == 'creative' ? 'ON' : 'OFF'), x, y + 114, 210, 20, c.mode != 'hardcore')) c.cheats = !c.cheats;
  } else if (c.tab == 1) {
    if (button('World Type: ' + (c.flat ? 'Superflat' : 'Default'), x, y, 210)) c.flat = !c.flat;
    text('Seed for the World Generator', x, y + 30, '#A0A0A0'); textField('wseed', c, 'seed', x, y + 42, 210, 20, 'Leave blank for a random seed');
    if (button('Generate Structures: ON', x, y + 70, 210, 20, false)) { }
  } else {
    if (button('Game Rules', x, y, 210, 20, false)) { }
    if (button('Data Packs', x, y + 24, 210, 20, false)) { }
    text('Textures: Faithful 32x', x, y + 56, '#A0A0A0', false);
  }
  if (button('Create New World', UW / 2 - 155, UH - 28, 150)) createWorld(c);
  if (button('Cancel', UW / 2 + 5, UH - 28, 150)) go('worlds');
}
function seedOf(s) { if (!s) return (Math.random() * 2 ** 31) | 0; if (/^-?\d+$/.test(s)) return parseInt(s) | 0; let h = 0; for (const ch of s) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0; return h; }
function createWorld(c) {
  const id = Date.now().toString(36);
  const meta = { id, name: c.name || 'New World', seed: seedOf(c.seed), mode: c.mode, diff: c.mode == 'hardcore' ? 3 : c.diff, cheats: c.cheats || c.mode == 'creative', flat: c.flat, created: Date.now(), last: Date.now(), gen: 3 };
  if (c.kit) meta.kit = c.kit; if (c.nether) meta.startNether = 1;
  S.worlds.push(meta); store.set('worlds', S.worlds); openWorld(meta, true);
}
// ---------- options ----------
function scrOptions() {
  screenBg(); header('Options');
  const x = UW / 2 - 155, y = UH / 6 - 12;
  opts.fov = Math.round(30 + slider('fov', 'FOV: ' + (Math.round(30 + (opts.fov - 30)) == 70 ? 'Normal' : Math.round(opts.fov) == 110 ? 'Quake Pro' : Math.round(opts.fov)), x, y, 150, (opts.fov - 30) / 80) * 80);
  opts.rd = Math.round(2 + slider('rd', 'Render Distance: ' + opts.rd + ' chunks', x + 160, y, 150, (opts.rd - 2) / 30) * 30);
  if (button('Music & Sounds...', x, y + 36, 150)) go('sound');
  if (button('Video Settings...', x + 160, y + 36, 150)) go('video');
  if (button('Controls...', x, y + 60, 150)) go('controls');
  if (button('Resource Packs...', x + 160, y + 60, 150)) { S.pmsg = ''; go('packs'); }
  if (button('Credits & Attribution...', x, y + 108, 150)) go('credits');
  opts.sens = slider('sens', 'Sensitivity: ' + Math.round(opts.sens * 200) + '%', x, y + 84, 150, opts.sens);
  if (button('Difficulty: ' + (world ? DIFFS[world.meta.diff] : '-'), x + 160, y + 84, 150, 20, !!world && world.meta.mode != 'hardcore')) { world.meta.diff = (world.meta.diff + 1) % 4; }
  if (button('Done', UW / 2 - 100, UH / 6 + 168)) { saveOpts(); go(world ? 'pause' : 'title'); }
}
function scrVideo() {
  screenBg(); header('Video Settings'); const x = UW / 2 - 155, y = UH / 6 - 12;
  if (button('GUI Scale: ' + (opts.gui || 'Auto'), x, y, 150)) opts.gui = (opts.gui + 1) % 5;
  if (button('View Bobbing: ' + (opts.bob ? 'ON' : 'OFF'), x + 160, y, 150)) opts.bob = !opts.bob;
  if (button('Clouds: ' + (opts.clouds ? 'Fancy' : 'OFF'), x, y + 24, 150)) opts.clouds = !opts.clouds;
  if (button('Smooth Lighting: ' + (opts.smooth ? 'ON' : 'OFF'), x + 160, y + 24, 150)) { opts.smooth = !opts.smooth; }
  { const k = +opts.shaders || 0; if (button('Shaders: ' + (k ? SHADER_PACKS[k].name : 'OFF'), x, y + 72, 150)) { opts.shaders = (k + 1) % SHADER_PACKS.length; if (opts.shaders) opts.clouds = true; } }
  if (button('Show FPS: ' + (opts.fps ? 'ON' : 'OFF'), x, y + 48, 150)) opts.fps = !opts.fps;
  opts.rd = Math.round(2 + slider('rd2', 'Render Distance: ' + opts.rd + ' chunks', x + 160, y + 48, 150, (opts.rd - 2) / 30) * 30);
  if (button('Auto Performance: ' + (opts.autoPerf ? 'ON' : 'OFF'), x, y + 96, 150)) opts.autoPerf = !opts.autoPerf;
  if (button('3D Quality: ' + ((opts.mres || 1.5) >= 1.5 ? 'High' : opts.mres >= 1 ? 'Normal' : 'Low'), x + 160, y + 96, 150)) { opts.mres = (opts.mres || 1.5) >= 1.5 ? 1 : opts.mres >= 1 ? .7 : 1.5; S.forceScale = 1; S.perfScale = 1; resize(); }
  textC('§7' + (GL1 ? 'Compatibility graphics (WebGL 1)' : 'WebGL 2') + (LOW_END ? ' - low-power device' : ''), UW / 2, y + 122, '#FFFFFF');
  const nC = Math.round(Math.PI * (opts.rd + 1.5) ** 2); textC('About ' + nC + ' chunks loaded' + (opts.rd > 16 ? ' - needs a powerful computer' : ''), UW / 2, y + 134, opts.rd > 16 ? '#FFAA00' : '#A0A0A0');
  if (button('Done', UW / 2 - 100, UH / 6 + 168)) { saveOpts(); go('options'); }
}
function scrSound() {
  screenBg(); header('Music & Sound Options'); const x = UW / 2 - 155, y = UH / 6 - 12;
  const sl = (id, label, X, Y) => { const v = slider(id, label + ': ' + (opts[id] ? Math.round(opts[id] * 100) + '%' : 'OFF'), X, Y, 150, opts[id]); if (v != opts[id]) { opts[id] = v; saveOpts(); } };
  sl('master', 'Master Volume', UW / 2 - 155, y); sl('music', 'Music', x, y + 24); sl('blocks', 'Blocks', x + 160, y + 24); sl('mobs', 'Friendly Creatures', x, y + 48); sl('ambient', 'Ambient/Environment', x + 160, y + 48); sl('ui', 'Interface', x, y + 72);
  const st = SND.idx ? `§aLoaded: ${SND.packName} (${SND.idx.size} sounds)` : S.msg || '§7No sound pack loaded';
  textC(st, UW / 2, y + 104, '#FFFFFF');
  if (button(SND.idx ? 'Change Sound Pack (.zip)' : 'Load Sound Pack (.zip)', x, y + 118, 150)) pickSoundPack();
  if (button('Remove Sound Pack', x + 160, y + 118, 150, 20, !!SND.idx)) { SND.stopMusic(); SND.idx = null; SND.buf = null; PackStore.clear(); S.msg = ''; }
  textC('Pick a Minecraft-format sound resource pack .zip from', UW / 2, y + 146, '#A0A0A0'); textC('your computer. It is read in your browser and remembered locally.', UW / 2, y + 157, '#A0A0A0');
  if (button('Done', UW / 2 - 100, UH / 6 + 180)) { saveOpts(); go(S.prev == 'title' || !world ? (world ? 'options' : 'title') : 'options'); }
}
function pickSoundPack() {
  const inp = document.getElementById('packfile'); inp.value = ''; inp.click();
}
async function loadPackFile(f, remember) {
  S.msg = '§eReading ' + f.name + '...';
  try { const n = await SND.loadZip(f, f.name.replace(/\.zip$/i, '')); S.msg = ''; if (remember) PackStore.save(f); SND.ensure(); SND.stopMusic(); if (!world) SND.playMusic('menu'); return n; }
  catch (e) { S.msg = '§c' + e.message; }
}
const CONTROLS = [['Walk', 'W A S D'], ['Jump / Swim up', 'Space'], ['Sneak', 'Shift'], ['Sprint', 'Ctrl or double-tap W'], ['Fly (Creative)', 'Double-tap Space'], ['Attack / Destroy', 'Left Button'],
  ['Use Item / Place Block', 'Right Button'], ['Pick Block', 'Middle Button'], ['Inventory', 'E'], ['Drop Item', 'Q'], ['Hotbar Slots', '1 - 9 / Scroll'], ['Open Chat', 'T'], ['Open Command', '/'],
  ['Third Person', 'F5'], ['Hide HUD', 'F1'], ['Take Screenshot', 'F2'], ['Debug Screen', 'F3'], ['Pause', 'Esc'], ['', ''], ['§eController', ''], ['Move / Look', 'Left / Right stick'], ['Jump / Sneak', 'A / B'],
  ['Attack / Use', 'RT / LT'], ['Hotbar', 'LB / RB'], ['Inventory / Drop', 'Y / X'], ['Pause / Chat', 'Start / Back'], ['', ''], ['§eTouch', ''], ['Move', 'Left joystick'], ['Look', 'Drag right side'], ['Place / Use', 'Tap'], ['Break / Attack', 'Hold'], ['Menus: right-click', 'Long press']];
function scrControls() {
  screenBg(); header('Controls'); const top = 32, bottom = UH - 36; listFrame(top, bottom);
  if (mouse.wheel) S.scroll = clamp(S.scroll + mouse.wheel * 12, 0, Math.max(0, CONTROLS.length * 12 - (bottom - top) + 12));
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  CONTROLS.forEach(([a, b], i) => { const y = top + 6 + i * 12 - S.scroll; if (y > bottom - 10 || y < top) return; text(a, UW / 2 - 150, y, '#FFFFFF'); text(b, UW / 2 + 150 - textW(b), y, '#FFFF80'); }); cx2.restore();
  if (button('Done', UW / 2 - 100, UH - 28)) go('options');
}
// ---------- in-game menus ----------
function scrPause() {
  cx2.fillStyle = S.bedrock ? 'rgba(30,30,31,.75)' : 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  if (S.bedrock) header('Game Menu'); else textC('Game Menu', UW / 2, 40, '#FFFFFF'); const x = UW / 2 - 102, y = UH / 4 + 8;
  if (button('Back to Game', x, y, 204)) go('game');
  if (button('Advancements', x, y + 24, 98)) go('advancements');
  if (button('Statistics', x + 106, y + 24, 98)) go('stats');
  if (button('Skins', x, y + 48, 98)) go('skins');
  { // multiplayer: host opens the world, friends see who's connected
    const remote = world && world.meta.remote, lbl = remote ? 'Online' : NET.role == 'host' ? (NET.code ? 'Code: ' + NET.code : 'Opening...') : 'Open to Friends';
    if (button(lbl, x + 106, y + 48, 98, 20, !remote && NET.role != 'host')) { netHost().catch(e => chat('§c' + e.message)); }
    if (NET.role == 'host' && NET.code) textC('§7Friends join with code §e' + NET.code + '§7 (' + NET.conns.size + ' connected)', UW / 2, y + 122, '#FFFFFF');
    else if (remote) textC('§7Playing on a friend\'s world', UW / 2, y + 122, '#FFFFFF'); }
  if (button('Options...', x, y + 72, 98)) go('options');
  if (button('Mods', x + 106, y + 72, 98)) { S.modmsg = ''; go('mods'); }
  if (button('Save and Quit to Title', x, y + 96, 204)) quitWorld();
}
function scrStats() {
  screenBg(); header('Statistics'); const st = player.stats; const top = 32, bottom = UH - 36; listFrame(top, bottom);
  const rows = [['Time Played', fmtTime(st.time)], ['Blocks Mined', st.mined], ['Blocks Placed', st.placed], ['Distance Walked', (st.walk / 1000).toFixed(2) + ' km'], ['Distance Flown', (st.fly / 1000).toFixed(2) + ' km'],
    ['Jumps', st.jumps], ['Mobs Killed', st.kills], ['Damage Taken', (st.dmg / 2).toFixed(1) + ' ♥'.replace('♥', 'hearts')], ['Deaths', st.deaths], ['Items Crafted', st.crafted], ['Items Smelted', st.smelted], ['Food Eaten', st.eaten]];
  rows.forEach(([a, b], i) => { const y = top + 8 + i * 12; text(a, UW / 2 - 120, y, '#FFFFFF'); const s = '' + b; text(s, UW / 2 + 120 - textW(s), y, '#FFFFFF'); });
  if (button('Done', UW / 2 - 100, UH - 28)) go('pause');
}
const fmtTime = s => { s = s | 0; const h = s / 3600 | 0, m = (s / 60 | 0) % 60; return (h ? h + ' h ' : '') + m + ' min ' + (s % 60) + ' s'; };
const ADV = [['wood', 'Getting Wood', 'Punch a tree until a block of wood pops out', 'oak_log'], ['bench', 'Benchmarking', 'Craft a workbench with four blocks of planks', 'crafting_table'],
  ['pick', 'Time to Mine!', 'Use planks and sticks to make a pickaxe', 'item:wooden_pickaxe'], ['stone', 'Stone Age', 'Mine Stone with your new Pickaxe', 'cobblestone'],
  ['furnace', 'Hot Topic', 'Construct a furnace out of eight cobblestone blocks', 'furnace'], ['iron', 'Acquire Hardware', 'Smelt an Iron Ingot', 'item:iron_ingot'],
  ['bread', 'Bake Bread', 'Turn wheat into bread', 'item:bread'], ['diamond', 'Diamonds!', 'Acquire diamonds', 'item:diamond'], ['kill', 'Monster Hunter', 'Defeat a creature', 'item:iron_sword'],
  ['eat', 'Husbandry', 'Eat something', 'item:apple'], ['deep', 'Deeper and Deeper', 'Reach deepslate depth', 'deepslate']];
function award(id) {
  if (!player || player.adv[id]) return; player.adv[id] = Date.now(); const a = ADV.find(a => a[0] == id); if (!a) return;
  toasts.push({ t: 0, title: 'Advancement Made!', name: a[1], icon: itemKey(a[3]) }); SND.play('levelup', .3, 1.3); earn(25);
  chat(`§f${player.name} has made the advancement §a[${a[1]}]`);
}
function scrAdvancements() {
  screenBg(); header('Advancements'); const top = 32, bottom = UH - 36; listFrame(top, bottom);
  ADV.forEach((a, i) => {
    const x = UW / 2 - 140 + (i % 2) * 145, y = top + 8 + (i >> 1) * 28, got = player.adv[a[0]];
    nine('tooltip_background', x, y, 138, 24, 10, 10, 10, 10); drawIcon(itemKey(a[3]), x + 4, y + 4); if (!got) { cx2.fillStyle = 'rgba(0,0,0,.6)'; cx2.fillRect(x + 4, y + 4, 16, 16); }
    text(a[1], x + 24, y + 4, got ? '#FFFF55' : '#808080'); let d = a[2]; while (textW(d) > 110) d = d.slice(0, -1); text(d + (d != a[2] ? '…'.replace('…', '..') : ''), x + 24, y + 14, '#A0A0A0', false);
  });
  if (button('Done', UW / 2 - 100, UH - 28)) go('pause');
}
function scrDeath() {
  const g = cx2.createLinearGradient(0, 0, 0, UH); g.addColorStop(0, 'rgba(80,0,0,.38)'); g.addColorStop(1, 'rgba(160,32,32,.63)'); cx2.fillStyle = g; cx2.fillRect(0, 0, UW, UH);
  cx2.save(); cx2.scale(2, 2); textC(world.meta.mode == 'hardcore' ? 'Game over!' : 'You Died!', UW / 4, 30, '#FFFFFF'); cx2.restore();
  textC(player.deathMsg || '', UW / 2, 85, '#FFFFFF'); textC('Score: §e' + player.score, UW / 2, 100, '#FFFFFF');
  if (S.deathT === undefined) S.deathT = performance.now();
  const en = performance.now() - S.deathT > 1000;
  if (world.meta.mode == 'hardcore') { if (button('Spectate World', UW / 2 - 100, UH / 4 + 72, 200, 20, en)) { S.deathT = undefined; player.mode = 'spectator'; world.meta.dead = true; player.hp = 20; player.dead = false; player.fly = true; go('game'); } }
  else if (button('Respawn', UW / 2 - 100, UH / 4 + 72, 200, 20, en)) { S.deathT = undefined; respawn(); go('game'); }
  if (button('Title Screen', UW / 2 - 100, UH / 4 + 96, 200, 20, en)) { S.deathT = undefined; if (world.meta.mode != 'hardcore') respawn(); quitWorld(); }
}
function scrLoading() {
  tiledBg('menu_background', .55);
  textC(S.loadTitle || 'Loading', UW / 2, UH / 2 - 30, '#FFFFFF');
  textC(S.loadSub || '', UW / 2, UH / 2 - 16, '#A0A0A0');
  const w = 160, x = UW / 2 - 80, y = UH / 2; cx2.fillStyle = '#fff'; cx2.fillRect(x - 1, y - 1, w + 2, 6); cx2.fillStyle = '#000'; cx2.fillRect(x, y, w, 4); cx2.fillStyle = '#80ff20'; cx2.fillRect(x, y, w * S.loadP, 4);
  textC(Math.round(S.loadP * 100) + '%', UW / 2, y + 12, '#FFFFFF');
}

// ---------- containers / inventory ----------
let carried = null;
const cloneSt = s => s ? { k: s.k, c: s.c, dmg: s.dmg } : null;
function giveItem(k, c, dmg) {
  const inv = player.inv, mx = MAXSTACK(k);
  for (let pass = 0; pass < 2 && c > 0; pass++) for (let i = 0; i < 36 && c > 0; i++) {
    const s = inv[i];
    if (pass == 0 && s && s.k == k && !s.dmg && !dmg && s.c < mx) { const a = Math.min(mx - s.c, c); s.c += a; c -= a; }
    else if (pass == 1 && !s) { const a = Math.min(mx, c); inv[i] = { k, c: a, dmg }; c -= a; }
  }
  return c; // leftover
}
// slot: {x,y,get,set,type}
function slotsPlayer(ox, oy, hotbarY) {
  const out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const i = 9 + r * 9 + c; out.push({ x: ox + c * 18, y: oy + r * 18, get: () => player.inv[i], set: v => player.inv[i] = v, grp: 'main' }); }
  for (let c = 0; c < 9; c++) out.push({ x: ox + c * 18, y: hotbarY, get: () => player.inv[c], set: v => player.inv[c] = v, grp: 'hot' });
  return out;
}
function handleSlots(slots, gx, gy, onShift) {
  let hov = null;
  for (const s of slots) {
    const x = gx + s.x, y = gy + s.y, st = s.get();
    if (s.type != 'output' || st) drawStack(st, x, y);
    if (hover(x - 1, y - 1, 18, 18)) {
      hov = s; cx2.fillStyle = 'rgba(255,255,255,.5)'; cx2.fillRect(x, y, 16, 16);
    }
  }
  if (hov) {
    const st = hov.get();
    if ((mouse.click || mouse.rclick) && !clickUsed) {
      clickUsed = true; const right = mouse.rclick;
      if (hov.type == 'creative') {
        if (carried) carried = null;
        else if (st) carried = { k: st.k, c: right ? 1 : MAXSTACK(st.k) };
      } else if (hov.type == 'trash') { carried = null; }
      else if (hov.type == 'output') {
        if (st && mouse.shift) { let n = 0; while (hov.get() && n < 64) { const o = hov.get(); if (giveItem(o.k, o.c) > 0) break; hov.take(); n++; } }
        else if (st && (!carried || (carried.k == st.k && carried.c + st.c <= MAXSTACK(st.k)))) { if (carried) carried.c += st.c; else carried = cloneSt(st); hov.take(); }
      } else if (mouse.shift && st && onShift) { onShift(hov); }
      else if (hov.accept && carried && !hov.accept(carried.k)) { }
      else if (!right) {
        if (!carried) { carried = st; hov.set(null); }
        else if (!st) { hov.set(carried); carried = null; }
        else if (st.k == carried.k && !st.dmg && !carried.dmg) { const mx = MAXSTACK(st.k), a = Math.min(mx - st.c, carried.c); st.c += a; carried.c -= a; if (!carried.c) carried = null; }
        else { hov.set(carried); carried = st; }
      } else {
        if (!carried && st) { const h = Math.ceil(st.c / 2); carried = { k: st.k, c: h, dmg: st.dmg }; st.c -= h; if (!st.c) hov.set(null); }
        else if (carried && (!st || (st.k == carried.k && st.c < MAXSTACK(st.k)))) { if (!st) hov.set({ k: carried.k, c: 1, dmg: carried.dmg }); else st.c++; carried.c--; if (!carried.c) carried = null; }
      }
      if (hov.changed) hov.changed();
    }
    if (st && !carried) S.tip = [prettyName(st.k), ...(st.dmg ? ['Durability: ' + (toolDurability(st.k) - st.dmg) + ' / ' + toolDurability(st.k)] : []), ...(foodVal(st.k) ? ['§9Restores ' + foodVal(st.k) / 2 + ' hunger'] : []), '§8minecraft:' + keyName(st.k)];
  }
  return hov;
}
function shiftPlayer(s) { // move between hotbar and main
  const st = s.get(); s.set(null); const range = s.grp == 'hot' ? [9, 36] : [0, 9]; let c = st.c;
  for (let i = range[0]; i < range[1] && c; i++) { const t = player.inv[i]; if (t && t.k == st.k && t.c < MAXSTACK(t.k) && !t.dmg) { const a = Math.min(MAXSTACK(t.k) - t.c, c); t.c += a; c -= a; } }
  for (let i = range[0]; i < range[1] && c; i++) if (!player.inv[i]) { player.inv[i] = { k: st.k, c, dmg: st.dmg }; c = 0; }
  if (c) s.set({ k: st.k, c, dmg: st.dmg });
}
function moveInto(st, list) { let c = st.c; for (const s of list) { const t = s.get(); if (t && t.k == st.k && t.c < MAXSTACK(t.k) && !t.dmg) { const a = Math.min(MAXSTACK(t.k) - t.c, c); t.c += a; c -= a; } if (!c) return 0; } for (const s of list) if (!s.get() && (!s.accept || s.accept(st.k))) { s.set({ k: st.k, c, dmg: st.dmg }); return 0; } return c; }
function drawCarried() { if (carried) drawStack(carried, mouse.x - 8, mouse.y - 8); }
function craftSlots(grid, w, ox, oy, outX, outY) {
  const out = [];
  for (let i = 0; i < w * w; i++) out.push({ x: ox + (i % w) * 18, y: oy + (i / w | 0) * 18, get: () => grid[i], set: v => grid[i] = v, grp: 'craft' });
  const res = () => craft(grid, w);
  out.push({ x: outX, y: outY, type: 'output', get: res, take: () => { const r = res(); if (!r) return; for (let i = 0; i < grid.length; i++) if (grid[i]) { grid[i].c--; if (!grid[i].c) grid[i] = null; } player.stats.crafted += r.c; onCrafted(r.k); } });
  return out;
}
function onCrafted(k) { const n = keyName(k); if (n == 'crafting_table') award('bench'); if (/_pickaxe$/.test(n)) award('pick'); if (n == 'furnace') award('furnace'); if (n == 'bread') award('bread'); }
function returnGrid(grid) { for (let i = 0; i < grid.length; i++) if (grid[i]) { const l = giveItem(grid[i].k, grid[i].c, grid[i].dmg); if (l) dropItem(grid[i].k, l); grid[i] = null; } }
function closeContainer() {
  if (S.screen == 'inventory' && player.craft2) returnGrid(player.craft2);
  if (S.screen == 'crafting' && S.grid3) returnGrid(S.grid3);
  if (S.screen == 'chest') { SND.play(S.cpos && BL[world.get(...S.cpos)]?.n == 'barrel' ? 'block/barrel/close' : 'chestclosed', .5, 1, S.cpos); if (S.cpos) lidOpen(S.cpos[0], S.cpos[1], S.cpos[2], 0); }
  if (carried) { const l = giveItem(carried.k, carried.c, carried.dmg); if (l) dropItem(carried.k, l); carried = null; }
  go('game');
}
function drawPlayerDoll(x, y, h, img) { // simple paper doll of the player skin (front view)
  const im = img || IMG.steve; if (!im) return; const s = im.width / 64, u = h / 32;
  const d = (sx, sy, sw, sh, dx, dy) => cx2.drawImage(im, sx * s, sy * s, sw * s, sh * s, x + dx * u, y + dy * u, sw * u, sh * u);
  d(8, 8, 8, 8, -4, 0); d(40, 8, 8, 8, -4, 0); d(20, 20, 8, 12, -4, 8); d(44, 20, 4, 12, -8, 8); d(36, 52, 4, 12, 4, 8); d(4, 20, 4, 12, -4, 20); d(20, 52, 4, 12, 0, 20);
}
function scrInventory() {
  if (player.mode == 'creative') return scrCreative();
  cx2.fillStyle = 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  const W = 176, H = 166, gx = Math.round(UW / 2 - W / 2), gy = Math.round(UH / 2 - H / 2);
  spr('inventory', gx, gy, W, H, 0, 0, W, H);
  cx2.save(); cx2.beginPath(); cx2.rect(gx + 26, gy + 8, 49, 70); cx2.clip(); cx2.fillStyle = '#000'; cx2.fillRect(gx + 26, gy + 8, 49, 70); drawPlayerDoll(gx + 51, gy + 12, 62); cx2.restore();
  text('Crafting', gx + 97, gy + 6, '#404040', false);
  const armor = [0, 1, 2, 3].map(i => ({ x: 8, y: 8 + i * 18, get: () => player.armor[i], set: v => player.armor[i] = v, accept: k => ARMOR(k) && ARMOR(k).slot == i || (i == 0 && keyName(k) == 'carved_pumpkin') }));
  const off = [{ x: 77, y: 62, get: () => player.offhand, set: v => player.offhand = v }];
  const pl = slotsPlayer(8, 84, 142), cr = craftSlots(player.craft2, 2, 98, 18, 154, 28);
  handleSlots([...armor, ...off, ...pl, ...cr], gx, gy, s => {
    if (s.grp == 'craft') { const st = s.get(); s.set(null); const l = giveItem(st.k, st.c, st.dmg); if (l) s.set({ k: st.k, c: l }); return; }
    const st = s.get(), a = ARMOR(st.k);
    if (a && !player.armor[a.slot] && s.grp) { player.armor[a.slot] = st; s.set(null); const mt = keyName(st.k).split('_')[0]; SND.play('item/armor/equip_' + ({ golden: 'gold', chainmail: 'chain' }[mt] || (['iron', 'diamond', 'leather', 'netherite'].includes(mt) ? mt : 'generic')), 1); return; }
    if (!s.grp) { s.set(null); const l = giveItem(st.k, st.c, st.dmg); if (l) s.set({ k: st.k, c: l, dmg: st.dmg }); return; }
    shiftPlayer(s);
  });
  drawCarried();
}
function scrCrafting() {
  cx2.fillStyle = 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  const W = 176, H = 166, gx = Math.round(UW / 2 - W / 2), gy = Math.round(UH / 2 - H / 2);
  spr('crafting_table', gx, gy, W, H, 0, 0, W, H); text('Crafting', gx + 29, gy + 6, '#404040', false); text('Inventory', gx + 8, gy + 72, '#404040', false);
  const pl = slotsPlayer(8, 84, 142), cr = craftSlots(S.grid3, 3, 30, 17, 124, 35);
  handleSlots([...pl, ...cr], gx, gy, s => { if (s.grp == 'craft') { const st = s.get(); s.set(null); const l = giveItem(st.k, st.c); if (l) s.set({ k: st.k, c: l }); } else shiftPlayer(s); });
  drawCarried();
}
function containerAt(p) { const k = p.join(','); return world.containers[k]; }
function scrCommandBlock() {
  tiledBg('menu_background', .55); header('Set Console Command');
  const w = Math.min(UW - 20, 320), x = UW / 2 - w / 2;
  text('Console Command', x, 44, '#A0A0A0'); textField('cmd', S.cmdEdit, 'cmd', x, 56, w);
  text('§7e.g. say Hello, time set day, summon zombie, setblock ~ ~1 ~ stone', x, 80, '#808080', false);
  const st = world.state[S.cmdKey] || {}; if (st.out) text('Previous Output: ' + st.out, x, 94, '#A0A0A0', false);
  const done = () => { (world.state[S.cmdKey] = world.state[S.cmdKey] || {}).cmd = S.cmdEdit.cmd.replace(/^\//, ''); world.dirty = true; };
  if (button('Done', UW / 2 - 102, UH - 40, 100, 20)) { done(); focus = null; go('game'); }
  if (button('Cancel', UW / 2 + 2, UH - 40, 100, 20)) { focus = null; go('game'); }
}
function runCommandBlock(cmd, x, y, z) {
  cmd = String(cmd || '').trim().replace(/^\//, ''); if (!cmd) return '';
  let out = '';
  const oc = world.meta.cheats; world.meta.cheats = true; const oldChat = chat; chat = m => { out = String(m).replace(/§./g, ''); if (cmd.startsWith('say ')) oldChat('[@] ' + cmd.slice(4)); };
  // ~ coordinates are relative to the command block
  try { const p = [player.x, player.y, player.z]; player.x = x + .5; player.y = y; player.z = z + .5; const tp = /^tp\b/.test(cmd); runCommand(cmd); if (!tp) { player.x = p[0]; player.y = p[1]; player.z = p[2]; } } catch (e) { out = e.message; }
  chat = oldChat; world.meta.cheats = oc; return out;
}
function scrChest() {
  cx2.fillStyle = 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  const C = S.cont, N = C.slots.length, cols = N == 9 ? 3 : N == 5 ? 5 : 9, rows = Math.ceil(N / cols), ox = (9 - cols) * 9, W = 176, H = 114 + rows * 18, gx = Math.round(UW / 2 - W / 2), gy = Math.round(UH / 2 - H / 2);
  spr('generic_54', gx, gy, W, rows * 18 + 17, 0, 0, W, rows * 18 + 17); spr('generic_54', gx, gy + rows * 18 + 17, W, 96, 0, 126, W, 96);
  text(S.contName, gx + 8, gy + 6, '#404040', false); text('Inventory', gx + 8, gy + rows * 18 + 20, '#404040', false);
  if (cols < 9) { cx2.fillStyle = '#C6C6C6'; cx2.fillRect(gx + 7, gy + 17, ox, rows * 18); cx2.fillRect(gx + 7 + ox + cols * 18, gy + 17, ox, rows * 18); }
  const cs = []; for (let i = 0; i < N; i++) cs.push({ x: 8 + ox + (i % cols) * 18, y: 18 + (i / cols | 0) * 18, get: () => C.slots[i], set: v => C.slots[i] = v, grp: 'cont' });
  const pl = slotsPlayer(8, rows * 18 + 31, rows * 18 + 89);
  handleSlots([...cs, ...pl], gx, gy, s => { const st = s.get(); s.set(null); const l = s.grp == 'cont' ? (giveItem(st.k, st.c, st.dmg)) : moveInto(st, cs); if (l) s.set({ k: st.k, c: l, dmg: st.dmg }); });
  drawCarried();
}
function scrFurnace() {
  cx2.fillStyle = 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  const W = 176, H = 166, gx = Math.round(UW / 2 - W / 2), gy = Math.round(UH / 2 - H / 2), F = S.cont;
  spr('furnace', gx, gy, W, H, 0, 0, W, H); textC(S.contName, gx + W / 2, gy + 6, '#404040', false); text('Inventory', gx + 8, gy + 72, '#404040', false);
  if (F.burn > 0) { const f = F.burn / F.burnMax, h = Math.ceil(14 * f); spr('container_furnace_lit_progress', gx + 56, gy + 36 + 14 - h, 14, h, 0, 14 - h, 14, h); }
  if (F.cook > 0) { const w = Math.ceil(24 * F.cook / 10); spr('container_furnace_burn_progress', gx + 79, gy + 34, w, 16, 0, 0, w, 16); }
  const fs = [{ x: 56, y: 17, get: () => F.slots[0], set: v => F.slots[0] = v, grp: 'cont' }, { x: 56, y: 53, get: () => F.slots[1], set: v => F.slots[1] = v, grp: 'cont', accept: k => fuelTime(k) > 0 },
    { x: 116, y: 35, type: 'output', get: () => F.slots[2], take: () => { F.slots[2] = null; } }];
  const pl = slotsPlayer(8, 84, 142);
  handleSlots([...fs, ...pl], gx, gy, s => { const st = s.get(); s.set(null); let l; if (s.grp == 'cont') l = giveItem(st.k, st.c, st.dmg); else if (smeltResult(st.k)) l = moveInto(st, [fs[0]]); else if (fuelTime(st.k)) l = moveInto(st, [fs[1]]); else { s.set(st); shiftPlayer(s); return; } if (l) s.set({ k: st.k, c: l, dmg: st.dmg }); });
  drawCarried();
}
function tickFurnaces(dt) {
  for (const key in world.containers) {
    const F = world.containers[key]; if (F.type != 'furnace') continue;
    const inp = F.slots[0], res = inp ? smeltResult(inp.k) : 0, out = F.slots[2];
    const can = res && (!out || (out.k == res && out.c < MAXSTACK(res)));
    if (F.burn > 0) F.burn -= dt;
    if (F.burn <= 0 && can && F.slots[1]) { const ft = fuelTime(F.slots[1].k); if (ft) { F.burn = F.burnMax = ft / 2; const fk = keyName(F.slots[1].k); F.slots[1].c--; if (!F.slots[1].c) F.slots[1] = fk == 'lava_bucket' ? { k: itemKey('item:bucket'), c: 1 } : null; } }
    if (F.burn > 0 && can) { F.cook += dt; if (F.cook >= 10) { F.cook = 0; inp.c--; if (!inp.c) F.slots[0] = null; if (out) out.c++; else F.slots[2] = { k: res, c: 1 }; player.stats.smelted++; if (keyName(res) == 'iron_ingot') award('iron'); } }
    else F.cook = Math.max(0, F.cook - dt * 2);
    if (F.burn < 0) F.burn = 0;
    { const [x, y, z] = key.split(',').map(Number), b = world.get(x, y, z), lit = F.burn > 0; if (b == BYNAME.furnace && lit) world.set(x, y, z, BYNAME.furnace_lit, false); else if (b == BYNAME.furnace_lit && !lit) world.set(x, y, z, BYNAME.furnace, false); }
  }
}
// ---- creative inventory ----
let CTABS;
function buildCreativeTabs() {
  const blocks = BL.slice(1).filter(b => !['water', 'lava', 'fire', 'soul_fire', 'nether_portal', 'redstone_wire'].includes(b.n) && !b.hide && !b.top);
  const items = ITEMS.map((n, i) => ({ n, k: ITEM_BASE + i })).filter(it => !BYNAME[it.n]);
  const isColored = n => /(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_(wool|concrete|concrete_powder|terracotta|glazed_terracotta|stained_glass|shulker_box|candle)$|^terracotta$|^glass$|^tinted_glass$|^candle$|^shulker_box$/.test(n);
  const isNatural = n => /(_ore$|leaves|sapling|_log$|stem$|^dirt|grass|sand$|gravel|clay|snow|ice|flower|tulip|poppy|dandelion|allium|bluet|orchid|daisy|cornflower|lily|rose|bush|fern|mushroom|coral|kelp|seagrass|sugar_cane|cactus|pumpkin|melon|moss|mud$|podzol|mycelium|nylium|netherrack|basalt|blackstone$|end_stone$|obsidian|bedrock|amethyst|dripstone|calcite|tuff$|deepslate$|^stone$|granite$|diorite$|andesite$|fungus|roots|vines|wart|sprouts|propagule|eyeblossom|torchflower|dry_grass|shrub|wheat|carrots|potatoes|beetroots|berry|lilac|peony|sunflower|azalea|cobweb|bone_block|magma|soul_s|glowstone|crying|sculk$|ancient_debris|sponge|hay_block|bamboo_stalk|sulfur$|cinnabar$|honeycomb)/.test(n);
  const isFunc = n => /(crafting_table|furnace|smoker|chest|barrel|anvil|grindstone|stonecutter|cartography|fletching|smithing|loom|lectern|enchanting|bookshelf|composter|cauldron|beacon|lodestone|respawn|bee|torch|lantern|chain|bars|jukebox|note_block|campfire|crafter|vault|trial_spawner|spawner|end_portal_frame|dragon_egg|heavy_core|creaking_heart|candle|froglight|sea_lantern|shroomlight|jack_o|end_rod|conduit)/.test(n);
  const isRed = n => /(redstone|piston|observer|dispenser|dropper|tnt|lamp|daylight|target|sculk_sensor|slime_block|honey_block|lever|repeater|comparator|hopper|rail|minecart|tripwire|button|pressure_plate|copper_bulb)/.test(n);
  const isOp = n => /command_block|jigsaw|structure|barrier|^light$|test_|debug_stick/.test(n);
  const isTool = n => /(_pickaxe|_axe|_shovel|_hoe|shears|flint_and_steel|bucket|compass|clock|fishing_rod|lead|name_tag|map|spyglass|brush|bundle|_boat|_raft|minecart|saddle|carrot_on_a_stick|warped_fungus_on_a_stick|music_disc|bone_meal|ender_pearl|ender_eye|firework|writable_book|book$|elytra|recovery)/.test(n);
  const isCombat = n => /(sword|bow$|crossbow|arrow|trident|shield|_helmet|_chestplate|_leggings|_boots|totem|mace|egg$|snowball|horse_armor|wind_charge|_spear|wolf_armor|nautilus_armor|turtle_helmet)/.test(n) && !/spawn_egg/.test(n);
  const isFood = n => !!FOOD[n] || /potion|stew|soup|cake|milk_bucket|honey_bottle|ominous_bottle/.test(n);
  const isEgg = n => /spawn_egg/.test(n);
  const B = f => blocks.filter(b => f(b.n)).map(b => b.id), It = f => items.filter(i => f(i.n)).map(i => i.k);
  const used = new Set();
  const take = arr => arr.filter(k => { if (used.has(k)) return false; used.add(k); return true; });
  const op = take([...B(isOp), ...It(isOp)]), colored = take(B(isColored)), red = take([...B(isRed), ...It(isRed)]), func = take(B(isFunc)), nat = take(B(isNatural));
  const eggs = take(It(n => isEgg(n) && MOBDEF[n.replace('_spawn_egg', '')])), tools = take(It(isTool)), combat = take(It(isCombat)), food = take(It(isFood));
  const build = take(blocks.map(b => b.id)); const ingr = take(items.map(i => i.k));
  const all = [...build, ...colored, ...nat, ...func, ...red, ...tools, ...combat, ...food, ...ingr, ...eggs, ...op];
  CTABS = [
    { name: 'Building Blocks', icon: itemKey('bricks'), list: build, row: 0, col: 0 }, { name: 'Colored Blocks', icon: itemKey('cyan_wool'), list: colored, row: 0, col: 1 },
    { name: 'Natural Blocks', icon: itemKey('grass_block'), list: nat, row: 0, col: 2 }, { name: 'Functional Blocks', icon: itemKey('crafting_table'), list: func, row: 0, col: 3 },
    { name: 'Redstone Blocks', icon: itemKey('item:redstone'), list: red, row: 0, col: 4 }, { name: 'Search Items', icon: itemKey('item:compass_00') || itemKey('item:compass'), list: all, row: 0, col: 6, search: true },
    { name: 'Tools & Utilities', icon: itemKey('item:diamond_pickaxe'), list: tools, row: 1, col: 0 }, { name: 'Combat', icon: itemKey('item:netherite_sword'), list: combat, row: 1, col: 1 },
    { name: 'Food & Drinks', icon: itemKey('item:golden_apple'), list: food, row: 1, col: 2 }, { name: 'Ingredients', icon: itemKey('item:iron_ingot'), list: ingr, row: 1, col: 3 },
    { name: 'Spawn Eggs', icon: itemKey('item:pig_spawn_egg'), list: eggs, row: 1, col: 4 }, { name: 'Operator Utilities', icon: itemKey('command_block'), list: op, row: 1, col: 5 },
    { name: 'Survival Inventory', icon: itemKey('chest'), list: null, row: 1, col: 6, inv: true }];
}
function scrCreative() {
  cx2.fillStyle = 'rgba(16,16,16,.6)'; cx2.fillRect(0, 0, UW, UH);
  const W = 195, H = 136, gx = Math.round(UW / 2 - W / 2), gy = Math.round(UH / 2 - H / 2 + 8), T = CTABS[S.ctab];
  const tabPos = t => [gx + (t.col == 6 ? W - 28 : t.col * 27), t.row == 0 ? gy - 28 : gy + H - 4];
  const drawTab = (t, i, sel) => { const [x, y] = tabPos(t); spr(`tab_${t.row ? 'bottom' : 'top'}_${sel ? 'selected' : 'unselected'}_${t.col + 1}`, x, y, 26, 32); drawIcon(t.icon, x + 5, y + (t.row ? 7 : 9)); };
  CTABS.forEach((t, i) => { if (i != S.ctab) drawTab(t, i, false); });
  spr(T.inv ? 'tab_inventory' : T.search ? 'tab_item_search' : 'tab_items', gx, gy, W, H, 0, 0, W, H);
  drawTab(T, S.ctab, true);
  CTABS.forEach((t, i) => { const [x, y] = tabPos(t); if (hover(x, y + (t.row ? 4 : 0), 26, 28)) { S.tip = [t.name]; if (mouse.click && !clickUsed) { clickUsed = true; S.ctab = i; S.cscroll = 0; SND.play('ui_click', .4); if (t.search) focus = 'csearch'; } } });
  text(T.search ? '' : T.name, gx + 8, gy + 6, '#404040', false);
  let slots = [];
  if (T.inv) {
    const armor = [0, 1, 2, 3].map(i => ({ x: 54 + (i >> 1) * 54, y: 6 + (i & 1) * 27, get: () => player.armor[i], set: v => player.armor[i] = v, accept: k => !!ARMOR(k) && ARMOR(k).slot == i }));
    slots = [...armor, { x: 35, y: 20, get: () => player.offhand, set: v => player.offhand = v }, ...slotsPlayer(9, 54, 112), { x: 173, y: 112, type: 'trash', get: () => null, set: () => { } }];
    cx2.save(); cx2.beginPath(); cx2.rect(gx + 73, gy + 6, 32, 43); cx2.clip(); drawPlayerDoll(gx + 89, gy + 8, 40); cx2.restore();
    handleSlots(slots, gx, gy, s => { const st = s.get(); s.set(null); if (s.grp) shiftPlayer(Object.assign({}, s, { get: () => st, set: v => s.set(v) })); else { const l = giveItem(st.k, st.c); if (l) s.set(st); } });
  } else {
    let list = T.list;
    if (T.search) { if (focus != 'csearch' && hover(gx + 80, gy + 4, 90, 12) && mouse.click) { focus = 'csearch'; clickUsed = true; } if (focus == 'csearch') { for (const k of keysPressed) if (k == 'Backspace') S.search.q = S.search.q.slice(0, -1); if (typed) S.search.q += typed; } text(S.search.q + (focus == 'csearch' && (performance.now() / 300 | 0) % 2 ? '_' : ''), gx + 82, gy + 6, '#FFFFFF'); const q = S.search.q.toLowerCase().replace(/ /g, '_'); if (q) list = list.filter(k => keyName(k).includes(q)); }
    const rows = Math.ceil(list.length / 9), maxS = Math.max(0, rows - 5);
    if (mouse.wheel && hover(gx, gy, W, H)) S.cscroll = clamp(S.cscroll + Math.sign(mouse.wheel), 0, maxS);
    if (mouse.down && hover(gx + 174, gy + 17, 14, 112) && maxS) S.dragScroll = true; if (!mouse.down) S.dragScroll = false;
    if (S.dragScroll) S.cscroll = clamp(Math.round((mouse.y - gy - 18 - 7) / (112 - 15) * maxS), 0, maxS);
    spr(maxS ? 'container_creative_inventory_scroller' : 'container_creative_inventory_scroller_disabled', gx + 175, gy + 18 + (maxS ? Math.round(S.cscroll / maxS * (112 - 15)) : 0), 12, 15);
    for (let i = 0; i < 45; i++) { const idx = (S.cscroll + (i / 9 | 0)) * 9 + i % 9; const k = list[idx]; slots.push({ x: 9 + (i % 9) * 18, y: 18 + (i / 9 | 0) * 18, type: 'creative', get: () => k ? { k, c: 1 } : null, set: () => { } }); }
    for (let c = 0; c < 9; c++) slots.push({ x: 9 + c * 18, y: 112, get: () => player.inv[c], set: v => player.inv[c] = v, grp: 'hot' });
    handleSlots(slots, gx, gy, s => { if (s.type == 'creative') { const st = s.get(); if (st) giveItem(st.k, MAXSTACK(st.k)); } else s.set(null); });
  }
  if (carried && mouse.click && !clickUsed && !hover(gx, gy - 28, W, H + 56)) { clickUsed = true; dropItem(carried.k, carried.c); carried = null; }
  drawCarried();
}
// ---------- chat ----------
const chatLog = [];
function chat(msg) { chatLog.push({ msg, t: performance.now() }); if (chatLog.length > 100) chatLog.shift(); }
function scrChat() {
  if (!S.chat) S.chat = { s: '' };
  for (const k of keysPressed) { if (k == 'Backspace') S.chat.s = S.chat.s.slice(0, -1); if (k == 'Enter') { const s = S.chat.s.trim(); S.chat = null; go('game'); if (s) { if (s[0] == '/') runCommand(s.slice(1)); else { chat(`<${player.name}> ${s}`); netOut({ t: 'chat', msg: `<${player.name}> ${s}` }); } S.history = S.history || []; S.history.push(s); } return; } if (k == 'ArrowUp' && S.history && S.history.length) S.chat.s = S.history[S.history.length - 1]; }
  if (typed) S.chat.s += typed;
  cx2.fillStyle = 'rgba(0,0,0,.5)'; cx2.fillRect(2, UH - 14, UW - 4, 12);
  text(S.chat.s + ((performance.now() / 300 | 0) % 2 ? '_' : ''), 4, UH - 12, '#FFFFFF');
  if (S.chat.s[0] == '/') { const parts = S.chat.s.slice(1).split(' '), last = parts[parts.length - 1]; let pool, hint = '';
    if (parts.length == 1) pool = CMDS; else { const g = CMD_ARGS[parts[0]]; const p = g && g[parts.length - 2]; pool = typeof p == 'function' ? p() : p; if (!pool && g) hint = ''; }
    const opts = (pool || []).filter(c => c.startsWith(last)).slice(0, 10);
    if (parts.length > 1 && CMD_ARGS[parts[0]] && !last && opts.length) text('§7What do you want? ' + opts.join(', '), 4, UH - 26 - opts.length * 12 - 12, '#FFFF55');
    if (opts.length) { if (keysPressed.includes('Tab')) S.chat.s = '/' + [...parts.slice(0, -1), opts[0]].join(' ') + ' '; cx2.fillStyle = 'rgba(0,0,0,.8)'; cx2.fillRect(4, UH - 16 - opts.length * 12, 120, opts.length * 12); opts.forEach((o, i) => { text((parts.length == 1 ? '/' : '') + o, 6, UH - 26 - i * 12, i ? '#AAAAAA' : '#FFFF55'); if (mouse.click && hover(4, UH - 28 - i * 12, 120, 12)) S.chat.s = '/' + [...parts.slice(0, -1), o].join(' ') + ' '; }); } }
}
const CMDS = ['nether', 'gamemode', 'time', 'weather', 'tp', 'give', 'kill', 'summon', 'seed', 'clear', 'effect', 'difficulty', 'spawnpoint', 'help', 'say', 'xp', 'fill', 'setblock'];
const CMD_ARGS = { weather: [['clear', 'rain', 'thunder']], time: [['set', 'add'], ['day', 'noon', 'night', 'midnight', '0', '6000', '12000', '18000']], gamemode: [['survival', 'creative', 'spectator', 'adventure']], difficulty: [['peaceful', 'easy', 'normal', 'hard']],
  summon: [() => Object.keys(MOBDEF)], give: [() => ['@s'], () => Object.keys(typeof BYNAME == 'object' ? BYNAME : {})], effect: [['give', 'clear'], ['@s'], ['speed', 'jump_boost', 'night_vision', 'regeneration', 'strength', 'invisibility', 'slow_falling', 'fire_resistance', 'water_breathing']], kill: [['@s', '@e']], clear: [['@s']], tp: [['~', '@s']] };
function runCommand(s) {
  const a = s.split(/\s+/), c = a[0]; const ok = world.meta.cheats || world.meta.mode == 'creative';
  if (MODS.cmds[c]) { try { MODS.cmds[c].fn(a.slice(1)); } catch (e) { chat('§c' + e.message); } return; }
  if (!ok && !['help', 'seed', 'say'].includes(c)) return chat('§cCommands are not allowed in this world');
  const num = (v, base) => v === undefined ? base : v[0] == '~' ? base + (parseFloat(v.slice(1)) || 0) : parseFloat(v);
  switch (c) {
    case 'nether': travel(); break;
    case 'help': chat('§eCommands: ' + [...CMDS, ...Object.keys(MODS.cmds)].map(c => '/' + c).join(' ')); break;
    case 'gamemode': { const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative', spectator: 'spectator', sp: 'spectator', 3: 'spectator', adventure: 'survival' }[a[1]]; if (!m) return chat('§cUnknown game mode'); player.mode = m; player.fly = m != 'survival' && player.fly || m == 'spectator'; chat(`Set own game mode to ${m[0].toUpperCase() + m.slice(1)} Mode`); break; }
    case 'time': { const v = a[2] == 'day' ? 1000 : a[2] == 'night' ? 13000 : a[2] == 'noon' ? 6000 : a[2] == 'midnight' ? 18000 : parseInt(a[2]); if (a[1] == 'set' && !isNaN(v)) { world.meta.time = v; chat('Set the time to ' + v); } else if (a[1] == 'add') { world.meta.time += parseInt(a[2]) || 0; } else if (a[1] == 'query') chat('The time is ' + (world.meta.time | 0)); break; }
    case 'weather': world.meta.rain = a[1] == 'rain' || a[1] == 'thunder'; world.meta.thunder = a[1] == 'thunder'; world.meta.weatherT = 300 + Math.random() * 600; chat('Changing the weather to ' + (a[1] || 'clear')); SND.setRain(world.meta.rain); break;
    case 'tp': { const x = num(a[1], player.x), y = num(a[2], player.y), z = num(a[3], player.z); if ([x, y, z].some(isNaN)) return chat('§cUsage: /tp x y z'); player.x = x; player.y = y; player.z = z; player.vy = 0; chat(`Teleported ${player.name} to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`); break; }
    case 'give': { const n = (a[1] || '').replace('minecraft:', ''), k = itemKey(n) || itemKey('item:' + n); if (!k) return chat('§cUnknown item: ' + n); const cnt = parseInt(a[2]) || 1; const l = giveItem(k, cnt); if (l) dropItem(k, l); chat(`Gave ${cnt} [${prettyName(k)}] to ${player.name}`); break; }
    case 'kill': hurtPlayer(1000, 'fell out of the world'.replace('fell out of the world', 'was killed')); break;
    case 'summon': { const t = (a[1] || '').replace('minecraft:', ''); if (!MOBDEF[t]) return chat('§cCan\'t summon ' + t + ': ' + Object.keys(MOBDEF).join(', ')); spawnMob(t, player.x + 1, player.y, player.z + 1); chat('Summoned new ' + prettyName(BYNAME[t] || 0).replace('?', t)); break; }
    case 'seed': chat('Seed: [§a' + world.seed + '§f]'); break;
    case 'clear': player.inv.fill(null); chat('Removed all items from ' + player.name); break;
    case 'difficulty': { const d = DIFFS.map(x => x.toLowerCase()).indexOf(a[1]); if (d >= 0) { world.meta.diff = d; chat('The difficulty has been set to ' + DIFFS[d]); } else chat('The difficulty is ' + DIFFS[world.meta.diff]); break; }
    case 'spawnpoint': player.spawn = [player.x, player.y, player.z]; chat('Set spawn point'); break;
    case 'say': chat(`[${player.name}] ${a.slice(1).join(' ')}`); break;
    case 'xp': addXp(parseInt(a[1]) || 0); break;
    case 'effect': chat('§7Effects are not available'); break;
    case 'setblock': { const x = num(a[1], Math.floor(player.x)), y = num(a[2], Math.floor(player.y)), z = num(a[3], Math.floor(player.z)), b = BYNAME[(a[4] || '').replace('minecraft:', '')]; if (b === undefined) return chat('§cUnknown block'); world.set(Math.floor(x), Math.floor(y), Math.floor(z), b); chat('Changed the block'); break; }
    case 'fill': { const p = a.slice(1, 7).map((v, i) => Math.floor(num(v, [player.x, player.y, player.z][i % 3]))), b = BYNAME[(a[7] || '').replace('minecraft:', '')]; if (b === undefined || p.some(isNaN)) return chat('§cUsage: /fill x1 y1 z1 x2 y2 z2 block'); let n = 0; for (let x = Math.min(p[0], p[3]); x <= Math.max(p[0], p[3]); x++) for (let y = Math.min(p[1], p[4]); y <= Math.max(p[1], p[4]); y++) for (let z = Math.min(p[2], p[5]); z <= Math.max(p[2], p[5]); z++) if (n++ < 32768) world.set(x, y, z, b); chat(`Successfully filled ${Math.min(n, 32768)} blocks`); break; }
    default: chat('§cUnknown command. Type /help for help');
  }
}
