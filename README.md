<p align="center">
    <a href="https://croct.com">
        <img src="https://cdn.croct.io/brand/logo/repo-icon-green.svg" alt="Croct" height="80"/>
    </a>
    <br />
    <strong>JSON Pointer</strong>
    <br />
    A RFC 6901 compliant JSON pointer library to handle arbitrary structured data.
</p>
<p align="center">
    <img alt="Build" src="https://github.com/croct-tech/json-pointer-js/actions/workflows/validate-branch.yaml/badge.svg" />
    <a href="https://codeclimate.com/repos/6219a343a6636301b6003865/test_coverage"><img src="https://api.codeclimate.com/v1/badges/a9ea56032f9524de01b1/test_coverage" /></a>
    <a href="https://codeclimate.com/repos/6219a343a6636301b6003865/maintainability"><img src="https://api.codeclimate.com/v1/badges/a9ea56032f9524de01b1/maintainability" /></a>
    <br />
    <br />
    <a href="https://github.com/croct-tech/json-pointer-js/releases">📦Releases</a>
    ·
    <a href="https://github.com/croct-tech/json-pointer-js/issues/new?labels=bug&template=bug-report.md">🐞Report Bug</a>
    ·
    <a href="https://github.com/croct-tech/json-pointer-js/issues/new?labels=enhancement&template=feature-request.md">✨Request Feature</a>
</p>

## Introduction

This library provides an [RFC 6901](https://tools.ietf.org/html/rfc6901) compliant JSON pointer implementation
to handle and manipulate arbitrary JSON values with type-safety.

## Installation

We recommend using [NPM](https://www.npmjs.com) to install the package:

```sh
npm install @croct-tech/json-pointer
```

## Overview

This library ships with a fast implementation of the JSON Pointer specification, as described in 
[RFC 6901](https://tools.ietf.org/html/rfc6901).

These are the main highlight that distinguishes it from similar libraries:

- Fast and lightweight, zero dependencies
- Fully compliant with the specification, including validation, serialization, and deserialization
- Provide methods for reading and writing structures
- Restricts operations such that no array becomes sparse
- Ensures that a valid `JsonStructure` modified by a `JsonPointer` results in a still valid `JsonStructure`

## Contributing

Contributions to the package are always welcome! 

- Report any bugs or issues on the [issue tracker](https://github.com/croct-tech/json-pointer-js/issues).
- For major changes, please [open an issue](https://github.com/croct-tech/json-pointer-js/issues) first to discuss what you would like to change.
- Please make sure to update tests as appropriate.

## Testing

Before running the test suites, the development dependencies must be installed:

```sh
npm install
```

Then, to run all tests:

```sh
npm run test
```

Run the following command to check the code against the style guide:

```sh
npm run lint
```

## Building

Before building the project, the dependencies must be installed:

```sh
npm install
```

The following command builds the library:

```
npm run build
```

## License

Copyright © 2015-2021 Croct Limited, All Rights Reserved.

All information contained herein is, and remains the property of Croct Limited. The intellectual, design and technical concepts contained herein are proprietary to Croct Limited s and may be covered by U.S. and Foreign Patents, patents in process, and are protected by trade secret or copyright law. Dissemination of this information or reproduction of this material is strictly forbidden unless prior written permission is obtained from Croct Limited.
