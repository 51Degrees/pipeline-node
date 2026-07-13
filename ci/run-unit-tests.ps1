param ([Parameter(Mandatory)][string]$RepoName)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$env:JEST_JUNIT_OUTPUT_DIR = "$PWD/$RepoName/test-results/unit"
npm --prefix $RepoName run unit-test
