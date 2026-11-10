"""The biome-tint variant tiles were written over the atlas rows that held the block-entity textures (chests, heads, pot,
conduit), so chests showed grass. This re-packs those entity textures into fresh rows below everything and repoints the models."""
import json, os, sys
from PIL import Image
TPL = '/root/tpl/assets/minecraft/textures/entity/'
def layout(imgs, cols, rows0, TS):
    x = 0; y = rows0; bandh = 0; place = {}
    for k, (im, lg) in sorted(imgs.items(), key=lambda kv: -kv[1][0].height):
        tw, th = im.width // TS, im.height // TS
        if x + tw > cols: x = 0; y += bandh; bandh = 0
        place[k] = (x, y); x += tw; bandh = max(bandh, th)
    return place, y + bandh
def run(R, esrc, old_rows0=33):
    reg = json.load(open(R + 'registry.json')); cols = reg['cols']
    A = Image.open(R + 'blocks.png').convert('RGBA'); TS = A.width // cols
    want = {}
    for k in ['normal', 'trapped', 'ender', 'copper', 'copper_exposed', 'copper_weathered', 'copper_oxidized']: want['chest_' + k] = 'chest/' + k + '.png'
    want['pot_base'] = 'decorated_pot/decorated_pot_base.png'; want['pot_side'] = 'decorated_pot/decorated_pot_side.png'; want['conduit'] = 'conduit/base.png'
    want['pot_base'] = 'decorated_pot/decorated_pot_base.png'; want['pot_side'] = 'decorated_pot/decorated_pot_side.png'; want['conduit'] = 'conduit/base.png'
    imgs = {}
    for k, p in want.items():
        src = next((d + p for d in (esrc, TPL) if os.path.exists(d + p)), None)
        if not src: continue
        logical = Image.open(TPL + p).size if os.path.exists(TPL + p) else Image.open(src).size
        imgs[k] = (Image.open(src).convert('RGBA').resize((logical[0] * TS // 16, logical[1] * TS // 16), Image.NEAREST), logical)
    oldp, _ = layout(imgs, cols, old_rows0, TS)
    old = {y * cols + x: k for k, (x, y) in oldp.items()}
    assert old.get(1320) == 'chest_normal', old
    used = max(max(reg['tiles'].values()) // cols + 1, reg['rows'])
    newp, rows = layout(imgs, cols, used, TS)
    new = {k: y * cols + x for k, (x, y) in newp.items()}
    NA = Image.new('RGBA', (A.width, rows * TS)); NA.paste(A, (0, 0))
    for k, (x, y) in newp.items(): NA.paste(imgs[k][0], (x * TS, y * TS))
    NA.save(R + 'blocks.png', optimize=True); reg['rows'] = rows
    n = 0
    def fix(els):
        nonlocal n
        for e in els or []:
            for f in e.get('faces', {}).values():
                if f[0] in old: f[0] = new[old[f[0]]]; n += 1
    for b in reg['blocks']:
        if not b or not b.get('entity'): continue
        for key in ('mm', 'mmo', 'mmh', 'mmx', 'mmi', 'mmu'): fix(b.get(key))
        b['t'] = [new[old[t]] if t in old else t for t in b['t']]
    reg['entityTiles'] = new
    json.dump(reg, open(R + 'registry.json', 'w'), separators=(',', ':'))
    open(R + 'js/registry.js', 'w').write('window.REGISTRY=' + json.dumps(reg, separators=(',', ':')) + ';')
    print(R, 'rows', rows, 'faces fixed', n)
run('/home/claude/blockcraft/', '/root/f64/assets/minecraft/textures/entity/')
run('/home/claude/bbsite/', '/root/bbm/assets/minecraft/textures/entity/')
