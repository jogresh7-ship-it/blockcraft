"""Copy extra mob textures into gui/ (stored at 2x their logical Java size, like the existing mob textures)."""
import os
from PIL import Image
MOBS = {'chicken': ['chicken/chicken_temperate.png', 'chicken.png'], 'villager': ['villager/villager.png'], 'iron_golem': ['iron_golem/iron_golem.png'],
  'snow_golem': ['snow_golem/snow_golem.png', 'snow_golem.png'], 'blaze': ['blaze/blaze.png', 'blaze.png'], 'squid': ['squid/squid.png'], 'glow_squid': ['squid/glow_squid.png'],
  'witch': ['witch/witch.png', 'witch.png'], 'zombie_villager': ['zombie_villager/zombie_villager.png', 'zombie/zombie_villager.png'], 'pillager': ['illager/pillager.png'],
  'vindicator': ['illager/vindicator.png'], 'evoker': ['illager/evoker.png'], 'vex': ['illager/vex.png'], 'horse': ['horse/horse_brown.png', 'horse/horse_white.png'], 'donkey': ['horse/donkey.png'],
  'mule': ['horse/mule.png'], 'skeleton_horse': ['horse/horse_skeleton.png'], 'zombie_horse': ['horse/horse_zombie.png'], 'polar_bear': ['bear/polarbear.png'],
  'hoglin': ['hoglin/hoglin.png'], 'zoglin': ['hoglin/zoglin.png'], 'silverfish': ['silverfish/silverfish.png', 'silverfish.png'], 'endermite': ['endermite/endermite.png', 'endermite.png'],
  'wandering_trader': ['wandering_trader/wandering_trader.png', 'wandering_trader.png']}
TPL = '/root/tpl/assets/minecraft/textures/entity/'
for R, src in [('/home/claude/blockcraft/', '/root/f64/assets/minecraft/textures/entity/'), ('/home/claude/bbsite/', '/root/bbm/assets/minecraft/textures/entity/')]:
    done = []
    for k, cands in MOBS.items():
        p = next((src + c for c in cands if os.path.exists(src + c)), None) or next((TPL + c for c in cands if os.path.exists(TPL + c)), None)
        if not p: continue
        lg = next((Image.open(TPL + c).size for c in cands if os.path.exists(TPL + c)), None) or Image.open(p).size
        Image.open(p).convert('RGBA').resize((lg[0] * 2, lg[1] * 2), Image.NEAREST).save(R + 'gui/mob_' + k + '.png'); done.append((k, lg))
    print(R, done)
