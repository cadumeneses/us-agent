"""Probe the exported edit and generate a visual review sheet."""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/demo-video-edit'
BIN=ROOT/'tmp/video-tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin'
video=Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'US-Agent-visual-edit-04m30.mp4'
probe=json.loads(subprocess.check_output([str(BIN/'ffprobe.exe'),'-v','error','-show_format','-show_streams','-of','json',str(video)]))
simple={'file':str(video),'duration':float(probe['format']['duration']),'bytes':int(probe['format']['size']),'streams':[{k:s.get(k) for k in ['codec_type','codec_name','width','height','r_frame_rate','sample_rate','channels','duration']} for s in probe['streams']]}
(OUT/'export-probe.json').write_text(json.dumps(simple,indent=2),encoding='utf-8')
print(json.dumps(simple,indent=2),flush=True)
times=[3,36,78,107,143,176,207,236,253,268]
sheet=Image.new('RGB',(1280,5*390),'#101b32');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
for i,t in enumerate(times):
    frame=OUT/f'review-{t:03}.jpg'
    subprocess.run([str(BIN/'ffmpeg.exe'),'-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1','-vf','scale=640:-1',str(frame)],check=True)
    im=Image.open(frame);x=(i%2)*640;y=(i//2)*390
    sheet.paste(im,(x,y+28));d.text((x+12,y+2),f'{t//60:02}:{t%60:02}',font=font,fill='white')
sheet.save(OUT/'visual-review.jpg',quality=92)
print('Visual review: artifacts/demo-video-edit/visual-review.jpg',flush=True)
