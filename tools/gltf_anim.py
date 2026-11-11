"""Sample a glTF skeletal animation as world-space rotation deltas per bone (scene frame), as euler for R = Ry Rz Rx."""
import json,struct,math,sys
def load(D):
  g=json.load(open(D+'/scene.gltf'));bin_=open(D+'/'+g['buffers'][0]['uri'],'rb').read()
  def acc(i):
    a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];st=bv.get('byteStride',4*n)
    return [struct.unpack_from('<%df'%n,bin_,off+k*st) for k in range(a['count'])]
  return g,acc
def qmul(a,b):
  ax,ay,az,aw=a;bx,by,bz,bw=b
  return [aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz]
def qinv(q): return [-q[0],-q[1],-q[2],q[3]]
def slerp(q0,q1,t):
  d=sum(a*b for a,b in zip(q0,q1))
  if d<0:q1=[-x for x in q1];d=-d
  if d>.9995: r=[a+(b-a)*t for a,b in zip(q0,q1)]
  else: th=math.acos(d);s=math.sin(th);r=[(math.sin((1-t)*th)*a+math.sin(t*th)*b)/s for a,b in zip(q0,q1)]
  n=math.sqrt(sum(x*x for x in r));return [x/n for x in r]
def euler(q):
  x,y,z,w=q
  R=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
  return [round(math.atan2(-R[1][2],R[1][1]),4),round(math.atan2(-R[2][0],R[0][0]),4),round(math.asin(max(-1,min(1,R[1][0]))),4)]
def sample(D,names,N=32,ai=0):
  g,acc=load(D);a=g['animations'][ai];par={}
  for i,n in enumerate(g['nodes']):
    for c in n.get('children',[]):par[c]=i
  rest={i:list(n.get('rotation',[0,0,0,1])) for i,n in enumerate(g['nodes'])};ch={};T=0
  for c in a['channels']:
    if c['target']['path']!='rotation':continue
    s=a['samplers'][c['sampler']];ts=[x[0] for x in acc(s['input'])];vs=acc(s['output']);ch[c['target']['node']]=(ts,vs);T=max(T,ts[-1])
  def at(i,t):
    if i not in ch:return rest[i]
    ts,vs=ch[i]
    if t<=ts[0]:return list(vs[0])
    for k in range(len(ts)-1):
      if ts[k]<=t<=ts[k+1]:return slerp(vs[k],vs[k+1],(t-ts[k])/((ts[k+1]-ts[k]) or 1))
    return list(vs[-1])
  def world(i,t):
    q=at(i,t) if t is not None else rest[i]
    while i in par: i=par[i];q=qmul(at(i,t) if t is not None else rest[i],q)
    return q
  idx={n.get('name'):i for i,n in enumerate(g['nodes'])};out={}
  for our,nm in names.items():
    i=idx[nm];W0=world(i,None);seq=[]
    for k in range(N): seq.append(euler(qmul(world(i,T*k/N),qinv(W0))))
    out[our]=seq
  return T,out
if __name__=='__main__':
  T,o=sample(sys.argv[1],json.loads(sys.argv[2]))
  print(T);[print(k,[max(abs(f[j]) for f in v) for j in range(3)]) for k,v in o.items()]
