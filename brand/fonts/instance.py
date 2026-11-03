import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
src, out, family, axes = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
loc = {k: float(v) for k, v in (a.split('=') for a in axes.split(','))}
f = instancer.instantiateVariableFont(TTFont(src), loc)
name = f['name']
for rec in list(name.names):
    if rec.nameID in (1, 4, 16, 21): rec.string = family
    elif rec.nameID in (2, 17, 22): rec.string = 'Regular'
    elif rec.nameID == 6: rec.string = family.replace(' ', '') + '-Regular'
name.names = [r for r in name.names if r.nameID not in (16, 17, 21, 22, 25)]
f['OS/2'].usWeightClass = 400; f['OS/2'].usWidthClass = 5
f['OS/2'].fsSelection = (f['OS/2'].fsSelection & ~0b1100001) | 0b1000000
f['head'].macStyle = 0
if 'STAT' in f: del f['STAT']
f.save(out)
