import json, zipfile, io, base64, os
from PIL import Image
os.chdir('/root/tpl')
meta = json.load(open('pack.mcmeta')); ov = [e['directory'] for e in meta.get('overlays', {}).get('entries', [])]
reg = json.load(open('/home/claude/blockcraft/registry.json')); T = 'assets/minecraft/textures/'
want = set()
for n in reg['tiles']: want.add(T + 'block/' + n.replace('_red', '').replace('redstone_line0', 'redstone_dust_line0').replace('redstone_line1', 'redstone_dust_line1').replace('grass_block_side_tinted', 'grass_block_side') + '.png')
want |= {T + 'block/grass_block_side_overlay.png', T + 'block/water_still.png', T + 'block/lava_still.png', T + 'gui/title/minecraft.png', T + 'gui/title/edition.png'}
for v in reg.get('entityTiles', {}).values(): want.add(T + v[1])
for n in reg['items']: want.add(T + 'item/' + n + '.png')
for k, v in reg['guimap'].items(): want.add(T + v)
for v in ['zombie/husk', 'zombie/drowned', 'skeleton/stray', 'skeleton/wither_skeleton', 'skeleton/bogged', 'spider/cave_spider', 'cow/mooshroom_red', 'piglin/piglin', 'piglin/piglin_brute'] + ['player/wide/' + s for s in ['steve', 'alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri']]: want.add(T + 'entity/' + v + '.png')
want.discard(T + 'font/ascii.png')
def resolve(p):
    if os.path.exists('/root/vm/' + p) and ('/entity/' not in p or '/entity/chest/normal' in p): return '/root/vm/' + p  # Vanilla Mending fixes win
    for d in reversed(ov):
        if os.path.exists(d + '/' + p): return d + '/' + p
    return p if os.path.exists(p) else None
buf = io.BytesIO(); n = 0
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(want):
        if 'title/background/panorama' in p: continue
        r = resolve(p)
        if r:
            z.write(r, p); n += 1
            if os.path.exists(r + '.mcmeta'): z.write(r + '.mcmeta', p + '.mcmeta')
    z.write('pack.png', 'pack.png')
data = buf.getvalue(); print(n, 'files', round(len(data) / 1e6, 1), 'MB')
O = '/home/claude/vanillapack/'
for f in os.listdir(O):
    if f.startswith('vanilla_') and f.endswith('.js'): os.remove(O + f)
b = base64.b64encode(data).decode(); CH = 11_000_000
for i in range(0, len(b), CH): open(O + 'vanilla_%d.js' % (i // CH), 'w').write("(window.EMBED_PACKS=window.EMBED_PACKS||{});(EMBED_PACKS.vanilla=EMBED_PACKS.vanilla||[])[%d]='%s';" % (i // CH, b[i:i + CH]))
pass  # icon/preview made separately
