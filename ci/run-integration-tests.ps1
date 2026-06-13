param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [string]$TestResourceKey
)

$env:RESOURCE_KEY = $TestResourceKey
# Aligned environment variable name. This is checked first by the tests.
# The legacy name above is retained for backwards compatibility.
${env:51DEGREES_RESOURCE_KEY} = $TestResourceKey

./node/run-integration-tests.ps1 -RepoName $RepoName

exit $LASTEXITCODE
