param (
    [Parameter(Mandatory)][string]$RepoName,
    [Parameter(Mandatory)][string]$TestResourceKey
)

$env:_51DEGREES_RESOURCE_KEY = $TestResourceKey
./node/run-integration-tests.ps1 -RepoName $RepoName
