param (
    [Parameter(Mandatory=$true)]
    [string]$RepoName
)

Push-Location $RepoName

# The jest below is the runner for the unit and integration stages of every
# package in the repository, because the stages run jest once from this
# root rather than from each package. It has to be jest 28 or later. Jest 27
# copies a fixed list of globals into its node test sandbox and fetch is not
# on that list, so under jest 27 a test sees no fetch even on Node 22, and
# the 51Did integration test failed with "No fetch function is available"
# from the DidClient constructor. Jest 28 and later give the sandbox the
# runtime's own globals, which is what the fiftyone.pipeline.did package
# already relies on through its devDependency on jest 29.
$packageJSON = @"
{
  "name": "pipeline-node",
  "version": "1.0.0",
  "description": "Temporary package to allow all tests to run using the local code as dependencies",
  "main": "index.js",
  "types": "types/index.d.ts",
  "scripts": {
    "unit-test": "jest --ci --reporters=jest-junit --reporters=default --coverage --coverageReporters=cobertura --testPathIgnorePatterns '.*integration.*'",
    "integration-test": "jest --ci --reporters=jest-junit --reporters=default --coverage --coverageReporters=cobertura --testMatch '**/*integration*.js'",
    "lint": "eslint . --ext .js",
    "tsc": "tsc -b --force"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/51Degrees/pipeline-node"
  },
  "author": "51Degrees Engineering <engineering@51degrees.com>",
  "dependencies": {
    "eslint": "8.57.0",
    "eslint-config-standard": "^17.0.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-jest": "^23.13.2",
    "eslint-plugin-jsdoc": "^38.1.6",
    "eslint-plugin-n": "^15.0.0",
    "eslint-plugin-node": "^11.1.0",
    "eslint-plugin-promise": "^6.0.0",
    "jest": "^29.7.0",
    "jest-junit": "^16.0.0",
    "mustache": "^4.0.1",
    "node-mocks-http": "^1.10.1",
    "uglify-js": "^3.8.1"
  },
  "jest": {
    "setupFilesAfterEnv": [
      "./setup.js"
    ]
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
"@

New-Item -ItemType File -Path "package.json" -Force | Out-Null
Set-Content -Path "package.json" -Value $packageJSON
Write-Output "Package configuration file created successfully."

Pop-Location

./node/setup-environment.ps1 -RepoName $RepoName

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}



