"""Bedrock entity geometry (.geo.json from Mojang's bedrock-samples) -> Blockcraft MOBDEF parts.
Bedrock model space == ours (x right, y up from the feet, -z forward, 1/16 block units).
Each cube is baked to its world-space centre + rotation matrix (p.rq), with animation tags taken from bone names."""
import json, math, sys, os
G = '/root/bs/bedrock-samples-main/resource_pack/models/entity/'

def mat_mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def T(x, y, z): return [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]]
def RX(a): c, s = math.cos(a), math.sin(a); return [[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]]
def RY(a): c, s = math.cos(a), math.sin(a); return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]
def RZ(a): c, s = math.cos(a), math.sin(a); return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
I4 = T(0, 0, 0)
def rot(r):  # bedrock euler (deg) -> our frame: Rz(-z) Ry(y) Rx(-x)
    d = math.pi / 180
    return mat_mul(mat_mul(RZ(-r[2] * d), RY(r[1] * d)), RX(-r[0] * d))
def about(p, r): return mat_mul(mat_mul(T(*p), rot(r)), T(-p[0], -p[1], -p[2]))
def app(m, v): return [sum(m[i][k] * (v[k] if k < 3 else 1) for k in range(4)) for i in range(3)]

def load(name, ident=None):
    d = json.load(open(G + name + '.geo.json'))
    if 'minecraft:geometry' in d:
        gs = d['minecraft:geometry']; g = next((x for x in gs if not ident or x['description']['identifier'] == ident), gs[0])
        tw, th = g['description'].get('texture_width', 64), g['description'].get('texture_height', 64)
    else:
        k = ident or next(k for k in d if k.startswith('geometry')); g = d[k]; tw, th = g.get('texturewidth', 64), g.get('textureheight', 64)
    return g['bones'], tw, th

def convert(name, ident=None, tags=None, skip=(), crot=None, brot=None):
    bones, tw, th = load(name, ident); B = {b['name']: b for b in bones}; W = {}
    def world(n):
        if n in W: return W[n]
        b = B[n]; m = I4
        if b.get('parent') in B: m = world(b['parent'])
        r = (brot or {}).get(b['name']) or b.get('rotation')
        if r and any(r): m = mat_mul(m, about(b.get('pivot', [0, 0, 0]), r))
        W[n] = m; return m
    def chain(n):
        out = []
        while n in B: out.append(n); n = B[n].get('parent')
        return out
    parts = []
    for b in bones:
        if b['name'] in skip or b.get('neverRender') or any(s in skip for s in chain(b['name'])): continue
        m0 = world(b['name'])
        for c in b.get('cubes', []):
            if isinstance(c.get('uv'), dict): continue
            o, s = c['origin'], c['size']; m = m0
            if b.get('bind_pose_rotation') and any(b['bind_pose_rotation']): m = mat_mul(m, about(b.get('pivot', [0, 0, 0]), b['bind_pose_rotation']))  # bind pose turns only this bone's own cubes
            if crot and b['name'] in crot: m = mat_mul(m, about(b.get('pivot', [0, 0, 0]), crot[b['name']]))
            if c.get('rotation') and any(c['rotation']): m = mat_mul(m, about(c.get('pivot', [o[0] + s[0] / 2, o[1] + s[1] / 2, o[2] + s[2] / 2]), c['rotation']))
            ctr = app(m, [o[0] + s[0] / 2, o[1] + s[1] / 2, o[2] + s[2] / 2])
            p = {'box': s, 'uv': c.get('uv', [0, 0]), 'pos': [round(v, 4) for v in ctr]}
            R = [[m[i][j] for j in range(3)] for i in range(3)]
            if any(abs(R[i][j] - (1 if i == j else 0)) > 1e-6 for i in range(3) for j in range(3)):
                p['rq'] = [round(R[0][0], 5), round(R[1][0], 5), round(R[2][0], 5), round(R[0][1], 5), round(R[1][1], 5), round(R[2][1], 5), round(R[0][2], 5), round(R[1][2], 5), round(R[2][2], 5)]
            if c.get('inflate'): p['inf'] = c['inflate']
            if c.get('mirror', b.get('mirror')): p['mir'] = 1
            # animation tags from the bone chain
            ch = chain(b['name']); low = [x.lower() for x in ch]
            def piv(n): return [round(v, 4) for v in app(world(B[n].get('parent')) if B[n].get('parent') in B else I4, B[n].get('pivot', [0, 0, 0]))]
            tg = (tags or {})
            hit = next((x for x in ch if x in tg), None)
            if hit:
                for k, v in tg[hit].items(): p[k] = v
                p['pivot'] = piv(hit)
            elif any(x == 'head' or x.startswith('head') for x in low):
                hn = next(x for x in ch if x.lower() == 'head' or x.lower().startswith('head')); p['head'] = 1; p['pivot'] = piv(hn)
            else:
                for x in ch:
                    lx = x.lower()
                    if 'leg' in lx and 'wing' not in lx:
                        import re
                        num = re.findall(r'\d', lx); left = 'left' in lx or lx.endswith('1') or lx.endswith('3')
                        front = 'front' in lx or (num and int(num[-1]) >= 2)
                        p['leg'] = (1 if left else 0) ^ (1 if front else 0); p['pivot'] = piv(x); break
                    if 'arm' in lx: p['arm'] = 1 if ('left' in lx) else 0; p['pivot'] = piv(x); break
                    if 'wing' in lx: p['flap'] = -1 if ('left' in lx or lx.endswith('1')) else 1; p['pivot'] = piv(x); break
                    if 'tail' in lx: p['wag'] = 1; p['pivot'] = piv(x); break
                    if 'fin' in lx: p['wag'] = 1; p['pivot'] = piv(x); break
            parts.append(p)
    return parts, tw, th

if __name__ == '__main__':
    ps, tw, th = convert(sys.argv[1]); print(tw, th, len(ps)); print(json.dumps(ps)[:2000])
