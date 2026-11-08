"""Read the vanilla block models from the template and give non-cube blocks their real 3D shape (bx with per-face textures)."""
import json, os, sys, re
M = '/root/tpl/assets/minecraft/'
def load(p):
    try: return json.load(open(p))
    except Exception: return None
cache = {}
def model(name):
    name = name.replace('minecraft:', '')
    if name in cache: return cache[name]
    m = load(M + 'models/' + name + '.json') or {}
    tex, el = {}, None
    if 'parent' in m:
        pt, pe = model(m['parent'])
        tex.update(pt); el = pe
    tex.update(m.get('textures', {}))
    if 'elements' in m: el = m['elements']
    cache[name] = (tex, el); return cache[name]
def resolve(tex, v, depth=0):
    v = v.get('sprite') if isinstance(v, dict) else v
    while v and v.startswith('#') and depth < 10: v = tex.get(v[1:]); v = v.get('sprite') if isinstance(v, dict) else v; depth += 1
    return v.replace('minecraft:', '').replace('block/', '') if v else None
NOSOLID = {'scaffolding', 'mangrove_roots', 'azalea', 'flowering_azalea', 'wheat', 'carrots', 'potatoes', 'beetroots', 'torch', 'soul_torch', 'redstone_torch', 'copper_torch', 'cake'}
ORDER = ['up', 'down', 'south', 'north', 'east', 'west']
def convert(reg, only_cube=True):
    tiles, n = reg['tiles'], 0
    for b in reg['blocks']:
        if b['s'] not in ('cube', 'box', 'cross') or re.search(r'door|trapdoor|slab|button|pressure_plate|_on$|_open$|_top$|^(nether_portal|seagrass|tall_seagrass|kelp|kelp_plant|sea_pickle|piston_head|powder_snow)$', b['n']): continue
        if b['s'] == 'box' and b.get('bx'): continue  # hand-made redstone/door/slab shapes keep their states
        bs = load(M + 'blockstates/' + b['n'] + '.json')
        if not bs or 'variants' not in bs: continue
        vs = bs['variants']; key = next((k for k in vs if 'facing=south' in k and 'hanging=true' not in k), None) or next((k for k in vs if 'hanging=false' in k or k == ''), None) or next(iter(vs))
        v = vs[key]; v = v[0] if isinstance(v, list) else v
        tex, el = model(v['model'])
        if not el: continue
        full = all(e['from'] == [0, 0, 0] and e['to'] == [16, 16, 16] for e in el) or b['n'] in ('honey_block', 'slime_block')
        if full: continue
        if all('rotation' in e for e in el): continue
        el = [e for e in el if 'rotation' not in e or e['rotation'].get('angle', 0) == 0]
        if convert_one(b, tex, el, tiles): n += 1
    return n
def convert_one(b, tex, el, tiles):
        if all('rotation' in e for e in el): return False
        el = [e for e in el if 'rotation' not in e or e['rotation'].get('angle', 0) == 0]
        bx, ok = [], True
        for e in el:
            f, t = e['from'], e['to']
            box = [round(f[0], 2), round(f[1], 2), round(f[2], 2), round(t[0], 2), round(t[1], 2), round(t[2], 2)]
            faces, first = [], None
            for d in ORDER:
                fc = e.get('faces', {}).get(d)
                if not fc: faces.append(None); continue
                tn = resolve(tex, fc.get('texture'))
                if tn not in tiles: ok = False; break
                ti = tiles[tn]; first = first if first is not None else ti
                faces.append([ti] + ([round(x / 16, 4) for x in fc['uv']] if 'uv' in fc else []))
            if not ok: break
            bx.append([box, first or 0, faces])
        if not ok or not bx or len(bx) > 24: return False
        b['s'] = 'box'; b['a'] = 1; b['bx'] = bx
        xs = [e[0] for e in bx]; b['bb'] = [min(x[0] for x in xs), min(x[1] for x in xs), min(x[2] for x in xs), max(x[3] for x in xs), max(x[4] for x in xs), max(x[5] for x in xs)]
        h, w = b['bb'][4] - b['bb'][1], b['bb'][3] - b['bb'][0]
        if h >= 4 and w >= 8 and b['n'] not in NOSOLID: b['solid'] = 1
        b['model'] = 1
        return True
LIGHT = {'lantern': 1, 'soul_lantern': 1, 'campfire': 1, 'soul_campfire': 1, 'end_rod': 1, 'sea_lantern': 1, 'shroomlight': 1, 'froglight': 1, 'ochre_froglight': 1, 'verdant_froglight': 1, 'pearlescent_froglight': 1, 'jack_o_lantern': 1, 'magma_block': 1, 'beacon': 1, 'conduit': 1, 'crying_obsidian': 1, 'respawn_anchor': 1, 'copper_lantern': 1}
SKIP = re.compile(r'(^|_)(wall_|potted_|attached_|infested_)|wall_torch|wall_sign|wall_banner|wall_head|wall_skull|wall_fan|_door$|_trapdoor$|_bed$|banner$|_sign$|skull|_head$|piston|moving|^air$|void_air|cave_air|_stem$|bubble_column|fire$|^water$|^lava$|portal|end_gateway|light$|structure|jigsaw|command|barrier|test_|^chest$|trapped_chest|ender_chest|shulker_box|_button$|pressure_plate|tripwire|redstone_wire|frosted_ice|_cauldron$|cocoa|_slab$')
def add_missing(reg):
    """Append every vanilla block (simple variants) that is missing, when all its textures are in the atlas."""
    tiles, have = reg['tiles'], {b['n'] for b in reg['blocks']}; added = []
    for f in sorted(os.listdir(M + 'blockstates')):
        nm = f[:-5]
        if nm in have or SKIP.search(nm) and nm not in LIGHT: continue
        bs = load(M + 'blockstates/' + f)
        if not bs or 'variants' not in bs: continue
        vs = bs['variants']; key = next((k for k in vs if k == ''), None) or next((k for k in vs if 'facing=south' in k and 'hanging=true' not in k and 'half=top' not in k), None) or next((k for k in vs if 'hanging=false' in k or 'axis=y' in k or 'age=0' in k or 'lit=false' in k), None) or next(iter(vs))
        v = vs[key]; v = v[0] if isinstance(v, list) else v
        tex, el = model(v['model'])
        if not el: continue
        full = all(e['from'] == [0, 0, 0] and e['to'] == [16, 16, 16] for e in el)
        if full and len(el) == 1:
            fc = el[0].get('faces', {}); g = lambda d: resolve(tex, fc.get(d, {}).get('texture'))
            t = [g('up'), g('down'), g('east') or g('north'), g('south') or g('north')]
            if not all(x in tiles for x in t): continue
            reg['blocks'].append({'n': nm, 't': [tiles[x] for x in t], 's': 'cube', 'a': 1 if re.search(r'glass|leaves|ice$', nm) else 0, 'e': LIGHT.get(nm, 0), 'vanilla': 1}); added.append(nm); continue
        b = {'n': nm, 't': [0, 0, 0, 0], 's': 'cube', 'a': 1, 'e': LIGHT.get(nm, 0), 'vanilla': 1}
        reg['blocks'].append(b)
        if not convert_one(b, tex, el, tiles): reg['blocks'].pop(); continue
        b['t'] = [b['bx'][0][1]] * 4; added.append(nm)
    return added

if __name__ == '__main__':
    for R in sys.argv[1:]:
        reg = json.load(open(R + 'registry.json'))
        n = convert(reg); ad = add_missing(reg); print('added', len(ad), ad)
        json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
        open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
        print(R, n, 'blocks now use vanilla models:', [b['n'] for b in reg['blocks'] if b.get('model')])
