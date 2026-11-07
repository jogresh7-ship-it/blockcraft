# Convert Mojang bedrock-samples textures into a Java-layout resource pack zip for Blockcraft.
import os, re, json, zipfile, io, base64
from PIL import Image
RP = '/root/bs/bedrock-samples-main/resource_pack/'
TX = RP + 'textures/'
reg = json.load(open('/home/claude/blockcraft/registry.json'))

def index(root):
    idx = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            m = re.match(r'(.+)\.(png|tga)$', f)
            if not m: continue
            k = m.group(1)
            if k.endswith('_mers') or k.endswith('_normal_map') or k.endswith('_heightmap'): continue
            p = os.path.join(d, f)
            if k not in idx or f.endswith('.tga') and 'leaves' in k: idx[k] = p   # tga keeps leaf transparency
    return idx
BI, II, EI = index(TX + 'blocks'), index(TX + 'items'), index(TX + 'entity')
for d, _, fs in os.walk(TX + 'entity'):
    if 'skulls' in d: continue
    for f in fs:
        m = re.match(r'(.+)\.(png|tga)$', f)
        if m and os.path.basename(d) == m.group(1): EI[m.group(1)] = os.path.join(d, f)
for k in list(EI):
    if '/skulls/' in EI[k] and os.path.exists(TX + 'entity/' + k + '/' + k + '.png'): EI[k] = TX + 'entity/' + k + '/' + k + '.png'
COL = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
bc = lambda c: 'silver' if c == 'light_gray' else c
W = {'oak': 'oak', 'spruce': 'spruce', 'birch': 'birch', 'jungle': 'jungle', 'acacia': 'acacia', 'dark_oak': 'big_oak'}
EX = {'grass_block_top': 'grass_top', 'grass_block_side': 'grass_side_carried', 'grass_block_snow': 'grass_side_snowed', 'dirt_path_top': 'grass_path_top', 'dirt_path_side': 'grass_path_side',
  'farmland': 'farmland_dry', 'farmland_moist': 'farmland_wet', 'podzol_top': 'dirt_podzol_top', 'podzol_side': 'dirt_podzol_side', 'rooted_dirt': 'dirt_with_roots', 'short_grass': 'tallgrass', 'dead_bush': 'deadbush',
  'cobweb': 'web', 'sugar_cane': 'reeds', 'lily_pad': 'waterlily', 'brown_mushroom': 'mushroom_brown', 'red_mushroom': 'mushroom_red', 'brown_mushroom_block': 'mushroom_block_skin_brown', 'red_mushroom_block': 'mushroom_block_skin_red',
  'mushroom_stem': 'mushroom_block_skin_stem', 'mushroom_block_inside': 'mushroom_block_inside', 'granite': 'stone_granite', 'polished_granite': 'stone_granite_smooth', 'diorite': 'stone_diorite', 'polished_diorite': 'stone_diorite_smooth',
  'andesite': 'stone_andesite', 'polished_andesite': 'stone_andesite_smooth', 'stone_bricks': 'stonebrick', 'mossy_stone_bricks': 'stonebrick_mossy', 'cracked_stone_bricks': 'stonebrick_cracked', 'chiseled_stone_bricks': 'stonebrick_carved',
  'mossy_cobblestone': 'cobblestone_mossy', 'bricks': 'brick', 'smooth_stone': 'stone_slab_top', 'smooth_stone_slab_side': 'stone_slab_side', 'sandstone': 'sandstone_normal', 'chiseled_sandstone': 'sandstone_carved', 'cut_sandstone': 'sandstone_smooth',
  'red_sandstone': 'red_sandstone_normal', 'chiseled_red_sandstone': 'red_sandstone_carved', 'cut_red_sandstone': 'red_sandstone_smooth', 'nether_bricks': 'nether_brick', 'red_nether_bricks': 'red_nether_brick', 'end_stone_bricks': 'end_bricks',
  'prismarine': 'prismarine_rough', 'dark_prismarine': 'prismarine_dark', 'chiseled_quartz_block': 'quartz_block_chiseled', 'chiseled_quartz_block_top': 'quartz_block_chiseled_top', 'quartz_pillar': 'quartz_block_lines', 'quartz_pillar_top': 'quartz_block_lines_top',
  'furnace_front': 'furnace_front_off', 'furnace_front_on': 'furnace_front_on', 'dispenser_front': 'dispenser_front_horizontal', 'dropper_front': 'dropper_front_horizontal', 'carved_pumpkin': 'pumpkin_face_off', 'jack_o_lantern': 'pumpkin_face_on',
  'packed_ice': 'ice_packed', 'nether_quartz_ore': 'quartz_ore', 'terracotta': 'hardened_clay', 'redstone_lamp': 'redstone_lamp_off', 'redstone_torch': 'redstone_torch_on', 'torch': 'torch_on', 'repeater': 'repeater_off', 'note_block': 'noteblock',
  'piston_top': 'piston_top_normal', 'slime_block': 'slime', 'water_still': 'water_still_grey', 'water_flow': 'water_flow_grey', 'tall_grass_bottom': 'double_plant_grass_bottom', 'tall_grass_top': 'double_plant_grass_top',
  'large_fern_bottom': 'double_plant_fern_bottom', 'large_fern_top': 'double_plant_fern_top', 'lilac_bottom': 'double_plant_syringa_bottom', 'lilac_top': 'double_plant_syringa_top', 'peony_bottom': 'double_plant_paeonia_bottom',
  'peony_top': 'double_plant_paeonia_top', 'rose_bush_bottom': 'double_plant_rose_bottom', 'rose_bush_top': 'double_plant_rose_top', 'sunflower_front': 'double_plant_sunflower_front', 'sunflower_top': 'double_plant_sunflower_top',
  'dandelion': 'flower_dandelion', 'poppy': 'flower_rose', 'allium': 'flower_allium', 'azure_bluet': 'flower_houstonia', 'blue_orchid': 'flower_blue_orchid', 'oxeye_daisy': 'flower_oxeye_daisy', 'cornflower': 'flower_cornflower',
  'lily_of_the_valley': 'flower_lily_of_the_valley', 'wither_rose': 'flower_wither_rose', 'oak_trapdoor': 'trapdoor', 'iron_door_bottom': 'door_iron_lower', 'iron_door_top': 'door_iron_upper', 'cherry_log': 'cherry_log_side',
  'crimson_stem': 'crimson_log_side', 'crimson_stem_top': 'crimson_log_top', 'warped_stem': 'warped_stem_side', 'warped_stem_top': 'warped_stem_top', 'crimson_nylium': 'crimson_nylium_top', 'warped_nylium': 'warped_nylium_top',
  'end_portal_frame_top': 'endframe_top', 'end_portal_frame_side': 'endframe_side', 'enchanting_table_side': 'enchanting_table_side', 'fletching_table_top': 'fletcher_table_top', 'fletching_table_front': 'fletcher_table_side1',
  'fletching_table_side': 'fletcher_table_side2', 'cactus_side': 'cactus_side', 'honeycomb_block': 'honeycomb', 'blast_furnace_front': 'blast_furnace_front_off', 'smoker_front': 'smoker_front_off', 'kelp': 'kelp_top', 'kelp_plant': 'kelp_a',
  'beehive_end': 'beehive_top', 'dried_kelp_side': 'dried_kelp_side_a', 'dried_kelp_bottom': 'dried_kelp_top', 'jigsaw_top': 'jigsaw_front', 'item_frame': 'itemframe_background', 'comparator': 'comparator_off', 'activator_rail': 'rail_activator',
  'detector_rail': 'rail_detector', 'powered_rail': 'rail_golden', 'rail': 'rail_normal', 'rail_corner': 'rail_normal_turned', 'activator_rail_on': 'rail_activator_powered', 'detector_rail_on': 'rail_detector_powered', 'powered_rail_on': 'rail_golden_powered',
  'brain_coral_block': 'coral_pink', 'bubble_coral_block': 'coral_purple', 'fire_coral_block': 'coral_red', 'horn_coral_block': 'coral_yellow', 'tube_coral_block': 'coral_blue', 'brain_coral': 'coral_plant_pink', 'bubble_coral': 'coral_plant_purple',
  'fire_coral': 'coral_plant_red', 'horn_coral': 'coral_plant_yellow', 'tube_coral': 'coral_plant_blue', 'brain_coral_fan': 'coral_fan_pink', 'bubble_coral_fan': 'coral_fan_purple', 'fire_coral_fan': 'coral_fan_red', 'horn_coral_fan': 'coral_fan_yellow', 'tube_coral_fan': 'coral_fan_blue',
  'anvil': 'anvil_base', 'anvil_top': 'anvil_top_damaged_0', 'chipped_anvil_top': 'anvil_top_damaged_1', 'damaged_anvil_top': 'anvil_top_damaged_2', 'composter_compost': 'compost', 'composter_ready': 'compost_ready',
  'cocoa_stage0': 'cocoa_stage_0', 'cocoa_stage1': 'cocoa_stage_1', 'cocoa_stage2': 'cocoa_stage_2', 'big_dripleaf_side': 'big_dripleaf_side1', 'big_dripleaf_tip': 'big_dripleaf_top', 'iron_chain': 'chain1', 'copper_chain': 'copper_chain1',
  'exposed_copper_chain': 'exposed_copper_chain1', 'closed_eyeblossom': 'eyeblossom_dormant', 'open_eyeblossom': 'eyeblossom_blooming', 'campfire_fire': 'campfire', 'candle': 'candle', 'candle_lit': 'candle_lit', 'conduit': 'conduit_base',
  'creaking_heart': 'creaking_heart_side_inactive', 'creaking_heart_top': 'creaking_heart_top_inactive', 'creaking_heart_awake': 'creaking_heart_side_active', 'creaking_heart_top_awake': 'creaking_heart_top_active', 'creaking_heart_dormant': 'creaking_heart_side_dormant',
  'end_portal_frame_eye': 'endframe_eye', 'firefly_bush_emissive': 'firefly_bush_firefly', 'grindstone_side': 'grindstone_side', 'grindstone_round': 'grindstone_round', 'grindstone_pivot': 'grindstone_pivot', 'lily_pad': 'waterlily',
  'deepslate_top': 'deepslate_top', 'redstone_dust_dot': 'redstone_dust_cross', 'redstone_dust_line0': 'redstone_dust_line', 'redstone_dust_line1': 'redstone_dust_line', 'cave_vines': 'cave_vines_head', 'cave_vines_lit': 'cave_vines_head_berries',
  'cave_vines_plant': 'cave_vines_body', 'cave_vines_plant_lit': 'cave_vines_body_berries'}
def block_src(n):
    cands = [n, EX.get(n)]
    m = re.match(r'^(%s)_(wool|concrete_powder|concrete|glazed_terracotta|terracotta|stained_glass_pane_top|stained_glass|shulker_box|candle_lit|candle)$' % '|'.join(COL), n)
    if m:
        c, t = bc(m.group(1)), m.group(2)
        cands.append({'wool': 'wool_colored_' + c, 'concrete_powder': 'concrete_powder_' + c, 'concrete': 'concrete_' + c, 'glazed_terracotta': 'glazed_terracotta_' + c, 'terracotta': 'hardened_clay_stained_' + c,
                      'stained_glass_pane_top': 'glass_pane_top_' + c, 'stained_glass': 'glass_' + c, 'shulker_box': 'shulker_top_' + c, 'candle': m.group(1) + '_candle', 'candle_lit': m.group(1) + '_candle_lit'}[t])
    for jw, bw in W.items():
        for pat, rep in [('%s_log' % jw, 'log_' + bw), ('%s_log_top' % jw, 'log_%s_top' % bw), ('%s_planks' % jw, 'planks_' + bw), ('%s_leaves' % jw, 'leaves_' + bw), ('%s_sapling' % jw, 'sapling_' + ('roofed_oak' if jw == 'dark_oak' else bw)),
                         ('%s_door_bottom' % jw, 'door_%s_lower' % ('wood' if jw == 'oak' else jw)), ('%s_door_top' % jw, 'door_%s_upper' % ('wood' if jw == 'oak' else jw)), ('%s_trapdoor' % jw, '%s_trapdoor' % jw)]:
            if n == pat: cands.append(rep)
    m = re.match(r'^(\w+)_stage(\d)$', n)
    if m: cands += [m.group(1) + '_stage_' + m.group(2), m.group(1) + '_stage' + m.group(2)]
    m = re.match(r'^(\w+)_tulip$', n)
    if m: cands.append('flower_tulip_' + m.group(1))
    m = re.match(r'^dead_(brain|bubble|fire|horn|tube)_coral(_block|_fan)?$', n)
    if m: col = {'brain': 'pink', 'bubble': 'purple', 'fire': 'red', 'horn': 'yellow', 'tube': 'blue'}[m.group(1)]; cands.append({None: 'coral_plant_%s_dead', '_block': 'coral_%s_dead', '_fan': 'coral_fan_%s_dead'}[m.group(2)] % col)
    m = re.match(r'^(mangrove|pale_oak|poplar)_log$', n)
    if m: cands += [m.group(1) + '_log_side', 'stripped_' + m.group(1) + '_log_side']
    if n in ('honey_block_top', 'honey_block_side', 'honey_block_bottom'): cands.append(n.replace('honey_block', 'honey'))
    if n == 'quartz_pillar_side': cands.append('quartz_block_lines')
    if n == 'purpur_pillar_side': cands.append('purpur_pillar')
    if n == 'nether_portal': cands.append('portal')
    for c in cands:
        if c and c in BI: return BI[c]
    if n.startswith('destroy_stage_') and os.path.exists(TX + 'environment/' + n + '.png'): return TX + 'environment/' + n + '.png'
    return None
IX = {'bucket': 'bucket_empty', 'bow': 'bow_standby', 'book': 'book_normal', 'enchanted_book': 'book_enchanted', 'writable_book': 'book_writable', 'written_book': 'book_written', 'lapis_lazuli': 'dye_powder_blue_new',
  'bone_meal': 'dye_powder_white_new', 'cocoa_beans': 'dye_powder_brown_new', 'ink_sac': 'dye_powder_black_new', 'glow_ink_sac': 'dye_powder_glow', 'redstone': 'redstone_dust', 'slime_ball': 'slimeball', 'golden_apple': 'apple_golden',
  'enchanted_golden_apple': 'apple_golden', 'golden_carrot': 'carrot_golden', 'beef': 'beef_raw', 'cooked_beef': 'beef_cooked', 'porkchop': 'porkchop_raw', 'cooked_porkchop': 'porkchop_cooked', 'chicken': 'chicken_raw', 'cooked_chicken': 'chicken_cooked',
  'mutton': 'mutton_raw', 'cooked_mutton': 'mutton_cooked', 'rabbit': 'rabbit_raw', 'cooked_rabbit': 'rabbit_cooked', 'cod': 'fish_raw', 'cooked_cod': 'fish_cooked', 'salmon': 'fish_salmon_raw', 'cooked_salmon': 'fish_salmon_cooked',
  'pufferfish': 'fish_pufferfish_raw', 'tropical_fish': 'fish_clownfish_raw', 'melon_slice': 'melon', 'melon_seeds': 'seeds_melon', 'pumpkin_seeds': 'seeds_pumpkin', 'wheat_seeds': 'seeds_wheat', 'beetroot_seeds': 'seeds_beetroot',
  'glistering_melon_slice': 'melon_speckled', 'fermented_spider_eye': 'spider_eye_fermented', 'nether_brick': 'netherbrick', 'clock_00': 'clock_item', 'compass_00': 'compass_item', 'recovery_compass_00': 'recovery_compass_item', 'map': 'map_empty',
  'filled_map': 'map_filled', 'fishing_rod': 'fishing_rod_uncast', 'firework_rocket': 'fireworks', 'firework_star': 'fireworks_charge', 'fire_charge': 'fireball', 'glass_bottle': 'potion_bottle_empty', 'potion': 'potion_bottle_drinkable',
  'splash_potion': 'potion_bottle_splash', 'lingering_potion': 'potion_bottle_lingering', 'dragon_breath': 'dragons_breath', 'popped_chorus_fruit': 'chorus_fruit_popped', 'poisonous_potato': 'potato_poisonous', 'baked_potato': 'potato_baked',
  'heart_of_the_sea': 'heartofthesea_closed', 'nautilus_shell': 'nautilus', 'elytra_broken': 'broken_elytra', 'minecart': 'minecart_normal', 'chest_minecart': 'minecart_chest', 'furnace_minecart': 'minecart_furnace', 'hopper_minecart': 'minecart_hopper',
  'tnt_minecart': 'minecart_tnt', 'command_block_minecart': 'minecart_command_block', 'oak_door': 'door_wood', 'oak_sign': 'sign', 'oak_boat': 'boat_oak', 'iron_door': 'door_iron', 'milk_bucket': 'bucket_milk', 'water_bucket': 'bucket_water',
  'lava_bucket': 'bucket_lava', 'powder_snow_bucket': 'bucket_powder_snow', 'cod_bucket': 'bucket_cod', 'salmon_bucket': 'bucket_salmon', 'pufferfish_bucket': 'bucket_pufferfish', 'tropical_fish_bucket': 'bucket_tropical', 'axolotl_bucket': 'bucket_axolotl',
  'tadpole_bucket': 'bucket_tadpole', 'pitcher_plant': 'pitcher_plant', 'seagrass': 'seagrass', 'spectral_arrow': 'arrow', 'leather_helmet': 'leather_helmet', 'pointed_dripstone': 'pointed_dripstone', 'knowledge_book': 'book_written', 'sugar_cane': 'reeds', 'totem_of_undying': 'totem', 'iron_chain': 'chain', 'turtle_scute': 'turtle_shell_piece', 'pointed_dripstone': 'pointed_dripstone', 'bell': 'bell', 'seagrass': 'seagrass'}
EGG = {'mooshroom': 'mushroomcow', 'zombified_piglin': 'pigzombie', 'magma_cube': 'lava_slime', 'elder_guardian': 'elderguardian', 'polar_bear': 'polarbear', 'skeleton_horse': 'skeletonhorse', 'zombie_horse': 'zombiehorse',
       'zombie_villager': 'zombievillager', 'wandering_trader': 'wanderingtrader', 'tropical_fish': 'clownfish'}
def item_src(n):
    c = [n, IX.get(n)]
    m = re.match(r'^wooden_(\w+)$', n)
    if m: c.append('wood_' + m.group(1))
    m = re.match(r'^golden_(\w+)$', n)
    if m: c.append('gold_' + m.group(1))
    m = re.match(r'^(%s)_dye$' % '|'.join(COL), n)
    if m: c += ['dye_powder_' + bc(m.group(1)) + '_new', 'dye_powder_' + bc(m.group(1))]
    m = re.match(r'^(\w+)_(door|boat|sign|chest_boat)$', n)
    if m: c += [m.group(2) + '_' + m.group(1), m.group(1) + '_' + m.group(2), 'boat_darkoak' if m.group(1) == 'dark_oak' and m.group(2) == 'boat' else None]
    m = re.match(r'^(\w+)_spawn_egg$', n)
    if m: c.append('egg_' + EGG.get(m.group(1), m.group(1).replace('_', '')))
    m = re.match(r'^music_disc_(\w+)$', n)
    if m: c.append('record_' + m.group(1))
    m = re.match(r'^(%s)_(bundle|candle)$' % '|'.join(COL), n)
    if m: c.append(m.group(2) + '_' + m.group(1))
    for x in c:
        if x and x in II: return II[x]
    return None
ENT = {'entity/pig/pig_temperate.png': 'pig', 'entity/cow/cow_temperate.png': 'cow', 'entity/sheep/sheep.png': 'sheep', 'entity/zombie/zombie.png': 'zombie', 'entity/zombie/husk.png': 'husk', 'entity/zombie/drowned.png': 'drowned',
  'entity/skeleton/skeleton.png': 'skeleton', 'entity/skeleton/stray.png': 'stray', 'entity/skeleton/wither_skeleton.png': 'wither_skeleton', 'entity/skeleton/bogged.png': 'bogged', 'entity/creeper/creeper.png': 'creeper',
  'entity/spider/spider.png': 'spider', 'entity/spider/cave_spider.png': 'cave_spider', 'entity/enderman/enderman.png': 'enderman', 'entity/slime/slime.png': 'slime', 'entity/ghast/ghast.png': 'ghast', 'entity/ghast/ghast_shooting.png': 'ghast_shooting',
  'entity/wolf/wolf.png': 'wolf', 'entity/wolf/wolf_tame.png': 'wolf_tame', 'entity/wolf/wolf_angry.png': 'wolf_angry', 'entity/player/wide/steve.png': 'steve', 'entity/player/wide/alex.png': 'alex',
  'entity/cow/mooshroom_red.png': 'mooshroom', 'environment/celestial/sun.png': None, 'environment/clouds.png': None}
out = {}; miss_b = []; miss_i = []
for n in reg['tiles']:
    if n.endswith('_red') or n == 'grass_block_side_tinted': continue
    s = block_src(n)
    if s: out['assets/minecraft/textures/block/' + n + '.png'] = s
    else: miss_b.append(n)
for n in reg['items']:
    s = item_src(n)
    if s: out['assets/minecraft/textures/item/' + n + '.png'] = s
    else: miss_i.append(n)
for j, b in ENT.items():
    if b is None: s = TX + ('environment/sun.png' if 'sun' in j else 'environment/clouds.png')
    else: s = EI.get(b)
    if s and os.path.exists(s): out['assets/minecraft/textures/' + j] = s
print('blocks', len(reg['tiles']) - len(miss_b), '/', len(reg['tiles']), ' items', len(reg['items']) - len(miss_i), '/', len(reg['items']))
print('entities', sum(1 for k in out if '/entity/' in k), [b for j, b in ENT.items() if b and not EI.get(b)])

buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for dst, src in out.items():
        im = Image.open(src).convert('RGBA')
        if '/block/' in dst and im.height > im.width and im.height % im.width and not dst.endswith(('water_still.png', 'lava_still.png')):
            im = im.crop((0, 0, im.width, im.width))
        b = io.BytesIO(); im.save(b, 'PNG'); z.writestr(dst, b.getvalue())
    z.write(RP + 'pack_icon.png', 'pack.png')
data = buf.getvalue(); print(len(out), 'textures', round(len(data) / 1e6, 1), 'MB')
O = '/home/claude/vanillapack/'; os.makedirs(O, exist_ok=True)
b64 = base64.b64encode(data).decode(); CH = 11_000_000
for f in os.listdir(O):
    if f.startswith('vanilla_') and f.endswith('.js'): os.remove(O + f)
for i in range(0, len(b64), CH):
    open(O + 'vanilla_%d.js' % (i // CH), 'w').write("(window.EMBED_PACKS=window.EMBED_PACKS||{});(EMBED_PACKS.vanilla=EMBED_PACKS.vanilla||[])[%d]='%s';" % (i // CH, b64[i:i + CH]))
Image.open(RP + 'pack_icon.png').convert('RGBA').resize((64, 64), Image.NEAREST).save(O + 'vanilla_icon.png')
# preview: grass/blocks row on sky gradient
pv = Image.new('RGBA', (384, 216), (120, 167, 255, 255))
for y in range(216):
    for x in range(0, 384, 8): pass
names = ['grass_block_side', 'oak_log', 'stone', 'diamond_ore', 'oak_planks', 'bricks', 'glass']
for i, nm in enumerate(names):
    s = block_src(nm)
    if not s: continue
    t = Image.open(s).convert('RGBA').resize((48, 48), Image.NEAREST); pv.alpha_composite(t, (8 + i * 53, 216 - 60))
big = Image.open(block_src('grass_block_side')).convert('RGBA').resize((96, 96), Image.NEAREST); pv.alpha_composite(big, (144, 30))
pv.save(O + 'vanilla_preview.png')
