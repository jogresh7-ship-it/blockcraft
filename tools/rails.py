"""Rail shapes (straight, slopes, curves) with their models and rotations from the vanilla blockstates."""
import json, sys
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems
def props(k): return dict(p.split('=') for p in k.split(',') if '=' in p)
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']
    for b in reg['blocks']:
        if b['n'] not in ('rail', 'powered_rail', 'detector_rail', 'activator_rail'): continue
        bs = MD.load(MD.M + 'blockstates/' + b['n'] + '.json'); mods, idx, sh = [], {}, {}
        for k, v in bs['variants'].items():
            p = props(k); v = v[0] if isinstance(v, list) else v
            if p.get('waterlogged', 'false') != 'false': continue
            key = p['shape'] + ('|on' if p.get('powered') == 'true' else '')
            m = v['model']
            if m not in idx: idx[m] = len(mods); mods.append(elems(m, T))
            sh[key] = [idx[m], v.get('x', 0), v.get('y', 0)]
        b['rails'] = sh; b['rmods'] = mods; b['solid'] = 0
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, [ (b['n'], list(b['rails'])[:12]) for b in reg['blocks'] if 'rails' in b][:1])
