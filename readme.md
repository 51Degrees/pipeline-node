![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=repository&utm_content=readme_main&utm_campaign=node-open-source "Data rewards the curious") **Node Pipeline**

[Developer Documentation](https://51degrees.com/pipeline-node/4.2/index.html?utm_source=github&utm_medium=repository&utm_content=documentation&utm_campaign=node-open-source "developer documentation")

## Introduction
This repository contains the components of the Node.JS implementation of the 51Degrees Pipeline API.

The Pipeline is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines) 

## Contents
This repository contains 4 modules:

- **fiftyone.pipeline.core** - Defines the essential components of the Pipeline API such as 'flow elements', 'flow data' and 'evidence'
- **fiftyone.pipeline.engines** - Functionality for a specialized type of flow element called an engine.
- **fiftyone.pipeline.engines.fiftyone** - Functionality specific to 51Degrees engines.
- **fiftyone.pipeline.cloudrequestengine** - An engine used to make requests to the 51Degrees cloud service.


## Installation

The modules in this repository are available on the node package manager:

```
npm install fiftyone.pipeline.core
npm install fiftyone.pipeline.engines
npm install fiftyone.pipeline.engines.fiftyone
npm install fiftyone.pipeline.cloudrequestengine
```

They can also be installed from this repository by running:

```
npm install <path to module>
```

## Tests
Most modules include some automated tests. To run these, make sure jest is installed:

```
npm install jest --global
```

Then, navigate to the module directory and execute:

```
npm test
```

## Examples
There are several examples available:

- **fiftyone.pipeline.core/examples/customFlowElements/1-simpleEvidenceFlowElement.js** - Demonstrates how to create a custom flow element that takes some evidence (birthdate) and returns something related to that evidence (star sign)
- **fiftyone.pipeline.core/examples/customFlowelements/3-clientSideEvidenceFlowElement.js** - Demonstrates how to modify the flow element from the 'simple evidence' example to gather evidence from code running on the client device (i.e. JavaScript).
- **fiftyone.pipeline.engines/examples/onPremiseFlowElement.js** - Demonstrates the creation of an engine that uses an auto-updating datafile to populate properties
- **fiftyone.pipeline.engines/examples/caching.js** - Demonstrates a custom cache that makes use of the result caching feature that engines provide.