import json,struct,sys
import numpy as np
from PIL import Image
def load(n):
    g=json.load(open(n+'/scene.gltf')); B=open(n+'/scene.bin','rb').read()
    def acc(i):
        a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]; o=bv.get('byteOffset',0)+a.get('byteOffset',0)
        nc={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]; dt={5126:'f4',5123:'u2',5125:'u4'}[a['componentType']]
        st=bv.get('byteStride',0)
        arr=np.frombuffer(B,dtype=dt,count=a['count']*nc if not st else None,offset=o) if not st else None
        if st: arr=np.array([np.frombuffer(B,dtype=dt,count=nc,offset=o+k*st) for k in range(a['count'])])
        return arr.reshape(-1,nc) if nc>1 else arr
    # world matrices
    import numpy.linalg as L
    mats={}
    def walk(i,M):
        nd=g['nodes'][i]; m=np.array(nd['matrix']).reshape(4,4).T if 'matrix' in nd else np.eye(4); M2=M@m
        if 'mesh' in nd: mats[nd['mesh']]=M2
        for c in nd.get('children',[]): walk(c,M2)
    for r in g['scenes'][0]['nodes']: walk(r,np.eye(4))
    out=[]
    for mi,mesh in enumerate(g['meshes']):
        for p in mesh['primitives']:
            P=acc(p['attributes']['POSITION']); UV=acc(p['attributes']['TEXCOORD_0']); I=acc(p['indices'])
            M=mats[mi]; P=(np.c_[P,np.ones(len(P))]@M.T)[:,:3]
            out.append((P,UV,I))
    return g,out
if __name__=='__main__':
    n=sys.argv[1]; g,o=load(n)
    for P,UV,I in o:
        print(len(P),len(I), 'idx first',I[:36].tolist())
        print(Image.open(n+'/textures/'+g['images'][0]['uri'].split('/')[-1]).size)
        for k in range(0,len(P),24):
            p=P[k:k+24]; print(k//24, np.round(p.min(0),2).tolist(), np.round(p.max(0)-p.min(0),2).tolist())
