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
  copper_golem: () => false, polar_bear: n => n == 'fox', fox: n => /^(chicken|rabbit|cod|salmon)$/.test(n),
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
  m.inW = inW;
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
  if (NET.role == 'client' || mobs.length > 45 || world.dim == 'nether' || world.meta.map || world.meta.showcase) return;
  const H = world.N.hash(c.cx, 4321, c.cz); if (H > .08) return;
  const x = c.cx * 16 + Math.floor(world.N.hash(c.cx, 7, c.cz) * 16), z = c.cz * 16 + Math.floor(world.N.hash(c.cx, 8, c.cz) * 16), y = world.topY(x, z), top = BL[world.get(x, y, z)]?.n, bio = world.biome(x, z);
  let t = null, n = 1;
  if (top == 'water') { const k = world.N.hash(c.cx, 9, c.cz); t = /swamp/.test(bio) ? (k < .5 ? 'frog' : 'tadpole') : /beach/.test(bio) ? 'turtle' : k < .4 ? 'cod' : k < .65 ? 'salmon' : k < .8 ? 'squid' : k < .9 ? 'dolphin' : k < .95 ? 'pufferfish' : 'axolotl'; n = /cod|salmon|tadpole/.test(t) ? 4 : t == 'dolphin' ? 3 : 1; }
  else if (/^(grass_block|sand|red_sand|snow_block|snowy_grass_block|podzol)$/.test(top)) {
    const L = /jungle/.test(bio) ? ['ocelot', 'parrot', 'panda', 'parrot'] : /bamboo/.test(bio) ? ['panda'] : /desert/.test(bio) ? ['rabbit', 'camel'] : /savanna/.test(bio) ? ['armadillo', 'llama', 'rabbit'] : /mountain|peak|meadow|windswept/.test(bio) ? ['llama', 'rabbit'] : /swamp/.test(bio) ? ['frog'] : /beach/.test(bio) ? ['turtle'] : /flower|cherry/.test(bio) ? ['bee', 'rabbit'] : /taiga|snowy|grove/.test(bio) ? ['fox', 'fox', 'rabbit'] : /forest|birch|plains/.test(bio) ? ['rabbit', 'bee', 'cat'] : ['rabbit'];
    t = L[Math.floor(world.N.hash(c.cx, 11, c.cz) * L.length)]; n = t == 'rabbit' ? 3 : t == 'llama' ? 3 : t == 'bee' ? 2 : 1;
  }
  if (!t || !MOBDEF[t]) return;
  for (let i = 0; i < n; i++) spawnMob(t, x + .5 + i * .6, y + (top == 'water' ? -1 : 1), z + .5);
};
// ---- special attacks ----
for (const [n, f] of Object.entries({ shulker: 'bullet', guardian: 'laser', elder_guardian: 'laser', breeze: 'wind', wither: 'skull', warden: 'boom', drowned: 'trident', phantom: 'swoop', llama: 'spit', snow_golem: 'snowball', evoker: 'fangs' })) if (MOBDEF[n]) MOBDEF[n].special = f;
function mobShot(m, t, o) { const sx = m.x, sy = m.y + (o.y ?? m.h * .6), sz = m.z, dx = t.x - sx, dy = t.y + (t === player ? 1.1 : (t.h || 1) / 2) - sy, dz = t.z - sz, d = Math.hypot(dx, dy, dz) || 1, sp = o.sp || 12;
  const a = { x: sx, y: sy, z: sz, vx: dx / d * sp, vy: dy / d * sp + (o.grav ? d * o.grav / sp / 2 : 0), vz: dz / d * sp, life: o.life || 8, grav: o.grav || 0, k: o.k, from: m, onPlayer: o.onPlayer, onHit: o.onHit, home: o.home ? t : null, big: o.big, wet: o.wet };
  arrows.push(a); return a; }
const IK = n => itemKey('item:' + n) || itemKey(n);
function shoveFrom(x, y, z, R, pow) { const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, player.y - y, dz); if (d < R) { const k = (1 - d / R) * pow; player.vx += dx / (d || 1) * k; player.vz += dz / (d || 1) * k; player.vy = Math.max(player.vy, k * .9); } for (let i = 0; i < 14; i++) particles.push({ x: x + (Math.random() - .5) * R, y: y + Math.random() * R * .5, z: z + (Math.random() - .5) * R, vx: (Math.random() - .5) * 3, vy: Math.random() * 2, vz: (Math.random() - .5) * 3, life: .5, tile: TEX[(BYNAME.white_wool || 1) * 4], g: 0, s: .12 }); }
function specialAttack(m, D, dt, t) {
  const dx = t.x - m.x, dz = t.z - m.z, dist = Math.hypot(dx, t.y - m.y, dz), P = player, eff = (n, s, a) => { if (t === P && typeof addEff == 'function' && P.mode == 'survival') addEff(n, s, a || 0); };
  const hurtT = (dmg, msg, ign) => { if (t === P) hurtPlayer(dmg, msg, ign, [m.x, m.y, m.z]); else hurtMob(t, dmg, dx / (dist || 1) * .3, dz / (dist || 1) * .3); };
  m.spc = (m.spc ?? 1 + Math.random() * 2) - dt;
  switch (D.special) {
    case 'bullet': if (dist < 16 && m.spc <= 0) { m.spc = 1 + Math.random() * 5; m.peek = 1.5; SND.play('mob/shulker/shoot1', 1, 1, [m.x, m.y, m.z]); mobShot(m, t, { sp: 5, life: 10, k: IK('shulker_shell'), home: 1, big: .2, onPlayer: () => { hurtT(4, 'was shot by a Shulker'); eff('levitation', 10); } }); } m.peek = Math.max(0, (m.peek || 0) - dt); break;
    case 'laser': if (dist < 15) { m.beam = (m.beam || 0) + dt; for (let i = 0; i < 3; i++) { const k = Math.random(); particles.push({ x: m.x + dx * k, y: m.y + .5 + (t.y + 1 - m.y - .5) * k, z: m.z + dz * k, vx: 0, vy: 0, vz: 0, life: .15, tile: TEX[(BYNAME.cyan_concrete || 1) * 4], g: 0, s: .06 + m.beam * .03 }); }
        if (m.beam > 2) { m.beam = 0; SND.play('mob/guardian/attack_loop', 1, 1, [m.x, m.y, m.z]); hurtT(m.type == 'elder_guardian' ? 8 : 6, 'was killed by a Guardian', false); } } else m.beam = 0;
      if (m.type == 'elder_guardian' && (m.fatT = (m.fatT ?? 5) - dt) <= 0 && Math.hypot(P.x - m.x, P.z - m.z) < 50) { m.fatT = 60; eff('slowness', 300, 1); SND.play('mob/guardian/elder_curse', 1); } break;
    case 'wind': if (dist < 16 && m.spc <= 0) { m.spc = 2 + Math.random(); SND.play('mob/breeze/shoot', 1, 1, [m.x, m.y, m.z]); const hit = a => { shoveFrom(a.x, a.y, a.z, 3, 14); SND.play('mob/breeze/wind_burst1', 1, 1, [a.x, a.y, a.z]); }; mobShot(m, t, { sp: 14, k: IK('wind_charge'), onPlayer: a => { hurtT(1, 'was blown away by a Breeze'); hit(a); }, onHit: (o, x, y, z) => hit({ x, y, z }) }); }
      if (m.ground && Math.random() < dt * .5) { m.vy = 9; m.kx = (Math.random() - .5) * 6; m.kz = (Math.random() - .5) * 6; SND.play('mob/breeze/jump1', .7, 1, [m.x, m.y, m.z]); } break;
    case 'skull': if (dist < 30 && m.spc <= 0) { m.spc = .9 + Math.random() * .8; SND.play('mob/wither/shoot', 1, 1, [m.x, m.y, m.z]); const boom = (x, y, z) => explode(x, y, z, 1.2, .4); mobShot(m, t, { sp: 10, y: 3, k: itemKey('wither_skeleton_skull'), onPlayer: a => { hurtT(8, 'was killed by the Wither'); eff('wither', 10, 1); boom(a.x, a.y, a.z); }, onHit: (o, x, y, z) => boom(x, y, z) }); } break;
    case 'boom': if (dist > 4 && dist < 16 && m.spc <= 0) { m.spc = 6; m.boomT = 1.7; SND.play('mob/warden/sonic_charge1', 1, 1, [m.x, m.y, m.z]); }
      if (m.boomT > 0) { m.mv = 0; m.boomT -= dt; if (m.boomT <= 0) { SND.play('mob/warden/sonic_boom1', 1, 1, [m.x, m.y, m.z]); for (let k = 0; k < 1; k += .06) particles.push({ x: m.x + dx * k, y: m.y + 1.8 + (t.y + 1 - m.y - 1.8) * k, z: m.z + dz * k, vx: 0, vy: 0, vz: 0, life: .5, tile: TEX[(BYNAME.light_blue_wool || 1) * 4], g: 0, s: .3 }); if (dist < 16) { hurtT(10, 'was obliterated by a sonically-charged shriek', true); if (t === P) { P.vx += dx / dist * 6; P.vy += 3; P.vz += dz / dist * 6; } } } } break;
    case 'trident': if (m.trid == null) m.trid = Math.random() < .25; if (m.trid && dist > 4 && dist < 14 && m.spc <= 0) { m.spc = 3; SND.play('item/trident/throw1', 1, 1, [m.x, m.y, m.z]); mobShot(m, t, { sp: 20, grav: 10, k: IK('trident'), onPlayer: () => hurtT(8, 'was impaled by a Drowned') }); } break;
    case 'swoop': if (m.spc <= 0) { m.spc = 5 + Math.random() * 4; m.dive = 2.2; SND.play('mob/phantom/swoop1', 1, 1, [m.x, m.y, m.z]); }
      if (m.dive > 0) { m.dive -= dt; m.speedMul = 4; if (dist < 1.8 && !(m.atkCd > 0)) { m.atkCd = 1.5; hurtT(D.dmg ? D.dmg[world.meta.diff] || 2 : 2, 'was slain by a Phantom'); m.dive = 0; } } else { m.vy = Math.max(m.vy, 2); } break;
    case 'spit': if (m.provoked && dist < 12 && m.spc <= 0) { m.spc = 2; SND.play('mob/llama/spit1', 1, 1, [m.x, m.y, m.z]); mobShot(m, t, { sp: 14, grav: 6, y: 1.6, onPlayer: () => hurtT(1, 'was spat on by a Llama') }); } break;
    case 'snowball': if (dist < 12 && m.spc <= 0) { m.spc = 1; SND.play('random/bow', .6, 1, [m.x, m.y, m.z]); const tg = t; mobShot(m, t, { sp: 16, grav: 12, k: IK('snowball'), onPlayer: () => {} }); if (tg !== P) setTimeout(() => { if (!tg.dead) { tg.kx = (tg.x - m.x) * .2; tg.kz = (tg.z - m.z) * .2; tg.hurtT = 0; hurtMob(tg, tg.type == 'blaze' ? 3 : 0, 0, 0); } }, dist / 16 * 1000); } break;
    case 'fangs': if (dist < 10 && m.spc <= 0) { m.spc = 4; SND.play('mob/evocation_illager/cast1', 1, 1, [m.x, m.y, m.z]); for (let i = 1; i <= 8; i++) setTimeout(() => { if (!world || m.dead) return; const x = m.x + dx / dist * i * 1.2, z = m.z + dz / dist * i * 1.2; for (let j = 0; j < 6; j++) particles.push({ x, y: m.y + Math.random(), z, vx: 0, vy: 1, vz: 0, life: .4, tile: TEX[(BYNAME.white_concrete || 1) * 4], g: 0, s: .15 }); SND.play('mob/evocation_fangs/fangs', .5, 1, [x, m.y, z]); if (Math.hypot(P.x - x, P.z - z) < 1 && Math.abs(P.y - m.y) < 2) hurtT(6, 'was bitten by Evoker fangs'); }, i * 90); } break;
  }
}
const _mobLife2 = mobLife;
mobLife = function (m, D, dt) {
  _mobLife2(m, D, dt); if (m.dead) return;
  if (D.special) { const t = m.target || (m.mt && !m.mt.dead ? m.mt : null); if (t) specialAttack(m, D, dt, t); }
  // land animals keep to land: they turn back from water, lava and big drops (unless they swim)
  if (!D.water && !D.fly && !D.swim && !D.lavaWalk && m.mv > 0 && m.ground && !m.target) {
    const f = [-Math.sin(m.yaw), -Math.cos(m.yaw)], ax = Math.floor(m.x + f[0] * (m.r + .6)), az = Math.floor(m.z + f[1] * (m.r + .6)), ay = Math.floor(m.y);
    const ahead = BL[world.get(ax, ay, az)]?.n, below = world.get(ax, ay - 1, az), below2 = world.get(ax, ay - 2, az), below3 = world.get(ax, ay - 3, az);
    if (ahead == 'water' || ahead == 'lava' || BL[below]?.n == 'water' || BL[below]?.n == 'lava' || (!below && !below2 && !below3)) { m.yawT = m.yaw + Math.PI * (.7 + Math.random() * .6); m.wt = 1.5; }
  }
  // homing shulker bullets
  if (m === mobs[0]) for (const a of arrows) if (a.home && !a.stuck) { const t = a.home, dx = t.x - a.x, dy = t.y + 1 - a.y, dz = t.z - a.z, d = Math.hypot(dx, dy, dz) || 1; a.vx += (dx / d * 5 - a.vx) * dt * 2; a.vy += (dy / d * 5 - a.vy) * dt * 2; a.vz += (dz / d * 5 - a.vz) * dt * 2; }
};
