![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.core-readme.md&utm_term=top "Data rewards the curious") **51Degrees Pipeline Core**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.core-readme.md&utm_term=top "developer documentation")

## Introduction
The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines) 

## This package - fiftyone.pipeline.core

This package definds the essential components of the Pipeline API such as `flow elements`, `flow data` and `evidence`. It also packages together JavaScript served by a pipeline and allows for client side requests for additional data populated by evidence from the client side.

It can be used on its own or with the following additional packages.

- [**fiftyone.pipeline.engines**](/fiftyone.pipeline.engines#readme.md) - Adds a specialized type of flow element called an engine which allows for additional features including an auto-updating data file for properties, a service called when a requested property is missing and a caching system.

Engines created by 51Degrees including:

- [**fiftyone.devicedetection**](https://github.com/51Degrees/device-detection-node#readme) - A device detection engine
- [**fiftyone.geolocation**](https://github.com/51Degrees/location-node#readme) - A geolocation lookup engine

Make use of the above along with the following additional packages:

- [**fiftyone.pipeline.engines.fiftyone**](/fiftyone.pipeline.engines.fiftyone#readme.md) - Functionality specific to 51Degrees engines.
- [**fiftyone.pipeline.cloudrequestengine**](/fiftyone.pipeline.cloudrequestengine#readme.md) - An engine used to make requests to the 51Degrees cloud service.

## Installation

```
npm install fiftyone.pipeline.core
```

## Examples

Examples can be found in the `examples/` folder. See below for a list of examples.

| Example                                | Description |
|----------------------------------------|-------------|
| [simpleEvidenceFlowElement.js](/fiftyone.pipeline.core/examples/customFlowElements/simpleEvidenceFlowElement.js)                   |  Demonstrates how to create a custom flow element that takes some evidence (birthdate) and returns something related to that evidence (star sign). |
| [clientSideEvidenceFlowElement.js](/fiftyone.pipeline.core/examples/customFlowElements/clientSideEvidenceFlowElement.js)                 | Demonstrates how to modify the flow element from the 'simple evidence' example to gather evidence from code running on the client device (i.e. JavaScript). |

## Tests

To run tests you will need to install the `jest` library.

```
npm install jest --global
```

Then, navigate to the module directory and execute:

```
npm test
```
