"""Placement data from vanilla blockstates: upside-down (half=top), wall/ceiling (face=wall|ceiling), hanging models;
plus wall heads/banners, barrier and light blocks."""
import json, re, sys, copy
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems, bbox
def props(k): return dict(p.split('=') for p in k.split(',') if '=' in p)
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; names = {b['n']: b for b in reg['blocks']}; c = {'top': 0, 'wall': 0, 'ceil': 0, 'hang': 0, 'attach': 0, 'new': 0}
    for b in reg['blocks']:
        n = b['n']
        if not b.get('mm') or b.get('entity'): continue
        bs = MD.load(MD.M + 'blockstates/' + n + '.json')
        if not bs or 'variants' not in bs: continue
        vs = {k: (v[0] if isinstance(v, list) else v) for k, v in bs['variants'].items()}
        def rotmap(**want):
            m = {}
            for k, v in vs.items():
                p = props(k)
                if all(p.get(a) == x for a, x in want.items()) and 'facing' in p and p['facing'] in ('north', 'east', 'south', 'west') and p.get('powered', 'false') == 'false' and p.get('waterlogged', 'false') == 'false' and p.get('shape', 'straight') == 'straight' and p.get('open', 'false') == 'false':
                    m.setdefault(p['facing'], [v.get('x', 0), v.get('y', 0)])
            return m if len(m) == 4 else None
        if b.get('fy'):
            t = rotmap(half='top')
            if t: b['fyt'] = t; c['top'] += 1
            w = rotmap(face='wall'); cl = rotmap(face='ceiling')
            if w: b['fyw2'] = w; c['wall'] += 1
            if cl: b['fyc'] = cl; c['ceil'] += 1
        hk = next((k for k in vs if props(k).get('hanging') == 'true' and props(k).get('waterlogged', 'false') == 'false'), None)
        if hk:
            eh = elems(vs[hk]['model'], T)
            if eh: b['mmh'] = eh; c['hang'] += 1
        # blocks that hang on a wall: their facing comes from the face you click, not from where you look
        if re.search(r'ladder$|tripwire_hook$|_wall_fan$|^lever$|cocoa$', n) and b.get('fy'): b['fyw'] = 1; c['attach'] += 1
        # slabs placed under a block turn into the top slab (handled by their *_top twin); trapdoors use half=top
    # wall heads and banners (attached to the block behind them, facing out)
    def add(b):
        if b['n'] in names: return
        reg['blocks'].append(b); names[b['n']] = b; c['new'] += 1
    for h in ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head', 'piglin_head', 'player_head']:
        if h not in names: continue
        b = copy.deepcopy(names[h]); b['n'] = h.replace('_skull', '_wall_skull').replace('_head', '_wall_head'); b['hide'] = 1; b['fyw'] = 1
        for e in b['mm']:
            e['f'] = [e['f'][0], e['f'][1] + 4, e['f'][2] + 4]; e['t'] = [e['t'][0], e['t'][1] + 4, e['t'][2] + 4]
        b['bb'] = bbox(b['mm']); add(b)
    for col in ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']:
        n = col + '_banner'
        if n not in names: continue
        b = copy.deepcopy(names[n]); b['n'] = col + '_wall_banner'; b['hide'] = 1; b['fyw'] = 1
        pole, bar, flag = b['mm']
        bar['f'] = [1.5, 14.7, 14]; bar['t'] = [14.5, 16, 16]; flag['f'] = [1.5, -9.3, 14.6]; flag['t'] = [14.5, 14.7, 15.4]
        b['mm'] = [bar, flag]; b['bb'] = [1.5, 0, 14, 14.5, 16, 16]; add(b)
    # creative technical blocks
    if 'barrier' not in names and 'glass' in T: add({'n': 'barrier', 't': [T['glass']] * 4, 's': 'box', 'a': 1, 'e': 0, 'vanilla': 1, 'mm': [], 'mr': [0, 0], 'bb': [0, 0, 0, 16, 16, 16], 'solid': 1, 'invisible': 1})
    if 'light' not in names and 'glass' in T: add({'n': 'light', 't': [T['glass']] * 4, 's': 'box', 'a': 1, 'e': 15, 'vanilla': 1, 'mm': [], 'mr': [0, 0], 'bb': [0, 0, 0, 16, 16, 16], 'invisible': 1})
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, c, 'total', len(reg['blocks']))
