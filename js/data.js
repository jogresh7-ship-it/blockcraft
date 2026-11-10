'use strict';
// ---------- gameplay data: hardness, tools, drops, recipes, smelting, food ----------
const TOOL_TIERS = { wooden: [0, 2, 59], golden: [0, 12, 32], stone: [1, 4, 131], iron: [2, 6, 250], diamond: [3, 8, 1561], netherite: [4, 9, 2031] };
function toolInfo(k) {
  const n = keyName(k) || ''; const m = n.match(/^(wooden|golden|stone|iron|diamond|netherite)_(pickaxe|axe|shovel|sword|hoe)$/);
  if (!m) return n == 'shears' ? { type: 'shears', tier: 0, speed: 2, dur: 238 } : null;
  const t = TOOL_TIERS[m[1]]; return { type: m[2], tier: t[0], speed: t[1], dur: t[2], mat: m[1] };
}
const toolDurability = k => (toolInfo(k) || {}).dur || (ARMOR(k) ? ARMOR(k).dur : 100);
function blockProps(id) {
  const n = BL[id].n;
  if (BL[id].slab && BYNAME[BL[id].slab]) return blockProps(BYNAME[BL[id].slab]);
  if (/_door|_trapdoor/.test(n)) return /iron|copper/.test(n) ? { h: 5, tool: 'pickaxe', tier: 0 } : { h: 3, tool: 'axe' };
  if (FLUID[id]) return { h: -1 };
  if (/^(bedrock|command_block|chain_command_block|repeating_command_block|barrier|end_portal_frame|jigsaw|structure_block|reinforced_deepslate|nether_portal|light)$/.test(n) || /command_block/.test(n)) return { h: -1 };
  if (SHAPE[id] == 2 || /^(tnt|fire|soul_fire|sugar_cane|kelp|kelp_plant)$/.test(n)) return { h: 0 };
  if (SHAPE[id] == 3 || SHAPE[id] == 4) return { h: -1 };
  if (/obsidian|ancient_debris|netherite_block|respawn_anchor/.test(n)) return { h: 50, tool: 'pickaxe', tier: 3 };
  if (/(diamond_ore|emerald_ore|gold_ore|redstone_ore)$/.test(n) && !/nether_gold/.test(n)) return { h: 3, tool: 'pickaxe', tier: 2 };
  if (/(iron_ore|lapis_ore|copper_ore)$/.test(n)) return { h: 3, tool: 'pickaxe', tier: 1 };
  if (/(iron|gold|diamond|emerald|lapis|copper|raw_.+)_block$|^(anvil|cauldron|heavy_core)$/.test(n)) return { h: 5, tool: 'pickaxe', tier: /iron|lapis|copper/.test(n) ? 1 : /anvil|cauldron|heavy/.test(n) ? 0 : 2 };
  if (/_ore$|deepslate/.test(n)) return { h: 3, tool: 'pickaxe', tier: 0 };
  if (/(leaves)$/.test(n)) return { h: .2, tool: 'hoe' };
  if (/(glass|glowstone|sea_lantern|redstone_lamp|beacon)/.test(n)) return { h: .3 };
  if (/^(ice|packed_ice|blue_ice|frosted_ice)$/.test(n)) return { h: .5, tool: 'pickaxe' };
  if (/(wool)$/.test(n)) return { h: .8, tool: 'shears' };
  if (/^(cactus|netherrack|crimson_nylium|warped_nylium)$/.test(n)) return { h: .4, tool: n == 'cactus' ? null : 'pickaxe', tier: n == 'cactus' ? undefined : 0 };
  if (/(grass_block|dirt|gravel|sand|clay|snow|farmland|mycelium|podzol|soul_s|mud$|concrete_powder|dirt_path|moss_block)/.test(n) && !/sandstone/.test(n)) return { h: .6, tool: 'shovel' };
  if (/(planks|_log|wood|_stem|bookshelf|crafting_table|chest|barrel|lectern|composter|note_block|jukebox|loom|cartography|fletching|smithing|beehive|bee_nest|bamboo|pumpkin|melon|jack_o|hyphae|mushroom_block|campfire|creaking)/.test(n)) return { h: 2, tool: 'axe' };
  if (/(sponge|hay_block|target|dried_kelp|honey|slime)/.test(n)) return { h: .5, tool: 'hoe' };
  return { h: 1.5, tool: 'pickaxe', tier: 0 };
}
function breakTime(id, held, inWater, onGround) {
  const p = blockProps(id); if (p.h < 0) return Infinity; if (p.h == 0) return 0;
  const t = held ? toolInfo(held) : null; const right = t && p.tool && t.type == p.tool;
  const canHarvest = !p.tool || p.tier === undefined || (right && t.tier >= p.tier);
  let speed = right ? t.speed : (t && t.type == 'sword' && /cobweb|leaves/.test(BL[id].n) ? 1.5 : 1);
  if (t && t.type == 'shears' && /(leaves|wool|cobweb)/.test(BL[id].n)) speed = 5;
  let dmg = speed / p.h / (canHarvest ? 30 : 100); if (inWater) dmg /= 5; if (!onGround) dmg /= 5;
  if (dmg >= 1) return 0; return Math.ceil(1 / dmg) / 20;
}
function canHarvest(id, held) { const p = blockProps(id); if (!p.tool || p.tier === undefined) return true; const t = held ? toolInfo(held) : null; return !!(t && t.type == p.tool && t.tier >= p.tier); }
function drops(id, held) {
  const n = BL[id].n, I = itemKey, r = Math.random(), t = held ? toolInfo(held) : null;
  if (!canHarvest(id, held)) return [];
  if (BL[id].top) return [];
  if (/_bed_head$/.test(n)) return [];
  { const W = n.replace(/^wall_torch$/, 'torch').replace('_wall_torch', '_torch').replace('_coral_wall_fan', '_coral_fan').replace('_wall_sign', '_sign').replace('_wall_banner', '_banner').replace('_wall_head', '_head').replace('_wall_skull', '_skull'); if (W != n && BYNAME[W]) return [[I(W), 1]]; }
  if (BL[id].invisible) return [];
  const ALT = { lever_on: 'lever', stone_button_on: 'stone_button', stone_pressure_plate_on: 'stone_pressure_plate', oak_pressure_plate_on: 'oak_pressure_plate', redstone_lamp_on: 'redstone_lamp', furnace_lit: 'furnace', redstone_torch_off: 'redstone_torch' };
  if (ALT[n]) return [[I(ALT[n]), 1]];
  if (FLUID[id]) return [];
  if (/_door/.test(n) && !/trapdoor/.test(n)) return /_top/.test(n) ? [] : [[I(n.replace('_open', '')), 1]];
  if (/_trapdoor_open$/.test(n)) return [[I(n.replace('_open', '')), 1]];
  if (/_slab_top$/.test(n)) return [[I(n.replace('_top', '')), 1]];
  if (n == 'redstone_wire') return [[I('item:redstone'), 1]];
  if (/piston_head|daylight_sensor_dummy/.test(n)) return [];
  if (/^(tall_grass|large_fern)$/.test(n)) return r < .125 ? [[I('item:wheat_seeds'), 1]] : [];
  if (t && t.type == 'shears' && /(leaves|short_grass|fern|tall_grass|vine|seagrass|dead_bush)/.test(n)) return [[id, 1]];
  const ore = { coal_ore: ['coal', 1], iron_ore: ['raw_iron', 1], gold_ore: ['raw_gold', 1], copper_ore: ['raw_copper', 2 + Math.floor(r * 3)], diamond_ore: ['diamond', 1], emerald_ore: ['emerald', 1],
    lapis_ore: ['lapis_lazuli', 4 + Math.floor(r * 5)], redstone_ore: ['redstone', 4 + Math.floor(r * 2)], nether_quartz_ore: ['quartz', 1], nether_gold_ore: ['gold_nugget', 2 + Math.floor(r * 4)] };
  const base = n.replace(/^deepslate_/, '');
  if (ore[base]) return [[I('item:' + ore[base][0]) || I(ore[base][0]), ore[base][1]]];
  if (/^(grass_block|snowy_grass_block|dirt_path|farmland|mycelium|podzol)$/.test(n)) return [[I('dirt'), 1]];
  if (n == 'stone') return [[I('cobblestone'), 1]];
  if (n == 'deepslate') return [[I('cobbled_deepslate'), 1]];
  if (/leaves$/.test(n)) { const out = []; const sap = I(n.replace('_leaves', '_sapling')); if (r < .05 && sap) out.push([sap, 1]); if (Math.random() < .02) out.push([I('item:stick'), 1 + (Math.random() * 2 | 0)]); if (/^(oak|dark_oak)_leaves$/.test(n) && Math.random() < .005) out.push([I('item:apple'), 1]); return out; }
  if (/^(short_grass|tall_grass|fern|large_fern)$/.test(n)) return r < .125 ? [[I('item:wheat_seeds'), 1]] : [];
  if (/(glass|^ice$|packed_ice|blue_ice)/.test(n) && !/tinted/.test(n)) return [];
  if (n == 'gravel') return [[r < .1 ? I('item:flint') : id, 1]];
  if (n == 'glowstone') return [[I('item:glowstone_dust'), 2 + Math.floor(r * 3)]];
  if (n == 'melon') return [[I('item:melon_slice'), 3 + Math.floor(r * 5)]];
  if (n == 'clay') return [[I('item:clay_ball'), 4]];
  if (n == 'snow_block') return [[I('item:snowball'), 4]];
  if (n == 'bookshelf') return [[I('item:book'), 3]];
  if (n == 'wheat') return [[I('item:wheat'), 1], [I('item:wheat_seeds'), 1 + Math.floor(r * 3)]];
  if (n == 'carrots') return [[I('item:carrot'), 2 + Math.floor(r * 3)]];
  if (n == 'potatoes') return [[I('item:potato'), 2 + Math.floor(r * 3)]];
  if (n == 'beetroots') return [[I('item:beetroot'), 1], [I('item:beetroot_seeds'), 1 + Math.floor(r * 2)]];
  if (n == 'sweet_berry_bush') return [[I('item:sweet_berries'), 2 + Math.floor(r * 2)]];
  if (/^(fire|soul_fire|cobweb|dead_bush|seagrass|kelp_plant)$/.test(n)) return n == 'cobweb' && t && t.type == 'sword' ? [[I('item:string'), 1]] : n == 'kelp_plant' ? [[I('kelp') || id, 1]] : n == 'dead_bush' ? [[I('item:stick'), Math.floor(r * 3)]] : [];
  return [[id, 1]];
}
const FOOD = { apple: 4, bread: 5, porkchop: 3, cooked_porkchop: 8, beef: 3, cooked_beef: 8, mutton: 2, cooked_mutton: 6, chicken: 2, cooked_chicken: 6, carrot: 3, potato: 1, baked_potato: 5,
  golden_apple: 4, enchanted_golden_apple: 4, cookie: 2, melon_slice: 2, sweet_berries: 2, glow_berries: 2, dried_kelp: 1, rotten_flesh: 4, cod: 2, cooked_cod: 5, salmon: 2, cooked_salmon: 6,
  pumpkin_pie: 8, beetroot: 1, beetroot_soup: 6, mushroom_stew: 6, rabbit_stew: 10, golden_carrot: 6, cooked_rabbit: 5, rabbit: 3, tropical_fish: 1, honey_bottle: 6, chorus_fruit: 4, suspicious_stew: 6 };
const foodVal = k => k >= ITEM_BASE ? FOOD[keyName(k)] : 0;
const ARMOR_PTS = { leather: [1, 3, 2, 1, 55], golden: [2, 5, 3, 1, 77], chainmail: [2, 5, 4, 1, 166], iron: [2, 6, 5, 2, 165], diamond: [3, 8, 6, 3, 363], netherite: [3, 8, 6, 3, 407], copper: [2, 4, 3, 1, 121], turtle: [2, 0, 0, 0, 275] };
function ARMOR(k) {
  const n = keyName(k) || ''; if (n == 'elytra') return { slot: 1, pts: 0, dur: 432 }; const m = n.match(/^(leather|golden|chainmail|iron|diamond|netherite|copper|turtle)_(helmet|chestplate|leggings|boots)$/); if (!m) return null;
  const slot = ['helmet', 'chestplate', 'leggings', 'boots'].indexOf(m[2]); return { slot, pts: ARMOR_PTS[m[1]][slot], dur: ARMOR_PTS[m[1]][4] * (slot == 1 ? 1.2 : 1) | 0 };
}
function attackDamage(k) {
  const t = k ? toolInfo(k) : null; if (!t) return 1;
  const base = { sword: [4, 5, 6, 7, 8], axe: [7, 9, 9, 9, 10], pickaxe: [2, 3, 4, 5, 6], shovel: [2.5, 3.5, 4.5, 5.5, 6.5], hoe: [1, 1, 1, 1, 1], shears: [1] }[t.type];
  return (base[t.tier] || 1) * (t.mat == 'golden' ? 1 : 1);
}
// ---- recipes ----
const TAGS = {
  planks: ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped', 'poplar'].map(w => w + '_planks'),
  logs: ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'poplar'].flatMap(w => [w + '_log', 'stripped_' + w + '_log']).concat(['crimson_stem', 'warped_stem', 'stripped_crimson_stem', 'stripped_warped_stem']),
  stone_tool: ['cobblestone', 'cobbled_deepslate', 'blackstone'], coal: ['item:coal', 'item:charcoal'], wool: ['white_wool', 'orange_wool', 'magenta_wool', 'light_blue_wool', 'yellow_wool', 'lime_wool', 'pink_wool', 'gray_wool', 'light_gray_wool', 'cyan_wool', 'purple_wool', 'blue_wool', 'brown_wool', 'green_wool', 'red_wool', 'black_wool'],
};
const RECIPES = [];
function R(pattern, key, out, n = 1) { RECIPES.push({ p: pattern, key, out, n }); }
function RS(ingr, out, n = 1) { RECIPES.push({ s: ingr, out, n }); }
function setupRecipes() {
  for (const w of ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'poplar']) for (const l of [w + '_log', 'stripped_' + w + '_log']) RS([l], w + '_planks', 4);
  for (const w of ['crimson', 'warped']) for (const l of [w + '_stem', 'stripped_' + w + '_stem']) RS([l], w + '_planks', 4);
  RS(['bamboo_block'], 'bamboo_planks', 2);
  R(['P', 'P'], { P: '#planks' }, 'item:stick', 4);
  R(['PP', 'PP'], { P: '#planks' }, 'crafting_table');
  R(['PPP', 'P P', 'PPP'], { P: '#planks' }, 'chest');
  R(['PPP', 'P P', 'PPP'], { P: '#planks' }, 'barrel');
  R(['CCC', 'C C', 'CCC'], { C: '#stone_tool' }, 'furnace');
  R(['c', 's'], { c: '#coal', s: 'item:stick' }, 'torch', 4);
  R(['r', 's'], { r: 'item:redstone', s: 'item:stick' }, 'redstone_torch');
  for (const w of ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped']) { R(['PP', 'PP', 'PP'], { P: w + '_planks' }, w + '_door', 3); R(['PPP', 'PPP'], { P: w + '_planks' }, w + '_trapdoor', 2); R(['PPP'], { P: w + '_planks' }, w + '_slab', 6); }
  R(['II', 'II', 'II'], { I: 'item:iron_ingot' }, 'iron_door', 3); R(['II', 'II'], { I: 'item:iron_ingot' }, 'iron_trapdoor');
  for (const [s, f] of [['stone', 'stone'], ['cobblestone', 'cobblestone'], ['stone_brick', 'stone_bricks'], ['brick', 'bricks'], ['sandstone', 'sandstone'], ['smooth_stone', 'smooth_stone'], ['andesite', 'andesite'], ['granite', 'granite'], ['diorite', 'diorite'], ['cobbled_deepslate', 'cobbled_deepslate'], ['nether_brick', 'nether_bricks'], ['quartz', 'quartz_block']]) R(['XXX'], { X: f }, s + '_slab', 6); R(['s', 'c'], { s: 'item:stick', c: 'cobblestone' }, 'lever'); RS(['stone'], 'stone_button'); R(['SS'], { S: 'stone' }, 'stone_pressure_plate'); R(['PP'], { P: '#planks' }, 'oak_pressure_plate');
  R([' r ', 'rgr', ' r '], { r: 'item:redstone', g: 'glowstone' }, 'redstone_lamp'); R(['PPP', 'CIC', 'CrC'], { P: '#planks', C: 'cobblestone', I: 'item:iron_ingot', r: 'item:redstone' }, 'piston'); RS(['item:slime_ball', 'piston'], 'sticky_piston');
  R(['PPP', 'PrP', 'PPP'], { P: '#planks', r: 'item:redstone' }, 'note_block'); R(['rrr', 'rrr', 'rrr'], { r: 'item:redstone' }, 'redstone_block');
  const mats = { wooden: '#planks', stone: '#stone_tool', iron: 'item:iron_ingot', golden: 'item:gold_ingot', diamond: 'item:diamond', copper: 'item:copper_ingot' };
  for (const [m, M] of Object.entries(mats)) {
    const k = { M, s: 'item:stick' };
    R(['MMM', ' s ', ' s '], k, `item:${m}_pickaxe`); R(['MM', 'Ms', ' s'], k, `item:${m}_axe`); R(['M', 's', 's'], k, `item:${m}_shovel`); R(['M', 'M', 's'], k, `item:${m}_sword`); R(['MM', ' s', ' s'], k, `item:${m}_hoe`);
  }
  const am = { leather: 'item:leather', iron: 'item:iron_ingot', golden: 'item:gold_ingot', diamond: 'item:diamond', copper: 'item:copper_ingot' };
  for (const [m, M] of Object.entries(am)) { const k = { M }; R(['MMM', 'M M'], k, `item:${m}_helmet`); R(['M M', 'MMM', 'MMM'], k, `item:${m}_chestplate`); R(['MMM', 'M M', 'M M'], k, `item:${m}_leggings`); R(['M M', 'M M'], k, `item:${m}_boots`); }
  for (const [b, i] of [['iron_block', 'item:iron_ingot'], ['gold_block', 'item:gold_ingot'], ['diamond_block', 'item:diamond'], ['emerald_block', 'item:emerald'], ['coal_block', 'item:coal'], ['lapis_block', 'item:lapis_lazuli'], ['redstone_block', 'item:redstone'], ['copper_block', 'item:copper_ingot'], ['raw_iron_block', 'item:raw_iron'], ['raw_gold_block', 'item:raw_gold'], ['raw_copper_block', 'item:raw_copper'], ['hay_block', 'item:wheat'], ['bone_block', 'item:bone_meal'], ['slime_block', 'item:slime_ball']]) {
    R(['XXX', 'XXX', 'XXX'], { X: i }, b); RS([b], i, 9);
  }
  R(['XXX', 'XXX', 'XXX'], { X: 'item:gold_nugget' }, 'item:gold_ingot'); R(['XXX', 'XXX', 'XXX'], { X: 'item:iron_nugget' }, 'item:iron_ingot');
  R(['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4); R(['BB', 'BB'], { B: 'item:brick' }, 'bricks'); R(['ss', 'ss'], { s: 'sand' }, 'sandstone'); R(['ss', 'ss'], { s: 'red_sand' }, 'red_sandstone');
  R(['ss', 'ss'], { s: 'item:snowball' }, 'snow_block'); R(['cc', 'cc'], { c: 'item:clay_ball' }, 'clay'); R(['gg', 'gg'], { g: 'item:glowstone_dust' }, 'glowstone');
  R(['WWW'], { W: 'item:wheat' }, 'item:bread'); R(['SSS'], { S: 'sugar_cane' }, 'item:paper', 3); RS(['item:paper', 'item:paper', 'item:paper', 'item:leather'], 'item:book');
  R(['PPP', 'BBB', 'PPP'], { P: '#planks', B: 'item:book' }, 'bookshelf');
  R(['I I', ' I '], { I: 'item:iron_ingot' }, 'item:bucket'); R([' I', 'I '], { I: 'item:iron_ingot' }, 'item:shears');
  R(['GSG', 'SGS', 'GSG'], { G: 'item:gunpowder', S: '#sand' }, 'tnt'); TAGS.sand = ['sand', 'red_sand'];
  R([' s ', 's s', ' s '], { s: 'item:stick' }, 'item:bowl'.replace('bowl', 'bowl'));
  RS(['brown_mushroom', 'red_mushroom', 'item:bowl'], 'item:mushroom_stew');
  RS(['pumpkin'], 'item:pumpkin_seeds', 4); RS(['item:melon_slice'], 'item:melon_seeds');
  R(['WCW', 'CCC', 'WCW'].map(s => s), { W: 'item:wheat', C: 'item:cocoa_beans' }, 'item:cookie', 8);
  R(['ggg', 'gag', 'ggg'], { g: 'item:gold_ingot', a: 'item:apple' }, 'item:golden_apple');
  R(['ggg', 'gcg', 'ggg'], { g: 'item:gold_nugget', c: 'item:carrot' }, 'item:golden_carrot');
  RS(['item:bone'], 'item:bone_meal', 3); RS(['item:sugar_cane'.replace('item:', '')], 'item:sugar');
  R(['PPP', 'PPP'], { P: 'glass' }, 'glass_pane'.replace('glass_pane', 'glass'), 0);
  R(['s s', 'sss', 's s'], { s: 'item:stick' }, 'item:ladder');
  R(['PPP', 'PPP', ' s '], { P: '#planks', s: 'item:stick' }, 'item:oak_sign', 3);
  R(['P P', 'PPP'], { P: '#planks' }, 'item:oak_boat');
  R(['ss', 'ss'], { s: 'item:string' }, 'white_wool');
  R(['WWW', 'PPP'], { W: '#wool', P: '#planks' }, 'item:white_bed');
  R(['CCC', 'CRC', 'CCC'], { C: '#stone_tool', R: 'item:redstone' }, 'dispenser'.replace('dispenser', 'observer'), 0);
  R(['III', ' i ', 'iii'], { I: 'iron_block', i: 'item:iron_ingot' }, 'anvil');
  R(['P P', 'P P', 'PPP'], { P: '#planks' }, 'composter');
  R(['C C', 'C C', 'CCC'], { C: 'item:iron_ingot' }, 'cauldron');
  R([' b ', 'DOD', 'OOO'], { b: 'item:book', D: 'item:diamond', O: 'obsidian' }, 'enchanting_table');
  R(['III', 'SSS'], { I: 'item:iron_ingot', S: 'stone' }, 'stonecutter'.replace('stonecutter', 'stonecutter'), 0);
  R(['PP', 'PP'], { P: 'oak_planks'.replace('oak_planks', '#planks') }, 'crafting_table');
  R(['GGG', 'GsG', 'GGG'], { G: 'glass', s: 'item:nether_star' }, 'beacon');
  R(['cc', 'cc'], { c: 'cobblestone' }, 'cobblestone'.replace('cobblestone', 'stone_bricks'), 0);
  for (const r of RECIPES) if (r.n === 0) r.dead = true;
}
const SMELT = { 'item:raw_iron': 'item:iron_ingot', 'item:raw_gold': 'item:gold_ingot', 'item:raw_copper': 'item:copper_ingot', iron_ore: 'item:iron_ingot', gold_ore: 'item:gold_ingot', copper_ore: 'item:copper_ingot',
  deepslate_iron_ore: 'item:iron_ingot', deepslate_gold_ore: 'item:gold_ingot', diamond_ore: 'item:diamond', sand: 'glass', red_sand: 'glass', cobblestone: 'stone', stone: 'smooth_stone', cobbled_deepslate: 'deepslate',
  'item:clay_ball': 'item:brick', clay: 'terracotta', 'item:porkchop': 'item:cooked_porkchop', 'item:beef': 'item:cooked_beef', 'item:mutton': 'item:cooked_mutton', 'item:chicken': 'item:cooked_chicken',
  'item:potato': 'item:baked_potato', 'item:cod': 'item:cooked_cod', 'item:salmon': 'item:cooked_salmon', 'item:rabbit': 'item:cooked_rabbit', cactus: 'item:green_dye', wet_sponge: 'sponge', netherrack: 'item:nether_brick',
  kelp: 'item:dried_kelp', stone_bricks: 'cracked_stone_bricks', sandstone: 'smooth_sandstone', 'item:ancient_debris': 'item:netherite_scrap', ancient_debris: 'item:netherite_scrap', quartz_block: 'smooth_quartz' };
function smeltResult(k) {
  const n = keyName(k); const r = SMELT[(k >= ITEM_BASE ? 'item:' : '') + n] || (k < ITEM_BASE && TAGS.logs.includes(n) ? 'item:charcoal' : null);
  return r ? itemKey(r) : 0;
}
function fuelTime(k) { // seconds
  const n = keyName(k) || '';
  if (n == 'coal' || n == 'charcoal') return 80; if (n == 'coal_block') return 800; if (n == 'lava_bucket') return 1000; if (n == 'blaze_rod') return 120;
  if (/planks|_log|_stem|crafting_table|bookshelf|chest|barrel|composter/.test(n)) return 15; if (n == 'stick' || /sapling/.test(n)) return 5; if (/^wooden_/.test(n)) return 10;
  if (n == 'dried_kelp_block') return 200; if (/wool|carpet/.test(n)) return 5; if (n == 'bamboo') return 2.5; return 0;
}
function matchIng(spec, k) {
  if (!k) return false; const n = (k >= ITEM_BASE ? 'item:' : '') + keyName(k);
  if (spec[0] == '#') return TAGS[spec.slice(1)].some(t => itemKey(t) == k);
  return itemKey(spec) == k || spec == n;
}
function craft(grid, w) { // grid: array w*w of stacks
  const cells = grid.map(s => s ? s.k : 0); const filled = cells.filter(Boolean);
  if (!filled.length) return null;
  // bounding box
  let x0 = w, y0 = w, x1 = -1, y1 = -1; cells.forEach((c, i) => { if (c) { const x = i % w, y = i / w | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.dead) continue;
    if (r.s) {
      if (r.s.length != filled.length) continue; const pool = filled.slice(); let ok = true;
      for (const s of r.s) { const i = pool.findIndex(k => matchIng(s, k)); if (i < 0) { ok = false; break; } pool.splice(i, 1); }
      if (ok) { const k = itemKey(r.out); if (k) return { k, c: r.n }; }
      continue;
    }
    const ph = r.p.length, pw = Math.max(...r.p.map(s => s.length)); if (pw != bw || ph != bh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < ph && ok; y++) for (let x = 0; x < pw && ok; x++) {
        const ch = (r.p[y][mirror ? pw - 1 - x : x] || ' '), k = cells[(y0 + y) * w + x0 + x];
        if (ch == ' ') { if (k) ok = false; } else if (!matchIng(r.key[ch], k)) ok = false;
      }
      if (ok) { const k = itemKey(r.out); if (k) return { k, c: r.n }; }
    }
  }
  return null;
}
