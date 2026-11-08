"""Store full Minecraft block models (elements, per-face uv + rotation) as `mm` for blocks rendered with block rotation (pistons)."""
import json, sys
sys.path.insert(0, '/root/build'); import models as MD
def default_uv(d, f, t):
    if d in ('up', 'down'): return [f[0], f[2], t[0], t[2]]
    if d in ('north', 'south'): return [f[0], 16 - t[1], t[0], 16 - f[1]]
    return [f[2], 16 - t[1], t[2], 16 - f[1]]
def mm(name, tiles):
    tex, el = MD.model('block/' + name); out = []
    for e in el:
        faces = {}
        for d, fc in e.get('faces', {}).items():
            tn = MD.resolve(tex, fc.get('texture'))
            if tn not in tiles: raise KeyError(tn)
            faces[d] = [tiles[tn]] + list(fc.get('uv') or default_uv(d, e['from'], e['to'])) + [fc.get('rotation', 0)]
        out.append({'f': e['from'], 't': e['to'], 'faces': faces})
    return out
SPEC = {'piston': ('piston', 'piston_base'), 'sticky_piston': ('sticky_piston', 'piston_base'), 'piston_head': ('piston_head', None), 'sticky_piston_head': ('piston_head_sticky', None)}
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']
    for b in reg['blocks']:
        if b['n'] in SPEC:
            a, x = SPEC[b['n']]; b['mm'] = mm(a, T)
            if x: b['mmx'] = mm(x, T)
            b['s'] = 'box'; b['a'] = 1; b['solid'] = 1; b['bb'] = [0, 0, 0, 16, 16, 16]; b.pop('bx', None)
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, [ (b['n'], len(b['mm'])) for b in reg['blocks'] if 'mm' in b])
