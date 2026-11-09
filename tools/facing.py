"""Give vanilla-model blocks real behaviour data: facing rotations, fence-gate open models, slab tops/doubles."""
import json, re, sys
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems, bbox
M = MD.M
def props(k): return dict(p.split('=') for p in k.split(',') if '=' in p)
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; names = {b['n']: b for b in reg['blocks']}; nf = ng = ns = 0
    for b in list(reg['blocks']):
        n = b['n']
        if not (b.get('model') or b.get('mm')) or b.get('mp') or 'piston' in n: continue
        bs = MD.load(M + 'blockstates/' + n + '.json')
        if not bs or 'variants' not in bs: continue
        vs = bs['variants']
        fk = [k for k in vs if 'facing=' in k]
        if fk:
            # the other properties of the variant we use, e.g. half=bottom,shape=straight for stairs
            base = {'half': 'bottom', 'shape': 'straight', 'open': 'false', 'in_wall': 'false', 'powered': 'false', 'face': 'floor', 'hanging': 'false', 'waterlogged': 'false', 'attachment': 'floor', 'has_book': 'false', 'lit': 'false', 'signal_fire': 'false', 'type': 'bottom', 'part': 'foot', 'occupied': 'false', 'tilt': 'none', 'berries': 'false', 'bottom': 'false'}
            def find(facing, **over):
                want = dict(base, **over); best = None; bs_ = -1
                for k in vs:
                    p = props(k)
                    if p.get('facing') != facing: continue
                    s = sum(p.get(a) == v for a, v in want.items() if a in p)
                    if s > bs_: best, bs_ = k, s
                return best
            fy, model = {}, None
            for f in ('north', 'east', 'south', 'west'):
                k = find(f)
                if k is None: continue
                v = vs[k]; v = v[0] if isinstance(v, list) else v
                fy[f] = [v.get('x', 0), v.get('y', 0)]
                if model is None or f == 'north': model = v['model']
            if len(fy) == 4:
                els = elems(model, T)
                if els:
                    b['mm'] = els; b.pop('bx', None); b['fy'] = fy; b['mr'] = fy['north']; b['s'] = 'box'; b['bb'] = bbox(els) if not b.get('solid') or n.endswith('stairs') else b.get('bb', bbox(els))
                    if n.endswith('stairs'): b['bb'] = [0, 0, 0, 16, 16, 16]
                    nf += 1
                    if n.endswith('fence_gate'):
                        ko = find('north', open='true'); vo = vs[ko]; vo = vo[0] if isinstance(vo, list) else vo
                        eo = elems(vo['model'], T)
                        if eo: b['mmo'] = eo; ng += 1
                        b['solid'] = 1; b['bb'] = [0, 0, 6, 16, 16, 10]
    # new slabs: a top-half twin and the double (full) block
    for b in list(reg['blocks']):
        n = b['n']
        if not n.endswith('_slab') or b.get('slab') or names.get(n + '_top'): continue
        stem = n[:-5]
        dbl = next((c for c in (stem, stem + 's', stem.replace('_brick', '_bricks'), stem + '_planks', stem.replace('_tile', '_tiles')) if c in names and names[c]['s'] == 'cube'), None)
        if b.get('mm'):
            top = json.loads(json.dumps(b)); top['n'] = n + '_top'; top['hide'] = 1
            for e in top['mm']:
                e['f'][1] += 8; e['t'][1] += 8
            top['bb'] = bbox(top['mm']); reg['blocks'].append(top); names[top['n']] = top
            if dbl: b['slab'] = dbl; top['slab'] = dbl
            ns += 1
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, 'facing', nf, 'gates', ng, 'slabs', ns, 'total', len(reg['blocks']))
