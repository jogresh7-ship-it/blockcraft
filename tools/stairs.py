"""Stair corner shapes: inner/outer models and the rotation for every facing/half/shape (from the vanilla blockstates)."""
import json, sys
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems
def props(k): return dict(p.split('=') for p in k.split(',') if '=' in p)
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; n = 0
    for b in reg['blocks']:
        if not b['n'].endswith('_stairs') or not b.get('mm'): continue
        bs = MD.load(MD.M + 'blockstates/' + b['n'] + '.json')
        if not bs or 'variants' not in bs: continue
        stv, mods = {}, {}
        for k, v in bs['variants'].items():
            v = v[0] if isinstance(v, list) else v; p = props(k)
            if p.get('waterlogged', 'false') != 'false': continue
            m = v['model'].replace('minecraft:', ''); kind = 1 if m.endswith('_inner') else 2 if m.endswith('_outer') else 0
            if kind and kind not in mods: mods[kind] = elems(v['model'], T)
            stv[p['facing'] + '|' + p['half'] + '|' + p['shape']] = [v.get('x', 0), v.get('y', 0), kind]
        if mods.get(1) and mods.get(2): b['stv'] = stv; b['mmi'] = mods[1]; b['mmu'] = mods[2]; n += 1
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, 'stairs', n)
