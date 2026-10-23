param([switch]$Serve,[string]$Action='snapshot',[string]$Text,[int]$X,[int]$Y)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class VidsNative {
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint f);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);
}
'@
[VidsNative]::SetProcessDPIAware() | Out-Null
$folder=Join-Path (Get-Location) 'tmp\vids-edit'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$serial=0
function Get-VidsWindow {
 foreach($process in (Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0})) {
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
  $tabs=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::TabItem)))
  foreach($tab in $tabs){if($tab.Current.Name -like '*US-AGENT*Google Vids*') {
    $script:vidsHandle=$process.MainWindowHandle
    if([VidsNative]::IsIconic($process.MainWindowHandle)){[VidsNative]::ShowWindow($process.MainWindowHandle,9) | Out-Null;Start-Sleep -Milliseconds 350}
    [VidsNative]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
    $shell=New-Object -ComObject WScript.Shell
    $null=$shell.AppActivate($process.Id)
    $pattern=$null
    if($tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select()}
    Start-Sleep -Milliseconds 350
    return $root
  }}
 }
 throw 'The US-Agent Google Vids tab was not found in Chrome.'
}
function Run-Action($command) {
 $root=Get-VidsWindow
 if($command.action -in @('keys','paste','click') -and [VidsNative]::GetForegroundWindow() -ne $script:vidsHandle){throw 'Chrome is not in foreground; no input was sent.'}
 switch($command.action){
  'inspect' {
   $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
   $result=@(foreach($node in $nodes){$n=$node.Current.Name;if($n -and $node.Current.ControlType -ne [System.Windows.Automation.ControlType]::TabItem){$r=$node.Current.BoundingRectangle;if(-not [double]::IsInfinity($r.X) -and -not [double]::IsInfinity($r.Y)){[pscustomobject]@{name=$n;type=$node.Current.ControlType.ProgrammaticName;x=[int]$r.X;y=[int]$r.Y;width=[int]$r.Width;height=[int]$r.Height}}}})
   $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $folder 'controls.json') -Encoding UTF8
   if($command.text){$result | Where-Object {$_.name -match $command.text} | ConvertTo-Json -Depth 4 -Compress}else{'Controls saved: tmp/vids-edit/controls.json'}
  }
  'invoke' {
   $condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,[string]$command.text)
   $element=$root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
   if(-not $element){throw ('Control not found: '+$command.text)}
   $pattern=$null
   if($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke()}
   elseif($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pattern)){$pattern.Select()}
   elseif($element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern,[ref]$pattern)){$pattern.Expand()}
   elseif($element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern,[ref]$pattern)){$pattern.DoDefaultAction()}
   else{throw 'The control has no supported invocation pattern.'}
   Start-Sleep -Milliseconds 300;'Invoked.'
  }
  'keys' {[System.Windows.Forms.SendKeys]::SendWait([string]$command.text);Start-Sleep -Milliseconds 300;'Keys sent.'}
  'paste' {Set-Clipboard -Value ([string]$command.text);[System.Windows.Forms.SendKeys]::SendWait('^v');Start-Sleep -Milliseconds 250;'Text pasted.'}
  'click' {
   $r=$root.Current.BoundingRectangle
   if($command.x -lt $r.X -or $command.x -ge $r.Right -or $command.y -lt $r.Y -or $command.y -ge $r.Bottom){throw 'Click is outside the Vids browser window.'}
   [VidsNative]::SetCursorPos([int]$command.x,[int]$command.y) | Out-Null
   [VidsNative]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[VidsNative]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
   Start-Sleep -Milliseconds 300;'Clicked.'
  }
  'snapshot' {
   $r=$root.Current.BoundingRectangle
   $bitmap=New-Object System.Drawing.Bitmap ([int]$r.Width),([int]$r.Height)
   $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
   $dc=$graphics.GetHdc()
   $rendered=[VidsNative]::PrintWindow([IntPtr]$root.Current.NativeWindowHandle,$dc,2)
   $graphics.ReleaseHdc($dc)
   if(-not $rendered){throw 'Window capture failed.'}
   $script:serial++
   $path=Join-Path $folder ('vids-'+$script:serial+'.png')
   $bitmap.Save($path);$graphics.Dispose();$bitmap.Dispose();$path
  }
  default {throw 'Unsupported action.'}
 }
}
if($Serve){
 $queue=Join-Path $folder 'commands.jsonl'
 [System.IO.File]::WriteAllText($queue,'')
 $processed=0
 'Vids UI ready. Watching tmp/vids-edit/commands.jsonl.'
 while($true){
  $lines=@([System.IO.File]::ReadAllLines($queue))
  while($processed -lt $lines.Length){
   $line=$lines[$processed];$processed++
   if($line){try{Run-Action ($line | ConvertFrom-Json)}catch{Write-Output ('ERROR: '+$_.Exception.Message)}}
  }
  Start-Sleep -Milliseconds 150
 }
}else{Run-Action @{action=$Action;text=$Text;x=$X;y=$Y}}
