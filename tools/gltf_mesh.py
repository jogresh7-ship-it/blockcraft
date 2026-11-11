"""Turn a Sketchfab Minecraft-mob glTF into Blockcraft mob parts made of textured triangles (p.tris), one part per bone/node,
scaled to the mob's height and centred on its feet. Usage: gltf_mesh.py <dir> <key> <height_blocks> <yaw_deg>"""
import json, struct, math, sys, os
from PIL import Image
TY = {5126: ('f', 4), 5123: ('H', 2), 5121: ('B', 1), 5125: ('I', 4)}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def mm(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def trs(n):
    if 'matrix' in n: m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[i][0] * s[0], R[i][1] * s[1], R[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]
def convert(D, key, H, yaw, outdir):
    g = json.load(open(D + '/scene.gltf')); B = open(D + '/' + g['buffers'][0]['uri'], 'rb').read()
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; t, s = TY[a['componentType']]; n = NC[a['type']]
        st = bv.get('byteStride', s * n); off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from('<' + t * n, B, off + k * st) for k in range(a['count'])]
    par = {}
    for i, n in enumerate(g['nodes']):
        for c in n.get('children', []): par[c] = i
    def W(i):
        m = trs(g['nodes'][i])
        while i in par: i = par[i]; m = mm(trs(g['nodes'][i]), m)
        return m
    skin = g.get('skins', [{}])[0] if g.get('skins') else {}; jn = [g['nodes'][j].get('name', '') for j in skin.get('joints', [])]
    texkeys = {}
    for mi, mat in enumerate(g.get('materials', [])):
        t = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture') or mat.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {}).get('diffuseTexture')
        if t is None: continue
        img = g['images'][g['textures'][t['index']]['source']]['uri']; k = '%s_%d' % (key, mi)
        im = Image.open(D + '/' + img).convert('RGBA')
        if im.width > 256: im = im.resize((256, round(256 * im.height / im.width)), Image.NEAREST)
        for o in outdir: im.save(o + k + '.png')
        texkeys[mi] = k
    groups = {}; ys = []; ally = []
    for ni, n in enumerate(g['nodes']):
        if 'mesh' not in n: continue
        M = W(ni)
        nm, q = n.get('name', ''), ni
        while (not nm or nm.startswith('Object_') or len(nm) > 30 or '-' in nm) and q in par: q = par[q]; nm = g['nodes'][q].get('name', '')
        for pr in g['meshes'][n['mesh']]['primitives']:
            if pr.get('mode', 4) != 4 or pr.get('material') not in texkeys: continue
            P = acc(pr['attributes']['POSITION']); U = acc(pr['attributes']['TEXCOORD_0']); J = acc(pr['attributes']['JOINTS_0']) if 'JOINTS_0' in pr['attributes'] and jn else None
            I = [x[0] for x in acc(pr['indices'])] if 'indices' in pr else list(range(len(P)))
            if J and False:  # skinned (Sketchfab exports already hold the bind pose in mesh space): put each vertex where its main bone holds it (joint world matrix x inverse bind matrix)
                IB = acc(skin['inverseBindMatrices']) if 'inverseBindMatrices' in skin else None
                JM = {}
                def jm(j):
                    if j not in JM:
                        Wj = W(skin['joints'][j]); ib = IB[j] if IB else None
                        JM[j] = mm(Wj, [[ib[c * 4 + r] for c in range(4)] for r in range(4)]) if ib else Wj
                    return JM[j]
                P = [[sum(jm(J[k][0])[r][c] * (p[c] if c < 3 else 1) for c in range(4)) for r in range(3)] for k, p in enumerate(P)]
            elif J: P = [[q[0], q[2], -q[1]] for q in ([sum(M[r][c] * (p[c] if c < 3 else 1) for c in range(4)) for r in range(3)] for p in P)]  # skinned Sketchfab exports lie on their back (z up): stand them up
            else: P = [[sum(M[r][c] * (p[c] if c < 3 else 1) for c in range(4)) for r in range(3)] for p in P]
            for t in range(0, len(I) - 2, 3):
                a, b, c = I[t], I[t + 1], I[t + 2]
                bone = jn[J[a][0]] if J else nm
                gk = (bone, texkeys[pr['material']])
                groups.setdefault(gk, []).extend([P[a] + list(U[a]), P[b] + list(U[b]), P[c] + list(U[c])])
    pts = [v for tri in groups.values() for v in tri]
    mn = [min(v[i] for v in pts) for i in range(3)]; mx = [max(v[i] for v in pts) for i in range(3)]
    s = H * 16 / (mx[1] - mn[1]) if H > 0 else -H * 16 / max(mx[i] - mn[i] for i in range(3)); cx, cz = (mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2; ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    def X(v): x, y, z = (v[0] - cx) * s, (v[1] - mn[1]) * s, (v[2] - cz) * s; return [x * ca + z * sa, y, -x * sa + z * ca]
    parts = []
    for (bone, tk), vs in groups.items():
        Q = [X(v) + [v[3], v[4]] for v in vs]
        bmn = [min(q[i] for q in Q) for i in range(3)]; bmx = [max(q[i] for q in Q) for i in range(3)]
        lb = bone.lower(); p = {'tex': tk}
        ctr = [(bmn[0] + bmx[0]) / 2, (bmn[1] + bmx[1]) / 2, (bmn[2] + bmx[2]) / 2]
        if 'leg' in lb or 'arm' in lb: piv = [ctr[0], bmx[1], ctr[2]]; front = ctr[2] < 0; left = ctr[0] > 0 or 'left' in lb or lb.endswith('l'); p['leg'] = (1 if left else 0) ^ (1 if front else 0)
        elif 'head' in lb or 'nose' in lb or 'ear' in lb or 'horn' in lb: piv = [ctr[0], bmn[1], bmx[2]]; p['head'] = 1
        elif 'wing' in lb: piv = [0 if 'tip' not in lb else ctr[0], ctr[1], ctr[2]]; p['flap'] = -1 if ('left' in lb or lb.endswith('l')) else 1
        elif 'tail' in lb: piv = [ctr[0], ctr[1], bmn[2]]; p['wag'] = 1
        else: piv = ctr
        p['pos'] = [round(v, 3) for v in piv]
        if 'leg' in p or 'head' in p or 'wag' in p: p['pivot'] = p['pos']
        p['bn'] = bone; p['bp'] = p['pos']
        p['tris'] = [round(q[i] - piv[i], 3) if i < 3 else round(q[i], 5) for q in Q for i in range(5)]
        p['box'] = [1, 1, 1]; p['uv'] = [0, 0]
        parts.append(p)
    return parts, sorted(set(texkeys.values()))
if __name__ == '__main__':
    ps, tx = convert(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), ['/tmp/'])
    print(tx, len(ps), [(p.get('leg'), p.get('head'), len(p['tris']) // 15) for p in ps])
