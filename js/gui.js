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
  if (S.bedrock && (k == 'menu_background' || k == 'menu_list_background')) { cx2.fillStyle = k == 'menu_background' ? BR.bg : BR.panel; cx2.fillRect(0, 0, UW, UH); return; }
  const im = IMG[k]; if (!im) { cx2.fillStyle = '#222'; cx2.fillRect(0, 0, UW, UH); return; }
  const t = im.width / 2;
  for (let x = 0; x < UW; x += t) for (let y = -((off | 0) % t); y < UH; y += t) cx2.drawImage(im, x, y, t, t);
  if (dark) { cx2.fillStyle = `rgba(0,0,0,${dark})`; cx2.fillRect(0, 0, UW, UH); }
}
const hover = (x, y, w, h) => mouse.x >= x && mouse.y >= y && mouse.x < x + w && mouse.y < y + h;
let clickUsed = false;
// ---------- Bedrock (phone/tablet) look: flat buttons, green main actions, dark header bar with a back arrow ----------
const BR = { face: '#6D6E70', faceHv: '#8A8B8D', faceDis: '#3A3B3D', edge: '#1E1E1F', shadow: '#2E2F30', hi: '#A0A1A3', green: '#3C8527', greenHv: '#4FA33A', greenShadow: '#1D4D13', bar: '#313233', bg: '#48494A', panel: '#3A3B3D' };
const BR_PRIMARY = /^(Play|Back to Game|Resume Game|Create New World|Create|Play Selected World|Respawn|Done|Save|Apply & Restart)$/;
function brButton(label, x, y, w, h, enabled, hv, primary) {
  x = Math.round(x); y = Math.round(y);
  const face = !enabled ? BR.faceDis : primary ? (hv ? BR.greenHv : BR.green) : hv ? BR.faceHv : BR.face, sh = !enabled ? BR.edge : primary ? BR.greenShadow : BR.shadow;
  cx2.fillStyle = BR.edge; cx2.fillRect(x, y, w, h);
  cx2.fillStyle = sh; cx2.fillRect(x + 1, y + h - 3, w - 2, 2);
  cx2.fillStyle = face; cx2.fillRect(x + 1, y + 1, w - 2, h - 4);
  if (enabled) { cx2.fillStyle = 'rgba(255,255,255,.22)'; cx2.fillRect(x + 1, y + 1, w - 2, 1); }
  textC(label, x + w / 2, y + (h - 8) / 2 - 1, enabled ? '#FFFFFF' : '#8A8A8A');
}
function button(label, x, y, w = 200, h = 20, enabled = true) {
  const hv = enabled && hover(x, y, w, h);
  if (S.bedrock) { brButton(label, x, y, w, h, enabled, hv, BR_PRIMARY.test(label)); if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); return true; } return false; }
  nine(enabled ? (hv ? 'widget_button_highlighted' : 'widget_button') : 'widget_button_disabled', x, y, w, h, 20, 4, 20, 4);
  textC(label, x + w / 2, y + (h - 8) / 2, enabled ? (hv ? '#FFFFA0' : '#FFFFFF') : '#A0A0A0');
  if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); return true; }
  return false;
}
let dragSlider = null;
function slider(id, label, x, y, w, v) { // v 0..1 -> new v
  const hv = hover(x, y, w, 20);
  if (S.bedrock) { // label above a green-filled track with a white knob
    if (hv && mouse.click && !clickUsed) { clickUsed = true; dragSlider = id; }
    if (dragSlider == id) { if (!mouse.down) { dragSlider = null; SND.play('ui_click', .4); } else v = clamp((mouse.x - x - 4) / (w - 8), 0, 1); }
    text(label, x + 2, y + 1, '#FFFFFF'); const ty = y + 13, kx = x + 4 + Math.round(v * (w - 8));
    cx2.fillStyle = BR.edge; cx2.fillRect(x, ty, w, 5); cx2.fillStyle = '#2A2B2C'; cx2.fillRect(x + 1, ty + 1, w - 2, 3); cx2.fillStyle = BR.green; cx2.fillRect(x + 1, ty + 1, kx - x - 1, 3);
    cx2.fillStyle = BR.edge; cx2.fillRect(kx - 4, ty - 3, 8, 11); cx2.fillStyle = hv || dragSlider == id ? '#FFFFFF' : '#E0E0E0'; cx2.fillRect(kx - 3, ty - 2, 6, 9);
    return v;
  }
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
    if (typed) obj[key] = (obj[key] + typed).slice(0, id == 'cmd' ? 256 : 64);
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
  if (S.bedrock) { // Bedrock title bar with a back arrow (same as Esc)
    cx2.fillStyle = BR.bar; cx2.fillRect(0, 0, UW, 24); cx2.fillStyle = BR.edge; cx2.fillRect(0, 24, UW, 1);
    textC(title, UW / 2, 8, '#FFFFFF');
    const hv = hover(4, 2, 30, 20); cx2.fillStyle = hv ? BR.faceHv : BR.face; cx2.fillRect(4, 3, 30, 18); cx2.fillStyle = BR.edge; cx2.fillRect(4, 19, 30, 2);
    cx2.fillStyle = '#FFFFFF'; for (let i = 0; i < 5; i++) { cx2.fillRect(14 + i, 12 - i, 1, 1 + 2 * i); } cx2.fillRect(19, 11, 7, 3); // arrow
    if (hv && mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); setTimeout(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape' })); }, 0); }
    return;
  }
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
  // shaped blocks with no item sprite get a real 3D icon
  const shaped = []; for (let i = 1; i < NB; i++) if ((SHAPE[i] == 7 || BL[i].mm || BL[i].mp) && ITEMS.indexOf(BL[i].n) < 0 && !BL[i].plant && !/^(redstone_wire|lily_pad|leaf_litter|wildflowers|pink_petals|ladder|vine|glow_lichen)$|rail$/.test(BL[i].n)) shaped.push(i);
  try { renderModelIcons(shaped); } catch (e) { console.warn('3D icons', e); }
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
// ---------- 3D icons for shaped blocks (stairs, anvils, pistons, gates, carpets...) ----------
// Renders each block's real geometry with the Minecraft inventory camera (30 deg tilt, 225 deg turn, 0.625 scale).
function blockIconGeom(i) {
  const out = [], b = BL[i], L = s => [s, 1, 1];
  if (b.mm) { emitMM(out, b.mm, 0, 0, 0, [0, 1, 0], [1, 1, 1], b.mr && !/piston/.test(b.n) ? b.mr : null); return out; }
  if (b.mp) { const k = b.mpk, c = { north: false, south: false, east: false, west: false, up: false, down: false };
    if (k == 'fence' || k == 'pane') { c.north = c.south = true; } else if (k == 'wall') { c.north = c.south = 'low'; c.east = c.west = 'none'; c.up = true; } else if (k == 'attach') c.south = true;
    emitMP(out, i, c, 0, 0, 0, [1, 1, 1]); return out; }
  for (const [BB, TT, FF] of (b.bx || [[b.bb || [0, 0, 0, 16, 16, 16], TEX[i * 4]]])) {
    const uv = tileUV(TT), uvS = b.sidev ? tileUV(TEX[i * 4 + 2]) : uv, bb = BB.map(v => v / 16), [X0, Y0, Z0, X1, Y1, Z1] = bb; let fi = 0;
    const Q = (C, u0, v0, u1, v1, s) => { let U = s == 1 || s == .5 ? uv : uvS; if (FF) { const fc = FF[fi++]; if (!fc) return; U = tileUV(fc[0]); if (fc.length == 5) { u0 = fc[1]; v0 = fc[2]; u1 = fc[3]; v1 = fc[4]; } } const f = (a, b2) => [lerp(U[0], U[2], a), lerp(U[1], U[3], b2)]; pushQuad(out, C, [f(u0, v1), f(u1, v1), f(u1, v0), f(u0, v0)], L(s)); };
    Q([[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], bb[0], bb[2], bb[3], bb[5], 1); Q([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], bb[0], bb[2], bb[3], bb[5], .5);
    Q([[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], bb[0], 1 - bb[4], bb[3], 1 - bb[1], .8); Q([[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], bb[0], 1 - bb[4], bb[3], 1 - bb[1], .8);
    Q([[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], bb[2], 1 - bb[4], bb[5], 1 - bb[1], .6); Q([[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], bb[2], 1 - bb[4], bb[5], 1 - bb[1], .6);
  }
  return out;
}
function renderModelIcons(list) {
  if (!gl || !list.length) return;
  const S = 64, fb = gl.createFramebuffer(), tex = gl.createTexture(), rb = gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.viewport(0, 0, S, S); gl.useProgram(PROG.p); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  const u = PROG.u; gl.uniform1f(u.uDay, 1); gl.uniform1f(u.uFogN, 1e5); gl.uniform1f(u.uFogF, 2e5); gl.uniform3f(u.uFog, 0, 0, 0); gl.uniform3f(u.uCam, 0, 0, 0);
  const k = 1.25, PV = M4.chain(M4.scale(k, -k, -.3), M4.rx(-30 * Math.PI / 180), M4.ry(-225 * Math.PI / 180), M4.trans(-.5, -.5, -.5));
  gl.uniformMatrix4fv(u.uPV, false, PV);
  const px = new Uint8Array(S * S * 4), cv = document.createElement('canvas'); cv.width = cv.height = S; const cg = cv.getContext('2d'), im = cg.createImageData(S, S), g = ICONS.getContext('2d');
  for (const i of list) {
    const geo = blockIconGeom(i); if (!geo.length) continue;
    const m = mkMesh(new Float32Array(geo));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawMesh(m, 'blocks', { alphaTest: .1, full: 1 }); freeMesh(m);
    gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let y = 0; y < S; y++) im.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); // flip
    cg.putImageData(im, 0, 0);
    const ox = (i % 32) * 32, oy = Math.floor(i / 32) * 32; g.clearRect(ox, oy, 32, 32); g.imageSmoothingEnabled = true; g.drawImage(cv, ox, oy, 32, 32);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteRenderbuffer(rb); gl.enable(gl.BLEND); gl.disable(gl.BLEND);
}

// ---------- animated block textures (fire, portals, sea lanterns, prismarine, kelp, lanterns, command blocks...) ----------
// Frames come from anim.png (base textures) or from the active resource pack's own frame strips.
let ANIMS = [], animCv = null, TNAME = null;
function setupAnims(ov) {
  ANIMS = []; if (!TNAME) { TNAME = []; for (const k in REG.tiles) TNAME[REG.tiles[k]] = k; }
  for (const e of REG.anim || []) {
    const n = TNAME[e.t];
    if (ov && n in ov) { const p = ov[n]; if (!p) continue; const w = p.img.width, nf = Math.floor(p.img.height / w); if (nf < 2) continue; const m = p.meta || {};
      ANIMS.push({ t: e.t, src: p.img, fw: w, strip: 1, n: nf, ft: m.frametime || 1, o: m.frames ? m.frames.map(f => typeof f == 'number' ? f : f.index) : null, i: m.interpolate ? 1 : 0 }); }
    else if (IMG.anim) ANIMS.push({ t: e.t, src: IMG.anim, fw: 32, row: e.row, n: e.n, ft: e.ft, o: e.o || null, i: e.i || 0 });
  }
  if (ov) for (const n in ov) { // the pack animates tiles that are still in the base game
    const t = REG.tiles[n], p = ov[n]; if (t === undefined || !p || ANIMS.some(a => a.t == t)) continue; const w = p.img.width, nf = Math.floor(p.img.height / w); if (nf < 2) continue; const m = p.meta || {};
    ANIMS.push({ t, src: p.img, fw: w, strip: 1, n: nf, ft: m.frametime || 1, o: m.frames ? m.frames.map(f => typeof f == 'number' ? f : f.index) : null, i: m.interpolate ? 1 : 0 });
  }
}
function animTick(now) {
  if (!ANIMS.length || !gl || !TEXS.blocks) return;
  const TS = IMG.blocks.width / REG.cols, tick = now / 50;
  if (!animCv || animCv.width != TS) { animCv = document.createElement('canvas'); animCv.width = animCv.height = TS; }
  const g = animCv.getContext('2d'); g.imageSmoothingEnabled = false; let bound = false;
  for (const a of ANIMS) {
    const len = a.o ? a.o.length : a.n, step = Math.floor(tick / a.ft), pos = step % len, fr = a.o ? a.o[pos] : pos;
    const mix = a.i ? Math.floor(((tick / a.ft) % 1) * 8) / 8 : 0, key = fr * 16 + mix * 8;
    if (a.last === key) continue; a.last = key;
    const sx = f => a.strip ? 0 : f * a.fw, sy = f => a.strip ? f * a.fw : a.row * a.fw;
    g.globalAlpha = 1; g.clearRect(0, 0, TS, TS); g.drawImage(a.src, sx(fr), sy(fr), a.fw, a.fw, 0, 0, TS, TS);
    if (mix) { const nx = a.o ? a.o[(pos + 1) % len] : (pos + 1) % len; g.globalAlpha = mix; g.drawImage(a.src, sx(nx), sy(nx), a.fw, a.fw, 0, 0, TS, TS); g.globalAlpha = 1; }
    if (!bound) { gl.bindTexture(gl.TEXTURE_2D, TEXS.blocks); bound = true; }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, (a.t % REG.cols) * TS, Math.floor(a.t / REG.cols) * TS, gl.RGBA, gl.UNSIGNED_BYTE, animCv);
  }
}
