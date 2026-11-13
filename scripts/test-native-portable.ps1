$ErrorActionPreference='Stop'
$projectDir=Split-Path -Parent $PSScriptRoot
$fixtureExe=Join-Path $projectDir 'target/debug/examples/fusion-preview.exe'
if(-not(Test-Path -LiteralPath $fixtureExe -PathType Leaf)){throw 'Build fusion-preview with tauri/custom-protocol first.'}
$fixtureDir=Join-Path $env:TEMP ('jarvis-portable-native-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureDir | Out-Null
$previousData=$env:JARVIS_DESKTOP_DATA_DIR
try {
    $env:JARVIS_DESKTOP_DATA_DIR=$fixtureDir
    $fixtureProcess=Start-Process -FilePath $fixtureExe -WorkingDirectory $projectDir -PassThru -WindowStyle Hidden
    @{pid=$fixtureProcess.Id;dataDir=$fixtureDir;exe=$fixtureExe} | ConvertTo-Json | Set-Content (Join-Path $projectDir 'output/portable-native-fixture.json') -Encoding utf8
    & python (Join-Path $PSScriptRoot 'test-native-portable.py')
    if($LASTEXITCODE -ne 0){throw 'Native portable test failed.'}
} finally {
    $env:JARVIS_DESKTOP_DATA_DIR=$previousData
    if($fixtureProcess){$actual=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$fixtureProcess.Id);if($actual -and $actual.ExecutablePath -eq $fixtureExe){Stop-Process -Id $fixtureProcess.Id}}
}
