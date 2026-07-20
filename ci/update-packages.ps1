param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

$packages = "fiftyone.pipeline.cloudrequestengine", "fiftyone.pipeline.core", "fiftyone.pipeline.engines", "fiftyone.pipeline.engines.fiftyone", "fiftyone.pipeline.did", "fiftyone.pipeline.translation"

./node/update-packages.ps1 -RepoName $RepoName -Packages $packages

exit $LASTEXITCODE