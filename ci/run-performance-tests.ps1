param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

./node/run-performance-tests.ps1 -RepoName $RepoName

exit $LASTEXITCODE