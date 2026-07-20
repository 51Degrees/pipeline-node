param (
    [Parameter(Mandatory)][string]$RepoName
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

# TODO: move everything below to common-ci after review
$packages = (npm --prefix $RepoName pkg get name --workspaces | ConvertFrom-Json -AsHashtable).Keys

# Installed outside the repo so the packed files are used, not the local ones.
$installDir = New-Item -Force -ItemType directory -Path package-test
$tarballs = (Get-ChildItem -Filter *.tgz package).FullName
npm install --prefix $installDir --no-save $tarballs

Push-Location $installDir
try {
    foreach ($package in $packages) {
        Write-Host "Loading $package"
        node -e "require('$package')"
    }
} finally {
    Pop-Location
}
