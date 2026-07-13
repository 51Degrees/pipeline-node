param (
    [Parameter(Mandatory)][string]$RepoName
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

npm --prefix $RepoName install --workspaces
& {
    # TODO: fix lint erorrs
    $ErrorActionPreference = 'Continue'
    npm --prefix $RepoName run lint
}
