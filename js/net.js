'use strict';
// ---------- Multiplayer (peer-to-peer over WebRTC, matchmaking via the free PeerJS service) ----------
// The host's browser owns the world. Friends join with a short code, get the world's seed + all edits,
// and from then on positions, block changes, chat, time and mobs are streamed.
const NET = { peer: null, role: null, code: '', conns: new Map(), host: null, myId: 'host', avatars: new Map(), cap: null, joinData: null, status: '', sendT: 0, mobT: 0, timeT: 0, nextId: 1 };
const PEER_JS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
function netName() { return (typeof PROFILE != 'undefined' && PROFILE.name) || store.get('mpName', '') || ('Player' + (100 + Math.floor(Math.random() * 900))); }
// some places block the browser's peer-to-peer connections (WebRTC) - e.g. the Claude preview frame. Multiplayer then has to run
// in its own tab: the offline Blockcraft.html or the GitHub Pages site both work
const MP_SITE = 'https://jogresh7-ship-it.github.io/blockcraft/';
const NO_RTC_MSG = 'Multiplayer is blocked in this window (no WebRTC). Use Open in New Tab, or the offline Blockcraft.html.';
function netCheckRTC() { if (typeof RTCPeerConnection == 'undefined' && typeof webkitRTCPeerConnection == 'undefined') { S.mp = S.mp || {}; S.mp.noRTC = 1; throw new Error(NO_RTC_MSG); } }
function netErr(e) { if (e && (e.type == 'browser-incompatible' || /browser/i.test(e.message || ''))) { S.mp = S.mp || {}; S.mp.noRTC = 1; return NO_RTC_MSG; } return 'Connection error: ' + (e.type || e.message); }
function netLoadLib() { try { netCheckRTC(); } catch (e) { return Promise.reject(e); } return window.Peer ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEER_JS; s.onload = res; s.onerror = () => rej(new Error('Could not load the multiplayer library (are you online?)')); document.head.appendChild(s); }); }
const netCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const peerId = code => 'blockcraft-mp-' + code.toUpperCase();
function netSend(c, msg) { try { if (c && c.open) c.send(msg); } catch (e) { } }
function netBroadcast(msg, except) { for (const [id, c] of NET.conns) if (id !== except) netSend(c, msg); }
function netOut(msg) { if (NET.role == 'host') netBroadcast(msg); else if (NET.role == 'client') netSend(NET.host, msg); }
function netMyState() { const P = player; return { t: 'p', id: NET.myId, name: player.name, skin: (typeof PROFILE != 'undefined' && PROFILE.skin) || 'steve', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), dim: world.dim, sneak: !!((keys.ShiftLeft || keys.ShiftRight) && !P.fly), held: held() ? held().k : 0,
  // pose + animation state so other players see crouching, sprinting, sitting, swimming, crawling, gliding, swinging, getting hurt and armour
  sw: typeof swing != 'undefined' && swing > 0 ? 1 : 0, hurt: P.hurtT > 0 ? 1 : 0, spr: P.sprint ? 1 : 0, sit: P.sit ? 1 : 0, swim: P.swimPose ? 1 : 0, glide: P.glide ? 1 : 0, crawl: P.crawlPose ? 1 : 0, sleep: P.sleeping ? 1 : 0,
  arm: P.armor.map(s => s ? keyName(s.k) : 0), off: P.offhand ? P.offhand.k : 0, eat: typeof eatT != 'undefined' && eatT > 0 ? 1 : 0, dead: P.dead ? 1 : 0 }; }
// ---- hosting ----
async function netHost(fixed) {
  if (NET.role == 'host' && (!fixed || NET.code == fixed) && (fixed || !NET.server)) return NET.code;
  if (NET.role) { netStop(); NET.server = null; NET.bot = false; } // still connected to a public server: leave it first, so friends get YOUR world
  NET.status = 'Starting...'; await netLoadLib();
  const code = fixed || netCode(); NET.role = 'host'; NET.code = code; NET.myId = 'host';
  return new Promise((res, rej) => {
    const peer = new Peer(peerId(code)); NET.peer = peer;
    peer.on('open', () => { NET.status = 'Open'; if (!NET.bot) chat(fixed ? '§aYou are now hosting the server §e' + NET.server : '§aYour world is open to friends. Code: §e' + code); res(code); });
    peer.on('error', e => { NET.status = 'Error: ' + (e.type || e.message); chat('§c' + netErr(e)); if (e.type == 'unavailable-id' && !fixed) { netStop(); netHost().then(res, rej); } else rej(e); });
    peer.on('connection', c => {
      const id = 'p' + NET.nextId++;
      c.on('data', d => netHostData(id, c, d));
      c.on('close', () => { NET.conns.delete(id); const a = NET.avatars.get(id); if (a) chat('§e' + a.name + ' left the game'); NET.avatars.delete(id); netBroadcast({ t: 'bye', id }); });
    });
  });
}
function netHostData(id, c, d) {
  if (!d || !d.t) return;
  if (d.t == 'ping') { netSend(c, { t: 'pong', players: NET.conns.size + (NET.bot ? 0 : 1), max: 20, motd: (world && world.meta.name) || 'Blockcraft', names: [...NET.avatars.values()].map(a => a.name).concat(NET.bot ? [] : [player ? player.name : 'Host']) }); return; }
  if (d.t == 'hello') {
    if (d.v !== 1) { netSend(c, { t: 'kick', why: 'Different game version - update the page' }); return; }
    NET.conns.set(id, c); const m = world.meta;
    netSend(c, { t: 'welcome', id, meta: { name: m.name, seed: m.seed, gen: m.gen, flat: m.flat, map: m.map, created: m.created, diff: m.diff, cheats: m.cheats, mode: m.mode }, edits: m.dimEdits ? m.dimEdits.overworld : world.edits, state: world.state, time: m.time, rain: m.rain, players: [...NET.avatars.values()].map(a => a.last).concat(NET.bot ? [] : [netMyState()]) });
    chat('§e' + (d.name || 'A player') + ' joined the game'); SND.play('random/pop', .5);
    return;
  }
  if (d.t == 'p') { d.id = id; netAvatar(d); netBroadcast(d, id); return; }
  if (d.t == 'b') { netApplyBlocks(d); netBroadcast(d, id); return; }
  if (d.t == 'chat') { chat(d.msg); netBroadcast(d, id); return; }
}
// ---- joining ----
async function netJoin(code) {
  netStop(); NET.status = 'Connecting...'; await netLoadLib();
  code = code.trim().toUpperCase(); NET.role = 'client'; NET.code = code;
  return new Promise((res, rej) => {
    const peer = new Peer(); NET.peer = peer; let done = false;
    const fail = msg => { if (done) return; done = true; NET.status = msg; netStop(); rej(new Error(msg)); };
    setTimeout(() => fail('No world found with code ' + code), 15000);
    peer.on('error', e => fail(e.type == 'peer-unavailable' ? 'No world found with code ' + code : netErr(e)));
    peer.on('open', () => {
      const c = peer.connect(peerId(code), { reliable: true }); NET.host = c;
      c.on('open', () => netSend(c, { t: 'hello', v: 1, name: netName() }));
      c.on('data', d => { if (d && d.t == 'welcome' && !done) { done = true; res(d); } netClientData(d); });
      c.on('close', () => { if (NET.role == 'client') { NET.role = null; if (world && world.meta.remote) { chat('§cDisconnected from the host'); S.netLost = 1; if (NET.server) { const n = NET.server; chat('§7Reconnecting to ' + n + '...'); setTimeout(() => { if (world && world.meta.remote) { netAdopt(n); quitWorld && quitWorld(); } netServer(n); }, 2500); } } } });
    });
  });
}
function netEnter(w) { // build the host's world locally from its seed + edits
  NET.myId = w.id; NET.joinData = { dimEdits: { overworld: w.edits || {} }, time: w.time, rain: w.rain };
  const meta = Object.assign({}, w.meta, { id: 'mp_' + NET.code, name: (w.meta.name || 'World') + ' (online)', remote: 1, state: w.state || {} });
  for (const p of w.players || []) netAvatar(p);
  openWorld(meta, false);
}
function netClientData(d) {
  if (!d || !d.t) return;
  if (d.t == 'kick') { chat('§c' + d.why); netStop(); return; }
  if (d.t == 'p') netAvatar(d);
  else if (d.t == 'b') netApplyBlocks(d);
  else if (d.t == 'chat') chat(d.msg);
  else if (d.t == 'time' && world) { world.meta.time = d.v; world.meta.rain = d.rain; }
  else if (d.t == 'bye') { const a = NET.avatars.get(d.id); if (a) chat('§e' + a.name + ' left the game'); NET.avatars.delete(d.id); }
  else if (d.t == 'mobs' && world && typeof mobs != 'undefined') netMobs(d.list);
}
// the host left: keep the server going. This player's copy of the world becomes the server's world, then the first player to
// reconnect becomes the new host (everyone else joins them), so a server never needs someone to keep it running
function netAdopt(n) { try { const id = 'srv_' + srvSlug(n).toLowerCase(), m = world.meta; Object.assign(m, { id, remote: 0, server: 1, name: n + ' Server' }); delete m.remote;
  S.worlds = S.worlds.filter(w => w.id != id); const meta = Object.assign({}, m); delete meta.edits; delete meta.containers; delete meta.dimEdits; delete meta.state; S.worlds.push(meta); store.set('worlds', S.worlds); saveWorld(); } catch (e) { console.warn('adopt', e); } }
function netStop() {
  NET.named = 0;
  try { for (const c of NET.conns.values()) c.close(); if (NET.host) NET.host.close(); if (NET.peer) NET.peer.destroy(); } catch (e) { }
  NET.conns.clear(); NET.avatars.clear(); NET.host = null; NET.peer = null; NET.role = null; NET.code = '';
}
// ---- other players ----
function netAvatar(d) {
  if (!d || d.id == NET.myId) return;
  let a = NET.avatars.get(d.id);
  if (!a) { a = { id: d.id, type: 'player', remote: 1, x: d.x, y: d.y, z: d.z, yaw: d.yaw, walk: 0, vx: 0, vz: 0, r: .3, h: 1.8, hp: 20, target: 1, lookP: 0 }; NET.avatars.set(d.id, a); if (NET.role == 'host' || world) chat('§e' + d.name + ' is here'); }
  a.last = d; a.name = d.name; a.tx = d.x; a.ty = d.y; a.tz = d.z; a.tyaw = d.yaw; a.lookP = d.pitch; a.dim = d.dim; a.sneak = d.sneak; a.holdK = d.held || 0;
  if (d.sw && !(a.swingT > 0) && !a.lastSw) a.swingT = 1; a.lastSw = d.sw; if (d.hurt && !(a.hurtT > 0) && !a.lastHurt) a.hurtT = .5; a.lastHurt = d.hurt;
  a.sprinting = !!d.spr; a.sitting = !!d.sit; a.swim = !!d.swim; a.glide = !!d.glide; a.crawl = !!d.crawl; a.sleeping = !!d.sleep; a.dead = !!d.dead; a.armorN = d.arm || []; a.offK = d.off || 0; a.eating = !!d.eat;
  a.skinTex = IMG['skin_' + d.skin] ? 'skin_' + d.skin : null;
}
function netAvatarsFor() { const out = []; if (!world) return out; for (const a of NET.avatars.values()) if (a.dim == world.dim && a.tx !== undefined && !a.dead) out.push(a); return out; }
// ---- block changes: everything a player action sets is captured and sent ----
function netBegin() { if (NET.role) NET.cap = []; }
function netEnd(hit) {
  if (!NET.cap) return; const list = NET.cap; NET.cap = null;
  const keys = new Set(list.map(c => c.slice(0, 3).join(','))); if (hit) keys.add(hit.x + ',' + hit.y + ',' + hit.z);
  if (!keys.size) return;
  const out = [...keys].map(k => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, world.get(x, y, z), world.state[k] || null]; });
  netOut({ t: 'b', dim: world.dim, list: out });
}
function netApplyBlocks(d) {
  if (!world || d.dim != world.dim) return;
  for (const [x, y, z, id, st] of d.list) {
    const k = x + ',' + y + ',' + z;
    if (!world.chunk(x >> 4, z >> 4)) { const ck = (x >> 4) + ',' + (z >> 4), li = lidx(x & 15, y, z & 15); (world.edits[ck] || (world.edits[ck] = {}))[li] = id; } // not loaded yet: remembered for later
    else world.set(x, y, z, id);
    if (st) world.state[k] = st; else delete world.state[k];
    const c = world.chunk(x >> 4, z >> 4); if (c) c.dirty = true;
  }
}
// ---- mobs: the host simulates them, friends see copies ----
function netMobs(list) {
  const byId = new Map(mobs.filter(m => m.ghost).map(m => [m.nid, m]));
  const keep = [];
  for (const [nid, type, x, y, z, yaw, hurt] of list) {
    if (!MOBDEF[type]) continue; let m = byId.get(nid);
    if (!m) { m = makeMob(type, x, y, z); m.ghost = 1; m.nid = nid; }
    m.tx = x; m.ty = y; m.tz = z; m.tyaw = yaw; if (hurt) m.hurtT = .3; keep.push(m);
  }
  mobs.length = 0; mobs.push(...keep);
}
// ---- per-frame ----
function netTick(dt) {
  if (!NET.role || !world || !player) return;
  if (!NET.named) { NET.named = 1; const nm = store.get('mpName', ''); if (nm) player.name = nm; }
  NET.sendT -= dt; if (NET.sendT <= 0) { NET.sendT = .08; if (!NET.bot) netOut(netMyState()); }
  const k = Math.min(1, dt * 12);
  for (const a of NET.avatars.values()) {
    if (a.tx === undefined) continue; const dx = a.tx - a.x, dz = a.tz - a.z;
    a.vx = dx / Math.max(dt, .001) * .1; a.vz = dz / Math.max(dt, .001) * .1; a.x += dx * k; a.y += (a.ty - a.y) * k; a.z += dz * k;
    let dy = a.tyaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * k; a.walk += Math.hypot(dx, dz) * 2.5; if (a.swingT > 0) a.swingT = Math.max(0, a.swingT - dt * 3); if (a.hurtT > 0) a.hurtT -= dt; if (a.eating) { a.swingT = .3 + Math.abs(Math.sin(performance.now() / 120)) * .2; }
  }
  if (NET.role == 'client') for (const m of mobs) if (m.ghost && m.tx !== undefined) { const dx = m.tx - m.x, dz = m.tz - m.z; m.vx = dx * 4; m.vz = dz * 4; m.x += dx * k; m.y += (m.ty - m.y) * k; m.z += dz * k; let dy = m.tyaw - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.yaw += dy * k; m.walk += Math.hypot(dx, dz) * 2.5; if (m.hurtT > 0) m.hurtT -= dt; }
  if (NET.role == 'host' && NET.conns.size) {
    NET.timeT -= dt; if (NET.timeT <= 0) { NET.timeT = 3; netBroadcast({ t: 'time', v: world.meta.time, rain: world.meta.rain }); }
    NET.mobT -= dt; if (NET.mobT <= 0) { NET.mobT = .2;
      for (const m of mobs) if (!m.nid) m.nid = NET.nextId++;
      netBroadcast({ t: 'mobs', list: mobs.filter(m => !m.dead).slice(0, 80).map(m => [m.nid, m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), m.hurtT > 0 ? 1 : 0]) }); }
  }
}
// name tags over other players
function netDrawNames(PV, W, H) {
  if (!NET.role) return;
  for (const a of netAvatarsFor()) {
    const p = [a.x, a.y + 2.15, a.z, 1], o = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) o[i] = PV[i] * p[0] + PV[4 + i] * p[1] + PV[8 + i] * p[2] + PV[12 + i];
    if (o[3] <= .1) continue; const sx = (o[0] / o[3] * .5 + .5) * UW, sy = (1 - (o[1] / o[3] * .5 + .5)) * UH;
    const w = textW(a.name) + 4; cx2.fillStyle = 'rgba(0,0,0,.4)'; cx2.fillRect(sx - w / 2, sy - 1, w, 10); text(a.name, Math.round(sx - w / 2 + 2), sy, '#FFFFFF', false);
  }
}
// ---- screens ----
// ---------- Multiplayer screens, laid out like Minecraft's "Play Multiplayer" server list ----------
const DEFAULT_SERVERS = [{ name: 'Blockcraft Survival', addr: 'Survival', motd: 'The official survival server' }, { name: 'Blockcraft Creative', addr: 'Creative', motd: 'Build anything, unlimited blocks' }, { name: 'Parkour', addr: 'Parkour', motd: 'Spiral Parkour Challenge - climb to the top!' }];
function mpServers() { let l = store.get('servers', null); if (!l) { l = DEFAULT_SERVERS.slice(); store.set('servers', l); } return l; }
const isCode = a => /^[A-Z0-9]{6}$/.test(a) && !/^(SURVIV|CREATI|PARKOU)/.test(a);
function mpJoin(sv) { S.mp = S.mp || {}; if (isCode(sv.addr.toUpperCase())) { S.mp.busy = 1; S.mp.msg = '§7Connecting to ' + sv.name + '...'; netJoin(sv.addr.toUpperCase()).then(w => { S.mp.busy = 0; netEnter(w); }).catch(e => { S.mp.busy = 0; S.mp.msg = '§c' + e.message; }); } else netServer(sv.addr); }
// ask a server how it is doing without joining it (players online, ping)
const MP_STAT = {};
async function mpProbe(sv) {
  const key = sv.addr.toUpperCase(), stt = MP_STAT[key] = { state: 'pinging', t: performance.now() };
  try { await netLoadLib(); } catch (e) { stt.state = 'offline'; stt.err = 'Offline'; return; }
  const code = isCode(key) ? key : 'SRV' + srvSlug(sv.addr), t0 = performance.now(), peer = new Peer(); let done = false;
  const end = (st, extra) => { if (done) return; done = true; Object.assign(stt, { state: st }, extra || {}); try { peer.destroy(); } catch (e) { } };
  setTimeout(() => end('offline'), 6000);
  peer.on('error', () => end('offline'));
  peer.on('open', () => { const c = peer.connect(peerId(code), { reliable: true }); c.on('open', () => c.send({ t: 'ping' })); c.on('data', d => { if (d && d.t == 'pong') end('online', { ping: Math.round(performance.now() - t0), players: d.players, max: d.max, motd: d.motd, names: d.names }); }); });
}
function pingBars(x, y, st) {
  const lvl = !st || st.state == 'offline' ? 0 : st.state == 'pinging' ? 1 + Math.floor(performance.now() / 150) % 5 : st.ping < 150 ? 5 : st.ping < 300 ? 4 : st.ping < 600 ? 3 : st.ping < 1000 ? 2 : 1;
  for (let i = 0; i < 5; i++) { const h = 2 + i * 1.5; cx2.fillStyle = !st || st.state == 'offline' ? '#5a1010' : i < lvl ? (st.state == 'pinging' ? '#7fbfff' : '#55FF55') : '#333'; cx2.fillRect(x + i * 2.2, y + 8 - h, 1.6, h); }
  if (!st || st.state == 'offline') { cx2.fillStyle = '#FF5555'; cx2.fillRect(x + 1, y + 1, 1, 1); }
}
function scrMultiplayer() {
  screenBg(); header(S.bedrock ? 'Servers' : 'Play Multiplayer'); S.mp = S.mp || {};
  const L = mpServers(), top = 32, bottom = UH - 58, w = Math.min(300, UW - 20), x = UW / 2 - w / 2;
  if (!S.mp.probed) { S.mp.probed = 1; L.forEach(mpProbe); }
  listFrame(top, bottom);
  if (mouse.wheel && hover(0, top, UW, bottom - top)) S.scroll = clamp(S.scroll + mouse.wheel * 18, 0, Math.max(0, L.length * 36 - (bottom - top) + 8));
  cx2.save(); cx2.beginPath(); cx2.rect(0, top, UW, bottom - top); cx2.clip();
  L.forEach((sv, i) => {
    const y = top + 4 + i * 36 - S.scroll, st = MP_STAT[sv.addr.toUpperCase()], hv = hover(x, y, w, 32) && mouse.y > top && mouse.y < bottom;
    if (S.mp.sel == i) { cx2.fillStyle = '#808080'; cx2.fillRect(x - 2, y - 2, w + 4, 36); cx2.fillStyle = '#000'; cx2.fillRect(x - 1, y - 1, w + 2, 34); }
    cx2.fillStyle = '#2a2a2a'; cx2.fillRect(x, y, 32, 32); drawIcon(BYNAME[['grass_block', 'diamond_block', 'oak_log', 'crafting_table', 'tnt'][i % 5]] || 1, x + 2, y + 2, 28);
    if (hv) { cx2.fillStyle = 'rgba(160,160,160,.5)'; cx2.fillRect(x, y, 32, 32); spr(hover(x, y, 32, 32) ? 'world_list_join_highlighted' : 'world_list_join', x, y, 32, 32); }
    text(sv.name, x + 35, y + 1, '#FFFFFF');
    const motd = st && st.state == 'online' ? (st.motd || sv.motd || 'A Blockcraft world') : st && st.state == 'pinging' ? '§8Pinging...' : '§4Can\'t connect to server' + (isCode(sv.addr.toUpperCase()) ? '' : ' §8- §7join to start it');
    text(motd, x + 35, y + 12, '#808080', false); text('§8' + (isCode(sv.addr.toUpperCase()) ? 'Friend code ' : 'Server ') + sv.addr, x + 35, y + 22, '#808080', false);
    pingBars(x + w - 14, y + 1, st); if (st && st.state == 'online') { const pc = '§7' + st.players + '§8/§7' + (st.max || 20); text(pc, x + w - 17 - textW(pc), y + 1, '#FFFFFF', false); }
    if (hv && st && st.state == 'online' && st.names && st.names.length && hover(x + w - 40, y, 40, 10)) S.mp.tip = st.names.join(', ');
    if (hv && mouse.click && !clickUsed) { clickUsed = true; if (S.mp.sel == i && performance.now() - (S.mp.lastClick || 0) < 400 || hover(x, y, 32, 32)) mpJoin(sv); S.mp.sel = i; S.mp.lastClick = performance.now(); SND.play('ui_click', .5); }
  });
  cx2.restore();
  if (S.mp.tip) { const tw = textW(S.mp.tip) + 8; nine('tooltip_background', mouse.x + 8, mouse.y - 14, tw, 14, 3, 3, 3, 3); text(S.mp.tip, mouse.x + 12, mouse.y - 11, '#FFFFFF', false); S.mp.tip = null; }
  if (S.mp.noRTC === undefined) { try { netCheckRTC(); S.mp.noRTC = 0; } catch (e) { } }
  if (S.mp.noRTC && !S.mp.msg) S.mp.msg = '§e' + NO_RTC_MSG;
  if (S.mp.noRTC && button('Open in New Tab', UW - 108, 6, 100)) { try { window.open(MP_SITE + (S.mp.sel != null && L[S.mp.sel] ? '?server=' + encodeURIComponent(L[S.mp.sel].addr) : ''), '_blank', 'noopener'); } catch (e) { } }
  if (S.mp.msg) textC(S.mp.msg, UW / 2, bottom + 2, '#FFFFFF');
  const sel = L[S.mp.sel], bx = UW / 2 - 154, by = UH - 50;
  if (button(S.mp.busy ? 'Connecting...' : 'Join Server', bx, by, 100, 20, !!sel && !S.mp.busy)) mpJoin(sel);
  if (button('Direct Connection', bx + 104, by, 100)) { S.mpEdit = { name: 'Minecraft Server', addr: '', direct: 1 }; go('mpdirect'); }
  if (button('Add Server', bx + 208, by, 100)) { S.mpEdit = { name: 'Blockcraft Server', addr: '', idx: -1 }; go('mpadd'); }
  if (button('Edit', bx, by + 24, 74, 20, !!sel)) { S.mpEdit = Object.assign({ idx: S.mp.sel }, sel); go('mpadd'); }
  if (button('Delete', bx + 78, by + 24, 74, 20, !!sel)) { L.splice(S.mp.sel, 1); store.set('servers', L); S.mp.sel = -1; }
  if (button('Refresh', bx + 156, by + 24, 74)) { for (const k in MP_STAT) delete MP_STAT[k]; S.mp.probed = 0; }
  if (button('Back', bx + 234, by + 24, 74)) go('title');
}
function scrMpAdd() { // "Edit Server Info"
  screenBg(); header(S.mpEdit.idx >= 0 ? 'Edit Server Info' : 'Add Server'); const E = S.mpEdit, x = UW / 2 - 100, y = Math.max(40, UH / 2 - 70);
  text('Server Name', x, y, '#A0A0A0'); textField('mpaddn', E, 'name', x, y + 10, 200);
  text('Server Address', x, y + 38, '#A0A0A0'); textField('mpadda', E, 'addr', x, y + 48, 200, 20, 'Server name (e.g. Survival) or friend code'); E.addr = E.addr.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 16);
  text('§8Your name in multiplayer:', x, y + 76, '#FFFFFF', false); E.pn = E.pn ?? store.get('mpName', ''); textField('mpaddp', E, 'pn', x, y + 86, 200, 20, netName());
  const ok = E.addr.length >= 3;
  if (button('Done', x, UH - 52, 200, 20, ok)) { if (E.pn) store.set('mpName', E.pn); const L = mpServers(), v = { name: E.name || 'Blockcraft Server', addr: E.addr }; if (E.idx >= 0) L[E.idx] = Object.assign(L[E.idx], v); else L.push(v); store.set('servers', L); delete MP_STAT[E.addr.toUpperCase()]; mpProbe(v); go('multiplayer'); }
  if (button('Host as hidden server bot', x, UH - 76, 200, 20, ok && !isCode(E.addr.toUpperCase()))) { netServer(E.addr, true); }
  if (button('Cancel', x, UH - 28, 200)) go('multiplayer');
}
function scrMpDirect() { // "Direct Connection"
  screenBg(); header('Direct Connection'); const E = S.mpEdit, x = UW / 2 - 100, y = Math.max(50, UH / 2 - 40);
  text('Server Address', x, y, '#A0A0A0'); textField('mpdir', E, 'addr', x, y + 10, 200, 20, 'Friend code or server name'); E.addr = E.addr.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 16);
  textC('§8Friend codes come from "Open to Friends" in the pause menu', UW / 2, y + 36, '#FFFFFF');
  if (S.mp && S.mp.msg) textC(S.mp.msg, UW / 2, y + 50, '#FFFFFF');
  if (button(S.mp && S.mp.busy ? 'Connecting...' : 'Join Server', x, UH - 52, 200, 20, E.addr.length >= 3 && !(S.mp && S.mp.busy))) mpJoin({ name: E.addr, addr: E.addr });
  if (button('Cancel', x, UH - 28, 200)) go('multiplayer');
}

// ---- servers: a fixed name instead of a random code. Whoever is hosting keeps it alive; a hidden "bot" tab can host it 24/7 ----
const srvSlug = n => n.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
async function netServer(name, bot) {
  const slug = srvSlug(name); if (slug.length < 3) return; const code = 'SRV' + slug;
  S.mp = S.mp || {}; S.mp.busy = 1; S.mp.msg = '§7Looking for ' + name + '...'; NET.server = name;
  try { if (bot) throw new Error('bot'); const w = await netJoin(code); NET.server = name; S.mp.busy = 0; S.mp.msg = ''; netEnter(w); return; }
  catch (e) { if (!bot && !/No world found/.test(e.message)) { S.mp.busy = 0; S.mp.msg = '§c' + e.message; return; } }
  // nobody is hosting it: this browser becomes the server (its world is saved here)
  S.mp.msg = '§7Starting ' + name + '...'; NET.server = name; NET.bot = !!bot;
  const id = 'srv_' + slug.toLowerCase(); let meta = S.worlds.find(w => w.id == id);
  const creative = /CREATIVE/.test(slug), map = /PARKOUR/.test(slug) && window.MAPS && MAPS.spiral ? 'spiral' : null;
  if (meta && map && meta.map != map) { S.worlds = S.worlds.filter(w => w.id != id); store.set('worlds', S.worlds); store.del('world_' + id); meta = null; } // old flat parkour world -> the new map
  if (!meta) { let h = 7; for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619); meta = { id, name: name + ' Server', seed: h >>> 0, mode: creative ? 'creative' : 'survival', diff: 2, cheats: creative, flat: !map && /PARKOUR|FLAT/.test(slug), map, created: Date.now(), last: Date.now(), gen: 3, server: 1 }; S.worlds.push(meta); store.set('worlds', S.worlds); }
  openWorld(meta, !store.get('world_' + id, null));
  for (let i = 0; i < 240 && S.screen != 'game' && S.screen != null; i++) await new Promise(r => setTimeout(r, 250));
  try { await netHost(code); NET.server = name; S.mp.busy = 0; S.mp.msg = ''; if (bot) botMode(name); }
  catch (e) { // someone else started it at the same moment: join them instead
    netStop(); NET.bot = false; if (e && e.type == 'unavailable-id') { quitWorld(); setTimeout(() => netServer(name), 500); } else { S.mp.busy = 0; chat('§cCould not start the server: ' + (e.type || e.message)); }
  }
}
// the bot: hosts the world but has no body, no sound and does not move; keep this tab open on any computer
function botMode(name) {
  player.mode = 'spectator'; player.fly = true; player.name = '[server]';
  SND.play = () => { }; try { SND.stopMusic(); } catch (e) { } S.botName = name; hideHud = true;
  try { document.title = 'Blockcraft server: ' + name; } catch (e) { }
  chat('§aServer bot is running "' + name + '". Players join by typing ' + name + ' in Multiplayer. Keep this tab open.');
}
function drawBotOverlay() {
  if (!NET.bot || S.screen != 'game') return;
  cx2.fillStyle = 'rgba(0,0,0,.65)'; cx2.fillRect(0, 0, UW, 34);
  textC('§aServer bot: ' + S.botName + ' §7- ' + NET.conns.size + ' player' + (NET.conns.size == 1 ? '' : 's') + ' online - keep this tab open', UW / 2, 6, '#FFFFFF');
  textC('§8Link: ' + location.origin + location.pathname + '?server=' + encodeURIComponent(S.botName), UW / 2, 18, '#FFFFFF');
}
// links like ...?server=Survival join (or start) that server automatically; &bot=1 runs the hidden bot
function netAutoStart() {
  try { const q = new URLSearchParams(location.search), n = q.get('server'); if (n) setTimeout(() => netServer(n, q.get('bot') == '1'), 300); } catch (e) { }
}
