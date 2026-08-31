param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

./node/install-package.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

# The integration tests run jest at the repository root against the source
# tree, not against the packages installed above, so a require in a package
# source file resolves through that package's own node_modules and then the
# root node_modules. Nothing in this stage installs inside the packages, and
# the root install made by ci/setup-environment.ps1 carries only the test
# tooling. Before fiftyone.pipeline.did bundled owid, installing its tarball
# above placed owid in the root node_modules, where the source tree could
# reach it. A bundled dependency stays inside
# node_modules/fiftyone.pipeline.did/node_modules, out of reach of
# fiftyone.pipeline.did/fodId.js, so the integration tests failed with
# "Cannot find module 'owid'". Installing the runtime dependencies inside
# the package gives the source tree the same resolution the unit stage gets
# from ci/build-project.ps1, and mirrors what ci/build-package.ps1 does
# before packing.
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

exit $LASTEXITCODE
