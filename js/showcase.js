// ---- Showcase world: a big superflat with every mob standing still as a statue and every block on display.
// Look at anything and the box at the top says what it is, what it does, whether it hurts and how long it takes to break ----
const nice = n => n.replace(/^item:/, '').split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const MOB_INFO = {
  zombie: 'Undead monster that walks toward you at night and burns in sunlight.', skeleton: 'Undead archer that shoots arrows from a distance and burns in daylight.', creeper: 'Sneaks up and explodes. Cats and ocelots scare it away.',
  spider: 'Climbs walls and attacks at night; calm during the day.', enderman: 'Teleports and picks up blocks. Looking at its eyes makes it angry.', pig: 'Farm animal. Ride it with a saddle and a carrot on a stick.',
  cow: 'Gives leather and beef, and milk if you use a bucket on it.', sheep: 'Shear it for wool, or dye it first.', chicken: 'Lays eggs and drops feathers.', wolf: 'Tame it with bones and it fights for you.',
  cat: 'Tame it with fish. Creepers and phantoms are afraid of it.', axolotl: 'Hunts fish and drowned underwater and plays dead when hurt.', bee: 'Pollinates flowers. Stings (poison) if you make it angry.',
  shulker: 'Hides in a shell in End cities and shoots homing bullets that make you float.', guardian: 'Guards ocean monuments and fires a laser after charging it.', breeze: 'Hops around trial chambers and blasts you away with wind charges.',
  wither: 'Three-headed boss you build from soul sand and skulls. Shoots exploding skulls.', ender_dragon: 'The boss of the End. Kill it to open the exit portal.', warden: 'Blind giant of the deep dark. Finds you by sound and fires a sonic boom.',
  villager: 'Trades items for emeralds. Lives in villages.', iron_golem: 'Protects villagers and throws monsters into the air.', creaking: 'Moves only when nobody is looking at it.',
  copper_golem: 'Built from a copper block and a carved pumpkin. Wanders around and sorts items.', phantom: 'Swoops at players who have not slept for days.', dolphin: 'Friendly swimmer that leads you to treasure.',
};
function mobInfo(t) { const D = MOBDEF[t] || {}; const kind = D.boss ? 'Boss' : D.hostile ? 'Hostile' : D.neutral ? 'Neutral' : 'Passive';
  const dmg = D.dmg ? D.dmg[2] || D.dmg[1] : 0;
  return { title: nice(t), lines: [MOB_INFO[t] || (D.hostile ? 'A monster that attacks you on sight.' : D.neutral ? 'Leaves you alone unless you attack it.' : 'A peaceful creature.'), kind + '  -  Health: ' + (D.hp || '?') / 2 + ' hearts' + (D.hostile || D.neutral ? '  -  Hurts: ' + (dmg ? dmg / 2 + ' hearts a hit' : 'yes') : '  -  Does not hurt you'),
    'Moves: ' + (D.fly ? 'flies' : D.water ? 'swims' : D.still ? 'stays in place' : 'walks') + (D.ranged ? ', attacks from far away' : '') + (D.burns ? ', burns in daylight' : '')] }; }
function blockInfo(id) {
  const b = BL[id], p = blockProps(id), n = b.n, tHand = breakTime(id, null, false, true), held = player && typeof player.inv != 'undefined' && player.inv[player.sel] ? player.inv[player.sel].k : null;
  const bt = v => v == Infinity ? 'cannot be broken' : v == 0 ? 'instantly' : v.toFixed(2) + ' s';
  const what = /ore$/.test(n) ? 'An ore: mine it for its resource.' : /log$|wood$/.test(n) ? 'Wood from a tree. Craft it into planks.' : /leaves$/.test(n) ? 'Tree leaves: they drop saplings and decay without logs nearby.' : /_stairs$/.test(n) ? 'Stairs: walk up them without jumping.' : /_slab$/.test(n) ? 'Half a block high.' : /door$/.test(n) ? 'Opens and closes when you use it.' : /glass/.test(n) ? 'See-through block.' : FLUID[id] ? 'A liquid: it flows and you can swim in it.' : /crop|wheat|carrots|potatoes|beetroots|stem|berry/.test(n) ? 'A plant that grows in stages.' : /lamp|torch|lantern|glowstone|froglight|sea_lantern/.test(n) ? 'Gives off light.' : /^(tnt)$/.test(n) ? 'Explodes when lit.' : /portal/.test(n) ? 'Takes you to another dimension.' : 'A building block.';
  const hurt = /^(magma_block|cactus|sweet_berry_bush|campfire|soul_campfire|fire|soul_fire|lava|wither_rose|pointed_dripstone|powder_snow)$/.test(n) ? 'Hurts you when you touch it' : 'Does not hurt';
  return { title: nice(n), lines: [what, hurt + '  -  Break by hand: ' + bt(tHand) + (held ? '  -  With held item: ' + bt(breakTime(id, held, false, true)) : ''), 'Tool: ' + (p.tool || 'any') + (p.tier !== undefined ? ' (tier ' + p.tier + '+)' : '') + (typeof LIGHT != 'undefined' && LIGHT[id] ? '  -  Light ' + LIGHT[id] : '')] };
}
function showcaseBuild() {
  const P = player, y = Math.floor(P.y); world.meta.showcaseBuilt = 2;
  const types = Object.keys(MOBDEF).filter(t => (MOBDEF[t].parts || MOBDEF[t].tex) && !MOBDEF[t].hide && !/^(player|minecart|boat|chest_boat|armor_stand|item_frame|ghost|tnt|falling_block)$/.test(t));
  types.forEach((t, i) => { const x = Math.floor(P.x) - 30 + (i % 12) * 5, z = Math.floor(P.z) - 12 - Math.floor(i / 12) * 6, D = MOBDEF[t];
    world.set(x, y - 1, z, BYNAME.polished_andesite || BYNAME.stone);
    const m = spawnMob(t, x + .5, y + (D.fly ? 1 : 0), z + .5); if (!m) return; m.ghost = true; m.statue = 1; m.persist = 1; m.yaw = Math.PI; m.vx = m.vy = m.vz = 0; });
  const blocks = BL.map((b, i) => i).filter(i => i && BL[i] && !BL[i].hide && !BL[i].top && (typeof isReal != 'function' || isReal(BL[i].n)) && !FLUID[i]);
  blocks.forEach((id, i) => { const x = Math.floor(P.x) - 40 + (i % 40) * 2, z = Math.floor(P.z) + 8 + Math.floor(i / 40) * 2; world.set(x, y, z, id); });
  chat('§aShowcase: mobs are in front of you, blocks behind you. Look at anything to learn about it.');
}
function showcaseInfo() {
  if (!world || !world.meta.showcase || S.screen != 'game' || !player) return;
  const P = player; let info = null;
  if (P.targetMob) info = mobInfo(P.targetMob.type); else if (P.target && P.target.b) info = blockInfo(P.target.b);
  if (!info) return;
  const w = Math.max(220, ...info.lines.map(l => textW(l) + 16), textW(info.title) * 2 + 16), x = Math.round(UW / 2 - w / 2), y = 6, h = 24 + info.lines.length * 11;
  cx2.fillStyle = 'rgba(16,0,16,.82)'; cx2.fillRect(x, y, w, h); cx2.strokeStyle = '#5000A0'; cx2.lineWidth = 1; cx2.strokeRect(x + .5, y + .5, w - 1, h - 1);
  cx2.save(); cx2.translate(UW / 2, y + 4); cx2.scale(1.5, 1.5); textC('§e' + info.title, 0, 0, '#FFFF55'); cx2.restore();
  info.lines.forEach((l, i) => textC(l, UW / 2, y + 20 + i * 11, '#E0E0E0'));
}
const _updWorldSC = updateWorld;
updateWorld = function (dt) { _updWorldSC(dt); if (world && world.meta.showcase && (world.meta.showcaseBuilt || 0) < 2 && player && S.screen == 'game') showcaseBuild(); };
