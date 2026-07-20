![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=readme.md&utm_term=top "Data rewards the curious") **Node Pipeline**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=readme.md&utm_term=top "developer documentation")

## Introduction
This repository contains the components of the Node.JS implementation of the 51Degrees Pipeline API.

The Pipeline is a generic web request intelligence and data processing solution with the ability to 
add a range of 51Degrees and/or custom plug ins (Engines) 

## Dependencies

The [tested versions](https://51degrees.com/documentation/_info__tested_versions.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=readme.md&utm_term=dependencies) page shows 
the Node versions that we currently test against. The software may run fine against other versions, 
but additional caution should be applied.

## Contents
This repository contains 6 modules:

- [**fiftyone.pipeline.core**](/fiftyone.pipeline.core#readme.md) - Defines the essential components of the Pipeline API such as 'flow elements', 'flow data' and 'evidence'
- [**fiftyone.pipeline.engines**](/fiftyone.pipeline.engines#readme.md) - Functionality for a specialized type of flow element called an engine.
- [**fiftyone.pipeline.engines.fiftyone**](/fiftyone.pipeline.engines.fiftyone#readme.md) - Functionality specific to 51Degrees engines.
- [**fiftyone.pipeline.cloudrequestengine**](/fiftyone.pipeline.cloudrequestengine#readme.md) - An engine used to make requests to the 51Degrees cloud service.
- [**fiftyone.pipeline.did**](/fiftyone.pipeline.did#readme.md) - A reader for the 51Did identifier returned by the 51Degrees cloud service.
- [**fiftyone.pipeline.translation**](/fiftyone.pipeline.translation#readme.md) - A flow element that translates property values from one element to another.

## Installation

The modules in this repository are available on the node package manager:

```
npm install fiftyone.pipeline.core
npm install fiftyone.pipeline.engines
npm install fiftyone.pipeline.engines.fiftyone
npm install fiftyone.pipeline.cloudrequestengine
npm install fiftyone.pipeline.did
npm install fiftyone.pipeline.translation
```

To work on them from this repository instead, install once from the root. The
modules form an npm workspace, so this also links them to each other:

```
npm install
```

## Examples

There are several examples available that demonstrate how to make use of the Pipeline API in isolation. These are described in the table below.
If you want examples that demonstrate how to use 51Degrees products such as device detection, then these are available in the corresponding [repository](https://github.com/51Degrees/device-detection-node) and on our [website](https://51degrees.com/documentation/_examples__device_detection__index.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=readme.md&utm_term=examples).

#### Core

| Example                                | Description |
|----------------------------------------|-------------|
| [simpleEvidenceFlowElement.js](/fiftyone.pipeline.core/examples/customFlowElements/simpleEvidenceFlowElement.js)                   |  Demonstrates how to create a custom flow element that takes some evidence (birthdate) and returns something related to that evidence (star sign). |
| [clientSideEvidenceFlowElement.js](/fiftyone.pipeline.core/examples/customFlowElements/clientSideEvidenceFlowElement.js)                 | Demonstrates how to modify the flow element from the 'simple evidence' example to gather evidence from code running on the client device (i.e. JavaScript). |

#### Engines

| Example                                | Description |
|----------------------------------------|-------------|
| [onPremiseFlowElement.js](/fiftyone.pipeline.engines/examples/onPremiseFlowElement.js)                  |  Demonstrates the creation of an engine that uses an auto-updating datafile to populate properties. |
| [caching.js](/fiftyone.pipeline.engines/examples/caching.js)                 | Demonstrates a custom cache that makes use of the result caching feature that engines provide. |

## Tests
Most modules include some automated tests. They are run for the whole workspace
from the repository root:

```
npm install
npm run unit-test
```

The integration tests need a resource key in the `_51DEGREES_RESOURCE_KEY`
environment variable:

```
npm run integration-test
```
