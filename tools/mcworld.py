"""Read a Java Edition world (Anvil .mca, 1.18+ sections with block palettes) into a dict of non-air blocks."""
import struct, zlib, os, sys, json, gzip
def nbt(b, i=0):
    def rd(t, i):
        if t == 1: return struct.unpack_from('>b', b, i)[0], i + 1
        if t == 2: return struct.unpack_from('>h', b, i)[0], i + 2
        if t == 3: return struct.unpack_from('>i', b, i)[0], i + 4
        if t == 4: return struct.unpack_from('>q', b, i)[0], i + 8
        if t == 5: return struct.unpack_from('>f', b, i)[0], i + 4
        if t == 6: return struct.unpack_from('>d', b, i)[0], i + 8
        if t == 7: n = struct.unpack_from('>i', b, i)[0]; return b[i + 4:i + 4 + n], i + 4 + n
        if t == 8: n = struct.unpack_from('>H', b, i)[0]; return b[i + 2:i + 2 + n].decode('utf8', 'replace'), i + 2 + n
        if t == 9:
            et = b[i]; n = struct.unpack_from('>i', b, i + 1)[0]; i += 5; out = []
            for _ in range(n): v, i = rd(et, i); out.append(v)
            return out, i
        if t == 10:
            d = {}
            while True:
                tt = b[i]; i += 1
                if tt == 0: return d, i
                n = struct.unpack_from('>H', b, i)[0]; k = b[i + 2:i + 2 + n].decode('utf8', 'replace'); i += 2 + n
                d[k], i = rd(tt, i)
        if t == 11: n = struct.unpack_from('>i', b, i)[0]; return list(struct.unpack_from('>%di' % n, b, i + 4)), i + 4 + 4 * n
        if t == 12: n = struct.unpack_from('>i', b, i)[0]; return list(struct.unpack_from('>%dq' % n, b, i + 4)), i + 4 + 8 * n
        raise ValueError(t)
    t = b[i]; n = struct.unpack_from('>H', b, i + 1)[0]; return rd(t, i + 3 + n)[0]
def chunks(path):
    d = open(path, 'rb').read()
    for k in range(1024):
        off = struct.unpack_from('>I', d, k * 4)[0]; sec, cnt = off >> 8, off & 255
        if not sec: continue
        ln, comp = struct.unpack_from('>IB', d, sec * 4096); raw = d[sec * 4096 + 5:sec * 4096 + 4 + ln]
        yield nbt(zlib.decompress(raw) if comp == 2 else gzip.decompress(raw))
def blocks(world):
    out = {}
    for f in os.listdir(world + '/region'):
        if not f.endswith('.mca'): continue
        for c in chunks(world + '/region/' + f):
            cx, cz = c.get('xPos'), c.get('zPos')
            for s in c.get('sections', []):
                bs = s.get('block_states'); 
                if not bs: continue
                pal = bs['palette']; data = bs.get('data'); sy = s['Y']
                if len(pal) == 1:
                    if pal[0]['Name'] == 'minecraft:air': continue
                    idxs = [0] * 4096
                else:
                    bits = max(4, (len(pal) - 1).bit_length()); per = 64 // bits; mask = (1 << bits) - 1; idxs = []
                    for L in data:
                        L &= (1 << 64) - 1
                        for j in range(per):
                            if len(idxs) < 4096: idxs.append((L >> (j * bits)) & mask)
                for n, p in enumerate(idxs):
                    e = pal[p]; nm = e['Name'][10:]
                    if nm in ('air', 'cave_air', 'void_air'): continue
                    x = cx * 16 + (n & 15); z = cz * 16 + ((n >> 4) & 15); y = sy * 16 + (n >> 8)
                    out[(x, y, z)] = (nm, e.get('Properties', {}))
    return out
if __name__ == '__main__':
    b = blocks(sys.argv[1]); import collections
    xs = [k[0] for k in b]; ys = [k[1] for k in b]; zs = [k[2] for k in b]
    print(len(b), min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
    print(collections.Counter(v[0] for v in b.values()).most_common(40))
