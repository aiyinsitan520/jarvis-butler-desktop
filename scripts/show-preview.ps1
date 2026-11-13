function Show-JarvisPreview {
    param([string[]]$Executables,[string]$DataDirectory)
    if (-not ('JarvisPreviewWindow' -as [type])) {
        Add-Type -TypeDefinition @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class JarvisPreviewWindow {
 public delegate bool Callback(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback cb,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]static extern bool ShowWindowAsync(IntPtr h,int mode);
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]static extern bool EnumChildWindows(IntPtr h,Callback cb,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]static extern bool GetClientRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]static extern bool ClientToScreen(IntPtr h,ref Point p);
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int X,Y;}
 [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int z,uint flags);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 public static IntPtr Find(uint pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid){var s=new StringBuilder(512);GetWindowText(h,s,512);if(s.ToString().Contains("\u5355\u9875\u672c\u5730\u7248")){found=h;return false;}}return true;},IntPtr.Zero);return found;}
 public static void FitClient(IntPtr h){var previous=SetThreadDpiAwarenessContext(new IntPtr(-4));try{Rect area;if(!GetClientRect(h,out area)||area.Right==0||area.Bottom==0)return;var origin=new Point();ClientToScreen(h,ref origin);EnumChildWindows(h,(child,p)=>{if(GetParent(child)!=h)return true;var name=new StringBuilder(128);GetClassName(child,name,128);if(name.ToString()=="WRY_WEBVIEW"){Rect r;GetWindowRect(child,out r);if(r.Left!=origin.X||r.Top!=origin.Y||r.Right-r.Left!=area.Right||r.Bottom-r.Top!=area.Bottom)SetWindowPos(child,IntPtr.Zero,0,0,area.Right,area.Bottom,0x0014);}return true;},IntPtr.Zero);}finally{SetThreadDpiAwarenessContext(previous);}}
 public static void Show(IntPtr h){ShowWindowAsync(h,IsIconic(h)?9:5);FitClient(h);SetForegroundWindow(h);}
}
'@
    }
    $candidates = @(Get-CimInstance Win32_Process -Filter "Name = 'fusion-preview.exe' OR Name = 'fusion-preview-reopen.exe'" | Where-Object { $Executables -contains $_.ExecutablePath })
    if (-not $candidates.Count) { return $false }
    # Native worker also handles the request when the cached main window was destroyed.
    [System.IO.File]::WriteAllText((Join-Path $DataDirectory 'show-main.request'), '')
    foreach ($candidate in $candidates) {
        $window=[JarvisPreviewWindow]::Find($candidate.ProcessId)
        if ($window -eq [IntPtr]::Zero) { continue }
        [JarvisPreviewWindow]::Show($window)
        for ($attempt=0;$attempt -lt 20;$attempt++) {
            if ([JarvisPreviewWindow]::IsWindowVisible($window)) { [JarvisPreviewWindow]::FitClient($window); return $true }
            Start-Sleep -Milliseconds 50
        }
    }
    # Give the tray worker one tick to recreate an expired cached window.
    for ($attempt=0;$attempt -lt 60;$attempt++) {
        foreach ($candidate in $candidates) {
            $window=[JarvisPreviewWindow]::Find($candidate.ProcessId)
            if ($window -ne [IntPtr]::Zero) { [JarvisPreviewWindow]::Show($window); return $true }
        }
        Start-Sleep -Milliseconds 100
    }
    return $false
}
