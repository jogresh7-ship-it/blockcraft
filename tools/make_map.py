"""Convert a Java world (block dict from mcworld.py) into a Blockcraft map template: maps/<id>.js"""
import pickle, json, base64, struct, sys
src, mid, title, dy, H, spawn = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), json.loads(sys.argv[6])
b = pickle.load(open(src, 'rb'))
reg = json.load(open('/home/claude/blockcraft/registry.json')); B = {x['n']: x for x in reg['blocks'] if x}
pal = ['air']; pi = {'air': 0}; ch = {}; state = {}
for (x, y, z), (n, pr) in b.items():
    y += dy
    if y < 0 or y >= H: continue
    if n not in B: continue
    bd = B[n]
    if bd.get('slab') and pr.get('type') == 'double' and bd['slab'] in B: n = bd['slab']; bd = B[n]
    if n not in pi: pi[n] = len(pal); pal.append(n)
    cx, cz = x >> 4, z >> 4; a = ch.setdefault((cx, cz), {})
    a[(x & 15) + 16 * ((z & 15) + 16 * y)] = pi[n]
    f = pr.get('facing'); st = {}
    if f and bd.get('fy') and f in bd['fy']:
        st = {'fd': f, 'fr': bd['fy'][f]}
        if pr.get('half') == 'top' and bd.get('fyt') and f in bd['fyt']: st = {'fd': f, 'fr': bd['fyt'][f], 'top': 1}
    if pr.get('open') == 'true': st['open'] = 1
    if st: state['%d,%d,%d' % (x, y, z)] = st
out = {}
for (cx, cz), a in ch.items():
    arr = [0] * (16 * 16 * H)
    for i, v in a.items(): arr[i] = v
    rl = []; i = 0
    while i < len(arr):
        v = arr[i]; j = i
        while j < len(arr) and arr[j] == v and j - i < 65535: j += 1
        rl += [j - i, v]; i = j
    out['%d,%d' % (cx, cz)] = base64.b64encode(struct.pack('<%dH' % len(rl), *rl)).decode()
M = {'id': mid, 'name': title, 'h': H, 'spawn': spawn, 'palette': pal, 'chunks': out, 'state': state}
s = '(window.MAPS=window.MAPS||{})[%s]=%s;' % (json.dumps(mid), json.dumps(M, separators=(',', ':')))
open('/home/claude/blockcraft/maps/%s.js' % mid, 'w').write(s); print(len(out), 'chunks', len(pal), 'block types', len(state), 'states', round(len(s) / 1e6, 2), 'MB')
