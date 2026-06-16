![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.cloudrequestengine-readme.md&utm_term=top "Data rewards the curious") **51Degrees Pipeline Cloud Request Engine**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.cloudrequestengine-readme.md&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines).

## This package - fiftyone.pipeline.cloudrequestengine

This package uses the `engines` class created by the [`fiftyone.pipeline.engines`](/fiftyone.pipeline.engines#readme.md). It makes available:

* A `Cloud Request Engine` which calls the 51Degrees cloud service to fetch properties and metadata about them based on a provided resource key. A resource key with the free properties used by the tests can be created [here](https://configure.51degrees.com/Wkqxf3Bs?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.cloudrequestengine-readme.md&utm_term=this-package-fiftyone-pipeline-cloudrequestengine).
* A `Cloud Engine` template which reads data from the Cloud Request Engine.

It is used by the cloud versions of the following 51Degrees engines:

- [**fiftyone.devicedetection**](https://github.com/51Degrees/device-detection-node#readme) - A device detection engine
- [**fiftyone.geolocation**](https://github.com/51Degrees/location-node#readme) - A geolocation lookup engine

## Installation

```
npm install fiftyone.pipeline.cloudrequestengine
```

## Tests

To run tests you will need to install the `jest` library.

```
npm install jest --global
```

Then, navigate to the module directory and execute:

```
npm test
```

The integration tests read the resource key from the aligned
`_51DEGREES_RESOURCE_KEY` environment variable first, then the legacy
`RESOURCE_KEY` variable.

