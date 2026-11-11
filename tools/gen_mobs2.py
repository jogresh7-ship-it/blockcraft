"""Build js/mobs2.js (new mobs from Bedrock geometry) + their gui textures (Faithful 64x scaled to 2x) + guimap entries."""
import json, sys, os
sys.path.insert(0, '/root/build'); import bedrock_mobs as bm
from PIL import Image
E = 'entity/'
# name: (geo, ident, java texture, w, h, hp, extra-def, skip bones)
M = {
 'cat': ('cat', None, 'cat/cat_tabby', .6, .7, 10, {'sound': 'mob/cat/meow1', 'hurt': 'mob/cat/hitt1', 'death': 'mob/cat/hitt1', 'step': None, 'drop': [['item:string', 0, 2]], 'speed': 1.4}, ()),
 'ocelot': ('ocelot', None, 'cat/ocelot', .6, .7, 10, {'sound': None, 'hurt': 'mob/cat/hitt1', 'death': 'mob/cat/hitt1', 'step': None, 'drop': [], 'speed': 1.6, 'shy': 1}, ()),
 'rabbit': ('rabbit.v2', None, 'rabbit/rabbit_brown', .4, .5, 3, {'sound': 'mob/rabbit/idle1', 'hurt': 'mob/rabbit/hurt1', 'death': 'mob/rabbit/bunnymurder', 'step': None, 'drop': [['item:rabbit', 0, 1], ['item:rabbit_hide', 0, 1]], 'jumpy': 1, 'speed': 1.6}, ()),
 'axolotl': ('axolotl', None, 'axolotl/axolotl_lucy', .75, .42, 14, {'sound': 'mob/axolotl/idle_air1', 'hurt': 'mob/axolotl/hurt1', 'death': 'mob/axolotl/death1', 'step': None, 'drop': [], 'water': 1, 'swim': 1}, ()),
 'turtle': ('turtle', None, 'turtle/turtle', 1.2, .4, 30, {'sound': 'mob/turtle/ambient_land1', 'hurt': 'mob/turtle/hurt1', 'death': 'mob/turtle/death1', 'step': None, 'drop': [['seagrass', 0, 2]], 'speed': .5, 'swim': 1}, ('eggbelly',)),
 'frog': ('frog', None, 'frog/frog_temperate', .5, .5, 10, {'sound': 'mob/frog/idle1', 'hurt': 'mob/frog/hurt1', 'death': 'mob/frog/death1', 'step': None, 'drop': [], 'jumpy': 1, 'swim': 1}, ('croaking_body', 'tongue')),
 'tadpole': ('tadpole', None, 'tadpole/tadpole', .4, .3, 6, {'sound': None, 'hurt': 'mob/frog/hurt1', 'death': 'mob/frog/death1', 'step': None, 'drop': [], 'water': 1, 'scale': 1}, ()),
 'bee': ('bee', None, 'bee/bee', .7, .6, 10, {'sound': 'mob/bee/loop', 'hurt': 'mob/bee/hurt1', 'death': 'mob/bee/death1', 'step': None, 'drop': [], 'fly': 1, 'flyH': 1.5, 'neutral': 1, 'dmg': [0, 2, 2, 3], 'speed': 1.5}, ()),
 'parrot': ('parrot', None, 'parrot/parrot_red_blue', .5, .9, 6, {'sound': 'mob/parrot/idle1', 'hurt': 'mob/parrot/hurt1', 'death': 'mob/parrot/death1', 'step': None, 'drop': [['item:feather', 1, 2]], 'fly': 1, 'flyH': 2}, ()),
 'panda': ('panda', None, 'panda/panda', 1.3, 1.25, 20, {'sound': 'mob/panda/idle1', 'hurt': 'mob/panda/hurt1', 'death': 'mob/panda/death', 'step': 'mob/panda/step1', 'drop': [['bamboo', 0, 2]], 'neutral': 1, 'dmg': [0, 4, 6, 9], 'speed': .8, 'breed': 'bamboo'}, ()),
 'llama': ('llama', None, 'llama/llama_creamy', .9, 1.87, 22, {'sound': 'mob/llama/idle1', 'hurt': 'mob/llama/hurt1', 'death': 'mob/llama/death1', 'step': 'mob/llama/step1', 'drop': [['item:leather', 0, 2]], 'breed': 'hay_block'}, ('chest1', 'chest2')),
 'camel': ('camel', None, 'camel/camel', 1.7, 2.375, 32, {'sound': 'mob/camel/ambient1', 'hurt': 'mob/camel/hurt1', 'death': 'mob/camel/death1', 'step': 'mob/camel/step1', 'drop': [], 'breed': 'cactus', 'speed': .9}, ('saddle', 'bridle', 'reins', 'saddle_chest')),
 'sniffer': ('sniffer', None, 'sniffer/sniffer', 1.9, 1.75, 14, {'sound': 'mob/sniffer/idle1', 'hurt': 'mob/sniffer/hurt1', 'death': 'mob/sniffer/death1', 'step': 'mob/sniffer/step1', 'drop': [], 'speed': .5, 'breed': 'item:torchflower_seeds'}, ()),
 'armadillo': ('armadillo', None, 'armadillo/armadillo', .7, .65, 12, {'sound': 'mob/armadillo/ambient1', 'hurt': 'mob/armadillo/hurt1', 'death': 'mob/armadillo/death1', 'step': 'mob/armadillo/step1', 'drop': [['item:armadillo_scute', 0, 1]], 'speed': .9, 'breed': 'item:spider_eye'}, ('cube', 'body_rolled_up', 'head_rolled_up')),
 'dolphin': ('dolphin', None, 'dolphin/dolphin', .9, .6, 10, {'sound': 'mob/dolphin/idle1', 'hurt': 'mob/dolphin/hurt1', 'death': 'mob/dolphin/death1', 'step': None, 'drop': [['item:cod', 0, 1]], 'water': 1, 'neutral': 1, 'dmg': [0, 2, 3, 4], 'speed': 2}, ()),
 'cod': ('cod', None, 'fish/cod', .5, .3, 3, {'sound': None, 'hurt': 'mob/fish/hurt1', 'death': 'mob/fish/hurt1', 'step': None, 'drop': [['item:cod', 1, 1]], 'water': 1}, ()),
 'salmon': ('salmon', None, 'fish/salmon', .7, .4, 3, {'sound': None, 'hurt': 'mob/fish/hurt1', 'death': 'mob/fish/hurt1', 'step': None, 'drop': [['item:salmon', 1, 1]], 'water': 1}, ()),
 'pufferfish': ('pufferfish', 'geometry.pufferfish.small.v1.8', 'fish/pufferfish', .35, .35, 3, {'sound': None, 'hurt': 'mob/fish/hurt1', 'death': 'mob/fish/hurt1', 'step': None, 'drop': [['item:pufferfish', 1, 1]], 'water': 1, 'poison': 1}, ()),
 'shulker': ('shulker', None, 'shulker/shulker', 1, 1, 30, {'sound': 'mob/shulker/ambient1', 'hurt': 'mob/shulker/hurt1', 'death': 'mob/shulker/death1', 'step': None, 'drop': [['item:shulker_shell', 0, 1]], 'hostile': 1, 'ranged': 1, 'still': 1, 'speed': 0, 'dmg': [0, 4, 4, 4], 'levitate': 1}, ()),
 'guardian': ('guardian', 'geometry.guardian.v1.8', 'guardian/guardian', .85, .85, 30, {'sound': 'mob/guardian/land_idle1', 'hurt': 'mob/guardian/guardian_hit1', 'death': 'mob/guardian/guardian_death', 'step': None, 'drop': [['item:prismarine_shard', 0, 2], ['item:cod', 0, 1]], 'hostile': 1, 'ranged': 1, 'water': 1, 'dmg': [0, 4, 6, 9]}, tuple('spikepart%d' % i for i in range(12))),
 'elder_guardian': ('guardian', 'geometry.guardian.v1.8', 'guardian/guardian_elder', 2, 2, 80, {'sound': 'mob/guardian/land_idle1', 'hurt': 'mob/guardian/elder_hit1', 'death': 'mob/guardian/elder_death', 'step': None, 'drop': [['sponge', 1, 1], ['item:prismarine_shard', 0, 2]], 'hostile': 1, 'ranged': 1, 'water': 1, 'scale': 2.35, 'dmg': [0, 5, 8, 12]}, tuple('spikepart%d' % i for i in range(12))),
 'phantom': ('phantom', None, 'phantom/phantom', .9, .5, 20, {'sound': 'mob/phantom/idle1', 'hurt': 'mob/phantom/hurt1', 'death': 'mob/phantom/death1', 'step': None, 'drop': [['item:phantom_membrane', 0, 1]], 'hostile': 1, 'fly': 1, 'flyH': 3, 'burns': 1, 'nightOnly': 1, 'dmg': [0, 4, 6, 9], 'speed': 3}, ()),
 'breeze': ('breeze', 'geometry.breeze', 'breeze/breeze', .6, 1.77, 30, {'sound': 'mob/breeze/idle1', 'hurt': 'mob/breeze/hurt1', 'death': 'mob/breeze/death1', 'step': None, 'drop': [['item:breeze_rod', 1, 2]], 'hostile': 1, 'ranged': 1, 'jumpy': 1, 'dmg': [0, 3, 3, 4]}, ()),
 'creaking': ('creaking', None, 'creaking/creaking', .9, 2.7, 1, {'sound': 'mob/creaking/ambient1', 'hurt': 'mob/creaking/sway1', 'death': 'mob/creaking/death', 'step': 'mob/creaking/step1', 'drop': [], 'hostile': 1, 'nightOnly': 1, 'dmg': [0, 3, 3, 4], 'freeze': 1, 'immortal': 1}, ()),
 'strider': ('strider', None, 'strider/strider', .9, 1.7, 20, {'sound': 'mob/strider/idle1', 'hurt': 'mob/strider/hurt1', 'death': 'mob/strider/death1', 'step': 'mob/strider/step1', 'drop': [['item:string', 2, 5]], 'lavaWalk': 1, 'noBurn': 1, 'breed': 'warped_fungus'}, ()),
 'copper_golem': ('copper_golem', 'geometry.copper_golem', 'copper_golem/copper_golem', .49, .98, 12, {'sound': 'mob/copper_golem/idle1', 'hurt': 'mob/copper_golem/hurt1', 'death': 'mob/copper_golem/death1', 'step': 'mob/copper_golem/step1', 'drop': [['item:copper_ingot', 1, 3]], 'speed': 1, 'sorter': 1}, ()),
 'wither': ('wither_boss', None, 'wither/wither', .9, 3.5, 300, {'sound': 'mob/wither/idle1', 'hurt': 'mob/wither/hurt1', 'death': 'mob/wither/death', 'step': None, 'drop': [['item:nether_star', 1, 1]], 'hostile': 1, 'boss': 1, 'fly': 1, 'flyH': 3, 'ranged': 1, 'skulls': 1, 'noBurn': 1, 'dmg': [0, 8, 12, 15]}, ()),
 'nautilus': ('nautilus', 'geometry.nautilus', 'nautilus/nautilus', .875, .95, 15, {'sound': None, 'hurt': 'mob/nautilus/hurt1', 'death': 'mob/nautilus/death1', 'step': None, 'drop': [], 'water': 1}, ()),
}
CROT = {'cat': {'body': [90, 0, 0]}, 'ocelot': {'body': [90, 0, 0]}, 'panda': {'body': [90, 0, 0]}, 'llama': {'body': [90, 0, 0]}}
BROT = {'cat': {'tail1': [-51.57, 0, 0], 'tail2': [10, 0, 0]}, 'ocelot': {'tail1': [-51.57, 0, 0], 'tail2': [10, 0, 0]}}
OUT = {}; GUIMAP = {}
for n, (geo, ident, tex, w, h, hp, ex, skip) in M.items():
    parts, tw, th = bm.convert(geo, ident, skip=set(skip), crot=CROT.get(n), brot=BROT.get(n))
    jt = Image.open('/root/tpl/assets/minecraft/textures/' + E + tex + '.png'); jw, jh = jt.size
    f = '/root/f64/assets/minecraft/textures/' + E + tex + '.png'; src = Image.open(f).convert('RGBA') if os.path.exists(f) else jt.convert('RGBA')
    g = src.resize((jw * 2, jh * 2), Image.NEAREST if src.width < jw * 2 else Image.BOX)
    key = 'mob_' + n
    for d in ['/home/claude/bbsite/gui/', '/home/claude/blockcraft/gui/', '/home/claude/repo/gui/']: g.save(d + key + '.png')
    GUIMAP[key] = E + tex + '.png'
    D = {'tex': key, 'tw': tw, 'w': w, 'h': h, 'hp': hp, 'parts': parts}; D.update(ex); OUT[n] = D
js = '// generated by tools/gen_mobs2.py from Bedrock geometry: more mobs\nObject.assign(MOBDEF, ' + json.dumps(OUT, separators=(',', ':')) + ');\n'
for d in ['/home/claude/bbsite/js/', '/home/claude/blockcraft/js/', '/home/claude/repo/js/']: open(d + 'mobs2.js', 'w').write(js)
for root in ['/home/claude/bbsite', '/home/claude/blockcraft', '/home/claude/repo']:
    for fn in ['registry.json', 'js/registry.js']:
        p = root + '/' + fn
        if not os.path.exists(p): continue
        s = open(p).read(); isjs = fn.endswith('.js'); pre = 'window.REGISTRY='
        r = json.loads(s[len(pre):].rstrip().rstrip(';')) if isjs else json.loads(s)
        r['guimap'].update(GUIMAP)
        open(p, 'w').write(pre + json.dumps(r, separators=(',', ':')) + ';' if isjs else json.dumps(r))
print(len(OUT), 'mobs', round(len(js) / 1024), 'KB')
