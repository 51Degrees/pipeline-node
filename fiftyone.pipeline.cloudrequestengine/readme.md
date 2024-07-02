![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=repository&utm_content=readme_main&utm_campaign=node-open-source "Data rewards the curious") **51Degrees Pipeline Cloud Request Engine**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=github&utm_medium=repository&utm_content=documentation&utm_campaign=node-open-source "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines).

## This package - fiftyone.pipeline.cloudrequestengine

This package uses the `engines` class created by the [`fiftyone.pipeline.engines`](/fiftyone.pipeline.engines#readme.md). It makes available:

* A `Cloud Request Engine` which calls the 51Degrees cloud service to fetch properties and metadata about them based on a provided resource key. Get a resource key at https://configure.51degrees.com/
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

