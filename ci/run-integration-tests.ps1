param (
    [Parameter(Mandatory)][string]$RepoName,
    [Parameter(Mandatory)][string]$TestResourceKey
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$env:_51DEGREES_RESOURCE_KEY = $TestResourceKey
$env:JEST_JUNIT_OUTPUT_DIR = "$PWD/$RepoName/test-results/integration"
npm --prefix $RepoName run integration-test
