'use strict';
// ---------- Marketplace: free in-game coins earned by playing; skins, world templates, starter kits ----------
const PROFILE = Object.assign({ coins: 250, owned: ['skin_steve'], skin: 'steve', kit: null, lastDaily: 0 }, store.get('profile', {}));
const saveProfile = () => store.set('profile', PROFILE);
let earnAcc = 0;
function earn(n) { }
const SKINS = [['steve', 'Steve', 0], ['alex', 'Alex', 0], ['ari', 'Ari', 150], ['efe', 'Efe', 150], ['kai', 'Kai', 150], ['makena', 'Makena', 200], ['noor', 'Noor', 200], ['sunny', 'Sunny', 250], ['zuri', 'Zuri', 250]];
const KITS = {
  starter: ['Starter Kit', 100, 'Stone tools, food and torches to get going fast.', 'item:stone_pickaxe', [['item:stone_pickaxe', 1], ['item:stone_axe', 1], ['item:stone_sword', 1], ['item:bread', 16], ['torch', 32], ['crafting_table', 1]]],
  builder: ['Builder Kit', 200, 'A big pile of building blocks for your first base.', 'bricks', [['oak_planks', 64], ['cobblestone', 64], ['glass', 32], ['oak_door', 2], ['oak_slab', 32], ['bricks', 64], ['torch', 32]]],
  redstone: ['Redstone Kit', 250, 'Dust, torches, levers, lamps and pistons for your first machine.', 'item:redstone', [['item:redstone', 64], ['redstone_torch', 16], ['lever', 8], ['stone_button', 8], ['redstone_lamp', 8], ['piston', 8], ['sticky_piston', 4], ['note_block', 4], ['stone_pressure_plate', 4]]],
  explorer: ['Explorer Kit', 300, 'Iron gear, a bucket, food and a bed-less night of courage.', 'item:iron_sword', [['item:iron_pickaxe', 1], ['item:iron_sword', 1], ['item:iron_helmet', 1], ['item:iron_chestplate', 1], ['item:bucket', 1], ['item:cooked_beef', 16], ['torch', 64]]],
  nether: ['Nether Kit', 400, 'Obsidian and flint & steel to build a portal right away.', 'obsidian', [['obsidian', 14], ['item:flint_and_steel', 1], ['item:golden_helmet', 1], ['item:iron_pickaxe', 1], ['item:cooked_porkchop', 16]]],
  diamond: ['Diamond Kit', 800, 'Full diamond tools and armor. For when you mean business.', 'item:diamond', [['item:diamond_pickaxe', 1], ['item:diamond_sword', 1], ['item:diamond_axe', 1], ['item:diamond_helmet', 1], ['item:diamond_chestplate', 1], ['item:diamond_leggings', 1], ['item:diamond_boots', 1], ['item:golden_apple', 4]]],
};
const TEMPLATES = {
  flatlands: ['Creative Flatlands', 0, 'A superflat creative world. Build anything.', 'grass_block', { mode: 'creative', flat: true, seed: '' }],
  redlab: ['Redstone Lab', 150, 'Superflat creative world with the Redstone Kit in your hotbar.', 'redstone_lamp', { mode: 'creative', flat: true, seed: 'redstone', kit: 'redstone' }],
  hardcore: ['Hardcore Challenge', 200, 'One life. Hard difficulty. Starter Kit included.', 'item:skeleton_skull', { mode: 'hardcore', seed: 'hardcore', kit: 'starter' }],
  nether: ['Nether Adventure', 350, 'Start inside the Nether with the Nether Kit. Good luck.', 'netherrack', { mode: 'survival', seed: 'inferno', kit: 'nether', nether: 1 }],
  cozy: ['Peaceful Builder', 100, 'Peaceful survival with the Builder Kit. No monsters, just building.', 'oak_planks', { mode: 'survival', diff: 0, seed: 'cozy', kit: 'builder' }],
};
const MARKET = [];
for (const [id, n] of SKINS) MARKET.push({ id: 'skin_' + id, cat: 'Skin Packs', name: n, price: 0, desc: 'Default character skin. Free.', skin: id, by: 'Default' });
const CATS = ['Home', 'Skin Packs'];
const owns = id => true;
function applySkin() { const k = 'skin_' + PROFILE.skin; if (IMG[k]) { IMG.steve = IMG[k]; if (TEXS[k]) TEXS.steve = TEXS[k]; } }
function giveKit(k) { for (const [n, c] of KITS[k][4]) { const key = itemKey(n); if (!key) continue; const l = giveItem(key, c); if (l) dropItem(key, l); } chat('§aReceived the ' + KITS[k][0]); SND.play('levelup', .4); }
function skinHead(name, x, y, s) { const im = IMG['skin_' + name]; if (!im) return; const k = im.width / 64; cx2.drawImage(im, 8 * k, 8 * k, 8 * k, 8 * k, x, y, s, s); cx2.drawImage(im, 40 * k, 8 * k, 8 * k, 8 * k, x, y, s, s); }
function coinBadge(x, y) { const s = '' + PROFILE.coins; const w = textW(s) + 22; nine('tooltip_background', x - w, y, w, 16, 10, 10, 10, 10); drawIcon(itemKey('item:emerald'), x - w + 2, y); text(s, x - w + 19, y + 4, '#55FF55'); }
function cardArt(it, x, y, w, h) {
  if (it.pack) { const p = PACKS.find(q => q.id == it.pack); cx2.drawImage(packThumb(p), x, y, w, h); }
  else if (it.skin) { cx2.fillStyle = '#2a3a52'; cx2.fillRect(x, y, w, h); drawPlayerDoll(x + w / 2, y + 3, h - 6, IMG['skin_' + it.skin]); }
  else { const src = IMG.panorama_1; if (src) cx2.drawImage(src, src.width * .3, src.height * .3, src.width * .4, src.height * .4, x, y, w, h); drawIcon(itemKey(it.icon), x + w / 2 - 12, y + h / 2 - 12, 24); }
}
function marketCard(it, x, y, w, top, bottom) {
  const h = w * .75 + 26, hv = hover(x, y, w, h) && mouse.y > top && mouse.y < bottom;
  cx2.fillStyle = hv ? '#5b5b5b' : '#3c3c3c'; cx2.fillRect(x, y, w, h); cx2.fillStyle = '#1e1e1e'; cx2.fillRect(x, y + h - 1, w, 1);
  cardArt(it, x + 2, y + 2, w - 4, w * .75 - 4);
  let nm = it.name; while (textW(nm) > w - 6) nm = nm.slice(0, -1); text(nm, x + 3, y + w * .75 + 2, '#FFFFFF', false);
  const eq = it.skin && PROFILE.skin == it.skin || it.pack && PS.active == it.pack;
  if (eq) text('§aIn use', x + 3, y + w * .75 + 13, '#FFFFFF', false); else if (owns(it.id)) text('§7Owned', x + 3, y + w * .75 + 13, '#FFFFFF', false);
  else text('§aFree', x + 3, y + w * .75 + 13, '#FFFFFF', false);
  if (hv && mouse.click && !clickUsed) { clickUsed = true; S.mitem = it; SND.play('ui_click', .5); go('marketItem'); }
  return h;
}
function scrMarket() {
  cx2.fillStyle = '#262626'; cx2.fillRect(0, 0, UW, UH);
  cx2.fillStyle = '#121212'; cx2.fillRect(0, 0, UW, 24); text('Marketplace', 8, 8, '#FFFFFF');
  S.mcat = CATS.includes(S.mcat) ? S.mcat : 'Home';
  let tx = 90; for (const c of CATS) { const w = textW(c) + 14, sel = S.mcat == c, hv = hover(tx, 4, w, 18); if (sel || hv) { cx2.fillStyle = sel ? '#3c8527' : '#3a3a3a'; cx2.fillRect(tx, 4, w, 18); } textC(c, tx + w / 2, 9, '#FFFFFF'); if (hv && mouse.click && !clickUsed) { clickUsed = true; S.mcat = c; S.scroll = 0; SND.play('ui_click', .5); } tx += w + 4; }
  const top = 28, bottom = UH - 26; if (mouse.wheel) S.scroll = Math.max(0, S.scroll + mouse.wheel * 24);
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  let y = top + 6 - S.scroll; const mx = 10, cw = clamp(Math.floor((UW - 2 * mx - 4 * 6) / 5), 60, 110);
  if (S.mcat == 'Home') {
    // featured banner
    const feat = ['skin_sunny', 'skin_alex', 'skin_zuri', 'skin_kai'].map(id => MARKET.find(m => m.id == id)), fi = Math.floor(performance.now() / 5000) % feat.length, f = feat[fi];
    const bw = UW - 2 * mx, bh = Math.min(110, bw * .3); if (f.pack) cx2.drawImage(packBanner(PACKS.find(q => q.id == f.pack)), mx, y, bw, bh); else { const src = IMG.panorama_2; if (src) cx2.drawImage(src, 0, src.height * .3, src.width, src.width * bh / bw, mx, y, bw, bh); if (f.skin) drawPlayerDoll(mx + bw * .8, y + 6, bh - 12, IMG['skin_' + f.skin]); else drawIcon(itemKey(f.icon), mx + bw * .75, y + bh / 2 - 24, 48); } cx2.fillStyle = 'rgba(0,0,0,.55)'; cx2.fillRect(mx, y + bh - 30, bw, 30);
    text('§eFeatured: §f' + f.name, mx + 8, y + bh - 25, '#FFFFFF'); text(f.desc.slice(0, 70), mx + 8, y + bh - 13, '#CCCCCC', false);
    feat.forEach((_, i) => { cx2.fillStyle = i == fi ? '#fff' : '#777'; cx2.fillRect(UW - mx - 12 - (feat.length - i) * 8, y + 6, 5, 5); });
    if (hover(mx, y, bw, bh) && mouse.y > top && mouse.click && !clickUsed) { clickUsed = true; S.mitem = f; go('marketItem'); }
    y += bh + 10;
    for (const cat of CATS.slice(1)) {
      text(cat, mx, y, '#FFFFFF'); const sa = 'See all >', sw = textW(sa); text(sa, UW - mx - sw, y, hover(UW - mx - sw, y, sw, 9) ? '#FFFF80' : '#A0A0A0'); if (hover(UW - mx - sw, y, sw, 9) && mouse.click && !clickUsed) { clickUsed = true; S.mcat = cat; S.scroll = 0; }
      y += 12; let x = mx, rh = 0; for (const it of MARKET.filter(m => m.cat == cat).slice(0, Math.floor((UW - 2 * mx + 6) / (cw + 6)))) { rh = marketCard(it, x, y, cw, top, bottom); x += cw + 6; } y += rh + 12;
    }
  } else {
    text(S.mcat, mx, y, '#FFFFFF'); y += 14; const cols = Math.max(1, Math.floor((UW - 2 * mx + 6) / (cw + 6))); let rh = 0;
    MARKET.filter(m => m.cat == S.mcat).forEach((it, i) => { rh = marketCard(it, mx + (i % cols) * (cw + 6), y + Math.floor(i / cols) * (rh + 8 || cw), cw, top, bottom); });
    if (S.mcat == 'Texture Packs') { const n = Math.ceil(MARKET.filter(m => m.cat == S.mcat).length / cols); y += n * (rh + 8) + 4; if (button('Manage & Import Packs...', mx, y, 160)) go('packs'); }
  }
  cx2.restore();
  cx2.fillStyle = '#121212'; cx2.fillRect(0, UH - 24, UW, 24);
  if (button('Back', 6, UH - 22, 60)) go(world ? 'pause' : 'title');
  textC(S.mmsg || '§7More content coming soon. All skins are free.', UW / 2 + 20, UH - 16, '#FFFFFF');
}
function scrMarketItem() {
  screenBg(); const it = S.mitem; header(it.name); coinBadge(UW - 6, 6);
  const px = UW / 2 - 110, py = 40;
  nine('tooltip_background', px - 6, py - 4, 92, 120, 10, 10, 10, 10);
  cardArt(it, px - 4, py - 2, 88, 116);
  const tx = px + 100; text(it.name, tx, py, '#FFFF55'); text(it.cat.replace(/s$/, ''), tx, py + 12, '#A0A0A0');
  const words = it.desc.split(' '); let line = '', ly = py + 30; for (const w of words) { if (textW(line + w) > 130) { text(line, tx, ly, '#FFFFFF'); ly += 10; line = ''; } line += w + ' '; } text(line, tx, ly, '#FFFFFF');
  text('§7By ' + (it.by || 'Blockcraft'), tx, ly + 14, '#FFFFFF');
  const owned = owns(it.id), by = py + 96;
  if (!owned) {
    if (button('Buy for ' + it.price + ' coins', tx, by, 130, 20, PROFILE.coins >= it.price)) { PROFILE.coins -= it.price; PROFILE.owned.push(it.id); saveProfile(); SND.play('levelup', .5, 1.2); S.mmsg = '§aBought ' + it.name + '!'; }
    if (PROFILE.coins < it.price) textC('§cYou need ' + (it.price - PROFILE.coins) + ' more coins', tx + 65, by + 24, '#FFFFFF');
  } else if (it.pack) { if (button(PS.active == it.pack ? 'Active' : 'Activate Pack', tx, by, 130, 20, PS.active != it.pack)) { S.mmsg = '§eApplying ' + it.name + '...'; applyPack(it.pack, p => S.mmsg = '§eApplying... ' + Math.round(p * 100) + '%').then(() => S.mmsg = '§a' + it.name + ' is now active'); } textC(S.mmsg || '', tx + 65, by + 26, '#FFFFFF'); }
  else if (it.skin) { if (button(PROFILE.skin == it.skin ? 'Equipped' : 'Equip Skin', tx, by, 130, 20, PROFILE.skin != it.skin)) { PROFILE.skin = it.skin; saveProfile(); applySkin(); } }
  else if (it.kit) {
    if (button(PROFILE.kit == it.kit ? 'Starting kit: ON' : 'Use as starting kit', tx, by, 130)) { PROFILE.kit = PROFILE.kit == it.kit ? null : it.kit; saveProfile(); }
    if (world && player && player.mode != 'spectator') { if (button('Claim in this world', tx, by + 24, 130, 20, !(world.meta.claimed || []).includes(it.kit))) { world.meta.claimed = [...(world.meta.claimed || []), it.kit]; giveKit(it.kit); } }
  } else if (it.tpl) { if (button('Create World', tx, by, 130, 20, !world)) { const t = TEMPLATES[it.tpl][4]; createWorld({ name: it.name, seed: t.seed, mode: t.mode, diff: t.diff ?? 2, cheats: t.mode == 'creative', flat: !!t.flat, tab: 0, kit: t.kit, nether: t.nether }); } if (world) textC('§7Quit to the title screen to create it', tx + 65, by + 24, '#FFFFFF'); }
  if (button('Back', UW / 2 - 50, UH - 28, 100)) go('market');
}

// ---------- Skins screen (dressing room) ----------
function scrSkins() {
  screenBg(); header('Skins');
  const cx = UW / 2 - 90, cy = 40; nine('tooltip_background', cx - 50, cy - 6, 100, 150, 10, 10, 10, 10);
  const sel = S.skinSel || PROFILE.skin; drawPlayerDoll(cx, cy + 6, 128, IMG['skin_' + sel]);
  textC(SKINS.find(s => s[0] == sel)[1], cx, cy + 150, '#FFFF55');
  const gx = UW / 2 - 20, gy = 40;
  SKINS.forEach(([id, name], i) => {
    const x = gx + (i % 3) * 46, y = gy + Math.floor(i / 3) * 50, hv = hover(x, y, 42, 46), on = PROFILE.skin == id;
    cx2.fillStyle = on ? '#3c8527' : hv ? '#5b5b5b' : '#3c3c3c'; cx2.fillRect(x, y, 42, 46); skinHead(id, x + 9, y + 4, 24); let n = name; textC(n, x + 21, y + 33, '#FFFFFF');
    if (hv) { S.skinSel = id; if (mouse.click && !clickUsed) { clickUsed = true; PROFILE.skin = id; saveProfile(); applySkin(); SND.play('ui_click', .5); } }
  });
  if (!SKINS.some((s, i) => hover(gx + (i % 3) * 46, gy + Math.floor(i / 3) * 50, 42, 46))) S.skinSel = null;
  textC('§7Click a skin to wear it. All skins are free.', UW / 2, UH - 44, '#FFFFFF');
  if (button('Done', UW / 2 - 100, UH - 28)) go(world ? 'pause' : 'title');
}
