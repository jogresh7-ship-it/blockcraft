import json,struct,math,sys
D=sys.argv[1];g=json.load(open(D+'/scene.gltf'));bin_=open(D+'/scene.bin','rb').read()
def acc(i):
  a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];off=bv.get('byteOffset',0)+a.get('byteOffset',0)
  n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];st=bv.get('byteStride',4*n)
  return [struct.unpack_from('<%df'%n,bin_,off+k*st) for k in range(a['count'])]
def slerp(q0,q1,t):
  d=sum(a*b for a,b in zip(q0,q1))
  if d<0:q1=[-x for x in q1];d=-d
  if d>.9995: r=[a+(b-a)*t for a,b in zip(q0,q1)]
  else:
    th=math.acos(d);s=math.sin(th);r=[(math.sin((1-t)*th)*a+math.sin(t*th)*b)/s for a,b in zip(q0,q1)]
  n=math.sqrt(sum(x*x for x in r));return [x/n for x in r]
def sample(ts,vs,t,rot):
  if t<=ts[0]:return list(vs[0])
  if t>=ts[-1]:return list(vs[-1])
  for i in range(len(ts)-1):
    if ts[i]<=t<=ts[i+1]:
      k=(t-ts[i])/(ts[i+1]-ts[i]) if ts[i+1]>ts[i] else 0
      return slerp(vs[i],vs[i+1],k) if rot else [a+(b-a)*k for a,b in zip(vs[i],vs[i+1])]
def euler(q): # R = Ry(b) Rz(c) Rx(a)
  x,y,z,w=q
  R=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
  c=math.asin(max(-1,min(1,R[1][0])));a=math.atan2(-R[1][2],R[1][1]);b=math.atan2(-R[2][0],R[0][0]);return [round(a,4),round(b,4),round(c,4)]
NM={'Head_2':'head','Body_5':'body','RightArm_8':'rarm','LeftArm_11':'larm','RightLeg_14':'rleg','LeftLeg_17':'lleg'}
out={}
for a in g['animations']:
  ch={};T=0
  for c in a['channels']:
    s=a['samplers'][c['sampler']];ts=[x[0] for x in acc(s['input'])];vs=acc(s['output']);nd=g['nodes'][c['target']['node']]
    T=max(T,ts[-1]);ch[(NM[nd['name']],c['target']['path'])]=(ts,vs,nd.get('translation',[0,0,0]))
  N=32;fr={}
  for (part,path),(ts,vs,rest) in ch.items():
    seq=[]
    for i in range(N):
      v=sample(ts,vs,T*i/N,path=='rotation')
      seq.append(euler(v) if path=='rotation' else [round((v[j]-rest[j])*16,3) for j in range(3)])
    fr.setdefault(part,{})['r' if path=='rotation' else 't']=seq
  out['walk' if 'walk' in a['name'] else 'idle']={'dur':T,'f':fr}
print('window.PANIM='+json.dumps(out,separators=(',',':'))+';')
