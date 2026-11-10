'use strict';
// ---------- Multiplayer (peer-to-peer over WebRTC, matchmaking via the free PeerJS service) ----------
// The host's browser owns the world. Friends join with a short code, get the world's seed + all edits,
// and from then on positions, block changes, chat, time and mobs are streamed.
const NET = { peer: null, role: null, code: '', conns: new Map(), host: null, myId: 'host', avatars: new Map(), cap: null, joinData: null, status: '', sendT: 0, mobT: 0, timeT: 0, nextId: 1 };
const PEER_JS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
function netName() { return (typeof PROFILE != 'undefined' && PROFILE.name) || store.get('mpName', '') || ('Player' + (100 + Math.floor(Math.random() * 900))); }
function netLoadLib() { return window.Peer ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEER_JS; s.onload = res; s.onerror = () => rej(new Error('Could not load the multiplayer library (are you online?)')); document.head.appendChild(s); }); }
const netCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const peerId = code => 'blockcraft-mp-' + code.toUpperCase();
function netSend(c, msg) { try { if (c && c.open) c.send(msg); } catch (e) { } }
function netBroadcast(msg, except) { for (const [id, c] of NET.conns) if (id !== except) netSend(c, msg); }
function netOut(msg) { if (NET.role == 'host') netBroadcast(msg); else if (NET.role == 'client') netSend(NET.host, msg); }
function netMyState() { const P = player; return { t: 'p', id: NET.myId, name: player.name, skin: (typeof PROFILE != 'undefined' && PROFILE.skin) || 'steve', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), dim: world.dim, sneak: !!P.sneak, held: held() ? held().k : 0 }; }
// ---- hosting ----
async function netHost(fixed) {
  if (NET.role) return NET.code;
  NET.status = 'Starting...'; await netLoadLib();
  const code = fixed || netCode(); NET.role = 'host'; NET.code = code; NET.myId = 'host';
  return new Promise((res, rej) => {
    const peer = new Peer(peerId(code)); NET.peer = peer;
    peer.on('open', () => { NET.status = 'Open'; if (!NET.bot) chat(fixed ? '§aYou are now hosting the server §e' + NET.server : '§aYour world is open to friends. Code: §e' + code); res(code); });
    peer.on('error', e => { NET.status = 'Error: ' + (e.type || e.message); chat('§cMultiplayer: ' + (e.type || e.message)); if (e.type == 'unavailable-id' && !fixed) { netStop(); netHost().then(res, rej); } else rej(e); });
    peer.on('connection', c => {
      const id = 'p' + NET.nextId++;
      c.on('data', d => netHostData(id, c, d));
      c.on('close', () => { NET.conns.delete(id); const a = NET.avatars.get(id); if (a) chat('§e' + a.name + ' left the game'); NET.avatars.delete(id); netBroadcast({ t: 'bye', id }); });
    });
  });
}
function netHostData(id, c, d) {
  if (!d || !d.t) return;
  if (d.t == 'hello') {
    if (d.v !== 1) { netSend(c, { t: 'kick', why: 'Different game version - update the page' }); return; }
    NET.conns.set(id, c); const m = world.meta;
    netSend(c, { t: 'welcome', id, meta: { name: m.name, seed: m.seed, gen: m.gen, flat: m.flat, created: m.created, diff: m.diff, cheats: m.cheats, mode: m.mode }, edits: m.dimEdits ? m.dimEdits.overworld : world.edits, state: world.state, time: m.time, rain: m.rain, players: [...NET.avatars.values()].map(a => a.last).concat(NET.bot ? [] : [netMyState()]) });
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
    peer.on('error', e => fail(e.type == 'peer-unavailable' ? 'No world found with code ' + code : 'Connection error: ' + (e.type || e.message)));
    peer.on('open', () => {
      const c = peer.connect(peerId(code), { reliable: true }); NET.host = c;
      c.on('open', () => netSend(c, { t: 'hello', v: 1, name: netName() }));
      c.on('data', d => { if (d && d.t == 'welcome' && !done) { done = true; res(d); } netClientData(d); });
      c.on('close', () => { if (NET.role == 'client') { NET.role = null; if (world && world.meta.remote) { chat('§cDisconnected from the host'); S.netLost = 1; if (NET.server) { const n = NET.server; chat('§7Reconnecting to ' + n + '...'); setTimeout(() => { if (world && world.meta.remote) { quitWorld && quitWorld(); } netServer(n); }, 2500); } } } });
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
  a.skinTex = IMG['skin_' + d.skin] ? 'skin_' + d.skin : null;
}
function netAvatarsFor() { const out = []; if (!world) return out; for (const a of NET.avatars.values()) if (a.dim == world.dim && a.tx !== undefined) out.push(a); return out; }
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
    let dy = a.tyaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * k; a.walk += Math.hypot(dx, dz) * 2.5;
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
function scrMultiplayer() {
  screenBg(); header('Multiplayer'); S.mp = S.mp || {}; for (const k of ['code', 'name', 'srv']) if (typeof S.mp[k] != 'string') S.mp[k] = '';
  const two = UW >= 430, x = two ? UW / 2 - 210 : UW / 2 - 100, y = two ? Math.max(32, UH / 2 - 70) : Math.max(32, Math.min(UH / 2 - 60, UH - 260)), cxm = x + 100;
  textC('Join a friend\'s world', cxm, y, '#FFFFFF');
  textC('§7Ask your friend for the code from', cxm, y + 14, '#FFFFFF'); textC('§7"Open to Friends" in their pause menu.', cxm, y + 24, '#FFFFFF');
  textField('mpcode', S.mp, 'code', x, y + 40, 200, 20, 'Friend code (e.g. K7QX2M)'); S.mp.code = S.mp.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  textField('mpname', S.mp, 'name', x, y + 66, 200, 20, 'Your name: ' + netName()); if (S.mp.name !== undefined && S.mp.name) store.set('mpName', S.mp.name);
  if (button(S.mp.busy ? 'Connecting...' : 'Join', x, y + 92, 200, 20, S.mp.code.length == 6 && !S.mp.busy)) {
    S.mp.busy = 1; S.mp.msg = '';
    netJoin(S.mp.code).then(w => { S.mp.busy = 0; netEnter(w); }).catch(e => { S.mp.busy = 0; S.mp.msg = '§c' + e.message; });
  }
  if (S.mp.msg) textC(S.mp.msg, UW / 2, y + 118 + (two ? 0 : 108), '#FFFFFF');
  // public servers: always the same name, so anyone can find them
  const sx = two ? UW / 2 + 10 : x, sy = two ? y : y + 132; textC('§eServers', sx + 100, sy, '#FFFFFF');
  const SV = ['Survival', 'Creative', 'Parkour'], bw = 64;
  SV.forEach((n, i) => { if (button(n, sx + i * 68, sy + 12, bw, 20, !S.mp.busy)) netServer(n); });
  textField('mpsrv', S.mp, 'srv', sx, sy + 36, 132, 20, 'Server name'); S.mp.srv = (S.mp.srv || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 16);
  if (button('Join', sx + 136, sy + 36, 64, 20, S.mp.srv.length >= 3 && !S.mp.busy)) netServer(S.mp.srv);
  if (button('Run a hidden server bot', sx, sy + 60, 200, 20, (S.mp.srv || '').length >= 3 && !S.mp.busy)) netServer(S.mp.srv, true);
  if (two) textC('§8A server stays online while someone (or a hidden bot tab) is hosting it.', UW / 2, UH - 42, '#FFFFFF');
  if (button('Back', UW / 2 - 100, UH - 28)) go('title');
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
  const creative = /CREATIVE/.test(slug);
  if (!meta) { let h = 7; for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619); meta = { id, name: name + ' Server', seed: h >>> 0, mode: creative ? 'creative' : 'survival', diff: 2, cheats: creative, flat: /PARKOUR|FLAT/.test(slug), created: Date.now(), last: Date.now(), gen: 2, server: 1 }; S.worlds.push(meta); store.set('worlds', S.worlds); }
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
