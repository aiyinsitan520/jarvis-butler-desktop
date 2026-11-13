param([switch]$Check)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$appFile = Join-Path $projectDir 'target\debug\examples\fusion-preview.exe'
$updatedAppFile = Join-Path $projectDir 'target\debug\examples\fusion-preview-reopen.exe'
$allowedApps = @($appFile, $updatedAppFile)
$latestApp = $allowedApps | Where-Object {Test-Path -LiteralPath $_ -PathType Leaf} | Get-Item | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestApp) { $appFile = $latestApp.FullName }
$previewDir = Join-Path $env:LOCALAPPDATA 'JarvisButlerDesktop\local-workbench'
if (-not (Test-Path -LiteralPath $appFile -PathType Leaf)) {
    throw 'Preview executable is missing. Build jarvis-desktop first.'
}
if ($Check) {
    Write-Output "EXE_OK: $appFile"
    Write-Output "ISOLATED_DATA: $previewDir"
    exit 0
}
$activeDataDir = $previewDir
$profileFile = Join-Path $previewDir 'profile.json'
if (Test-Path -LiteralPath $profileFile -PathType Leaf) {
    $profile = Get-Content -LiteralPath $profileFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($profile.dataDir -and (Test-Path -LiteralPath $profile.dataDir -PathType Container)) { $activeDataDir = [string]$profile.dataDir }
}
$created = $false
$previewMutex = New-Object System.Threading.Mutex($true, 'Local\JarvisButlerDesktop-LocalWorkbench', [ref]$created)
if (-not $created) {
    $previewMutex.Dispose()
    . (Join-Path $PSScriptRoot 'show-preview.ps1')
    if (Show-JarvisPreview -Executables $allowedApps -DataDirectory $activeDataDir) {
        Write-Output 'EXISTING_WINDOW_SHOWN'
        exit 0
    }
    Add-Type -AssemblyName System.Windows.Forms
    $message = -join (0x7a97,0x53e3,0x5524,0x9192,0x6682,0x672a,0x5b8c,0x6210,0xff0c,0x8bf7,0x70b9,0x51fb,0x6258,0x76d8,0x56fe,0x6807,0x6253,0x5f00,0x3002 | ForEach-Object {[char]$_})
    [System.Windows.Forms.MessageBox]::Show($message, 'Jarvis Butler') | Out-Null
    exit 0
}
$ownsMutex = $true
try {
    New-Item -ItemType Directory -Path $previewDir -Force | Out-Null
    $env:JARVIS_DESKTOP_DATA_DIR = $previewDir
    Remove-Item Env:DINGMI_WEBVIEW_ARGS -ErrorAction SilentlyContinue
    $previewProcess = Start-Process -FilePath $appFile -WorkingDirectory $projectDir -PassThru
    $previewProcess.WaitForExit()
    if ($previewProcess.ExitCode -ne 0) { throw "Preview exited with code $($previewProcess.ExitCode)." }
} catch {
    # A launch-error dialog must not keep the next launch locked out.
    if ($ownsMutex) { $previewMutex.ReleaseMutex(); $ownsMutex = $false }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show([string]$_.Exception.Message, 'Jarvis Butler - launch failed') | Out-Null
    exit 1
} finally {
    if ($ownsMutex) { $previewMutex.ReleaseMutex() }
    $previewMutex.Dispose()
}
