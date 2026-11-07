'use strict';
// ---------- touch (phones/tablets) and gamepad (Xbox/PlayStation/Switch) controls ----------
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) || (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);
const TOUCH = { on: false, joy: null, look: null, btn: {}, ids: {} };
const PAD = { on: false, prev: [], cx: 0, cy: 0 };
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code == 'Escape' ? 'Escape' : code == 'Space' ? ' ' : code.replace('Key', '').toLowerCase() }));
function touchLayout() { // gui-unit rectangles
  const s = 26, m = 8;
  return {
    jump: [UW - s - m - 4, UH - s - 34, s, s, 'Jump'], sneak: [UW - 2 * s - m - 10, UH - s - 34, s, s, 'Sneak'],
    inv: [UW / 2 + 95, UH - 22, 22, 20, '...'], pause: [UW - 26, 4, 22, 18, 'II'], chat: [UW - 52, 4, 22, 18, 'T'],
    drop: [UW / 2 - 117, UH - 22, 22, 20, 'Q'], cam: [UW - 78, 4, 22, 18, 'F5'], fly: [UW - s - m - 4, UH - 2 * s - 40, s, s, 'Fly'],
  };
}
const inRect = (x, y, r) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];
function guiPos(t) { const r = ui.getBoundingClientRect(); return [(t.clientX - r.left) * devicePixelRatio / GS, (t.clientY - r.top) * devicePixelRatio / GS]; }
function setupTouch() {
  const kb = document.createElement('input'); kb.id = 'kb'; kb.setAttribute('autocomplete', 'off'); kb.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;width:10px;height:10px';
  document.body.appendChild(kb);
  kb.addEventListener('input', e => { if (e.data) typed += e.data; kb.value = ''; });
  kb.addEventListener('keydown', e => { if (e.key == 'Backspace') keysPressed.push('Backspace'); if (e.key == 'Enter') keysPressed.push('Enter'); });
  const start = e => {
    if (IS_MOBILE) { TOUCH.on = true; noLock = true; } SND.ensure(); if (!SND.music && !world && SND.idx) SND.playMusic('menu');
    for (const t of e.changedTouches) {
      const [x, y] = guiPos(t);
      if (S.screen != 'game' || !TOUCH.on) { mouse.x = x; mouse.y = y; mouse.down = true; mouse.click = true; TOUCH.ids[t.identifier] = { menu: 1, t0: performance.now(), x, y }; continue; }
      const L = touchLayout(); let hit = null;
      for (const k in L) if (inRect(x, y, L[k]) && (k != 'fly' || player.mode != 'survival')) hit = k;
      const hx = UW / 2 - 91, hy = UH - 22;
      if (!hit && y >= hy && x >= hx && x < hx + 182) { player.sel = Math.floor((x - hx) / 20); S.selT = 2; TOUCH.ids[t.identifier] = { hot: 1 }; continue; }
      if (hit) {
        TOUCH.ids[t.identifier] = { btn: hit }; TOUCH.btn[hit] = 1;
        if (hit == 'jump') { keys.Space = true; key('Space', true); }
        if (hit == 'sneak') keys.ShiftLeft = true;
        if (hit == 'fly') { player.fly = !player.fly; player.vy = 0; }
        if (hit == 'inv') key('KeyE', true), key('KeyE', false);
        if (hit == 'pause') key('Escape', true);
        if (hit == 'chat') key('KeyT', true), key('KeyT', false), kb.focus();
        if (hit == 'drop') key('KeyQ', true), key('KeyQ', false);
        if (hit == 'cam') player.view = ((player.view || 0) + 1) % 3;
        continue;
      }
      if (x < UW * .4 && !TOUCH.joy) { TOUCH.joy = { id: t.identifier, ox: x, oy: y, dx: 0, dy: 0 }; TOUCH.ids[t.identifier] = { joy: 1 }; continue; }
      if (!TOUCH.look) { TOUCH.look = { id: t.identifier, lx: t.clientX, ly: t.clientY, t0: performance.now(), moved: 0 }; TOUCH.ids[t.identifier] = { look: 1 }; }
    }
    e.preventDefault();
  };
  const move = e => {
    for (const t of e.changedTouches) {
      const info = TOUCH.ids[t.identifier]; if (!info) continue; const [x, y] = guiPos(t);
      if (info.menu) { mouse.x = x; mouse.y = y; if (Math.hypot(x - info.x, y - info.y) > 6) info.moved = 1; if (info.moved && /worlds|controls|stats|advancements/.test(S.screen)) { mouse.wheel -= (y - (info.ly ?? y)) / 18; } if (info.moved && (S.screen == 'inventory') && player && player.mode == 'creative') mouse.wheel -= (y - (info.ly ?? y)) / 18; info.ly = y; continue; }
      if (info.joy && TOUCH.joy) { const j = TOUCH.joy; j.dx = clamp((x - j.ox) / 30, -1, 1); j.dy = clamp((y - j.oy) / 30, -1, 1); }
      if (info.look && TOUCH.look && player) {
        const l = TOUCH.look, dx = t.clientX - l.lx, dy = t.clientY - l.ly; l.lx = t.clientX; l.ly = t.clientY; l.moved += Math.abs(dx) + Math.abs(dy);
        const s = (opts.sens * .6 + .2) * .012; player.yaw -= dx * s; player.pitch = clamp(player.pitch - dy * s, -1.5707, 1.5707);
        if (l.moved > 12 && !l.breaking) l.dragging = true;
      }
    }
    e.preventDefault();
  };
  const end = e => {
    for (const t of e.changedTouches) {
      const info = TOUCH.ids[t.identifier]; delete TOUCH.ids[t.identifier]; if (!info) continue;
      if (info.menu) { mouse.down = false; if (performance.now() - info.t0 > 450 && !info.moved && /inventory|crafting|chest|furnace/.test(S.screen)) mouse.rclick = true; }
      if (info.btn) { TOUCH.btn[info.btn] = 0; if (info.btn == 'jump') { keys.Space = false; key('Space', false); } if (info.btn == 'sneak') keys.ShiftLeft = false; }
      if (info.joy) { TOUCH.joy = null; keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false; player && (player.sprint = false); }
      if (info.look && TOUCH.look) { const l = TOUCH.look; if (!l.dragging && !l.breaking && performance.now() - l.t0 < 300) { mouse.rdown = true; mouse.rclick = true; setTimeout(() => { mouse.rdown = false; }, 60); } if (l.breaking) mouse.down = false; TOUCH.look = null; }
    }
    e.preventDefault();
  };
  document.addEventListener('touchstart', start, { passive: false }); document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end, { passive: false }); document.addEventListener('touchcancel', end, { passive: false });
}
function touchFrame() {
  if (!TOUCH.on) return;
  const kb = document.getElementById('kb'); if ((focus || S.screen == 'chat') && document.activeElement != kb) kb.focus(); else if (!focus && S.screen != 'chat' && document.activeElement == kb) kb.blur();
  if (S.screen != 'game' || !player) return;
  const j = TOUCH.joy; if (j) { keys.KeyW = j.dy < -.3; keys.KeyS = j.dy > .3; keys.KeyA = j.dx < -.3; keys.KeyD = j.dx > .3; if (j.dy < -.95) player.sprint = true; }
  const l = TOUCH.look; if (l && !l.dragging && !l.breaking && performance.now() - l.t0 > 300) { l.breaking = true; mouse.down = true; }
}
function drawTouchHUD() {
  if (!TOUCH.on || S.screen != 'game' || hideHud) return;
  const L = touchLayout();
  for (const k in L) { if (k == 'fly' && player.mode == 'survival') continue; const [x, y, w, h, label] = L[k]; cx2.globalAlpha = TOUCH.btn[k] ? .9 : .55; nine(TOUCH.btn[k] ? 'widget_button_highlighted' : 'widget_button', x, y, w, h, 3, 3, 3, 3); textC(label, x + w / 2, y + h / 2 - 4, '#FFFFFF'); }
  const j = TOUCH.joy; cx2.globalAlpha = .35; cx2.fillStyle = '#000';
  const jx = j ? j.ox : 50, jy = j ? j.oy : UH - 60; cx2.beginPath(); cx2.arc(jx, jy, 30, 0, 7); cx2.fill(); cx2.globalAlpha = .6; cx2.fillStyle = '#ddd'; cx2.beginPath(); cx2.arc(jx + (j ? j.dx * 24 : 0), jy + (j ? j.dy * 24 : 0), 11, 0, 7); cx2.fill();
  cx2.globalAlpha = 1;
}
// ---------- gamepad ----------
function padFrame(dt) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; if (!pads.length) return;
  const g = pads[0], B = g.buttons.map(b => b.pressed), A = g.axes, was = PAD.prev; PAD.prev = B;
  const press = i => B[i] && !was[i], rel = i => !B[i] && was[i];
  const dz = v => Math.abs(v) < .18 ? 0 : (v - Math.sign(v) * .18) / .82;
  if (B.some(Boolean) || A.some(a => Math.abs(a) > .3)) { if (!PAD.on) { PAD.on = true; noLock = true; PAD.cx = UW / 2; PAD.cy = UH / 2; chat && world && chat('§7Controller connected: ' + g.id.slice(0, 40)); } }
  if (!PAD.on) return;
  if (S.screen == 'game' && player) {
    const lx = dz(A[0]), ly = dz(A[1]), rx = dz(A[2] || 0), ry = dz(A[3] || 0);
    keys.KeyW = ly < -.3; keys.KeyS = ly > .3; keys.KeyA = lx < -.3; keys.KeyD = lx > .3;
    const s = (opts.sens * .6 + .2) * 3.2 * dt; player.yaw -= rx * Math.abs(rx) * s * 1.6; player.pitch = clamp(player.pitch - ry * Math.abs(ry) * s, -1.5707, 1.5707);
    if (press(0)) key('Space', true); if (rel(0)) key('Space', false);
    keys.ShiftLeft = !!(B[1] || B[13]); if (B[10]) player.sprint = true;
    mouse.down = !!B[7]; mouse.rdown = !!B[6]; if (press(6)) mouse.rclick = true;
    if (press(4)) { player.sel = (player.sel + 8) % 9; S.selT = 2; } if (press(5)) { player.sel = (player.sel + 1) % 9; S.selT = 2; }
    if (press(3)) key('KeyE', true), key('KeyE', false); if (press(2)) key('KeyQ', true), key('KeyQ', false);
    if (press(9)) key('Escape', true); if (press(8)) key('KeyT', true), key('KeyT', false); if (press(11)) mouse.mclick = true;
    if (press(12)) player.view = ((player.view || 0) + 1) % 3;
  } else {
    // menu: left stick / d-pad moves a cursor; A = click, X = right click, B = back
    const sp = 260 * dt; let vx = dz(A[0]), vy = dz(A[1]); if (B[14]) vx = -1; if (B[15]) vx = 1; if (B[12]) vy = -1; if (B[13]) vy = 1;
    PAD.cx = clamp(PAD.cx + vx * sp, 0, UW); PAD.cy = clamp(PAD.cy + vy * sp, 0, UH); if (vx || vy) { mouse.x = PAD.cx; mouse.y = PAD.cy; }
    if (dz(A[3] || 0)) mouse.wheel += dz(A[3]) * dt * 8;
    if (press(0)) { mouse.x = PAD.cx; mouse.y = PAD.cy; mouse.down = true; mouse.click = true; } if (rel(0)) mouse.down = false;
    if (press(2)) { mouse.x = PAD.cx; mouse.y = PAD.cy; mouse.rclick = true; }
    if (press(1) || press(9)) key('Escape', true);
    if (press(3) && /inventory|crafting|chest|furnace/.test(S.screen)) key('KeyE', true), key('KeyE', false);
    if (press(4) && S.screen == 'inventory' && CTABS) S.ctab = (S.ctab + CTABS.length - 1) % CTABS.length; if (press(5) && S.screen == 'inventory' && CTABS) S.ctab = (S.ctab + 1) % CTABS.length;
  }
}
function padFamily() { const g = navigator.getGamepads && [...navigator.getGamepads()].find(Boolean); const id = (g && g.id || '').toLowerCase(); return /054c|dualsense|dualshock|playstation|wireless controller/.test(id) ? 'ps' : /057e|nintendo|pro controller|joy-con/.test(id) ? 'switch' : 'xbox'; }
function prompt(k, x, y, s = 12) { spr('prompts/' + padFamily() + '_' + k, x, y, s, s, 0, 0, 16, 16); }
function drawPadHints() {
  if (!PAD.on || TOUCH.on) return;
  const H = (list) => { let x = UW - 6; for (const [k, l] of list.reverse()) { const w = textW(l) + 16; x -= w + 6; cx2.fillStyle = 'rgba(0,0,0,.5)'; cx2.fillRect(x - 2, UH - 17, w + 4, 15); prompt(k, x, UH - 16); text(l, x + 15, UH - 13, '#FFFFFF'); } };
  if (S.screen == 'game') { if (hideHud || !player) return; const hx = Math.round(UW / 2 - 91), hy = UH - 22; prompt('lb', hx - 16, hy + 5); prompt('rb', hx + 184, hy + 5); return; }
  if (/inventory|crafting|chest|furnace/.test(S.screen)) H([['a', 'Pick up'], ['x', 'Split'], ['y', 'Close']]);
  else if (S.screen != 'loading') H([['a', 'Select'], ['b', 'Back']]);
}
function drawPadCursor() {
  if (!PAD.on || S.screen == 'game' || TOUCH.on) return;
  const x = mouse.x, y = mouse.y; cx2.fillStyle = '#000'; cx2.fillRect(x - 1, y - 1, 3, 11); cx2.fillRect(x - 1, y - 1, 8, 3); cx2.fillStyle = '#fff'; cx2.fillRect(x, y, 1, 9); cx2.fillRect(x, y, 6, 1); cx2.fillRect(x, y, 4, 4);
}
