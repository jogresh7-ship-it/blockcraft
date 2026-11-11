import json,os
from PIL import Image
TP='/root/tpl/assets/minecraft/textures/entity/end_portal/end_portal.png'
FP='/root/f64/assets/minecraft/textures/entity/end_portal/end_portal.png'
for root in ['/home/claude/bbsite','/home/claude/blockcraft','/home/claude/repo']:
  for fn in ['registry.json','js/registry.js']:
    p=root+'/'+fn
    if not os.path.exists(p):continue
    s=open(p).read();isjs=fn.endswith('.js');pre='window.REGISTRY='
    r=json.loads(s[len(pre):].rstrip().rstrip(';')) if isjs else json.loads(s)
    T=r['tiles'];T['end_portal']=1676;T['end_gateway']=1676
    r.setdefault('entityTiles',{})['end_portal']=[1676,'entity/end_portal/end_portal.png',16,16]
    names={b['n'] for b in r['blocks'] if b}
    if 'end_portal' not in names: r['blocks'].append({'n':'end_portal','t':[1676]*4,'s':'box','a':1,'e':1,'vanilla':1,'bb':[0,0,0,16,12,16],'bx':[[[0,0,0,16,12,16],1676,[[1676],None,None,None,None,None]]],'hide':1})
    if 'end_gateway' not in names: r['blocks'].append({'n':'end_gateway','t':[1676]*4,'s':'cube','a':2,'e':1,'vanilla':1,'hide':1})
    open(p,'w').write(pre+json.dumps(r,separators=(',',':'))+';' if isjs else json.dumps(r))
  img=Image.open(root+'/blocks.png').convert('RGBA');TS=img.width//r['cols']
  import random
  if root.endswith('repo'):
    random.seed(3);src=Image.new('RGBA',(64,64),(10,14,24,255));q=src.load()
    for i in range(90):q[random.randrange(64),random.randrange(64)]=random.choice([(90,200,190,255),(160,220,255,255),(60,120,110,255)])
  else: src=Image.open(TP).convert('RGBA')
  # the star field: a dark teal tile from the portal texture
  t=src.resize((TS,TS),Image.BOX);px=t.load()
  for y in range(TS):
    for x in range(TS):
      R,G,B,A=px[x,y];px[x,y]=(int(R*.35+4),int(G*.45+8),int(B*.6+18),255)
  img.paste(t,((1676%r['cols'])*TS,(1676//r['cols'])*TS));img.save(root+'/blocks.png')
  print(root,TS)
