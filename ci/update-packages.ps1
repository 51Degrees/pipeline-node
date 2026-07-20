param (
    [Parameter(Mandatory)][string]$RepoName
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

# TODO: move everything below to common-ci after review
npm --prefix $RepoName update --save --workspaces --include-workspace-root
