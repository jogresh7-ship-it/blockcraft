"""Blocks still drawn as a flat cross that are really models in vanilla (bars, chains, ...): give them their real model / multipart."""
import json, sys, re
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems, bbox, pick
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; done = []
    for b in reg['blocks']:
        n = b['n']
        if b['s'] != 'cross' or b.get('mm') or b.get('mp'): continue
        bs = MD.load(MD.M + 'blockstates/' + n + '.json')
        if not bs: continue
        if 'multipart' in bs:
            parts = []
            for p in bs['multipart']:
                ap = p['apply']; ap = ap[0] if isinstance(ap, list) else ap; els = elems(ap['model'], T)
                if els is None: parts = None; break
                parts.append({'w': p.get('when'), 'm': els, 'rx': ap.get('x', 0), 'ry': ap.get('y', 0)})
            if not parts: continue
            b.update({'s': 'box', 'vanilla': 1, 'mp': parts, 'mpk': 'pane' if re.search('bars$|pane$', n) else 'other', 'bb': [0, 0, 0, 16, 16, 16], 'solid': 1}); done.append(n); continue
        v = pick(bs['variants']); m = v['model'].replace('minecraft:', '')
        mdl = MD.load(MD.M + 'models/' + m.replace('block/', 'block/') + '.json') or {}
        if mdl.get('parent', '').endswith(('cross', 'tinted_cross', 'flower_pot_cross')): continue
        els = elems(v['model'], T)
        if not els: continue
        b.update({'s': 'box', 'vanilla': 1, 'mm': els, 'mr': [v.get('x', 0), v.get('y', 0)], 'bb': bbox(els)})
        if re.search('chain$', n): b['axisRot'] = 1
        done.append(n)
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, len(done), done)
