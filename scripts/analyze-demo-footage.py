import json, math, pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont

source=pathlib.Path(r'C:\Users\Carlos Eduardo\Videos\demo')
output=pathlib.Path('tmp/vids-edit/footage');output.mkdir(parents=True,exist_ok=True)
binpath=pathlib.Path('tmp/video-tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin')
rows=[]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
for index,path in enumerate(sorted(source.glob('*.mp4')),1):
    probe=json.loads(subprocess.check_output([str(binpath/'ffprobe.exe'),'-v','error','-show_format','-show_streams','-of','json',str(path)]))
    duration=float(probe['format']['duration']);video=next(s for s in probe['streams'] if s['codec_type']=='video')
    row={'index':index,'file':str(path),'duration':duration,'width':video['width'],'height':video['height'],'audio':any(s['codec_type']=='audio' for s in probe['streams'])}
    framepath=output/str(index);framepath.mkdir(exist_ok=True)
    interval=max(5,math.ceil(duration/15))
    subprocess.run([str(binpath/'ffmpeg.exe'),'-hide_banner','-loglevel','error','-y','-i',str(path),'-vf',f'fps=1/{interval},scale=640:-2','-q:v','3',str(framepath/'%03d.jpg')],check=True)
    frames=sorted(framepath.glob('*.jpg'));thumb=Image.open(frames[0]);w,h=thumb.size
    sheet=Image.new('RGB',(w*3,(h+34)*math.ceil(len(frames)/3)),(18,25,38));draw=ImageDraw.Draw(sheet)
    for i,frame in enumerate(frames):
        x=(i%3)*w;y=(i//3)*(h+34);sheet.paste(Image.open(frame),(x,y));draw.text((x+8,y+h+4),f'{index} | {i*interval:03d}s | {path.stem[-6:]}',fill='white',font=font)
    sheet.save(output/f'contact-{index}.jpg',quality=92)
    row['sampleInterval']=interval;row['samples']=len(frames);rows.append(row)
    print(json.dumps(row),flush=True)
(output/'inventory.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
