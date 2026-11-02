"""Compare unmodified captures; reject different dimensions/DPR instead of resizing."""
import json, sys
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageChops
folder = Path(sys.argv[1])
a = Image.open(folder/'prototype.png').convert('RGB')
b = Image.open(folder/'production.png').convert('RGB')
ma=json.loads((folder/'prototype.json').read_text()); mb=json.loads((folder/'production.json').read_text())
if ma['viewport']!=mb['viewport'] or a.size!=b.size:
 raise SystemExit('Non-comparable captures: viewport, DPR, or raster dimensions differ')
if ('scroll' in ma or 'scroll' in mb) and ma.get('scroll') != mb.get('scroll'):
 raise SystemExit('Non-comparable captures: recorded scroll positions differ')
viewport = ma['viewport']
css_size = (round(viewport['width']), round(viewport['height']))
physical_size = tuple(round(value * viewport['dpr']) for value in css_size)
if a.size not in (css_size, physical_size):
 raise SystemExit('Non-comparable captures: raster does not cover the recorded viewport')
Image.blend(a,b,0.5).save(folder/'overlay.png')
ImageChops.difference(a,b).save(folder/'diff.png')
side=Image.new('RGB',(a.width*2,a.height),'white');side.paste(a,(0,0));side.paste(b,(a.width,0));side.save(folder/'side-by-side.png')
rows=[]
production_by_component=defaultdict(list)
def component_key(element):
 return (element.get('scope','page'), element['selector'].strip().split()[0])
for element in mb['elements']:
 production_by_component[component_key(element)].append(element)
occurrences=defaultdict(int)
unmatched_prototype=[]
for left in ma['elements']:
 scope,component=component_key(left)
 key=(scope,component)
 index=occurrences[key]
 occurrences[key]+=1
 candidates=production_by_component[key]
 if index >= len(candidates):
  unmatched_prototype.append({'scope':scope,'component':component,'occurrence':index+1,'element':left})
  continue
 right=candidates[index]
 styles=['padding','gap','font','color','backgroundColor','border','borderRadius','boxShadow','textAlign']
 rows.append({'selector':left['selector'],'scope':scope,'occurrence':index+1,'prototype':left,'production':right,'delta':{k:right[k]-left[k] for k in ['x','y','width','height']},'styleDifferences':{key:{'prototype':left[key],'production':right[key]} for key in styles if key in left and key in right and left[key]!=right[key]}})
unmatched_production=[{'scope':scope,'component':component,'occurrence':index+1,'element':element} for (scope,component), elements in production_by_component.items() for index,element in enumerate(elements) if index>=occurrences[(scope,component)]]
(folder/'comparison.json').write_text(json.dumps({'viewport':viewport,'rasterSize':a.size,'pairing':'card scope when recorded, component class and DOM occurrence; requires equal content order','status':'measurement-only-not-accepted','geometry':rows,'unmatchedPrototype':unmatched_prototype,'unmatchedProduction':unmatched_production},ensure_ascii=False,indent=2)+'\n')
print(folder)
