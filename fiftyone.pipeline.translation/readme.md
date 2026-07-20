![51Degrees](https://51degrees.com/img/logo.png?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.translation-readme.md&utm_term=top "Data rewards the curious") **51Degrees Pipeline Translation**

[Developer Documentation](https://51degrees.com/pipeline-node/index.html?utm_source=github&utm_medium=readme&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.translation-readme.md&utm_term=top "developer documentation")

## Introduction

The 51Degrees Pipeline API is a generic web request intelligence and data processing solution with the ability to add a range of 51Degrees and/or custom plug ins (Engines)

## This package - fiftyone.pipeline.translation

This package provides a generic translation `flow element`. A translation engine reads string based properties from an upstream element and writes translated values under its own element data key. The supported value shapes are a string, a list of strings and a weighted list of strings (the `{ value, weight, rawWeight }` shape surfaced by 51Degrees engines), as well as an `AspectPropertyValue` wrapping any of those. The shape of an output property matches its input, and the weights of a weighted list are preserved.

Translations are supplied as YAML files, where the file name defines the locale contained in the file (for example `countries.fr_FR.yml`). The language to translate to can be fixed, or resolved from the evidence using the `query.translation`, `query.accept-language` and `header.accept-language` keys (in that precedence order). English is treated as the base language: when it is the highest priority language no translation is performed and the source values are returned unchanged.

This package is used by [`fiftyone.ipintelligence.translation`](https://github.com/51Degrees/ip-intelligence-node) to turn weighted country code lists into localized country names.

## Installation

```
npm install fiftyone.pipeline.translation
```

## Tests

This module is part of the pipeline-node npm workspace, so its dependencies
are installed once from the repository root:

```
npm install
```

The tests are run from the root as well:

```
npm run unit-test
```
