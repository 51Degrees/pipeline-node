param (
    [Parameter(Mandatory)][string]$RepoName
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

# TODO: move everything below to common-ci after review
# Installs the root and all of the workspace members.
npm --prefix $RepoName install
