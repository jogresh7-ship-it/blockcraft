import os, json, glob, shutil, math
from PIL import Image
SRC = '/root/tex/assets/minecraft/textures/'
OUT = os.environ.get('OUT', '/root/build/site/')
os.makedirs(OUT + 'gui', exist_ok=True)
T = 32

F64 = os.environ.get('PRIMARY', '/root/f64/assets/minecraft/textures/')
PFACT = float(os.environ.get('PFACT', '0.5'))
MISSING64 = []
def pick(path):
    alt = path.replace(SRC, F64)
    if os.path.exists(alt): return alt
    MISSING64.append(os.path.relpath(path, SRC)); return path
def first_frame(path):
    im = Image.open(pick(path)).convert('RGBA')
    w, h = im.size
    if h > w and h % w == 0:
        im = im.crop((0, 0, w, w))
    return im.resize((T, T), Image.NEAREST)

def tint(im, c):
    r, g, b, a = im.split()
    r = r.point(lambda v: v * c[0] // 255); g = g.point(lambda v: v * c[1] // 255); b = b.point(lambda v: v * c[2] // 255)
    return Image.merge('RGBA', (r, g, b, a))

GRASS = (124, 189, 107); FOLI = (89, 174, 48); SPRUCE = (97, 153, 97); BIRCH = (128, 167, 85); WATER = (63, 118, 228)
NOTINT_LEAVES = ('cherry', 'azalea', 'pale_oak', 'poplar')
def tint_for(n):
    if n.endswith('leaves') and not any(k in n for k in NOTINT_LEAVES):
        return SPRUCE if 'spruce' in n else BIRCH if 'birch' in n else FOLI
    if n in ('grass_block_top', 'short_grass', 'fern', 'tall_grass_bottom', 'tall_grass_top', 'large_fern_bottom', 'large_fern_top',
             'sugar_cane', 'vine', 'lily_pad', 'bush', 'grass_block_side_overlay'):
        return GRASS if 'grass' in n or n in ('bush',) else FOLI
    if n in ('water_still', 'water_flow'):
        return WATER
    return None

# ---------- block atlas ----------
names = sorted(os.path.basename(p)[:-4] for p in glob.glob(SRC + 'block/*.png'))
tiles = {}
for n in names:
    im = first_frame(SRC + 'block/' + n + '.png')
    t = tint_for(n)
    tiles[n] = tint(im, t) if t else im
# synthetic grass side + snowy grass
side = first_frame(SRC + 'block/grass_block_side.png')
side.alpha_composite(tint(first_frame(SRC + 'block/grass_block_side_overlay.png'), GRASS))
tiles['grass_block_side_tinted'] = side
tiles['redstone_dust_red'] = tint(first_frame(SRC + 'block/redstone_dust_dot.png'), (255, 40, 30))
tiles['redstone_line0_red'] = tint(first_frame(SRC + 'block/redstone_dust_line0.png'), (255, 40, 30))
tiles['redstone_line1_red'] = tint(first_frame(SRC + 'block/redstone_dust_line1.png'), (255, 40, 30))
order = list(tiles.keys())
COLS = 40
rows = math.ceil(len(order) / COLS)
atlas = Image.new('RGBA', (COLS * T, rows * T))
tidx = {}
alpha_kind = {}
for i, n in enumerate(order):
    atlas.paste(tiles[n], ((i % COLS) * T, (i // COLS) * T))
    tidx[n] = i
    a = tiles[n].getchannel('A')
    lo, hi = a.getextrema()
    if lo == 255: alpha_kind[n] = 0
    else:
        hist = a.histogram()
        mid = sum(hist[16:240])
        alpha_kind[n] = 2 if mid > 40 else 1   # 2 translucent, 1 cutout
atlas.save(OUT + 'blocks.png', optimize=True)

# animated strips
for n in ('water_still', 'lava_still'):
    im = Image.open(pick(SRC + 'block/' + n + '.png')).convert('RGBA')
    w, h = im.size
    im = im.resize((T, T * (h // w)), Image.NEAREST)
    if n == 'water_still': im = tint(im, WATER)
    im.save(OUT + n + '.png', optimize=True)

# ---------- block registry ----------
EXCL = ['destroy', 'overlay', 'particle', '_bed_', 'bed_', 'door', '_stage', 'stage', 'fire_', '_flow', 'pane_top', 'rail',
        'redstone_dust', 'emissive', 'hydration', 'sniffer_egg', 'pointed_dripstone', 'sulfur_spike', 'test_', 'structure_block_',
        'jigsaw_lock', 'powered', '_sign', 'shelf', 'trapdoor', 'ladder', 'lever', 'tripwire', 'comparator', 'repeater', 'item_frame',
        'flower_pot', 'brewing_stand', 'hopper', 'bell', 'campfire', 'dripleaf', 'pink_petals', 'leaf_litter', 'glow_lichen', 'sculk_vein',
        'vine', 'lily_pad', 'frogspawn', 'resin_clump', 'end_rod', 'lightning_rod', 'conduit', 'cave_vines', 'hanging_moss', 'moss_carpet',
        'spore_blossom', 'potted_', 'pitcher', 'wildflowers', 'crafter_', 'cocoa', 'grass_block_side', 'grass_block_snow', 'cauldron_inner',
        'piston_inner', 'piston_top_sticky', 'bulb_lit', 'cake_inner', 'composter_compost', 'composter_ready', '_lit', 'barrel_top_open',
        'turtle_egg_', 'respawn_anchor_side', 'respawn_anchor_top_off', 'frosted_ice', 'suspicious_', 'water_still', 'lava_still',
        'trial_spawner_', 'vault_', 'creaking_heart_', 'calibrated_sculk_sensor', 'sculk_sensor_tendril', 'sculk_shrieker_can', 'sculk_catalyst_top_bloom',
        'sculk_catalyst_side_bloom', 'nether_portal', 'chain_command_block_conditional', 'command_block_conditional', 'tall_seagrass', 'stem',
        'grindstone', 'redstone_torch_off', 'beehive_front_honey', 'bee_nest_front_honey', 'chiseled_bookshelf_occupied', 'chiseled_bookshelf_empty',
        '_bottom_ominous', 'dispenser_front_vertical', 'dropper_front_vertical', 'smooth_stone_slab_side', 'fire_0', 'fire_1', 'daylight_detector_inverted',
        'farmland_moist', 'furnace_front_on', 'smoker_front_on', 'blast_furnace_front_on', 'observer_back_on', 'redstone_lamp_on', 'bamboo_stage0',
        'bamboo_large_leaves', 'bamboo_small_leaves', 'bamboo_singleleaf', 'bamboo_fence', 'anvil', 'cactus_flower_', 'lectern_base', 'enchanting_table_bottom']
KEEP_EXACT = {'anvil', 'mushroom_stem', 'pumpkin_stem', 'stem'} - {'stem', 'pumpkin_stem'}
CROSS = ['sapling', 'tulip', 'poppy', 'dandelion', 'allium', 'azure_bluet', 'blue_orchid', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley',
         'wither_rose', 'short_grass', 'dead_bush', 'fungus', 'crimson_roots', 'warped_roots', 'nether_sprouts', 'sugar_cane', 'cobweb', 'torchflower',
         'coral_fan', 'seagrass', 'kelp', 'eyeblossom', 'dry_grass', 'firefly_bush', 'cactus_flower', 'red_shrub', 'torch', 'lantern', 'chain',
         'iron_bars', 'copper_bars', 'candle', 'amethyst_cluster', 'amethyst_bud', 'hanging_roots', 'weeping_vines', 'twisting_vines', 'mangrove_propagule',
         'bamboo_stalk', 'bush']
CROSS_EXACT = {'fern', 'brown_mushroom', 'red_mushroom', 'brain_coral', 'bubble_coral', 'fire_coral', 'horn_coral', 'tube_coral', 'dead_brain_coral',
               'dead_bubble_coral', 'dead_fire_coral', 'dead_horn_coral', 'dead_tube_coral', 'sea_pickle', 'azalea_plant'}
TWO_HIGH = {'tall_grass': 'tall_grass_bottom', 'large_fern': 'large_fern_bottom', 'lilac': 'lilac_bottom', 'peony': 'peony_bottom',
            'rose_bush': 'rose_bush_bottom', 'sunflower': 'sunflower_front', 'wheat': 'wheat_stage7', 'carrots': 'carrots_stage3',
            'potatoes': 'potatoes_stage3', 'beetroots': 'beetroots_stage3', 'sweet_berry_bush': 'sweet_berry_bush_stage3', 'fire': 'fire_0', 'soul_fire': 'soul_fire_0'}
EMIT = ['glowstone', 'sea_lantern', 'shroomlight', 'froglight', 'jack_o_lantern', 'lava', 'torch', 'lantern', 'magma', 'beacon', 'redstone_lamp',
        'end_rod', 'fire', 'candle', 'amethyst_cluster', 'crying_obsidian', 'respawn_anchor', 'sculk_catalyst', 'copper_bulb', 'firefly']
SUF = ['_top', '_bottom', '_side', '_front', '_end', '_back', '_sides', '_base', '_east', '_north', '_inner', '_side1', '_side2', '_side3', '_up', '_down', '_saw', '_outside', '_inside']

def excluded(n):
    if n in KEEP_EXACT: return False
    return any(k in n for k in EXCL)

blocks = []  # dicts
def add(name, top, bottom, side, front=None, shape='cube', **kw):
    for t in (top, bottom, side, front):
        if t is not None and t not in tidx: return
    tex = [tidx[top], tidx[bottom], tidx[side], tidx[front or side]]
    ak = max(alpha_kind[top], alpha_kind[side])
    b = dict(n=name, t=tex, s=shape, a=ak, e=int(any(k in name for k in EMIT)))
    b.update(kw)
    blocks.append(b)

add('air', 'stone', 'stone', 'stone')
# hand-specified specials first
add('grass_block', 'grass_block_top', 'dirt', 'grass_block_side_tinted')
add('snowy_grass_block', 'snow', 'dirt', 'grass_block_snow')
add('water', 'water_still', 'water_still', 'water_still', shape='water'); blocks[-1]['a'] = 2
add('lava', 'lava_still', 'lava_still', 'lava_still', shape='lava'); blocks[-1]['a'] = 0
add('crafting_table', 'crafting_table_top', 'oak_planks', 'crafting_table_side', 'crafting_table_front')
add('furnace', 'furnace_top', 'furnace_top', 'furnace_side', 'furnace_front')
add('smoker', 'smoker_top', 'smoker_bottom', 'smoker_side', 'smoker_front')
add('blast_furnace', 'blast_furnace_top', 'blast_furnace_top', 'blast_furnace_side', 'blast_furnace_front')
add('dispenser', 'furnace_top', 'furnace_top', 'furnace_side', 'dispenser_front')
add('dropper', 'furnace_top', 'furnace_top', 'furnace_side', 'dropper_front')
add('bookshelf', 'oak_planks', 'oak_planks', 'bookshelf')
add('chiseled_bookshelf', 'chiseled_bookshelf_top', 'chiseled_bookshelf_top', 'chiseled_bookshelf_side', 'chiseled_bookshelf_occupied')
add('pumpkin', 'pumpkin_top', 'pumpkin_top', 'pumpkin_side')
add('carved_pumpkin', 'pumpkin_top', 'pumpkin_top', 'pumpkin_side', 'carved_pumpkin')
add('jack_o_lantern', 'pumpkin_top', 'pumpkin_top', 'pumpkin_side', 'jack_o_lantern')
add('melon', 'melon_top', 'melon_top', 'melon_side')
add('tnt', 'tnt_top', 'tnt_bottom', 'tnt_side')
add('cactus', 'cactus_top', 'cactus_bottom', 'cactus_side', shape='cactus')
add('chest', 'oak_planks', 'oak_planks', 'oak_planks')  # replaced icon by item; textured from planks
add('jukebox', 'jukebox_top', 'jukebox_side', 'jukebox_side')
add('note_block', 'note_block', 'note_block', 'note_block')
add('piston', 'piston_top', 'piston_bottom', 'piston_side')
add('sticky_piston', 'piston_top_sticky', 'piston_bottom', 'piston_side')
add('observer', 'observer_top', 'observer_top', 'observer_side', 'observer_front')
add('redstone_lamp', 'redstone_lamp', 'redstone_lamp', 'redstone_lamp')
add('farmland', 'farmland', 'dirt', 'dirt')
add('dirt_path', 'dirt_path_top', 'dirt', 'dirt_path_side')
add('mycelium', 'mycelium_top', 'dirt', 'mycelium_side')
add('podzol', 'podzol_top', 'dirt', 'podzol_side')
add('crimson_nylium', 'crimson_nylium', 'netherrack', 'crimson_nylium_side')
add('warped_nylium', 'warped_nylium', 'netherrack', 'warped_nylium_side')
add('enchanting_table', 'enchanting_table_top', 'enchanting_table_bottom', 'enchanting_table_side')
add('lectern', 'lectern_top', 'oak_planks', 'lectern_sides', 'lectern_front')
add('beehive', 'beehive_end', 'beehive_end', 'beehive_side', 'beehive_front')
add('bee_nest', 'bee_nest_top', 'bee_nest_bottom', 'bee_nest_side', 'bee_nest_front')
add('respawn_anchor', 'respawn_anchor_top', 'respawn_anchor_bottom', 'respawn_anchor_side0')
add('composter', 'composter_top', 'composter_bottom', 'composter_side')
add('cauldron', 'cauldron_top', 'cauldron_bottom', 'cauldron_side')
add('anvil', 'anvil_top', 'anvil', 'anvil')
add('stonecutter', 'stonecutter_top', 'stonecutter_bottom', 'stonecutter_side')
add('cartography_table', 'cartography_table_top', 'dark_oak_planks', 'cartography_table_side3', 'cartography_table_side1')
add('daylight_detector', 'daylight_detector_top', 'daylight_detector_side', 'daylight_detector_side')
add('creaking_heart', 'creaking_heart_top', 'creaking_heart_top', 'creaking_heart')
add('trial_spawner', 'trial_spawner_top_inactive', 'trial_spawner_bottom', 'trial_spawner_side_inactive')
add('vault', 'vault_top', 'vault_bottom', 'vault_side_off', 'vault_front_off')
add('sculk_sensor', 'sculk_sensor_top', 'sculk_sensor_bottom', 'sculk_sensor_side')
add('crafter', 'crafter_top', 'crafter_bottom', 'crafter_east', 'crafter_north')
add('nether_portal', 'nether_portal', 'nether_portal', 'nether_portal'); blocks[-1]['a'] = 2
add('grindstone', 'grindstone_round', 'grindstone_round', 'grindstone_side')
add('snow_block', 'snow', 'snow', 'snow')
add('fire', 'fire_0', 'fire_0', 'fire_0', shape='cross')
add('soul_fire', 'soul_fire_0', 'soul_fire_0', 'soul_fire_0', shape='cross')
for k, v in TWO_HIGH.items():
    if k not in ('fire', 'soul_fire'): add(k, v, v, v, shape='cross')
done = {b['n'] for b in blocks} | {'snow', 'crafting_table', 'stem'}
bases = {}
for n in names:
    if excluded(n) and n not in KEEP_EXACT: continue
    base = n
    for s in SUF:
        if n.endswith(s) and len(n) > len(s): base = n[:-len(s)]; break
    bases.setdefault(base, set()).add(n)
for base in sorted(bases):
    if base in done or base + '_block' in done and False: continue
    have = bases[base]
    g = lambda s: base + s if base + s in have else None
    if base in have and (base in CROSS_EXACT or any(k in base for k in CROSS)):
        add(base, base, base, base, shape='cross'); continue
    side = base if base in have else g('_side') or g('_sides') or g('_front')
    if not side: continue
    top = g('_top') or g('_end') or (base + '_top' if False else None) or side
    bottom = g('_bottom') or top
    front = g('_front')
    nm = base
    if base.endswith('_log') or base.endswith('_stem') or base in ('basalt', 'polished_basalt', 'bone_block', 'hay_block', 'quartz_pillar', 'purpur_pillar', 'deepslate', 'bamboo_block', 'stripped_bamboo_block', 'muddy_mangrove_roots', 'mangrove_roots'):
        pass
    add(nm, top, bottom, side, front)
    done.add(nm)
# dedupe
seen = set(); reg = []
for b in blocks:
    if b['n'] in seen: continue
    seen.add(b['n']); reg.append(b)
for b in reg:
    if b['n'].endswith('leaves'): b['a'] = 1
    if b['s'] == 'cross': b['a'] = 1
    if any(k in b['n'] for k in ('ice', 'slime', 'honey_block', 'stained_glass', 'tinted_glass')): b['a'] = 2
for k, v in [('tall_grass', 'tall_grass_top'), ('large_fern', 'large_fern_top'), ('lilac', 'lilac_top'), ('peony', 'peony_top'), ('rose_bush', 'rose_bush_top'), ('sunflower', 'sunflower_top')]:
    t = tidx[v]; reg.append(dict(n=k + '_top', t=[t, t, t, t], s='cross', a=1, e=0, top=1))
def T_(n): return tidx[n]
for n, tile, shape, extra in [('redstone_wire', 'redstone_dust_red', 'flat', {}), ('lever', 'lever', 'cross', {}), ('lever_on', 'lever', 'cross', {'hide': 1}),
    ('stone_button', 'stone', 'box', {'bb': [5, 0, 6, 11, 2, 10]}), ('stone_button_on', 'stone', 'box', {'bb': [5, 0, 6, 11, 1, 10], 'hide': 1}),
    ('stone_pressure_plate', 'stone', 'box', {'bb': [1, 0, 1, 15, 1, 15]}), ('stone_pressure_plate_on', 'stone', 'box', {'bb': [1, 0, 1, 15, .5, 15], 'hide': 1}),
    ('oak_pressure_plate', 'oak_planks', 'box', {'bb': [1, 0, 1, 15, 1, 15]}), ('oak_pressure_plate_on', 'oak_planks', 'box', {'bb': [1, 0, 1, 15, .5, 15], 'hide': 1}),
    ('redstone_torch_off', 'redstone_torch_off', 'cross', {'hide': 1}), ('piston_head', 'piston_top', 'cube', {'hide': 1}), ('sticky_piston_head', 'piston_top_sticky', 'cube', {'hide': 1}),
    ('repeater', 'repeater', 'flat', {}), ('daylight_sensor_dummy', 'daylight_detector_top', 'box', {'bb': [0, 0, 0, 16, 6, 16], 'hide': 1})]:
    t = T_(tile); b = dict(n=n, t=[t, t, t, t], s=shape, a=1 if shape in ('cross', 'flat') else 0, e=1 if n == 'redstone_wire' else 0); b.update(extra); reg.append(b)
for b in reg:
    n = b['n']
    if n in ('torch', 'soul_torch', 'copper_torch', 'redstone_torch', 'redstone_torch_off'): b['s'] = 'box'; b['bb'] = [7, 0, 7, 9, 10, 9]
    if n in ('lever', 'lever_on'): b['s'] = 'box'; b['bx'] = [[[5, 0, 4, 11, 3, 12], 'cobblestone'], [[7, 3, 5 if n == 'lever' else 9, 9, 12, 7 if n == 'lever' else 11], 'lever']]; b['bb'] = [5, 0, 4, 11, 3, 12]
    if n == 'repeater': b['s'] = 'box'; b['bb'] = [0, 0, 0, 16, 2, 16]; b['bx'] = [[[0, 0, 0, 16, 2, 16], 'repeater'], [[7, 2, 2, 9, 7, 4], 'redstone_torch_off'], [[7, 2, 9, 9, 7, 11], 'redstone_torch_off']]
    if 'bx' in b: b['bx'] = [[bb, tidx[t]] for bb, t in b['bx']]
HIDE = {'snowy_grass_block', 'azalea_plant', 'bamboo_stalk', 'crimson_roots_pot', 'warped_roots_pot', 'end_portal_frame_eye', 'kelp_plant', 'mangrove_propagule_hanging', 'straw_bed', 'red_shrub', 'redstone_wire', 'fire', 'soul_fire', 'wheat', 'carrots', 'potatoes', 'beetroots', 'sweet_berry_bush', 'nether_portal', 'water', 'lava'}
for b in reg:
    if b['n'] in HIDE: b['hide'] = 1
    if b['n'] == 'dried_kelp': b['n'] = 'dried_kelp_block'
WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped', 'poplar', 'iron', 'copper', 'exposed_copper', 'weathered_copper', 'oxidized_copper']
for w in WOODS:
    if w + '_door_bottom.png' not in os.listdir(SRC + 'block'): continue
    bt, tt, tr = tidx[w + '_door_bottom'], tidx[w + '_door_top'], tidx[w + '_trapdoor']
    for half, t in (('', bt), ('_top', tt)):
        for op, bb in (('', [0, 0, 0, 16, 16, 3]), ('_open', [0, 0, 0, 3, 16, 16])):
            reg.append(dict(n=w + '_door' + half + op, t=[t, t, t, t], s='box', a=1, e=0, bb=bb, solid=1, door=1, hide=0 if (half == '' and op == '') else 1))
    reg.append(dict(n=w + '_trapdoor', t=[tr] * 4, s='box', a=1, e=0, bb=[0, 0, 0, 16, 3, 16], solid=1))
    reg.append(dict(n=w + '_trapdoor_open', t=[tr] * 4, s='box', a=1, e=0, bb=[0, 0, 13, 16, 16, 16], solid=1, hide=1))
SLABS = [('stone', 'stone', 'stone'), ('smooth_stone', 'smooth_stone', 'smooth_stone_slab_side'), ('cobblestone', 'cobblestone', 'cobblestone'), ('mossy_cobblestone', 'mossy_cobblestone', 'mossy_cobblestone'),
         ('stone_brick', 'stone_bricks', 'stone_bricks'), ('brick', 'bricks', 'bricks'), ('sandstone', 'sandstone_top', 'sandstone'), ('red_sandstone', 'red_sandstone_top', 'red_sandstone'),
         ('andesite', 'andesite', 'andesite'), ('granite', 'granite', 'granite'), ('diorite', 'diorite', 'diorite'), ('polished_andesite', 'polished_andesite', 'polished_andesite'),
         ('cobbled_deepslate', 'cobbled_deepslate', 'cobbled_deepslate'), ('deepslate_brick', 'deepslate_bricks', 'deepslate_bricks'), ('deepslate_tile', 'deepslate_tiles', 'deepslate_tiles'),
         ('nether_brick', 'nether_bricks', 'nether_bricks'), ('quartz', 'quartz_block_top', 'quartz_block_side'), ('prismarine', 'prismarine', 'prismarine'), ('purpur', 'purpur_block', 'purpur_block'),
         ('blackstone', 'blackstone_top', 'blackstone'), ('mud_brick', 'mud_bricks', 'mud_bricks'), ('tuff', 'tuff', 'tuff')] + [(w, w + '_planks', w + '_planks') for w in ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped']]
for n, top, side in SLABS:
    if top not in tidx or side not in tidx: continue
    full = {'stone_brick': 'stone_bricks', 'brick': 'bricks', 'deepslate_brick': 'deepslate_bricks', 'deepslate_tile': 'deepslate_tiles', 'nether_brick': 'nether_bricks', 'quartz': 'quartz_block', 'purpur': 'purpur_block', 'mud_brick': 'mud_bricks', 'smooth_stone': 'smooth_stone'}.get(n, n + '_planks' if n + '_planks' in tidx else n)
    t, sd = tidx[top], tidx[side]
    reg.append(dict(n=n + '_slab', t=[t, t, sd, sd], s='box', a=0, e=0, bb=[0, 0, 0, 16, 8, 16], solid=1, slab=full, sidev=1))
    reg.append(dict(n=n + '_slab_top', t=[t, t, sd, sd], s='box', a=0, e=0, bb=[0, 8, 0, 16, 16, 16], solid=1, slab=full, hide=1, sidev=1))
ws, ls = tidx['water_still'], tidx['lava_still']
for i in range(1, 9): reg.append(dict(n='water_%d' % i, t=[ws] * 4, s='water', a=2, e=0, hide=1, lvl=i))
for i in range(1, 9): reg.append(dict(n='lava_%d' % i, t=[ls] * 4, s='lava', a=0, e=1, hide=1, lvl=i))
reg[[b['n'] for b in reg].index('daylight_detector')].update(s='box', bb=[0, 0, 0, 16, 6, 16])
t = T_('redstone_lamp_on'); reg.append(dict(n='redstone_lamp_on', t=[t, t, t, t], s='cube', a=0, e=1, hide=1))
t = T_('furnace_front_on'); f = reg[[b['n'] for b in reg].index('furnace')]; reg.append(dict(n='furnace_lit', t=f['t'][:3] + [t], s='cube', a=0, e=1, hide=1))
for b in reg:
    if b['n'] == 'nether_portal': b['e'] = 1
print('blocks', len(reg))

# ---------- items ----------
inames = sorted(os.path.basename(p)[:-4] for p in glob.glob(SRC + 'item/*.png'))
inames = [n for n in inames if not n.endswith('_overlay') and not any(n.startswith(p) for p in ('compass_', 'recovery_compass_', 'clock_')) or n.endswith('_00')]
inames = [n for n in inames if not (n.startswith('bow_pulling') or n.startswith('crossbow_') and n != 'crossbow_standby' or '_pulling' in n or n.startswith('light_') and n[6:].isdigit())]
ICOLS = 32
irows = math.ceil(len(inames) / ICOLS)
iat = Image.new('RGBA', (ICOLS * T, irows * T))
LEATHER = (160, 101, 64)
for i, n in enumerate(inames):
    im = first_frame(SRC + 'item/' + n + '.png')
    if n.startswith('leather_') and 'overlay' not in n: im = tint(im, LEATHER)
    if n in ('potion', 'splash_potion', 'lingering_potion', 'tipped_arrow'):
        ov = SRC + 'item/' + n + '_overlay.png'
        if os.path.exists(ov): im.alpha_composite(tint(first_frame(ov), (200, 40, 200)))
    iat.paste(im, ((i % ICOLS) * T, (i // ICOLS) * T))
iat.save(OUT + 'items.png', optimize=True)
print('items', len(inames))

json.dump(dict(cols=COLS, rows=rows, tiles=tidx, blocks=reg, items=inames, icols=ICOLS, irows=irows), open(OUT + 'registry.json', 'w'), separators=(',', ':'))

# ---------- gui + other sprites ----------
G = SRC + 'gui/'
copy = {
 'font.png': SRC + 'font/ascii.png',
 'menu_background.png': G + 'menu_background.png', 'menu_list_background.png': G + 'menu_list_background.png',
 'inworld_menu_background.png': G + 'inworld_menu_background.png',
 'header_separator.png': G + 'header_separator.png', 'footer_separator.png': G + 'footer_separator.png',
 'inventory.png': G + 'container/inventory.png', 'crafting_table.png': G + 'container/crafting_table.png',
 'furnace.png': G + 'container/furnace.png', 'generic_54.png': G + 'container/generic_54.png',
 'tab_items.png': G + 'container/creative_inventory/tab_items.png', 'tab_item_search.png': G + 'container/creative_inventory/tab_item_search.png',
 'tab_inventory.png': G + 'container/creative_inventory/tab_inventory.png',
 'sun.png': SRC + 'environment/celestial/sun.png', 'clouds.png': SRC + 'environment/clouds.png', 'rain.png': SRC + 'environment/rain.png',
 'snowfall.png': SRC + 'environment/snow.png',
 'underwater.png': SRC + 'misc/underwater.png',
 'pig.png': SRC + 'entity/pig/pig_temperate.png', 'cow.png': SRC + 'entity/cow/cow_temperate.png',
 'sheep.png': SRC + 'entity/sheep/sheep.png', 'sheep_wool.png': SRC + 'entity/sheep/sheep_wool.png',
 'chicken.png': SRC + 'entity/chicken/chicken_temperate.png', 'enderman.png': SRC + 'entity/enderman/enderman.png', 'slime.png': SRC + 'entity/slime/slime.png', 'magmacube.png': SRC + 'entity/slime/magmacube.png', 'ghast.png': SRC + 'entity/ghast/ghast.png', 'ghast_shooting.png': SRC + 'entity/ghast/ghast_shooting.png', 'zombified_piglin.png': SRC + 'entity/piglin/zombified_piglin.png', 'wolf.png': SRC + 'entity/wolf/wolf.png', 'wolf_tame.png': SRC + 'entity/wolf/wolf_tame.png', 'wolf_angry.png': SRC + 'entity/wolf/wolf_angry.png', 'zombie.png': SRC + 'entity/zombie/zombie.png', 'skeleton.png': SRC + 'entity/skeleton/skeleton.png', 'creeper.png': SRC + 'entity/creeper/creeper.png', 'spider.png': SRC + 'entity/spider/spider.png', 'spider_eyes.png': SRC + 'entity/spider/spider_eyes.png', 'arrow.png': SRC + 'entity/projectiles/arrow.png', 'steve.png': SRC + 'entity/player/wide/steve.png', 'title_logo.png': SRC + 'gui/title/minecraft.png', 'title_edition.png': SRC + 'gui/title/edition.png',
 'toast.png': G + 'sprites/toast/advancement.png', 'pack.png': '/root/tex/pack.png',
}
for i, ph in enumerate(['new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full_moon', 'waning_gibbous', 'third_quarter', 'waning_crescent']):
    copy['moon%d.png' % i] = SRC + 'environment/celestial/moon/%s.png' % ph
SP = G + 'sprites/'
for f in ['widget/button', 'widget/button_highlighted', 'widget/button_disabled', 'widget/slider', 'widget/slider_highlighted', 'widget/slider_handle',
          'widget/slider_handle_highlighted', 'widget/text_field', 'widget/text_field_highlighted', 'widget/checkbox', 'widget/checkbox_selected',
          'widget/tab', 'widget/tab_selected', 'widget/tab_highlighted', 'widget/tab_selected_highlighted', 'widget/scroller', 'widget/slot_frame',
          'hud/hotbar', 'hud/hotbar_selection', 'hud/crosshair', 'hud/food_empty', 'hud/food_full', 'hud/food_half', 'hud/experience_bar_background',
          'hud/experience_bar_progress', 'hud/air', 'hud/air_empty', 'hud/armor_empty',
          'hud/heart/container', 'hud/heart/full', 'hud/heart/half', 'hud/heart/hardcore_full', 'hud/heart/hardcore_half', 'hud/heart/container_blinking',
          'tooltip/background', 'tooltip/frame', 'container/furnace/burn_progress', 'container/furnace/lit_progress',
          'container/creative_inventory/scroller', 'container/creative_inventory/scroller_disabled',
          'world_list/join', 'world_list/join_highlighted', 'container/slot_highlight_back', 'container/slot_highlight_front']:
    copy[f.replace('/', '_') + '.png'] = SP + f + '.png'
for i in range(1, 8):
    for k in ('top_selected', 'top_unselected', 'bottom_selected', 'bottom_unselected'):
        copy['tab_%s_%d.png' % (k, i)] = SP + 'container/creative_inventory/tab_%s_%d.png' % (k, i)
for i in range(6):
    copy['panorama_%d.png' % i] = G + 'title/background/panorama_%d.png' % i
guimap = {k[:-4]: os.path.relpath(v, SRC) for k, v in copy.items() if v.startswith(SRC)}
reg_obj = json.load(open(OUT + 'registry.json')); reg_obj['guimap'] = guimap
json.dump(reg_obj, open(OUT + 'registry.json', 'w'), separators=(',', ':'))
NINE = {}
missing = []
for k, v in copy.items():
    if not os.path.exists(v) and not os.path.exists(v.replace(SRC, F64)): missing.append(k); continue
    src = pick(v); im = Image.open(src).convert('RGBA')
    if src.startswith(F64) and not k.startswith('panorama') and not k.startswith('title_') and k != 'font': im = im.resize((max(1, int(im.width * PFACT)), max(1, int(im.height * PFACT))), Image.NEAREST)
    mm = src + '.mcmeta'
    if os.path.exists(mm):
        try:
            sc_ = json.load(open(mm)).get('gui', {}).get('scaling', {})
            if sc_.get('type') == 'nine_slice': bd = sc_.get('border', 0); NINE[k[:-4]] = [bd] * 4 if isinstance(bd, (int, float)) else [bd.get('left', 0), bd.get('top', 0), bd.get('right', 0), bd.get('bottom', 0)]
        except Exception: pass
    if k.startswith('panorama'): im = im.resize((512, 512), Image.LANCZOS)
    im.save(OUT + 'gui/' + k, optimize=True)
ro = json.load(open(OUT + 'registry.json')); ro['nine'] = NINE; ro['baseName'] = os.environ.get('BASENAME', 'Default'); json.dump(ro, open(OUT + 'registry.json', 'w'), separators=(',', ':'))
print('nine', NINE.get('widget_button')); print('missing', missing); print('not in 64x (fallback):', len(MISSING64), MISSING64[:30])
shutil.copy('/root/tex/license.txt', OUT + 'license.txt')
