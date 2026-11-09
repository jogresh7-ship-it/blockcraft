"""Blocks Minecraft draws as block-entities: chests, heads, decorated pot, conduit (real entity textures packed into the atlas),
signs, hanging signs, beds, banners (built from planks/wool), plus wall torches, wall coral fans, copper doors/trapdoors,
infested blocks and frosted ice."""
import json, os, re, sys, copy
from PIL import Image
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems, bbox
TPL = '/root/tpl/assets/minecraft/textures/entity/'
FACING = {'north': [0, 0], 'east': [0, 90], 'south': [0, 180], 'west': [0, 270]}  # models below face north
def cub(u, v, w, h, d):  # Java model-part box UV layout (texel coords)
    return {'up': (u + d, v, u + d + w, v + d), 'down': (u + d + w, v, u + d + 2 * w, v + d), 'north': (u + d, v + d, u + d + w, v + d + h),
            'south': (u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h), 'west': (u, v + d, u + d, v + d + h), 'east': (u + d + w, v + d, u + 2 * d + w, v + d + h)}
def el(f, t, tile, uvs, flip=False):
    """box f..t (block px) textured from an entity region at `tile` with texel uv rects; flip = entity model rendered upside-down."""
    faces = {}
    for d, r in uvs.items():
        u0, v0, u1, v1 = r; dd = d
        if flip and d in ('up', 'down'): dd = 'down' if d == 'up' else 'up'
        if flip and d not in ('up', 'down'): v0, v1 = v1, v0
        faces[dd] = [tile, u0, v0, u1, v1, 0]
    return {'f': f, 't': t, 'faces': faces}
def tbox(f, t, tiles, top=None, side=None):  # box textured from ordinary block tiles
    top = tiles[top] if isinstance(top, str) else top; side = tiles[side] if isinstance(side, str) else side
    faces = {}
    for d in ('up', 'down', 'north', 'south', 'east', 'west'):
        tl = top if d in ('up', 'down') else side
        if d in ('up', 'down'): uv = [f[0], f[2], t[0], t[2]]
        elif d in ('north', 'south'): uv = [f[0], 16 - t[1], t[0], 16 - f[1]]
        else: uv = [f[2], 16 - t[1], t[2], 16 - f[1]]
        uv = [max(0, min(16, x)) for x in uv]
        faces[d] = [tl] + uv + [0]
    return {'f': f, 't': t, 'faces': faces}
def run(R, esrc):
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; cols = reg['cols']; names = {b['n']: b for b in reg['blocks']}
    A = Image.open(R + 'blocks.png').convert('RGBA'); TS = A.width // cols
    # ---- pack entity textures into new atlas rows ----
    regions, want = {}, {}
    for k in ['normal', 'trapped', 'ender', 'copper', 'copper_exposed', 'copper_weathered', 'copper_oxidized']: want['chest_' + k] = 'chest/' + k + '.png'
    for k, p in {'skeleton': 'skeleton/skeleton.png', 'wither_skeleton': 'skeleton/wither_skeleton.png', 'zombie': 'zombie/zombie.png', 'creeper': 'creeper/creeper.png', 'piglin': 'piglin/piglin.png', 'player': 'player/wide/steve.png'}.items(): want['head_' + k] = p
    want['pot_base'] = 'decorated_pot/decorated_pot_base.png'; want['pot_side'] = 'decorated_pot/decorated_pot_side.png'; want['conduit'] = 'conduit/base.png'
    imgs = {}
    for k, p in want.items():
        src = next((d + p for d in (esrc, TPL) if os.path.exists(d + p)), None)
        if not src: continue
        logical = Image.open(TPL + p).size if os.path.exists(TPL + p) else Image.open(src).size
        im = Image.open(src).convert('RGBA').resize((logical[0] * TS // 16, logical[1] * TS // 16), Image.NEAREST)
        imgs[k] = (im, logical)
    rows0 = reg['rows']; x = 0; y = rows0; bandh = 0; place = {}
    for k, (im, lg) in sorted(imgs.items(), key=lambda kv: -kv[1][0].height):
        tw, th = im.width // TS, im.height // TS
        if x + tw > cols: x = 0; y += bandh; bandh = 0
        place[k] = (x, y); x += tw; bandh = max(bandh, th)
    rows = y + bandh
    NA = Image.new('RGBA', (A.width, rows * TS)); NA.paste(A, (0, 0))
    for k, (x, y) in place.items(): NA.paste(imgs[k][0], (x * TS, y * TS)); regions[k] = y * cols + x
    NA.save(R + 'blocks.png', optimize=True); reg['rows'] = rows
    out = []
    def add(b):
        if b['n'] in names: old = names[b['n']]; old.clear(); old.update(b)
        else: reg['blocks'].append(b); names[b['n']] = b
        out.append(b['n'])
    def entblock(n, els, solid=1, extra=None):
        b = {'n': n, 't': [els[0]['faces'][next(iter(els[0]['faces']))][0]] * 4, 's': 'box', 'a': 1, 'e': 0, 'vanilla': 1, 'mm': els, 'mr': [0, 0], 'fy': FACING, 'bb': bbox(els), 'entity': 1}
        if solid: b['solid'] = 1
        if extra: b.update(extra)
        add(b)
    # chests (the chest model is drawn upside-down in Java, hence flip)
    for n, k in [('chest', 'normal'), ('trapped_chest', 'trapped'), ('ender_chest', 'ender'), ('copper_chest', 'copper'), ('exposed_copper_chest', 'copper_exposed'), ('weathered_copper_chest', 'copper_weathered'), ('oxidized_copper_chest', 'copper_oxidized'),
                 ('waxed_copper_chest', 'copper'), ('waxed_exposed_copper_chest', 'copper_exposed'), ('waxed_weathered_copper_chest', 'copper_weathered'), ('waxed_oxidized_copper_chest', 'copper_oxidized')]:
        t = regions.get('chest_' + k)
        if t is None: continue
        els = [el([1, 0, 1], [15, 10, 15], t, cub(0, 19, 14, 10, 14), True), el([1, 9, 1], [15, 14, 15], t, cub(0, 0, 14, 5, 14), True), el([7, 7, 0], [9, 11, 1], t, cub(0, 0, 2, 4, 1), True)]
        entblock(n, els, 1, {'e': 7 if n == 'ender_chest' else 0, 'chestlike': 1})
    # mob heads (8x8x8 cube on the floor)
    for n, k in [('skeleton_skull', 'skeleton'), ('wither_skeleton_skull', 'wither_skeleton'), ('zombie_head', 'zombie'), ('creeper_head', 'creeper'), ('piglin_head', 'piglin'), ('player_head', 'player')]:
        t = regions.get('head_' + k)
        if t is None: continue
        els = [el([4, 0, 4], [12, 8, 12], t, cub(0, 0, 8, 8, 8), True)] if k != 'piglin' else [el([3, 0, 4], [13, 8, 12], t, cub(0, 0, 10, 8, 8), True)]
        entblock(n, els, 0)
    # decorated pot
    if 'pot_base' in regions and 'pot_side' in regions:
        tb, ts = regions['pot_base'], regions['pot_side']
        side = lambda: {'north': (0, 0, 16, 16), 'south': (0, 0, 16, 16), 'east': (0, 0, 16, 16), 'west': (0, 0, 16, 16)}
        body = {'f': [1, 0, 1], 't': [15, 16, 15], 'faces': {d: [ts, *r, 0] for d, r in side().items()}}
        body['faces']['up'] = [tb, 0, 13, 14, 27, 0]; body['faces']['down'] = [tb, 14, 13, 28, 27, 0]
        neck = el([4, 16, 4], [12, 20, 12], tb, cub(0, 5, 8, 3, 8))
        entblock('decorated_pot', [body, neck], 1)
    if 'conduit' in regions:
        entblock('conduit', [el([5, 5, 5], [11, 11, 11], regions['conduit'], cub(0, 0, 6, 6, 6))], 0, {'e': 15})
    # ---- signs, hanging signs, banners, beds from block textures ----
    WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak', 'poplar']
    stem = lambda w: next((c for c in (w + '_log', w + '_stem', 'stripped_' + w + '_log', w + '_block', 'bamboo_block') if c in T), None)
    chain = next((c for c in ('iron_chain', 'chain') if c in T), None)
    for w in WOODS:
        pl = w + '_planks'
        if pl not in T: continue
        lg = stem(w) or pl
        entblock(w + '_sign', [tbox([0, 7.3, 7.3], [16, 15.3, 8.7], T, pl, pl), tbox([7.3, 0, 7.3], [8.7, 7.3, 8.7], T, lg, lg)], 0)
        entblock(w + '_wall_sign', [tbox([0, 4, 14.6], [16, 12, 16], T, pl, pl)], 0, {'hide': 1})
        hs = [tbox([1, 0, 7], [15, 10, 9], T, pl, pl)]
        if chain: hs += [tbox([3, 10, 7.5], [4, 16, 8.5], T, chain, chain), tbox([12, 10, 7.5], [13, 16, 8.5], T, chain, chain)]
        entblock(w + '_hanging_sign', hs, 0)
    COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
    for c in COLORS:
        wool = c + '_wool'
        if wool not in T: continue
        entblock(c + '_banner', [tbox([7.3, 0, 7.3], [8.7, 28, 8.7], T, 'oak_planks', 'oak_planks'), tbox([1.5, 26.7, 7], [14.5, 28, 9], T, 'oak_planks', 'oak_planks'), tbox([1.5, 1.5, 7.6], [14.5, 26.7, 8.4], T, wool, wool)], 0)
        legs = lambda: [tbox([0, 0, 0], [3, 3, 3], T, 'oak_planks', 'oak_planks'), tbox([13, 0, 0], [16, 3, 3], T, 'oak_planks', 'oak_planks')]
        # foot half (the item) and head half with the pillow; both face north (head towards -z)
        entblock(c + '_bed', [tbox([0, 3, 0], [16, 9, 16], T, wool, wool)] + [tbox([0, 0, 13], [3, 3, 16], T, 'oak_planks', 'oak_planks'), tbox([13, 0, 13], [16, 3, 16], T, 'oak_planks', 'oak_planks')], 1, {'bed': 1, 'bb': [0, 0, 0, 16, 9, 16]})
        entblock(c + '_bed_head', [tbox([0, 3, 0], [16, 9, 16], T, wool, wool), tbox([2, 9, 1], [14, 10.5, 6], T, 'white_wool', 'white_wool')] + legs(), 1, {'bed': 1, 'hide': 1, 'bb': [0, 0, 0, 16, 9, 16]})
    # ---- wall torches and wall coral fans from their vanilla models ----
    for n in ['wall_torch', 'soul_wall_torch', 'redstone_wall_torch', 'copper_wall_torch'] + [p + c + '_coral_wall_fan' for c in ('tube', 'brain', 'bubble', 'fire', 'horn') for p in ('', 'dead_')]:
        bs = MD.load(MD.M + 'blockstates/' + n + '.json')
        if not bs: continue
        vs = bs['variants']; fy = {}; model = None
        for k, v in vs.items():
            p = dict(q.split('=') for q in k.split(',')); v = v[0] if isinstance(v, list) else v
            if p.get('lit', 'true') != 'true' or p.get('waterlogged', 'false') != 'false': continue
            fy[p['facing']] = [v.get('x', 0), v.get('y', 0)]; model = v['model'] if p['facing'] == 'east' or model is None else model
        # vanilla wall torch models point east; re-express rotations relative to that model
        v = vs[next(k for k in vs if 'facing=east' in k and 'lit=false' not in k and 'waterlogged=true' not in k)]; v = v[0] if isinstance(v, list) else v
        els = elems(v['model'], T)
        if not els or len(fy) < 4: continue
        base = fy['east'][1]; fy = {d: [0, (r[1] - base) % 360] for d, r in fy.items()}
        b = {'n': n, 't': [els[0]['faces'][next(iter(els[0]['faces']))][0]] * 4, 's': 'box', 'a': 1, 'e': 14 if 'torch' in n and 'redstone' not in n else (7 if 'redstone' in n else 0), 'vanilla': 1, 'mm': els, 'mr': fy['east'], 'fy': fy, 'fyw': 1, 'bb': bbox(els), 'hide': 1}
        if 'coral' in n: b['plant'] = 1
        add(b)
    # ---- copper doors / trapdoors: same block family as the iron door, opened by hand ----
    for ox in ['', 'exposed_', 'weathered_', 'oxidized_']:
        for wx in ['', 'waxed_']:
            base = wx + ox + 'copper_door'; tb_, tt_ = ox + 'copper_door_bottom', ox + 'copper_door_top'
            if tb_ in T and tt_ in T and 'iron_door' in names:
                for suf, tl, bbx in [('', tb_, 'iron_door'), ('_open', tb_, 'iron_door_open'), ('_top', tt_, 'iron_door_top'), ('_top_open', tt_, 'iron_door_top_open')]:
                    b = copy.deepcopy(names[bbx]); b['n'] = base + suf; b['t'] = [T[tl]] * 4; add(b)
            base = wx + ox + 'copper_trapdoor'; tl = ox + 'copper_trapdoor'
            if tl in T and 'iron_trapdoor' in names:
                for suf, src in [('', 'iron_trapdoor'), ('_open', 'iron_trapdoor_open')]:
                    b = copy.deepcopy(names[src]); b['n'] = base + suf; b['t'] = [T[tl]] * 4; add(b)
    # ---- infested blocks look exactly like their normal block ----
    for n in ['stone', 'cobblestone', 'stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks', 'chiseled_stone_bricks', 'deepslate']:
        if n in names and 'infested_' + n not in names:
            b = copy.deepcopy(names[n]); b['n'] = 'infested_' + n; add(b)
    if 'frosted_ice_0' in T and 'frosted_ice' not in names: add({'n': 'frosted_ice', 't': [T['frosted_ice_0']] * 4, 's': 'cube', 'a': 1, 'e': 0, 'vanilla': 1})
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, len(out), 'blocks; atlas rows', rows0, '->', rows, '; total', len(reg['blocks']))
run('/home/claude/blockcraft/', '/root/f64/assets/minecraft/textures/entity/')
run('/home/claude/bbsite/', '/root/bbm/assets/minecraft/textures/entity/')
