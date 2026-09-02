param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

# The repository root carries its own package.json, which is the harness that
# lets jest, tsc and eslint run once from the root against the local source
# instead of against published packages. It used to be written out here on
# every run, which meant the lint tooling existed only inside this script and
# nobody could run npm run lint from a clone. It is now checked in, and
# ./node/setup-environment.ps1 below installs it with npm install.
#
# Two things about that file are easy to undo by accident.
#
# The jest it pins has to be 28 or later. Jest 27 copies a fixed list of
# globals into its node test sandbox and fetch is not on that list, so under
# jest 27 a test sees no fetch even on Node 22, and the 51Did integration test
# failed with "No fetch function is available" from the DidClient constructor.
# Jest 28 and later give the sandbox the runtime's own globals, which is what
# the fiftyone.pipeline.did package already relies on through its devDependency
# on jest 29.
#
# The test patterns in the unit-test and integration-test scripts are wrapped
# in escaped double quotes and not single quotes. On Windows npm runs scripts
# through cmd.exe, which passes single quotes through as part of the argument,
# so jest received the pattern with the quote characters attached. Jest 27
# still matched the integration files that way, whilst jest 29 on the Windows
# runners answered "No tests found" with "testMatch: '**/*integration*.js' -
# 0 matches", and the unit script's ignore pattern silently stopped excluding
# the integration files. Double quotes are removed by every shell npm uses.

./node/setup-environment.ps1 -RepoName $RepoName

exit $LASTEXITCODE
