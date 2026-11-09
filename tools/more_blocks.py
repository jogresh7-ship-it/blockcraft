"""Add the remaining vanilla blocks: rotated-part models (potted plants, chains, dripleaf...) and connecting multipart blocks (fences, walls, panes, bars, vines)."""
import json, os, re, sys
sys.path.insert(0, '/root/build'); import models as MD
M = MD.M
def default_uv(d, f, t):
    if d in ('up', 'down'): return [f[0], f[2], t[0], t[2]]
    if d in ('north', 'south'): return [f[0], 16 - t[1], t[0], 16 - f[1]]
    return [f[2], 16 - t[1], t[2], 16 - f[1]]
def elems(model, tiles):
    tex, el = MD.model(model.replace('minecraft:', ''))
    if not el: return None
    out = []
    for e in el:
        faces = {}
        for d, fc in e.get('faces', {}).items():
            tn = MD.resolve(tex, fc.get('texture'))
            if tn not in tiles: return None
            faces[d] = [tiles[tn]] + [round(v, 3) for v in (fc.get('uv') or default_uv(d, e['from'], e['to']))] + [fc.get('rotation', 0)]
        o = {'f': [round(v, 3) for v in e['from']], 't': [round(v, 3) for v in e['to']], 'faces': faces}
        r = e.get('rotation')
        if r and r.get('angle', 0): o['r'] = [*r.get('origin', [8, 8, 8]), r['axis'], r['angle'], 1 if r.get('rescale') else 0]
        out.append(o)
    return out
def bbox(els):
    if not els: return [0, 0, 0, 16, 16, 16]
    return [min(e['f'][0] for e in els), min(e['f'][1] for e in els), min(e['f'][2] for e in els), max(e['t'][0] for e in els), max(e['t'][1] for e in els), max(e['t'][2] for e in els)]
PREF = ['type=bottom', 'face=floor', 'facing=north', 'powered=false', 'shape=north_south', 'axis=y', 'waterlogged=false', 'half=lower', 'hanging=false', 'level=3', 'age=7', 'thickness=frustum', 'vertical_direction=up', 'tilt=none', 'berries=false', 'attached=false', 'lit=false', 'open=false', 'in_wall=false', 'stage=0']
def pick(vs):
    best, bs = None, -1
    for k in vs:
        s = sum(p in k.split(',') for p in PREF)
        if s > bs: best, bs = k, s
    v = vs[best]; return v[0] if isinstance(v, list) else v
SKIP = re.compile(r'_wall_|^wall_torch$|_sign$|_bed$|^test_|^attached_|^tripwire$|^infested_|^waxed_.*_(door|trapdoor)$|banner|head$|skull$|_air$|^light$|^barrier$|structure|moving_piston|portal|gateway|bubble_column|^frosted_ice$|chest$|statue$|conduit|decorated_pot')
LIGHT = {'copper_wall_torch': 1, 'redstone_wall_torch': 1, 'soul_wall_torch': 1}
NONSOLID = re.compile(r'button|pressure_plate|rail$|potted_|_fan$|coral|vine|dripleaf|dripstone|stem$|crop|pitcher|sapling|moss$|spike|cocoa|hook|lichen|sculk_vein|resin_clump|bamboo$')
def add(reg):
    tiles, have = reg['tiles'], {b['n'] for b in reg['blocks']}; added = []
    for f in sorted(os.listdir(M + 'blockstates')):
        nm = f[:-5]
        if nm in have or SKIP.search(nm): continue
        bs = MD.load(M + 'blockstates/' + f)
        if 'variants' in bs:
            v = pick(bs['variants']); els = elems(v['model'], tiles)
            if not els: continue
            if len(els) == 1 and els[0]['f'] == [0, 0, 0] and els[0]['t'] == [16, 16, 16] and 'r' not in els[0] and not v.get('x') and not v.get('y'):
                fc = els[0]['faces']; g = lambda d: (fc.get(d) or fc.get('north'))[0]
                reg['blocks'].append({'n': nm, 't': [g('up'), g('down'), g('east'), g('south')], 's': 'cube', 'a': 0, 'e': LIGHT.get(nm, 0), 'vanilla': 1}); added.append(nm); continue
            bb = bbox(els); b = {'n': nm, 't': [els[0]['faces'][next(iter(els[0]['faces']))][0]] * 4, 's': 'box', 'a': 1, 'e': LIGHT.get(nm, 0), 'vanilla': 1, 'mm': els, 'mr': [v.get('x', 0), v.get('y', 0)], 'bb': bb}
            if not NONSOLID.search(nm) and bb[4] - bb[1] >= 4 and bb[3] - bb[0] >= 8: b['solid'] = 1
            if NONSOLID.search(nm) and re.search(r'coral|vine|dripleaf|sapling|crop|pitcher|stem$', nm): b['plant'] = 1
            reg['blocks'].append(b); added.append(nm)
        else:  # multipart: each part has an optional `when` and is shown when it matches the block's connections
            parts, ok = [], True
            for p in bs['multipart']:
                ap = p['apply']; ap = ap[0] if isinstance(ap, list) else ap
                els = elems(ap['model'], tiles)
                if els is None: ok = False; break
                parts.append({'w': p.get('when'), 'm': els, 'rx': ap.get('x', 0), 'ry': ap.get('y', 0)})
            if not ok or not parts: continue
            kind = 'fence' if nm.endswith('_fence') else 'wall' if nm.endswith('_wall') else 'pane' if re.search(r'pane$|bars$', nm) else 'attach' if re.search(r'vine$|lichen|sculk_vein|resin_clump', nm) else 'other'
            allm = [e for p in parts for e in p['m']]
            first = next((e['faces'][d][0] for e in allm for d in e['faces']), 0)
            b = {'n': nm, 't': [first] * 4, 's': 'box', 'a': 1, 'e': 0, 'vanilla': 1, 'mp': parts, 'mpk': kind, 'bb': [0, 0, 0, 16, 16, 16]}
            if kind in ('fence', 'wall', 'pane', 'other') and not re.search(r'bamboo|shelf', nm): b['solid'] = 1
            if nm.endswith('shelf') or nm == 'brewing_stand': b['solid'] = 1
            reg['blocks'].append(b); added.append(nm)
    return added
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); ad = add(reg)
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, len(ad), 'added; total', len(reg['blocks']))
