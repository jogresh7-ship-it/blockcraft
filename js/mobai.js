// ---- extra mob behaviour: who hates whom, water mobs, golems you build, biome spawns for the newer mobs ----
Object.assign(PREY, {
  wolf: n => /^(sheep|rabbit|fox|skeleton|stray|wither_skeleton|bogged)$/.test(n),
  cat: n => /^(chicken|rabbit)$/.test(n), ocelot: n => /^(chicken)$/.test(n),
  axolotl: n => /^(squid|glow_squid|drowned|cod|salmon|pufferfish|tadpole|guardian|elder_guardian)$/.test(n),
  frog: n => n == 'slime' || n == 'magma_cube',
  guardian: n => /^(squid|glow_squid|axolotl)$/.test(n), elder_guardian: n => /^(squid|glow_squid|axolotl)$/.test(n),
  enderman: n => n == 'endermite', piglin: n => n == 'wither_skeleton', piglin_brute: n => n == 'wither_skeleton', wither_skeleton: n => /^piglin/.test(n),
  zoglin: n => MOBDEF[n] && !/zoglin|creeper|ghast/.test(n),
  wither: n => MOBDEF[n] && !MOBDEF[n].undead && !/wither|zombie|skeleton|husk|drowned|stray|bogged|phantom|zoglin|ghast|minecart|player/.test(n),
  copper_golem: () => false, polar_bear: n => n == 'fox',
  llama: n => n == 'wolf',
  dolphin: () => false,
});
Object.assign(FEARS, {
  phantom: /^(cat|ocelot)$/, creeper: /^(cat|ocelot)$/, rabbit: /^(wolf|fox)$/, chicken: /^(fox|cat|ocelot)$/,
  wolf: /^llama$/, hoglin: /^$/, cod: /^(axolotl|dolphin)$/, salmon: /^(axolotl|dolphin)$/, tadpole: /^(axolotl|frog)$/, squid: /^(axolotl|guardian|elder_guardian)$/,
  villager: /^(zombie|husk|drowned|zombie_villager|pillager|vindicator|evoker|vex|zoglin|ravager)$/, turtle: /^(zombie|drowned|husk)$/,
});
const _mobLife = mobLife;
mobLife = function (m, D, dt) {
  _mobLife(m, D, dt); if (m.dead) return;
  const bx = Math.floor(m.x), by = Math.floor(m.y + .3), bz = Math.floor(m.z), inW = BL[world.get(bx, by, bz)]?.n == 'water';
  if (D.water) { // fish, dolphins, axolotls: keep to the water; out of it they flop and (fish) dry out
    if (inW) { m.dryT = 0; const f = [-Math.sin(m.yaw), -Math.cos(m.yaw)]; if (BL[world.get(Math.floor(m.x + f[0] * 1.2), by, Math.floor(m.z + f[1] * 1.2))]?.n != 'water') m.yawT = m.yaw + Math.PI * (.6 + Math.random() * .8); }
    else if (m.type != 'axolotl') { m.mv = 0; if (m.ground && Math.random() < dt * 2) { m.vy = 4; m.yawT = Math.random() * 6.28; } m.dryT = (m.dryT || 0) + dt; if (m.dryT > (m.type == 'dolphin' ? 120 : 15) && m.hurtT <= 0) hurtMob(m, 1, 0, 0, true); }
  }
  if (D.still) { m.mv = 0; m.vx = m.vz = 0; }
  if (D.freeze && m.target) { // the creaking only moves while nobody is looking at it
    const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz) || 1, f = [-Math.sin(player.yaw), -Math.cos(player.yaw)];
    if ((dx * f[0] + dz * f[1]) / d > .55) { m.mv = 0; m.atkCd = Math.max(m.atkCd || 0, .3); m.frozen = 1; } else m.frozen = 0;
  }
  if (D.immortal && m.hp < 1) m.hp = 1; // creakings only die when their heart is broken
  if (D.poison && !player.dead && Math.hypot(m.x - player.x, m.y - player.y, m.z - player.z) < 1.6 && (m.puffCd = (m.puffCd || 0) - dt) <= 0 && player.mode == 'survival') { m.puffCd = 2; if (typeof addEff == 'function') addEff('poison', 6, 0); hurtPlayer(1, 'was killed by a Pufferfish'); }
  if (m.type == 'bee' && m.provoked && m.target && Math.hypot(m.x - player.x, m.z - player.z) < 1.6 && m.atkCd > .9 && !m.stung) { m.stung = 1; if (typeof addEff == 'function') addEff('poison', 10, 0); }
  if (D.lavaWalk && BL[world.get(bx, Math.floor(m.y - .05), bz)]?.n == 'lava') { m.vy = Math.max(m.vy, 0); m.y = Math.floor(m.y - .05) + 1; m.ground = true; }
};
// build a golem: carved pumpkin on top of iron blocks (T shape), two snow blocks, or one copper block
function golemCheck(x, y, z, id) {
  const n = BL[id]?.n; if (!/^(carved_pumpkin|jack_o_lantern)$/.test(n)) return;
  const g = (dx, dy, dz) => BL[world.get(x + dx, y + dy, z + dz)]?.n || '';
  const clear = cells => { for (const c of cells) world.set(x + c[0], y + c[1], z + c[2], 0); world.set(x, y, z, 0); };
  if (g(0, -1, 0) == 'snow_block' && g(0, -2, 0) == 'snow_block') { clear([[0, -1, 0], [0, -2, 0]]); spawnMob('snow_golem', x + .5, y - 2, z + .5); return; }
  if (g(0, -1, 0) == 'iron_block' && g(0, -2, 0) == 'iron_block') for (const [ax, az] of [[1, 0], [0, 1]]) if (g(ax, -1, az) == 'iron_block' && g(-ax, -1, -az) == 'iron_block') { clear([[0, -1, 0], [0, -2, 0], [ax, -1, az], [-ax, -1, -az]]); spawnMob('iron_golem', x + .5, y - 2, z + .5); return; }
  if (/copper_block$|^copper_block$/.test(g(0, -1, 0)) && MOBDEF.copper_golem) { clear([[0, -1, 0]]); spawnMob('copper_golem', x + .5, y - 1, z + .5); SND.play('mob/copper_golem/spawn', 1, 1, [x, y, z]); }
}
// biome spawns for the newer animals (on top of the classic farm animals)
const _naturalSpawn = naturalSpawn;
naturalSpawn = function (c) {
  _naturalSpawn(c);
  if (NET.role == 'client' || mobs.length > 45 || world.dim == 'nether' || world.meta.map) return;
  const H = world.N.hash(c.cx, 4321, c.cz); if (H > .08) return;
  const x = c.cx * 16 + Math.floor(world.N.hash(c.cx, 7, c.cz) * 16), z = c.cz * 16 + Math.floor(world.N.hash(c.cx, 8, c.cz) * 16), y = world.topY(x, z), top = BL[world.get(x, y, z)]?.n, bio = world.biome(x, z);
  let t = null, n = 1;
  if (top == 'water') { const k = world.N.hash(c.cx, 9, c.cz); t = /swamp/.test(bio) ? (k < .5 ? 'frog' : 'tadpole') : /beach/.test(bio) ? 'turtle' : k < .4 ? 'cod' : k < .65 ? 'salmon' : k < .8 ? 'squid' : k < .9 ? 'dolphin' : k < .95 ? 'pufferfish' : 'axolotl'; n = /cod|salmon|tadpole/.test(t) ? 4 : t == 'dolphin' ? 3 : 1; }
  else if (/^(grass_block|sand|red_sand|snow_block|snowy_grass_block|podzol)$/.test(top)) {
    const L = /jungle/.test(bio) ? ['ocelot', 'parrot', 'panda', 'parrot'] : /bamboo/.test(bio) ? ['panda'] : /desert/.test(bio) ? ['rabbit', 'camel'] : /savanna/.test(bio) ? ['armadillo', 'llama', 'rabbit'] : /mountain|peak|meadow|windswept/.test(bio) ? ['llama', 'rabbit'] : /swamp/.test(bio) ? ['frog'] : /beach/.test(bio) ? ['turtle'] : /flower|cherry/.test(bio) ? ['bee', 'rabbit'] : /forest|birch|taiga|plains/.test(bio) ? ['rabbit', 'bee', 'cat'] : ['rabbit'];
    t = L[Math.floor(world.N.hash(c.cx, 11, c.cz) * L.length)]; n = t == 'rabbit' ? 3 : t == 'llama' ? 3 : t == 'bee' ? 2 : 1;
  }
  if (!t || !MOBDEF[t]) return;
  for (let i = 0; i < n; i++) spawnMob(t, x + .5 + i * .6, y + (top == 'water' ? -1 : 1), z + .5);
};
