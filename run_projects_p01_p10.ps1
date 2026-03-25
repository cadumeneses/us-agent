$ErrorActionPreference = "Stop"

param(
    [string]$ResultsPath = ".\runs\results.jsonl",
    [string]$CsvPath = ".\runs\results.csv",
    [switch]$CommitteeOnly,
    [switch]$InteractiveReview
)

$runner = if ($CommitteeOnly) { "run_committee.py" } else { "run.py" }
$classifyOnlyArgs = if ($InteractiveReview) { @() } else { @("--classify-only") }

Write-Host "Executando lote P01-P10 com $runner"
& py $runner --project-ids P01-P10 --projects-dir .\projects --results-path $ResultsPath @classifyOnlyArgs

Write-Host "Gerando CSV em $CsvPath"
& py .\export_results_csv.py --input $ResultsPath --output $CsvPath
