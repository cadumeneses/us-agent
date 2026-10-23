"""Build editable SVG figures from repository evidence using the standard library.

Run from the repository root. Render the companion HTML with a browser to PDF
for LaTeX integration. No recommendation outputs or screenshots are synthesized.
"""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'figures'
BLUE, TEAL, PURPLE, AMBER, INK = '#2457B2', '#087E8B', '#7040A0', '#A65312', '#172A43'

def text(x, y, content, size=22, color=INK, weight='normal', anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(content)}</text>'

def box(x, y, w, h, stroke, fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'

def arrow(path, color=INK, dashed=False):
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="2.4" marker-end="url(#arrow)"' + (' stroke-dasharray="6 4"' if dashed else '') + '/>'

def save(name, w, h, mm, title, parts):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{mm}mm" height="{h*mm/w:.3f}mm" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title">
<title id="title">{escape(title)}</title>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" fill="{INK}"/></marker></defs>
<rect width="{w}" height="{h}" fill="white"/>
<g font-family="Arial, Helvetica, sans-serif">{''.join(parts)}</g></svg>'''
    (OUT / f'{name}.svg').write_text(svg, encoding='utf-8')
    (OUT / f'{name}.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>{escape(title)}</title><style>@page{{size:{mm}mm {h*mm/w:.3f}mm;margin:0}}html,body{{margin:0;padding:0;background:white}}svg{{display:block}}</style>{svg}</html>', encoding='utf-8')

p = [text(15, 29, 'FROM PROJECT CONTEXT TO REUSABLE ENGINEERING KNOWLEDGE', 25, weight='bold')]
p += [box(350, 52, 955, 57, TEAL, '#EDF8F7'), text(372, 88, 'Configure and publish: definitions, taxonomies, reference data and test catalogs', 22, TEAL, 'bold')]
p += [box(15, 130, 290, 194, BLUE, '#EFF4FC'), text(34, 164, '1  PREPARE', 24, BLUE, 'bold'),
      text(34, 202, 'Project profile'), text(34, 234, 'Stories and tasks'),
      text(34, 272, 'Classify / review stories', 21), text(34, 304, 'when the workflow needs it', 21)]
p += [box(330, 130, 590, 194, TEAL, '#FFFFFF')]
for x, name, detail, color, fill in [(350, 'NFRs', 'Story + profile', BLUE, '#EFF4FC'), (540, 'Test cases', 'Story + catalog', PURPLE, '#F5F0FA'), (730, 'Project risks', 'Profile only', AMBER, '#FFF6EC')]:
    p += [box(x, 142, 170, 170, color, fill), text(x+85, 181, name, 23, color, 'bold', 'middle'), text(x+85, 225, detail, 21, anchor='middle'), text(x+85, 270, 'Retrieve artifacts', 20, anchor='middle')]
p += [arrow('M305,226 H327'), arrow('M625,109 V127'),
      text(625, 350, '2  CHOOSE ONE: distinct inputs and method policies', 21, TEAL, anchor='middle')]
p += [box(940, 130, 365, 194, TEAL, '#EDF8F7'), text(960, 164, '3  INSPECT AND REUSE', 24, TEAL, 'bold'),
      text(960, 202, 'Read recommended artifacts'), text(960, 234, 'Inspect source cases'),
      text(960, 272, 'Compare feature contributions', 21), text(960, 304, 'Replay and export a run', 21), arrow('M920,226 H937')]
p += [box(15, 365, 1290, 44, PURPLE, '#F5F0FA'), text(660, 394, 'Human decisions stay visible: accept / reject and adapt NFRs or tests while preserving their originals', 22, PURPLE, anchor='middle')]
save('recommender-workflow', 1320, 425, 178, 'End-to-end tool workflow with three alternative recommender configurations', p)

report = json.loads((ROOT/'docs/evidencias/integrated-demonstration-v1/report.json').read_text(encoding='utf-8'))['content']
feature = report['configuredFeature']
assert feature['sameDefinitionAndDataset']
p = [text(320, 30, 'ONE CONFIGURED FEATURE, TWO RESULTS', 24, weight='bold', anchor='middle'),
     text(320, 66, 'Same version-2 definition, dataset and other inputs', 21, anchor='middle')]
for x, condition, color, fill in zip([12, 332], feature['conditions'], [BLUE, TEAL], ['#EFF4FC', '#EDF8F7']):
    neighbor = condition['neighbors'][0]
    p += [box(x, 92, 296, 180, color, fill), text(x+148, 128, condition['value'], 25, color, 'bold', 'middle'),
          text(x+148, 171, neighbor['recordId'], 24, weight='bold', anchor='middle'),
          text(x+148, 214, f"Similarity: {neighbor['similarity']:.1%}", 23, anchor='middle'),
          text(x+148, 248, f"Distance: {neighbor['distance']:g}", 22, anchor='middle')]
p += [text(320, 304, 'Synthetic example; similarity is not risk probability.', 21, anchor='middle')]
save('configured-feature', 640, 325, 86, 'Preserved synthetic comparison: team distribution changes the selected reference project', p)
print('Generated two SVG figures and their print HTML; configured-feature values come from report.json.')
