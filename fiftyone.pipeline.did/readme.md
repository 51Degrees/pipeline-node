# fiftyone.pipeline.did

Strongly typed Node.js reader for the 51Did (51Degrees Identifier) returned by
the 51Degrees Cloud service. Mirrors the .NET `FiftyOne.Did` package.

## Terminology

- The **51Did** (51Degrees Identifier) is the identifier as a whole.
- The **envelope** is the data model that carries it: a signed OWID holding the
  version, domain, date, payload and signature. It changes byte-for-byte every
  time the cloud issues one.
- The **value** is the stable, comparable part of the payload after the Flags
  and License Id: a 32-byte SHA-256 for Probabilistic and HashedEmail
  identifiers, or 16 GUID bytes for Random.

**Comparing two 51Dids means comparing their values, never their envelopes.**

## Payload layout

| Offset | Length | Field      | Type                                            |
|-------:|-------:|------------|-------------------------------------------------|
|      0 |      1 | Flags      | uint8: bits 0-2 usage, bits 6-7 identifier type |
|      1 |      4 | LicenseId  | uint32 (little-endian)                          |
|      5 |  16/32 | Value      | SHA-256 (Probabilistic, HashedEmail) or GUID (Random) |

| Bits 7-6 | `IdType`        | Value length | Minimum payload |
|---------:|-----------------|-------------:|----------------:|
|     `00` | `PROBABILISTIC` |           32 |              37 |
|     `01` | `RANDOM`        |           16 |              21 |
|     `10` | `HASHED_EMAIL`  |           32 |              37 |
|     `11` | `RESERVED`      |    remainder |               5 |

Identifiers issued before the type tag existed have bits 6-7 zeroed and decode
as `PROBABILISTIC`.

## OWID dependency

`FodId` builds on the OWID envelope library
([SWAN-community/owid-js](https://github.com/SWAN-community/owid-js)), consumed
through the [51Degrees/owid-js](https://github.com/51Degrees/owid-js) fork.
owid-js is parse + verify only and exposes no instance `asBase64`, so `FodId`
**composes** an owid instance, keeps the original base64 for `asBase64()`, and
delegates the rest.

The fork was extended with an offline `verifyWithPublicKey(pem, others)` that
works in Node and the browser (Web Crypto), so `FodId.verify()` runs without
contacting a network endpoint.

The fork is not on the npm registry, so `package.json` names it as the GitHub
reference `github:51Degrees/owid-js#main`, which npm resolves by cloning the
repository. That applies only when working in this repository, because the
published `fiftyone.pipeline.did` package carries the OWID source inside its
own tarball under `node_modules/owid`, named in `bundleDependencies`. Anyone
installing the package from npm needs neither git nor reachable GitHub, and
gets the same OWID code every time, whatever the fork's `main` branch happens
to hold on the day. owid-js is Apache-2.0 and its `LICENSE` file travels in
the bundle alongside the source.

## Install / build

```bash
npm install   # needs git on the PATH to fetch the owid-js fork
npm test
```

## Usage

```js
const { FodId, IdType } = require('fiftyone.pipeline.did');

const fodId = FodId.fromBase64(base64FromCloudService);

const flags = fodId.flags;
const type = fodId.type;          // IdType.PROBABILISTIC / RANDOM / HASHED_EMAIL
const licenseId = fodId.licenseId;
const value = fodId.hash;         // Uint8Array: SHA-256 or GUID bytes, see type

const domain = fodId.domain;
const verified = await fodId.verify(publicKeyPem);   // async (Web Crypto)
const base64 = fodId.asBase64();
```

## Comparing two 51Dids

```js
const a = FodId.fromBase64(idprobglobalA);
const b = FodId.fromBase64(idprobglobalB);

// The envelope (date, signature, base64) differs across reissues.
// The value inside the payload is stable - this is what you compare:
const sameValue = Buffer.from(a.hash).equals(Buffer.from(b.hash));
```

## Non-goals

- **No signature verification on construction.** Call `verify(publicKeyPem)`
  when needed (it is asynchronous).
- **No creation of new 51Dids.** This is a parser; new 51Dids are issued by the
  51Degrees cloud / on-premise hashing engines.
