import numpy as np, json, sys, math
sys.path.insert(0,'.'); from rd import load
def parts(name, spec, ground):
    g,o=load(name); P=o[0][0]; out=[]
    for i,(size,uv,extra) in spec.items():
        p=P[i*24:(i+1)*24]; c=(p.min(0)+p.max(0))/2
        pos=[round(float(-c[0]),3)+0.0, round(float(c[1]+ground),3), round(float(-c[2]),3)+0.0]
        # local axes: unique corners, edges from corner 0
        U=np.unique(np.round(p,3),axis=0); a=U[0]; d=[(np.linalg.norm(b-a),b-a) for b in U[1:]]; d.sort(key=lambda t:t[0])
        edges=d
        w,h,dd=size; rot=0
        cand=[e for L,e in edges if abs(L-h)<.2 and abs(e[0])<1e-2]
        if cand:
            v=max(cand,key=lambda e:abs(e[1])); v=v*np.sign(v[1]) if abs(v[1])>1e-3 else v
            vy,vz=v[1],-v[2]  # to ours
            rot=round(float(math.atan2(vz,vy)),4)
            if abs(rot)<0.01: rot=0
        part=dict(box=size,uv=uv,pos=pos); 
        if rot: part['rot']=[rot,0,0]
        part.update(extra); out.append(part)
    return out
def js(ps):
    s=json.dumps(ps); return s.replace('"','').replace('pivot','pivot')
HD=lambda pv:{'head':1,'pivot':pv}
horse={0:([10,10,22],[0,32],{}),1:([4,12,7],[0,35],{}),2:([6,5,7],[0,13],{}),3:([2,3,1],[19,16],{}),4:([2,3,1],[19,16],{}),5:([2,16,2],[56,36],{}),6:([4,5,5],[0,25],{}),
 7:([4,11,4],[48,21],{'leg':1}),8:([4,11,4],[48,21],{'leg':0}),9:([4,11,4],[48,21],{'leg':0}),10:([4,11,4],[48,21],{'leg':1}),11:([3,14,4],[42,36],{})}
vil={0:([8,10,8],[0,0],{}),1:([8,18,6],[0,38],{'inf':.5}),2:([4,8,4],[44,22],{}),3:([8,4,4],[40,38],{}),4:([4,8,4],[44,22],{}),5:([4,12,4],[0,22],{'leg':0}),6:([4,12,4],[0,22],{'leg':1}),7:([8,12,6],[16,20],{}),8:([2,4,2],[24,0],{})}
wit=dict(vil); wit.update({9:([10,2,10],[0,64],{}),10:([7,4,7],[0,76],{}),11:([4,4,4],[0,87],{}),12:([1,2,1],[0,95],{'inf':.25}),13:([1,1,1],[0,0],{'inf':-.25})})
res={'horse':parts('horse',horse,16.86),'villager':parts('villager',vil,29),'witch':parts('witch',wit,29)}
json.dump(res,open('parts.json','w'))
for k,v in res.items(): print(k); [print(' ',p) for p in v]
