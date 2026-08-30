param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$packages = "fiftyone.pipeline.cloudrequestengine", "fiftyone.pipeline.core", "fiftyone.pipeline.engines", "fiftyone.pipeline.engines.fiftyone", "fiftyone.pipeline.did", "fiftyone.pipeline.translation"

$noRemote = "fiftyone.pipeline.core"

# Packages that carry a dependency inside the published tarball with
# bundleDependencies. npm pack copies the named folders out of node_modules,
# so those folders have to exist by the time it runs. This job runs on a
# different machine from the Pre Build job and starts from a fresh clone, and
# the common-ci packing script only sets the version and packs, so nothing
# else installs anything here. Without this step the bundle would be empty
# and the failure would be silent.
$bundling = "fiftyone.pipeline.did"

foreach ($package in $bundling) {
    Push-Location (Join-Path $RepoName $package)

    try {
        Write-Output "Installing runtime dependencies for $package"
        npm install --omit=dev || $(throw "ERROR: Failed to install dependencies for $package")
    } finally {
        Pop-Location
    }
}

./node/build-package-npm.ps1 -RepoName $RepoName -Packages $packages -NoRemote $noRemote -Version $Version

exit $LASTEXITCODE