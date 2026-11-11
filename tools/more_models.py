import json,sys,os
sys.path.insert(0,'/root/build'); sys.argv=[sys.argv[0]]
import mcmodels as MC
WANT={'heavy_core':'heavy_core','composter':'composter','chorus_plant':'chorus_plant','honey_block':'honey_block','slime_block':'slime_block','cactus':'cactus','dried_kelp_block':'dried_kelp_block'}
for root in ['/home/claude/bbsite','/home/claude/blockcraft','/home/claude/repo']:
  for fn in ['registry.json','js/registry.js']:
    p=root+'/'+fn;s=open(p).read();isjs=fn.endswith('.js');pre='window.REGISTRY='
    r=json.loads(s[len(pre):].rstrip().rstrip(';')) if isjs else json.loads(s);T=r['tiles'];done=[]
    for b in r['blocks']:
      if not b or b['n'] not in WANT or b.get('mm'):continue
      try: m=MC.mm(WANT[b['n']],T)
      except Exception as e: print('skip',b['n'],e);continue
      if not m:continue
      lo=[min(e['f'][i] for e in m) for i in range(3)];hi=[max(e['t'][i] for e in m) for i in range(3)]
      b['mm']=m;b['s']='box';b['a']=1;b['bb']=lo+hi;b['solid']=1;b['model']=1;b['vanilla']=1;b.pop('bx',None);done.append(b['n'])
    open(p,'w').write(pre+json.dumps(r,separators=(',',':'))+';' if isjs else json.dumps(r))
  print(root,done)
