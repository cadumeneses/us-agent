param([string]$EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
$ErrorActionPreference = 'Stop'
$paperRoot = Split-Path -Parent $PSScriptRoot
foreach ($figureName in @('recommender-workflow', 'configured-feature')) {
    $htmlPath = Join-Path $paperRoot "figures/$figureName.html"
    $figureUri = ([System.Uri]$htmlPath).AbsoluteUri
    foreach ($outputMode in @('pdf', 'png')) {
        $outputPath = Join-Path $paperRoot "figures/$figureName.$outputMode"
        $profilePath = Join-Path $paperRoot "tmp/paper-edge-$figureName-$outputMode"
        $edgeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--hide-scrollbars', '--no-pdf-header-footer', "--user-data-dir=`"$profilePath`"")
        if ($outputMode -eq 'pdf') {
            $edgeArgs += "--print-to-pdf=`"$outputPath`""
        } else {
            $edgeArgs += "--screenshot=`"$outputPath`""
            $edgeArgs += if ($figureName -eq 'recommender-workflow') { '--window-size=680,218' } else { '--window-size=330,166' }
            $edgeArgs += '--force-device-scale-factor=2'
        }
        $edgeArgs += "`"$figureUri`""
        $process = Start-Process -FilePath $EdgePath -ArgumentList $edgeArgs -WindowStyle Hidden -PassThru -Wait
        if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) { throw "Figure rendering failed: $figureName $outputMode" }
        Write-Output "Rendered figures/$figureName.$outputMode"
    }
}
