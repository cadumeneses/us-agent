param(
    [string]$CsvPath = ".\runs\results.csv",
    [switch]$CommitteeOnly,
    [switch]$InteractiveReview
)

$ErrorActionPreference = "Stop"
$runner = if ($CommitteeOnly) { "run_committee.py" } else { "run.py" }
$classifyOnlyArgs = if ($InteractiveReview) { @() } else { @("--classify-only") }
$pythonExe = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "py" }

Write-Host "Executando lote P01-P10 com $runner"
& $pythonExe $runner --project-ids P01-P10 --projects-dir .\projects @classifyOnlyArgs

Write-Host "Gerando CSV SQL em $CsvPath"
& $pythonExe .\export_results_csv.py --output $CsvPath
