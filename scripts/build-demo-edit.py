"""Build reviewable, silent demo chapters from original recordings and production captures."""
import json, subprocess, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/demo-video-edit'
TMP = OUT / 'parts'
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(exist_ok=True)
FF = ROOT / 'tmp/video-tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe'
INV = json.loads((ROOT / 'tmp/vids-edit/footage/inventory.json').read_text())
FONT = 'C:/Windows/Fonts/segoeui.ttf'
BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
NAVY = '#101b32'

SCENES = [
 dict(id='01-overview', title='US-Agent | From recommendations to traceable reuse', duration=30,
      footer='Choose a recommender  •  Inspect evidence  •  Review and adapt',
      clips=[(1,1,17,1)],
      script='Software teams often need to reuse knowledge from previous projects, but a suggestion is useful only when its origin and reasoning can be inspected. US Agent brings recommendation, evidence, and human review into one workspace. The entry page offers three recommender options. This demonstration follows project risk configuration and non-functional requirement reuse, then checks whether the recorded recommendation can be replayed and exported.'),
 dict(id='02-definition', title='01 | Inspect the published recommender definition', duration=40,
      footer='Project Risk Recommender  •  Versioned definition and dataset',
      clips=[(2,12,18,1),(2,30,12,1),(2,55,10,1)],
      script='We begin with the published Project Risk Recommender. Its definition records a stable identifier, an explicit version, and the input and output attributes. Platforms, application domains, and languages form the project profile. Risks are the output. The calculation records the distance method, feature weights, and number of neighbors. A dataset is imported and published against a compatible definition. We are inspecting the prepared configuration here. Versioned definitions and datasets make the inputs to each recommendation explicit.'),
 dict(id='03-team-feature', title='02 | Extend the profile with team distribution', duration=30,
      footer='team_distribution  •  categorical  •  weight 5  •  k = 1',
      clips=[(3,0,6,1),(3,22,14,1),(2,68,6,1)],
      script='Version two adds team distribution as a categorical feature, with colocated and distributed values. Its weight is five; the other features keep weight one. We use a single nearest neighbor. The extension is visible in the configuration and has an explicit weight in the calculation. Next, we hold the definition and dataset versions fixed and change only the target team distribution.'),
 dict(id='04-distributed', title='03 | Preserved run: distributed team → P09', duration=35,
      footer='Production evidence capture  •  Synthetic risk associations for demonstration',
      image='distributed-production.png',
      script='These preserved production results show the controlled comparison. For a distributed team, the selected neighbor is P zero nine, with ninety-three point seven five percent similarity. The suggested risk concerns communication failures and delayed integrations. The explanation separates each feature contribution: team distribution matches, while languages contribute to the distance. These risk associations are synthetic and have not been empirically validated. Similarity measures the profile match, not the probability of a risk.'),
 dict(id='05-colocated', title='04 | Same definition and dataset: colocated team → P01', duration=35,
      footer='Only team_distribution changes  •  P09: 93.75% → P01: 100%',
      image='colocated-production.png',
      script='Now compare the preserved run for a colocated team. Definition version two, dataset version two, and the other target characteristics remain fixed. The selected neighbor changes to P zero one, with one hundred percent profile similarity and zero distance. Its suggested risk concerns interface rework when information visualizations change. Changing one target feature has changed both the nearest project and the recommendation. The feature contributions let the reviewer inspect why that happened.'),
 dict(id='06-source', title='05 | Inspect the source and confirm the destination', duration=30,
      footer='Non-functional Requirement Recommender  •  Source P02  •  Human review',
      clips=[(4,1,12,1),(5,7,11,1),(4,37,7,1)],
      script='For artifact reuse, we move to the Non-functional Requirement Recommender. The result links the suggestions to source project P zero two and shows the matching characteristics. We inspect the source, then confirm Projeto Emanuel and its grade consolidation story as the destination. We choose the access-control requirement for review. Acceptance explicitly connects the recommendation to the artifact selected for reuse.'),
 dict(id='07-adaptation', title='06 | Adapt access control to the target story', duration=30,
      footer='Typing accelerated  •  Target-specific wording and adaptation rationale',
      clips=[(7,0,45,2.5),(7,45,10,2),(7,55,7,1)],
      script='We adapt the general access-control requirement to the coordinator role and the grade consolidation workflow. The new wording limits access to authorized students and classes. We also record a reason for the change, making the destination context explicit. Saving creates an adapted revision while preserving the original artifact. The source, the review decision, and the target-specific change remain traceable.'),
 dict(id='08-replay', title='07 | Verify replay, export evidence, and return to the workspace', duration=40,
      footer='Replay verification  •  JSON evidence  •  us-agent-api.vercel.app',
      clips=[(8,0,20,1),(8,42,7,1),(8,60,10,1),(8,78,3,1)],
      script='Finally, Verify replay checks the recorded recommendation using its preserved inputs and dependencies. The successful check confirms that the result and explanation can be reproduced for this run. Download JSON evidence exports the structured record for inspection outside the interface. We can check the recommendation separately from the adapted artifact and its review history. We return to the project workspace. US Agent connects configurable recommendations with inspectable evidence and explicit human decisions. The application is available at us-agent-api dot vercel dot app, with access controlled by workspace permissions.'),
]

def run(args):
    p = subprocess.run([str(FF), '-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr)

def overlay(scene, num):
    im = Image.new('RGBA',(1920,1080),(0,0,0,0)); d = ImageDraw.Draw(im)
    d.rectangle((0,0,1920,80), fill=NAVY); d.rectangle((0,1000,1920,1080), fill=NAVY)
    d.rectangle((0,77,1920,80), fill='#4ad5d0')
    d.text((36,17),scene['title'],font=ImageFont.truetype(BOLD,32),fill='white')
    d.text((36,1022),scene['footer'],font=ImageFont.truetype(FONT,25),fill='#d5e7fa')
    d.text((1815,1022),f'{num:02}/08',font=ImageFont.truetype(BOLD,24),fill='#4ad5d0')
    path=TMP/f'overlay-{num}.png'; im.save(path); return path

def main():
    (OUT/'edit-plan.json').write_text(json.dumps(SCENES,indent=2,ensure_ascii=False),encoding='utf-8')
    t=0; md=['# US-Agent narration — English, Knox\n','Target visual duration: 04:30. Original audio removed; narration generated in Google Vids.\n']
    for n,s in enumerate(SCENES,1):
        md += [f"\n## {n}. {s['id']} — {t//60:02}:{t%60:02} ({s['duration']} s)\n",s['script']+'\n']
        (OUT/f"{s['id']}.txt").write_text(s['script'],encoding='utf-8');t+=s['duration']
    (OUT/'NARRATION.md').write_text('\n'.join(md),encoding='utf-8')
    for n,s in enumerate(SCENES,1):
        final=OUT/(s['id']+'.mp4')
        if final.exists(): print('Existing', final.name,flush=True);continue
        pieces=[]
        for k,clip in enumerate(s.get('clips',[])):
            source,start,dur,speed=clip; part=TMP/f'{n}-{k}.mp4'
            run(['-ss',start,'-i',INV[source-1]['file'],'-t',dur,
                 '-vf',f'setpts=(PTS-STARTPTS)/{speed},scale=1920:920:force_original_aspect_ratio=decrease,pad=1920:920:(ow-iw)/2:(oh-ih)/2:color=0x101b32,setsar=1,fps=30',
                 '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',part])
            pieces.append(part)
        if s.get('image'):
            part=TMP/f'{n}-still.mp4'
            run(['-loop','1','-i',ROOT/'tmp/vids-edit'/s['image'],'-t',s['duration'],
                 '-vf','scale=1920:920:force_original_aspect_ratio=decrease,pad=1920:920:(ow-iw)/2:(oh-ih)/2:color=0x101b32,setsar=1,fps=30',
                 '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',part]);pieces=[part]
        listing=TMP/f'concat-{n}.txt'
        listing.write_text(''.join("file '"+str(p).replace('\\','/')+"'\n" for p in pieces),encoding='utf-8')
        run(['-f','concat','-safe','0','-i',listing,'-i',overlay(s,n),
             '-filter_complex',f'[0:v]tpad=stop_mode=clone:stop_duration=40,pad=1920:1080:0:80:color=0x101b32[base];[base][1:v]overlay=0:0,trim=duration={s["duration"]},setpts=PTS-STARTPTS[v]',
             '-map','[v]','-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',final])
        print('Rendered',final.name,flush=True)
    listing=OUT/'concat.txt';listing.write_text(''.join("file '"+s['id']+".mp4'\n" for s in SCENES),encoding='utf-8')
    run(['-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',OUT/'US-Agent-visual-edit-04m30.mp4'])
    print('Finished visual edit',flush=True)

if __name__=='__main__': main()
