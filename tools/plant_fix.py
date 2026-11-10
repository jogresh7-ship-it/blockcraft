"""Plants that are not a plain cross in vanilla (sunflower head, pink petals, pitcher...) get their real model; double plant tops use half=upper."""
import json, sys, re
sys.path.insert(0, '/root/build'); import models as MD
from more_blocks import elems, bbox
def props(k): return dict(p.split('=') for p in k.split(',') if '=' in p)
for R in sys.argv[1:]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; changed = []
    for b in reg['blocks']:
        n = b['n']
        if b.get('mm') or not (b['s'] in ('cross', 'flat') or b.get('plant')): continue
        if not re.search(r'flower|sunflower|lilac|peony|rose|petals|wildflowers|leaf_litter|bush|berry|wheat|carrots|potatoes|beetroots|pitcher|torchflower|eyeblossom|azalea|dripleaf|spore|wart|seagrass|cactus_flower|fern|grass', n): continue
        base = n[:-4] if n.endswith('_top') and b.get('top') else n
        bs = MD.load(MD.M + 'blockstates/' + base + '.json')
        if not bs or 'variants' not in bs: continue
        vs = bs['variants']; want = 'upper' if base != n else 'lower'
        k = next((k for k in vs if props(k).get('half', want) == want and props(k).get('age', '0') in ('0', '3', '4', '7') and props(k).get('flower_amount', '4') == '4' and props(k).get('facing', 'north') == 'north'), None)
        if k is None: continue
        v = vs[k]; v = v[0] if isinstance(v, list) else v
        els = elems(v['model'], T)
        if not els: continue
        tset = {f[0] for e in els for f in e['faces'].values()}
        simple = len(els) == 2 and all(e.get('r') for e in els) and tset <= set(b['t'])
        if simple: continue
        b['mm'] = els; b['s'] = 'box'; b['mr'] = [v.get('x', 0), v.get('y', 0)]; b['vanilla'] = 1; b.pop('bx', None)
        b['bb'] = bbox(els) if b['s'] != 'box' else bbox(els); b['plant'] = 1
        b['t'] = [next(iter(tset))] * 4 if not (set(b['t']) & tset) else b['t']
        changed.append(n)
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, len(changed), changed)
