// ---- Fruit SMP: the one public server. Joining it opens the lobby's game selector (like a real server's compass menu):
// Parkour, Build Battle (vote on a theme, then build it) and Survival with other players. Each mode is its own server room. ----
const FRUIT_MODES = [
  { id: 'FruitSMP Parkour', name: 'Parkour', icon: 'feather', col: '§a', lore: ['Climb the Spiral Parkour map.', 'Checkpoints, no block breaking.'] },
  { id: 'FruitSMP Build', name: 'Build Battle', icon: 'bricks', col: '§e', lore: ['Vote on a theme, then build it', 'in creative before time runs out.'] },
  { id: 'FruitSMP Survival', name: 'Survival', icon: 'iron_sword', col: '§c', lore: ['Survive together: mine, craft,', 'build and fight. PvP is on.'] },
];
function scrFruit() {
  screenBg(); const F = S.fruit = S.fruit || {};
  if (!F.probed) { F.probed = 1; FRUIT_MODES.forEach(m => mpProbe({ addr: m.id })); }
  const W = 236, H = 150, x = Math.round(UW / 2 - W / 2), y = Math.round(UH / 2 - H / 2);
  cx2.fillStyle = '#000'; cx2.fillRect(x - 1, y - 1, W + 2, H + 2); cx2.fillStyle = '#FFFFFF'; cx2.fillRect(x, y, W, H); cx2.fillStyle = '#555'; cx2.fillRect(x + 2, y + 2, W - 2, H - 2); cx2.fillStyle = '#C6C6C6'; cx2.fillRect(x + 3, y + 3, W - 6, H - 6);
  textC('§2§lFruit SMP', UW / 2, y + 8, '#FFFFFF'); textC('§8Choose a game', UW / 2, y + 20, '#404040');
  FRUIT_MODES.forEach((m, i) => {
    const bx = x + 18 + i * 72, by = y + 40, hv = hover(bx, by, 56, 56), st = MP_STAT[m.id.toUpperCase()];
    cx2.fillStyle = hv ? '#FFFFFF' : '#8B8B8B'; cx2.fillRect(bx, by, 56, 56); cx2.fillStyle = '#373737'; cx2.fillRect(bx + 2, by + 2, 52, 52);
    const k = itemKey('item:' + m.icon) || BYNAME[m.icon]; if (k) drawIcon(k, bx + 12, by + 8, 32);
    textC(m.col + m.name, bx + 28, by + 60, '#FFFFFF');
    textC(st && st.state == 'online' ? '§7' + st.players + ' playing' : st && st.state == 'pinging' ? '§8...' : '§80 playing', bx + 28, by + 71, '#FFFFFF');
    if (hv) { S.fruitTip = [m.col + m.name, ...m.lore.map(l => '§7' + l), '§eClick to play']; if (mouse.click && !clickUsed) { clickUsed = true; SND.play('ui_click', .5); F.busy = m.name; netServer(m.id); } }
  });
  if (S.mp && S.mp.msg) textC(S.mp.msg, UW / 2, y + H + 4, '#FFFFFF'); else if (F.busy) textC('§7Joining ' + F.busy + '...', UW / 2, y + H + 4, '#FFFFFF');
  if (button('Back', UW / 2 - 50, y + H + 18, 100)) go('multiplayer');
  if (S.fruitTip) { const L = S.fruitTip, tw = Math.max(...L.map(l => textW(l))) + 8; nine('tooltip_background', mouse.x + 8, mouse.y - 4, tw, L.length * 10 + 4, 3, 3, 3, 3); L.forEach((l, i) => text(l, mouse.x + 12, mouse.y - 1 + i * 10, '#FFFFFF', false)); S.fruitTip = null; }
}
// ---- Build Battle: the host runs rounds; everyone sees the theme and timer. Vote by typing 1, 2 or 3 in chat ----
const BB_THEMES = ['Castle', 'Treehouse', 'Pirate Ship', 'Dragon', 'Rocket', 'Giant Fruit', 'Lighthouse', 'Volcano', 'Underwater Base', 'Robot', 'Haunted House', 'Space Station', 'Train', 'Ice Cream Shop', 'Windmill', 'Jungle Temple', 'Snowman', 'Race Car', 'Mushroom House', 'Skyscraper', 'Farm', 'Dinosaur', 'Airship', 'Bridge', 'Statue of a Mob'];
const BB = { ph: null, end: 0, opts: [], theme: '', votes: {} };
const isBB = () => world && NET.server && /BUILD/i.test(String(NET.server)) || world && /^srv_fruitsmpbuild/.test(String(world.meta.id));
function bbTick() {
  if (!isBB() || NET.role == 'client') return; const now = Date.now();
  if (!BB.ph || now > BB.end) {
    if (BB.ph != 'vote') { BB.ph = 'vote'; BB.end = now + 30000; BB.votes = {}; const pool = BB_THEMES.slice(); BB.opts = [0, 1, 2].map(() => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); chat('§6§lBuild Battle! §eVote for the next theme - type 1, 2 or 3 in chat:'); BB.opts.forEach((o, i) => chat('§e  ' + (i + 1) + ') §f' + o)); }
    else { const c = [0, 0, 0]; for (const v of Object.values(BB.votes)) c[v - 1]++; const best = c.indexOf(Math.max(...c)); BB.theme = BB.opts[best]; BB.ph = 'build'; BB.end = now + 5 * 60000; chat('§6§lThe theme is: §f' + BB.theme + ' §7(' + c[best] + ' vote' + (c[best] == 1 ? '' : 's') + ') §6- you have 5 minutes!'); SND.play('random/levelup', .6); }
    netOut({ t: 'chat', msg: '§6Build Battle: ' + (BB.ph == 'vote' ? 'vote 1) ' + BB.opts[0] + ' 2) ' + BB.opts[1] + ' 3) ' + BB.opts[2] : 'build "' + BB.theme + '"') });
  }
  if ((BB.sent = (BB.sent || 0) + 1) % 60 == 0) netOut({ t: 'bb', ph: BB.ph, end: BB.end, opts: BB.opts, theme: BB.theme });
}
const _chatBB = chat;
chat = function (msg) { _chatBB(msg); if (isBB() && NET.role != 'client' && BB.ph == 'vote') { const m = /^<(.{1,24}?)> ([123])$/.exec(String(msg)); if (m) BB.votes[m[1]] = +m[2]; } };
function bbDraw() {
  if (!isBB() || S.screen != 'game' || !BB.ph) return; const left = Math.max(0, Math.round((BB.end - Date.now()) / 1000)), tm = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  const s = BB.ph == 'vote' ? '§eVote: §f1) ' + BB.opts[0] + '  2) ' + BB.opts[1] + '  3) ' + BB.opts[2] + '  §7(' + tm + ')' : '§6Build: §f' + BB.theme + '  §7' + tm + ' left';
  const w = textW(s) + 12; cx2.fillStyle = 'rgba(0,0,0,.6)'; cx2.fillRect(UW / 2 - w / 2, 4, w, 13); textC(s, UW / 2, 7, '#FFFFFF');
}
// ---- showcase statues stay statues after reloading or rejoining ----
const _updWorldFr = updateWorld;
updateWorld = function (dt) { _updWorldFr(dt); bbTick(); if (world && world.meta.showcase) for (const m of mobs) if (!m.statue || !m.ghost) { m.ghost = true; m.statue = 1; m.persist = 1; m.vx = m.vy = m.vz = 0; } };
const _scInfo = typeof showcaseInfo == 'function' ? showcaseInfo : null;
showcaseInfo = function () { if (_scInfo) _scInfo(); bbDraw(); };
