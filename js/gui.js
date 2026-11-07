'use strict';
// ---------- 2D GUI layer: bitmap font, sprites, nine-slice, immediate-mode widgets ----------
let ui, cx2, GS = 2, UW = 0, UH = 0;
const mouse = { x: 0, y: 0, down: false, rdown: false, click: false, rclick: false, wheel: 0, shift: false, release: false };
let typed = '', keysPressed = [];
const GLYPH = new Uint8Array(256);
const fontCache = new Map();
function initGUI(canvas) {
  ui = canvas; cx2 = ui.getContext('2d');
  // glyph widths from ascii.png (16x16 grid)
  const f = IMG.font, cs = f.width / 16, c = document.createElement('canvas'); c.width = f.width; c.height = f.height;
  const g = c.getContext('2d'); g.drawImage(f, 0, 0); const px = g.getImageData(0, 0, f.width, f.height).data;
  for (let ch = 0; ch < 256; ch++) {
    const gx = (ch % 16) * cs, gy = Math.floor(ch / 16) * cs; let w = 0;
    for (let x = cs - 1; x >= 0 && !w; x--) for (let y = 0; y < cs; y++) if (px[((gy + y) * f.width + gx + x) * 4 + 3] > 0) { w = x + 1; break; }
    GLYPH[ch] = ch == 32 ? 4 : Math.ceil(w * 8 / cs) + 1;
  }
}
function fontImg(col) {
  let c = fontCache.get(col); if (c) return c;
  c = document.createElement('canvas'); c.width = IMG.font.width; c.height = IMG.font.height; const g = c.getContext('2d');
  g.drawImage(IMG.font, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  fontCache.set(col, c); return c;
}
const COLORS = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
const shadowOf = c => '#' + c.slice(1).match(/../g).map(h => (parseInt(h, 16) >> 2).toString(16).padStart(2, '0')).join('');
function textW(s, sc = 1) { let w = 0; for (let i = 0; i < s.length; i++) { if (s[i] == '§') { i++; continue; } const c = s.charCodeAt(i); w += (c < 256 ? GLYPH[c] : 6); } return w * sc; }
function text(s, x, y, col = '#FFFFFF', shadow = true, sc = 1) {
  if (shadow) drawText(s, x + sc, y + sc, shadowOf(col), sc, true);
  drawText(s, x, y, col, sc, false);
}
function drawText(s, x, y, col, sc, isShadow) {
  const cs = IMG.font.width / 16; let cur = col;
  for (let i = 0; i < s.length; i++) {
    if (s[i] == '§' && i + 1 < s.length) { const k = COLORS[s[++i]]; if (k) cur = isShadow ? shadowOf(k) : k; continue; }
    let c = s.charCodeAt(i); if (c > 255) c = 63;
    const img = fontImg(cur);
    cx2.drawImage(img, (c % 16) * cs, Math.floor(c / 16) * cs, cs, cs, x, y, 8 * sc, 8 * sc);
    x += GLYPH[c] * sc;
  }
}
const textC = (s, x, y, col, sh, sc = 1) => text(s, Math.round(x - textW(s, sc) / 2), y, col, sh, sc);
function spr(k, x, y, w, h, sx = 0, sy = 0, sw, sh) {
  const im = IMG[k]; if (!im) return;
  sw = sw ?? im.width / 2; sh = sh ?? im.height / 2;
  cx2.drawImage(im, sx * 2, sy * 2, sw * 2, sh * 2, x, y, w ?? sw, h ?? sh);
}
// nine-slice (borders in gui units of the source sprite's logical size)
function nine(k, x, y, w, h, bl, bt, br, bb) {
  const im = IMG[k]; if (!im) return; const s = im.width / ((ORIG[k] || im).width / 2), W = im.width / s, H = im.height / s;
  const nb = REG.nine && REG.nine[k]; if (nb) [bl, bt, br, bb] = nb;
  // snap to whole screen pixels so the nine pieces never leave hairline gaps
  const px = v => Math.round(v * GS) / GS; x = px(x); y = px(y); w = px(w); h = px(h);
  if (bl + br > w) { const f = w / (bl + br); bl *= f; br *= f; } if (bt + bb > h) { const f = h / (bt + bb); bt *= f; bb *= f; }
  bl = px(bl); br = px(br); bt = px(bt); bb = px(bb);
  const xs = [0, bl, W - br, W], ys = [0, bt, H - bb, H], dx = [x, x + bl, x + w - br, x + w], dy = [y, y + bt, y + h - bb, y + h];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const sw = xs[i + 1] - xs[i], sh = ys[j + 1] - ys[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j]; if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
    cx2.drawImage(im, Math.round(xs[i] * s), Math.round(ys[j] * s), Math.max(1, Math.round(sw * s)), Math.max(1, Math.round(sh * s)), dx[i], dy[j], dw + (i < 2 ? .01 : 0), dh + (j < 2 ? .01 : 0));
  }
}
function tiledBg(k, dark = 0.0, off = 0) {
  const im = IMG[k]; if (!im) { cx2.fillStyle = '#222'; cx2.fillRect(0, 0, UW, UH); return; }
  const t = im.width / 2;
  for (let x = 0; x < UW; x += t) for (let y = -((off | 0) % t); y < UH; y += t) cx2.drawImage(im, x, y, t, t);
  if (dark) { cx2.fillStyle = `rgba(0,0,0,${dark})`; cx2.fillRect(0, 0, UW, UH); }
}
const hover = (x, y, w, h) => mouse.x >= x && mouse.y >= y && mouse.x < x + w && mouse.y < y + h;
let clickUsed = false;
function button(label, x, y, w = 200, h = 20, enabled = true) {
  const hv = enabled && hover(x, y, w, h);
  nine(enabled ? (hv ? 'widget_button_highlighted' : 'widget_button') : 'widget_button_disabled', x, y, w, h, 20, 4, 20, 4);
  textC(label, x + w / 2, y + (h - 8) / 2, enabled ? (hv ? '#FFFFA0' : '#FFFFFF') : '#A0A0A0');
  if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); return true; }
  return false;
}
let dragSlider = null;
function slider(id, label, x, y, w, v) { // v 0..1 -> new v
  const hv = hover(x, y, w, 20);
  nine(hv ? 'widget_slider_highlighted' : 'widget_slider', x, y, w, 20, 20, 4, 20, 4);
  if (hv && mouse.click && !clickUsed) { clickUsed = true; dragSlider = id; }
  if (dragSlider == id) { if (!mouse.down) { dragSlider = null; SND.play('ui_click', .4); } else v = clamp((mouse.x - x - 4) / (w - 8), 0, 1); }
  nine(hv || dragSlider == id ? 'widget_slider_handle_highlighted' : 'widget_slider_handle', x + Math.round(v * (w - 8)), y, 8, 20, 2, 2, 2, 3);
  textC(label, x + w / 2, y + 6, hv ? '#FFFFA0' : '#FFFFFF');
  return v;
}
let focus = null, caret = 0;
function textField(id, obj, key, x, y, w, h = 20, placeholder = '') {
  const hv = hover(x, y, w, h);
  if (mouse.click && !clickUsed) { if (hv) { focus = id; clickUsed = true; } else if (focus == id) focus = null; }
  nine(focus == id ? 'widget_text_field_highlighted' : 'widget_text_field', x, y, w, h, 1, 1, 1, 1);
  if (focus == id) {
    for (const k of keysPressed) { if (k == 'Backspace') obj[key] = obj[key].slice(0, -1); }
    if (typed) obj[key] = (obj[key] + typed).slice(0, 64);
  }
  let s = obj[key]; while (textW(s) > w - 10 && s.length) s = s.slice(1);
  if (!s && focus != id) text(placeholder, x + 4, y + (h - 8) / 2, '#707070', false);
  else text(s + (focus == id && (performance.now() / 300 | 0) % 2 ? '_' : ''), x + 4, y + (h - 8) / 2, '#E0E0E0');
}
function tooltip(lines, x, y) {
  const w = Math.max(...lines.map(l => textW(l))) + 8, h = lines.length * 10 + 6;
  x = Math.min(x + 12, UW - w - 2); y = Math.max(2, y - 12);
  nine('tooltip_background', x - 3, y - 3, w + 6, h + 6, 10, 10, 10, 10);
  nine('tooltip_frame', x - 3, y - 3, w + 6, h + 6, 10, 10, 10, 10);
  lines.forEach((l, i) => text(l, x + 4, y + 4 + i * 10 + (i ? 2 : 0), i ? '#AAAAAA' : '#FFFFFF'));
}
function header(title) {
  textC(title, UW / 2, 15, '#FFFFFF');
}
function sepLines(top, bottom) {
  const hs = IMG.header_separator; if (!hs) return;
  for (let x = 0; x < UW; x += 32) { spr('header_separator', x, top - 2, 32, 2); spr('footer_separator', x, bottom, 32, 2); }
}
// ---------- item icons ----------
let ICONS; // canvas atlas for block icons (32px each)
function buildIcons() {
  ICONS = document.createElement('canvas'); const C = 32; ICONS.width = C * 32; ICONS.height = C * Math.ceil(NB / 32);
  const g = ICONS.getContext('2d'); g.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 32; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
  const bt = IMG.blocks.width / REG.cols, it = IMG.items.width / REG.icols; const tileTo = (t, dark) => { tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, 32, 32); tg.drawImage(IMG.blocks, (t % REG.cols) * bt, Math.floor(t / REG.cols) * bt, bt, bt, 0, 0, 32, 32); if (dark) { tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = `rgba(0,0,0,${dark})`; tg.fillRect(0, 0, 32, 32); } };
  for (let i = 1; i < NB; i++) {
    const ox = (i % 32) * C, oy = Math.floor(i / 32) * C;
    const itemTex = ITEMS.indexOf(BL[i].n);
    if (itemTex >= 0 && SHAPE[i] != 1) { g.drawImage(IMG.items, (itemTex % REG.icols) * it, Math.floor(itemTex / REG.icols) * it, it, it, ox, oy, 32, 32); continue; }
    if (SHAPE[i] == 2 || SHAPE[i] == 3 || SHAPE[i] == 4 || SHAPE[i] == 6 || (SHAPE[i] == 7 && !/button|pressure_plate/.test(BL[i].n))) { if (SHAPE[i] == 3) g.drawImage(IMG.water, 0, 0, IMG.water.width, IMG.water.width, ox, oy, 32, 32); else if (SHAPE[i] == 4) g.drawImage(IMG.lava, 0, 0, IMG.lava.width, IMG.lava.width, ox, oy, 32, 32); else { tileTo(BL[i].bx ? BL[i].bx[BL[i].bx.length > 1 ? 1 : 0][1] : TEX[i * 4]); g.drawImage(tmp, ox, oy); } continue; }
    const t = TEX.slice(i * 4, i * 4 + 4);
    const face = (tile, dark, m) => { tileTo(tile, dark); g.setTransform(1, 0, 0, 1, ox, oy); g.transform(...m); g.drawImage(tmp, 0, 0); };
    face(t[0], 0, [0.5, -0.25, 0.5, 0.25, 0, 8]); face(t[3], 0.2, [0.5, 0.25, 0, 0.5, 0, 8]); face(t[2], 0.4, [0.5, -0.25, 0, 0.5, 16, 16]);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
function drawIcon(k, x, y, s = 16) {
  if (!k) return;
  if (k >= ITEM_BASE) { const i = k - ITEM_BASE, it = IMG.items.width / REG.icols; cx2.drawImage(IMG.items, (i % REG.icols) * it, Math.floor(i / REG.icols) * it, it, it, x, y, s, s); }
  else cx2.drawImage(ICONS, (k % 32) * 32, Math.floor(k / 32) * 32, 32, 32, x, y, s, s);
}
function drawStack(st, x, y) {
  if (!st) return; drawIcon(st.k, x, y);
  if (st.c > 1) { const s = '' + st.c; text(s, x + 17 - textW(s), y + 9, '#FFFFFF'); }
  if (st.dmg) { const mx = toolDurability(st.k), f = 1 - st.dmg / mx; cx2.fillStyle = '#000'; cx2.fillRect(x + 2, y + 13, 13, 2); cx2.fillStyle = `hsl(${f * 120},100%,50%)`; cx2.fillRect(x + 2, y + 13, Math.round(12 * f), 1); }
}
