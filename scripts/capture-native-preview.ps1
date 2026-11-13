param([Parameter(Mandatory=$true)][int]$PreviewId,[string]$OutFile='output/playwright/fusion-native.png',[string]$WindowTitle='')
$ErrorActionPreference='Stop'
$previewProcess=Get-Process -Id $PreviewId
if ($previewProcess.ProcessName -notlike '*fusion*') {
    $projectRoot=Split-Path -Parent $PSScriptRoot
    $fixtureFile=Join-Path $projectRoot 'output/updater-installed-test.json'
    if($previewProcess.ProcessName -ne 'jarvis-desktop' -or -not(Test-Path -LiteralPath $fixtureFile)){throw 'Only an isolated Jarvis preview or installer fixture may be captured.'}
    $fixture=Get-Content -LiteralPath $fixtureFile -Raw -Encoding UTF8|ConvertFrom-Json
    $allowedRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot 'output'))+[IO.Path]::DirectorySeparatorChar
    if($fixture.pid -ne $PreviewId -or $fixture.exe -ne $previewProcess.Path -or -not([IO.Path]::GetFullPath($fixture.exe).StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase))){throw 'Installed capture target is not the isolated fixture.'}
    $pointer=Get-Content -LiteralPath (Join-Path $env:APPDATA 'org.jarvis.butler.desktop/profile.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($pointer.testOwner -ne 'jarvis-updater-e2e-20261113' -or $pointer.dataDir -ne $fixture.root){throw 'Installed screenshot profile is not isolated.'}
}
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FusionCapture {
 public delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb,IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public static IntPtr Largest(uint pid,string title){IntPtr best=IntPtr.Zero;long area=0;EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);Rect r;var text=new StringBuilder(256);GetWindowText(h,text,256);if(owner==pid&&(title.Length==0||text.ToString()==title)&&IsWindowVisible(h)&&GetWindowRect(h,out r)){long a=(long)(r.Right-r.Left)*(r.Bottom-r.Top);if(a>area){area=a;best=h;}}return true;},IntPtr.Zero);return best;}
}
'@
[FusionCapture]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
$window=[FusionCapture]::Largest($PreviewId,$WindowTitle)
if($window -eq [IntPtr]::Zero){throw 'The preview has no visible main window.'}
$rect=New-Object FusionCapture+Rect
if(-not [FusionCapture]::GetWindowRect($window,[ref]$rect)){throw 'Cannot read preview window size.'}
$bitmap=New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$dc=$graphics.GetHdc()
try {if(-not [FusionCapture]::PrintWindow($window,$dc,2)){throw 'Cannot capture preview window.'}} finally {$graphics.ReleaseHdc($dc)}
try {$bitmap.Save([System.IO.Path]::GetFullPath($OutFile),[System.Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
Write-Output 'Captured isolated native preview only.'
