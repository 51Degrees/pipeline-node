param (
    [Parameter(Mandatory)][string]$RepoName,
    [Parameter(Mandatory)][string]$Version
)
./node/build-workspace-packages.ps1 -RepoName:$RepoName -Version:$Version
