"""Collect animated block textures (vertical frame strips + .mcmeta) into anim.png and REG.anim."""
import json, os, sys
from PIL import Image
for R, src, res in [('/home/claude/blockcraft/', '/root/f64/assets/minecraft/textures/block/', Image.LANCZOS), ('/home/claude/bbsite/', '/root/bbm/assets/minecraft/textures/block/', Image.NEAREST)]:
    reg = json.load(open(R + 'registry.json')); T = reg['tiles']; rows = []
    for n, t in sorted(T.items(), key=lambda kv: kv[1]):
        if n.startswith(('water_', 'lava_')): continue
        p = src + n + '.png'
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGBA'); w = im.width
        if im.height <= w or im.height % w: continue
        meta = {}
        if os.path.exists(p + '.mcmeta'):
            try: meta = json.load(open(p + '.mcmeta')).get('animation', {})
            except Exception: pass
        nf = im.height // w
        frames = [im.crop((0, i * w, w, (i + 1) * w)).resize((32, 32), res) for i in range(nf)]
        order = [f if isinstance(f, int) else f['index'] for f in meta.get('frames', [])] or list(range(nf))
        e = {'t': t, 'row': len(rows), 'n': nf, 'ft': meta.get('frametime', 1)}
        if meta.get('frames'): e['o'] = order
        if meta.get('interpolate'): e['i'] = 1
        rows.append((e, frames))
    W = 32 * max(len(f) for _, f in rows); sheet = Image.new('RGBA', (W, 32 * len(rows)))
    for e, frames in rows:
        for i, f in enumerate(frames): sheet.paste(f, (i * 32, e['row'] * 32))
    sheet.save(R + 'anim.png', optimize=True); reg['anim'] = [e for e, _ in rows]
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, len(rows), 'animated', sheet.size, os.path.getsize(R + 'anim.png') // 1024, 'KB')
