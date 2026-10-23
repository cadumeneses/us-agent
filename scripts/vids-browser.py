"""Thin Chrome DevTools CLI helper. Uses fresh visible accessibility snapshots."""
import json, re, subprocess, sys, time
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/'tmp/chrome-tools/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools.js'
PAGE='3'
def call(*args):
    p=subprocess.run(['node',str(CLI),*map(str,args)],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=75)
    if p.returncode or re.search(r'^Error:',p.stdout,re.M): raise RuntimeError(p.stdout+p.stderr)
    return p.stdout
def snap():
    text=call('take_snapshot',PAGE)
    (ROOT/'tmp/vids-edit/current.txt').write_text(text,encoding='utf-8')
    return text
def uid(label,role=None):
    text=snap()
    candidates=[line for line in text.splitlines() if f'"{label}"' in line and (not role or f' {role} ' in line)]
    if len(candidates)!=1: raise RuntimeError(f'Expected one target {label}, found {candidates}\n{text[-12000:]}')
    return re.search(r'uid=(\S+)',candidates[0])[1]
def click(label,role=None): return call('click',PAGE,uid(label,role))
def press(key): return call('press_key',PAGE,key)
def main():
    global PAGE
    arg=sys.argv[1:]
    if arg and arg[0]=='--page': PAGE=arg[1];arg=arg[2:]
    action=arg.pop(0)
    if action=='snapshot': print(snap())
    elif action=='click': print(click(*arg));print(snap())
    elif action=='fill': print(call('fill',PAGE,uid(arg[0]),arg[1]));print(snap())
    elif action=='menu':
        print(click(arg.pop(0),'menuitem'))
        for key in arg: print(press(key))
        print(snap())
    elif action=='keys':
        for key in arg: print(press(key))
        print(snap())
    elif action=='raw': print(call(*arg))
    elif action=='script':
        print(call('type_text',PAGE,(ROOT/arg[0]).read_text(encoding='utf-8'))); print(snap())
    elif action=='replace-scene':
        number=int(arg[0]); scene=json.loads((ROOT/'artifacts/demo-video-edit/edit-plan.json').read_text(encoding='utf-8'))[number-1]
        press('Escape');press('Control+Alt+Shift+t');press('Home')
        for _ in range(number-1): press('ArrowRight')
        selected=snap()
        if not re.search(r'"Cena '+str(number)+r' de 8, dura',selected): raise RuntimeError('Could not verify selected scene')
        for key in ['Control+Alt+Shift+c','Control+a','Backspace']: press(key)
        state=snap()
        if 'Este cenário não tem objetos.' not in state: raise RuntimeError('Scene did not become empty')
        click('Inserir','menuitem')
        upload=uid('Fazer upload u','menuitem')
        print(call('upload_file',PAGE,upload,ROOT/'artifacts/demo-video-edit'/f'{scene["id"]}.mp4'))
        state=snap()
        print('\n'.join(line for line in state.splitlines() if 'timer ' in line or 'mp4' in line or 'inserido' in line))
    elif action=='narrate':
        number=int(arg[0]); scene=json.loads((ROOT/'artifacts/demo-video-edit/edit-plan.json').read_text(encoding='utf-8'))[number-1]
        state=snap()
        if f'"Cena {number} / 8"' not in state: raise RuntimeError('Narration panel is on wrong scene')
        if '"Knox"' not in state: raise RuntimeError('Knox voice not selected')
        call('click_at',PAGE,1650,290)
        press('Control+a')
        call('type_text',PAGE,scene['script'])
        state=snap()
        if 'button "Inserir narração" disableable disabled' in state: raise RuntimeError('Script not ready')
        print(f'Scene {number}: English script entered with Knox',flush=True)
        call('click_at',PAGE,1672,822)
        deadline=time.monotonic()+50
        while time.monotonic()<deadline:
            time.sleep(2); state=snap()
            if 'button "Atualizar narração"' in state:
                print('\n'.join(line for line in state.splitlines() if 'generic "' in line and 'Knox' in line or 'timer ' in line),flush=True)
                (ROOT/f'artifacts/demo-video-edit/voice-scene-{number}.txt').write_text(state,encoding='utf-8')
                break
        else: raise RuntimeError('Voice generation has not finished')
        if number<8: call('click_at',PAGE,1782,230)
    else: raise ValueError(action)
if __name__=='__main__': main()
