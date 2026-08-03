param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [hashtable]$Keys,
    [Parameter(Mandatory=$true)]
    [boolean]$DryRun
)

./node/publish-package-npm.ps1 -RepoName $RepoName -Keys $Keys -DryRun $DryRun

exit $LASTEXITCODE