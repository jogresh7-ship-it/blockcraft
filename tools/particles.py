"""Pack the vanilla particle sprites into one atlas (16 per row, 16x16 cells) + a name -> [index, frames] map."""
import os, re, json
from PIL import Image
P = '/root/tpl/assets/minecraft/textures/particle/'
groups = {}
for f in sorted(os.listdir(P)):
    if not f.endswith('.png'): continue
    m = re.match(r'(.+?)_(\d+)\.png$', f); base, n = (m.group(1), int(m.group(2))) if m else (f[:-4], 0)
    if base.startswith('sga_') or base in ('vibration',): continue
    groups.setdefault(base, []).append((n, f))
cells, MAP = [], {}
for base, fr in groups.items():
    fr.sort(); MAP[base] = [len(cells), len(fr)]
    for _, f in fr: cells.append(f)
W = 16; rows = (len(cells) + W - 1) // W; at = Image.new('RGBA', (W * 16, rows * 16))
for i, f in enumerate(cells):
    im = Image.open(P + f).convert('RGBA')
    if im.height > im.width: im = im.crop((0, 0, im.width, im.width))
    at.paste(im.resize((16, 16), Image.NEAREST), ((i % W) * 16, (i // W) * 16))
for R in ['/home/claude/blockcraft/', '/home/claude/bbsite/']: at.save(R + 'gui/particles.png')
js = 'window.PTEX=' + json.dumps({'cols': W, 'rows': rows, 'map': MAP}, separators=(',', ':')) + ';'
for R in ['/home/claude/blockcraft/', '/home/claude/bbsite/', '/home/claude/repo/']: open(R + 'js/ptex.js', 'w').write(js)
print(len(cells), rows, list(MAP)[:20])
