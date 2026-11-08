// Minimap mod for Blockcraft
// - Minimap in the top-right corner, north is up, the arrow is you
// - Press M for the full world map (everything you've explored): scroll or +/- to zoom, arrow keys to pan
// - Press N to zoom the minimap in/out
const TILE = new Map();      // tile index -> [r,g,b] average colour
const CHUNKS = new Map();    // "cx,cz" -> { canvas, d, t }
let atlasData = null, atlasKey = null, zoom = 1, big = false, bigZoom = 2, panX = 0, panZ = 0;
const MINI = 64;             // minimap size in GUI pixels (shows 128x128 blocks at zoom 1)

function tileColor(t) {
  let c = TILE.get(t); if (c) return c;
  const img = IMG.blocks;
  if (atlasKey !== img) { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0); atlasData = g.getImageData(0, 0, img.width, img.height); atlasKey = img; TILE.clear(); }
  const ts = img.width / REG.cols, x0 = (t % REG.cols) * ts, y0 = Math.floor(t / REG.cols) * ts; let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < ts; y += 2) for (let x = 0; x < ts; x += 2) { const i = ((y0 + y) * img.width + x0 + x) * 4; if (atlasData.data[i + 3] < 128) continue; r += atlasData.data[i]; g += atlasData.data[i + 1]; b += atlasData.data[i + 2]; n++; }
  c = n ? [r / n, g / n, b / n] : [0, 0, 0]; TILE.set(t, c); return c;
}
function blockColor(id) {
  if (FLUID[id] == 1) return [52, 92, 200];
  if (FLUID[id] == 2) return [220, 100, 20];
  return tileColor(TEX[id * 4]);
}
function renderChunk(c) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d'), im = g.createImageData(16, 16), d = c.d;
  const nether = world.dim == 'nether', startY = nether ? Math.min(WH - 2, Math.floor(player.y) + 2) : WH - 1;
  const hs = new Int16Array(256);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let y = startY, id = 0;
    if (nether) { while (y > 0 && d[lidx(x, y, z)]) y--; }
    for (; y > 0; y--) { id = d[lidx(x, y, z)]; if (id && SHAPE[id] != 2 && !(SHAPE[id] == 6 && BL[id].n != 'lily_pad')) break; }
    let col = blockColor(id); hs[x + z * 16] = y;
    if (FLUID[id] == 1) { let dep = 0; while (dep < 12 && FLUID[d[lidx(x, y - dep - 1, z)]] == 1) dep++; const k = 1 - dep * .04; col = col.map(v => v * k); }
    const o = (z * 16 + x) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255;
  }
  // hill shading from the slope towards the north-west
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const h = hs[x + z * 16], hn = z > 0 ? hs[x + (z - 1) * 16] : h, hw = x > 0 ? hs[x - 1 + z * 16] : h, k = 1 + clamp((h - hn) + (h - hw), -4, 4) * .06, o = (z * 16 + x) * 4;
    im.data[o] *= k; im.data[o + 1] *= k; im.data[o + 2] *= k;
  }
  g.putImageData(im, 0, 0); return cv;
}
let lastDim = null, scanT = 0;
function update(dt) {
  if (!world) return;
  if (lastDim !== world.dim) { CHUNKS.clear(); lastDim = world.dim; }
  scanT -= dt; const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16); let budget = 6;
  for (const [k, c] of world.chunks) {
    if (budget <= 0) break; const e = CHUNKS.get(k);
    const near = Math.abs(c.cx - pcx) <= 1 && Math.abs(c.cz - pcz) <= 1;
    if (!e || e.d !== c.d || (near && scanT <= 0 && e.t < performance.now() - 1000)) { CHUNKS.set(k, { canvas: renderChunk(c), d: c.d, t: performance.now(), cx: c.cx, cz: c.cz }); budget--; }
  }
  if (scanT <= 0) scanT = 1;
}
function drawMap(ctx, x, y, w, h, scale, cxw, czw, round) {
  ctx.save(); ctx.beginPath(); if (round) ctx.rect(x, y, w, h); else ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.imageSmoothingEnabled = false;
  const midX = x + w / 2, midY = y + h / 2;
  for (const e of CHUNKS.values()) {
    const sx = midX + (e.cx * 16 - cxw) * scale, sy = midY + (e.cz * 16 - czw) * scale, s = 16 * scale;
    if (sx + s < x || sy + s < y || sx > x + w || sy > y + h) continue;
    ctx.drawImage(e.canvas, sx, sy, s + .5, s + .5);
  }
  // other players' view: mobs as dots
  if (typeof mobs != 'undefined') for (const m of mobs) { const sx = midX + (m.x - cxw) * scale, sy = midY + (m.z - czw) * scale; if (sx < x || sy < y || sx > x + w || sy > y + h) continue; ctx.fillStyle = MOBDEF[m.type] && MOBDEF[m.type].hostile ? '#ff4040' : '#ffffff'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2); }
  // player arrow
  const px = midX + (player.x - cxw) * scale, py = midY + (player.z - czw) * scale, a = -player.yaw;
  ctx.translate(px, py); ctx.rotate(a + Math.PI); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 3.5); ctx.lineTo(0, 2); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
api.on('tick', update);
api.on('hud', (ctx, UW, UH) => {
  if (!world || S.screen == 'death') return;
  if (big && S.screen != 'game' && S.screen != 'chat') big = false;
  if (big) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, UW, UH);
    const m = 12, w = UW - m * 2, h = UH - m * 2 - 14;
    drawMap(ctx, m, m + 12, w, h, bigZoom, player.x + panX, player.z + panZ);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(m - .5, m + 11.5, w + 1, h + 1);
    api.text('World Map - ' + CHUNKS.size + ' chunks explored', m, 3, '#FFFFFF');
    api.text('Scroll to zoom, arrow keys to look around, M to close', m, UH - 11, '#AAAAAA');
    const t = 'X ' + Math.round(player.x + panX) + '  Z ' + Math.round(player.z + panZ) + '  (' + bigZoom.toFixed(2).replace(/\.?0+$/, '') + 'x)';
    api.text(t, UW - m - api.textW(t), 3, '#FFFF55');
    return;
  }
  if (S.screen != 'game' && S.screen != 'chat') return;
  const size = MINI, x = UW - size - 4, y = 4, scale = size / (128 / zoom);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, size + 4, size + 4); ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
  drawMap(ctx, x, y, size, size, scale, player.x, player.z);
  api.text('N', x + size / 2 - 2, y + 1, '#FFFFFF');
  const coords = Math.floor(player.x) + ', ' + Math.floor(player.y) + ', ' + Math.floor(player.z);
  api.text(coords, x + size / 2 - Math.round(api.textW(coords) / 2), y + size + 4, '#FFFFFF');
});
window.addEventListener('keydown', e => {
  if (!world || (S.screen != 'game' && !big) || e.repeat) return;
  if (e.code == 'KeyM') { big = !big; panX = panZ = 0; }
  if (e.code == 'KeyN' && !big) zoom = zoom == 1 ? 2 : zoom == 2 ? .5 : 1;
});
window.addEventListener('keydown', e => { if (!big) return; const st = 48 / bigZoom; if (e.code == 'ArrowLeft') panX -= st; if (e.code == 'ArrowRight') panX += st; if (e.code == 'ArrowUp') panZ -= st; if (e.code == 'ArrowDown') panZ += st; if (e.code == 'Equal' || e.code == 'NumpadAdd') bigZoom = clamp(bigZoom * 1.25, .25, 8); if (e.code == 'Minus' || e.code == 'NumpadSubtract') bigZoom = clamp(bigZoom * .8, .25, 8); });
// while the world map is open, the scroll wheel zooms the map instead of changing the hotbar slot
window.addEventListener('wheel', e => { if (!big) return; bigZoom = clamp(bigZoom * (e.deltaY < 0 ? 1.25 : .8), .25, 8); e.stopImmediatePropagation(); }, { capture: true });
api.on('join', () => api.chat('§aMinimap loaded. §7Press M for the world map, N to zoom the minimap.'));
