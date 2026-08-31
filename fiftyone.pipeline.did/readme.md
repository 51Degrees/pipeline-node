# fiftyone.pipeline.did

Strongly typed Node.js reader for the 51Did (51Degrees Identifier) returned by
the 51Degrees Cloud service, and a client for everything a server does with a
51Did against the cloud. Mirrors the .NET `FiftyOne.Did` package.

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
|      1 |      4 | LicenseId  | uint32 (little-endian), see below               |
|      5 |  16/32 | Value      | SHA-256 (Probabilistic, HashedEmail) or GUID (Random) |

| Bits 7-6 | `IdType`        | Value length | Least payload accepted |
|---------:|-----------------|-------------:|-----------------------:|
|     `00` | `PROBABILISTIC` |           32 |                     37 |
|     `01` | `RANDOM`        |           16 |                     21 |
|     `10` | `HASHED_EMAIL`  |           32 |                     37 |
|     `11` | `RESERVED`      |    remainder |                      5 |

Identifiers issued before the type tag existed have bits 6-7 zeroed and decode
as `PROBABILISTIC`.

On an identifier carrying a creator context (which binds the identifier to the
browser and connection it was created on) the four bytes at offset 1 hold an
encrypted value that only 51Degrees can turn back into a licence identifier.
`licenseId` is then the field's raw value and identifies nothing outside
51Degrees. A payload longer than the least length carries the creator context
after the value, and the reader accepts it as it accepts the base length. The
lengths of a context section belong to the cloud, so the reader checks only
the lower bound for the identifier type, holds no upper bound of its own, and
leaves anything longer for the cloud to judge. A reader built before a longer
context section existed therefore still reads the identifier.

## Reading a 51Did

A 51Did arrives from outside, from a page, a link or a log line, so a value
that is not one is an ordinary outcome rather than an error. `FodId.tryParse`
and `FodId.tryFromByteArray` never throw. Each returns a frozen result
reporting the same three facts:

| Field | Type | Meaning |
| --- | --- | --- |
| `ok` | boolean | True when the input was a structurally valid 51Did |
| `value` | `FodId` or `null` | The identifier on success and `null` on failure, never a half read identifier |
| `status` | string | `FodId.ParseStatus.PARSED` on success, otherwise the specific reason |

```js
const { FodId } = require('fiftyone.pipeline.did');

const result = FodId.tryParse(untrusted);
if (result.ok) {
  use(result.value);
} else {
  console.log('not a 51Did: ' + result.status);
}
```

Reading and verifying are two questions with two answers. A successful read
says the bytes are a structurally valid 51Did and nothing more. No read
fetches a key or checks a signature, so a parsed 51Did is not necessarily
genuine, and a structurally valid identifier whose signature does not match
reads successfully and then fails verification. Verify with
`fodId.verify(publicKeyPem)`, `fodId.checkSignature(publicKeyPem)` or
`DidClient.verifySignature(fodId)`, described below.

### Read statuses

`FodId.ParseStatus` is a frozen object of stable string values. Compare
against its members rather than against the text of any message. The
vocabulary is the OWID library's own, carried through unchanged, plus two
members for the 51Did payload. A failure the OWID library reported keeps the
OWID library's status, so a specific reason is never reduced to a general one.

| Status | Reported by | Meaning |
| --- | --- | --- |
| `PARSED` | both | The input is a structurally valid 51Did. Says nothing about the signature |
| `MISSING_INPUT` | OWID | Nothing was supplied, being `null`, `undefined`, an empty or whitespace-only string, or a buffer of no bytes |
| `INVALID_INPUT_TYPE` | OWID | The input was not a string (`tryParse`) or not a byte array (`tryFromByteArray`) |
| `INVALID_BASE64` | OWID | The string is not base64 in either alphabet, so there are no bytes to read |
| `UNSUPPORTED_VERSION` | OWID | The first byte names an envelope version the OWID library does not know |
| `ABSENT_NODE` | OWID | The bytes are the OWID absent node marker, which stands for no identifier |
| `UNEXPECTED_END` | OWID | The data stopped part way through a field |
| `INVALID_DOMAIN_ENCODING` | OWID | The creator domain is not terminated or is longer than a domain name can be |
| `BYTE_COUNT_MISMATCH` | OWID | The declared payload byte count disagrees with the bytes present |
| `IMPLEMENTATION_CAPACITY_EXCEEDED` | OWID | The envelope is consistent but larger than this runtime can hold |
| `MALFORMED_ENVELOPE` | OWID | Malformed in a way none of the above describes |
| `PAYLOAD_TOO_SHORT` | 51Did | The payload is shorter than the 5 byte header (flags and licence id), so the type cannot be read |
| `INVALID_TYPE_PAYLOAD_LENGTH` | 51Did | The header named a type and the payload is shorter than that type's value needs, being 21 bytes for Random and 37 for Probabilistic and HashedEmail |

A Reserved type is not yet assigned, so the reader accepts it at any length
from the header up and exposes whatever follows the header as the value.

### The throwing surface

`FodId.fromBase64(base64)`, `FodId.fromByteArray(bytes)`, `FodId.fromOwid(owid)`
and `new FodId(owid)` are the same read for a caller who prefers an
exception. They run the same checks, in the same order, and throw:

| Thrown | When |
| --- | --- |
| `TypeError` | The argument is the wrong kind of thing, being `null`, `undefined`, a non-string to `fromBase64`, or a non-`Uint8Array` to `fromByteArray` |
| `RangeError` | The payload is `PAYLOAD_TOO_SHORT` or `INVALID_TYPE_PAYLOAD_LENGTH`. The error carries `status` |
| `FodIdParseError` | The OWID library refused the envelope for any other status. The error carries `status` |

A wrong argument type is a programming error and stays exceptional on every
surface. Everything else is a fact about the data, which the non-throwing
surfaces report as a result and the throwing surfaces report as one of the
two errors above.

### Migrating from the removed OWID API

The OWID library this package builds on no longer has a public constructor
and no longer throws from a read (see the next section). A caller who reached
the OWID library through this package changes as follows.

| Before | After |
| --- | --- |
| `FodId.fromOwid(new owid(s))` | `FodId.fromBase64(s)`, or `FodId.tryParse(s)` for a result |
| `try { FodId.fromBase64(s) } catch (e) { /* e was a string */ }` | `const r = FodId.tryParse(s); if (!r.ok) { /* r.status */ }` |
| `catch (e)` on `fromBase64` reading `e.message` | `catch (e)` reading `e.status`, one of `FodId.ParseStatus` |
| `fodId.date` read as a signed number | `fodId.date` is now unsigned, the same value as `fodId.dateMinutes` |
| `fodId.verify(pem)` resolving `false` for a key that could not be imported | `verify` rejects when the question could not be answered, and `checkSignature(pem)` reports `INVALID_KEY` |

## OWID dependency

`FodId` builds on the OWID envelope library
([SWAN-community/owid-js](https://github.com/SWAN-community/owid-js)). The
library is read and verify only, so `FodId` **composes** the OWID the library
read, delegates the envelope fields to it, and keeps the standard base64 for
`asBase64()`.

The library was hardened so that an OWID reaches calling code by one route
only, which is a successful read through `owid.parse` or `owid.parseBytes`.
Those reads answer with `{ ok, owid, status }` and never throw, `new owid()`
throws naming what to use instead, and an OWID that has been read is frozen
and hands out its byte arrays as copies. This package follows the same shape,
which is why `tryParse` and `tryFromByteArray` exist and why the OWID statuses
appear in `FodId.ParseStatus` unchanged. The library also offers an offline
`verifyWithPublicKey(pem, others)` and `checkSignatureWithPublicKey(pem,
others)` that work in Node and the browser (Web Crypto), so `FodId.verify()`
and `FodId.checkSignature()` run without contacting a network endpoint.

The library is not on the npm registry, so `package.json` names it as a
GitHub reference, which npm resolves by cloning the repository. The reference
is currently `github:SWAN-community/owid-js#78ee457`, the tip of the hardening
branch, and returns to the [51Degrees/owid-js](https://github.com/51Degrees/owid-js)
fork at the merged commit once the fork is synced. That applies only when
working in this repository, because the published `fiftyone.pipeline.did`
package carries the OWID source inside its own tarball under
`node_modules/owid`, named in `bundleDependencies`. Anyone installing the
package from npm needs neither git nor reachable GitHub, and gets the same
OWID code every time, whatever the referenced branch happens to hold on the
day. owid-js is Apache-2.0 and its `LICENSE` file travels in the bundle
alongside the source.

## Install / build

```bash
npm install   # needs git on the PATH to fetch owid-js
npm test
```

## Usage

```js
const { FodId, IdType } = require('fiftyone.pipeline.did');

// Either base64 alphabet is accepted, the standard one the cloud issues and
// the URL-safe one a page puts in a link, with or without padding.
const fodId = FodId.fromBase64(base64FromCloudService);

const flags = fodId.flags;
const type = fodId.type;          // IdType.PROBABILISTIC / RANDOM / HASHED_EMAIL
const licenseId = fodId.licenseId;
const value = fodId.hash;         // Uint8Array: SHA-256 or GUID bytes, see type

const domain = fodId.domain;
const minutes = fodId.dateMinutes; // minutes since 2020-01-01T00:00:00Z
const verified = await fodId.verify(publicKeyPem);   // async (Web Crypto)
const base64 = fodId.asBase64();      // standard alphabet with padding
const inLink = fodId.asBase64Url();   // URL-safe alphabet, no padding
```

`dateMinutes` is the envelope's own date as the unsigned 32-bit count of
minutes since 2020-01-01T00:00:00Z, the value the OWID `public-key?date=`
parameter takes, for callers comparing creation times. `date` now reports
the same unsigned value.

Where the value may not be a 51Did at all, read it without throwing.

```js
const result = FodId.tryParse(valueFromOutside);
if (!result.ok) {
  // result.status is one of FodId.ParseStatus, and result.value is null.
  return;
}
const fodId = result.value;
```

`fodId.checkSignature(publicKeyPem)` reports the signature outcome as one of
`FodId.SignatureStatus` (the OWID library's own frozen object), so that "could
not check" stays apart from "does not match". Only `SIGNATURE_INVALID` means
the identifier should be distrusted, and `KEY_UNAVAILABLE`, `INVALID_KEY` and
`VERIFICATION_ERROR` mean the question was never answered. The boolean
`verify(publicKeyPem)` resolves only for the two statuses that judge the
signature and rejects for the rest, because a caller told `false` would treat
an outage as a forgery.

```js
const check = await fodId.checkSignature(publicKeyPem);
if (check.status === FodId.SignatureStatus.SIGNATURE_INVALID) {
  // The identifier should be distrusted.
} else if (!check.ok) {
  // The signature was never judged. Do not treat this as a forgery.
  console.log(check.status + ': ' + check.message);
}
```

## Comparing two 51Dids

```js
const a = FodId.fromBase64(idprobglobalA);
const b = FodId.fromBase64(idprobglobalB);

// The envelope (date, signature, base64) differs across reissues.
// The value inside the payload is stable - this is what you compare:
const sameValue = Buffer.from(a.hash).equals(Buffer.from(b.hash));
```

## Verifying on your server

`DidClient` handles every manipulation of a 51Did a server needs against the
cloud, so server code never builds a cloud URL or handles a key itself. One
instance serves a whole server. It needs Node 18 or later for the built-in
`fetch`, or a `fetch` function passed in.

```js
const { FodId, DidClient } = require('fiftyone.pipeline.did');

const client = new DidClient({
  resourceKey: process.env._51DEGREES_RESOURCE_KEY,
  licenceKey: process.env._51DEGREES_LICENSE_KEY   // optional, see below
  // endpoint: defaults to FOD_CLOUD_API_URL, then the public cloud
});
```

| Option | Meaning |
| --- | --- |
| `resourceKey` | Required. The page's resource key, public by nature. It travels in the route of the key and verify requests and in the form body of the redeem request |
| `licenceKey` | Optional. A licence key of the same account, server side only. Needed to redeem where the account holds licence keys. Sent only in the body of the redeem request, never in a URL |
| `endpoint` | Optional. The API base including the `/api/v4/` segment. Defaults to the `FOD_CLOUD_API_URL` environment variable, the same variable the cloud request engine honours, then to `https://cloud.51degrees.com/api/v4/`. A value without a trailing slash gains one |
| `fetch` | Optional. The HTTP transport, defaulting to the global `fetch`. Tests inject one |

Every request carries a `User-Agent` naming this package and its version.

Every client method takes either a `FodId` or the identifier's base64 in
either alphabet. A string is read before anything else happens. The client
first turns away an encoded value longer than 4096 characters with a
`DidArgumentError`, which is client policy on the size of input the client
is willing to look at, deliberately generous and unrelated to how long a
51Did is, and it is not a limit of the 51Did format. A string under that
length that does not read as a 51Did is refused with a `DidArgumentError`
naming the read status, and in both cases no key is fetched and no request
is made. A key list that cannot be fetched is a `DidClientError`, never an
invalid signature.

**1. Parse.** The identifier arrives from a page in the URL-safe alphabet and
from the cloud in the standard one. `tryParse` and `fromBase64` take either.

```js
const read = FodId.tryParse(fiftyOneDid);
if (!read.ok) {
  // Answer the page with read.status. Nothing has been fetched.
}
const fodId = read.value;
```

**2. Verify the signature offline.** The client fetches the published signing
public keys from the cloud once, caches them for a day, and picks the key in
force when the identifier was created, being the entry whose start is latest
on or before the identifier's date (a key stays in force until the next one
starts, and keys are published up to three months ahead). Near a period
boundary the neighbouring key is tried as well, and no earlier key is tried.
The envelope version must be the one the cloud signs and the payload at least
the base length for its type.

```js
const valid = await client.verifySignature(fodId);        // boolean
const detail = await client.verifySignatureDetailed(fodId);
// { valid: false, reason: 'nokey' } when no published key covers the date
const keys = await client.publicKeys();     // [{ startsAt: Date, publicKey: PEM }]
const key = await client.publicKeyFor(fodId); // the entry in force, or null
```

`verifySignatureDetailed` answers `{ valid: false, reason: 'signature' }` only
when a candidate key was tried and the signature did not match. A date no
published key covers is `'nokey'`, and a key list that could not be fetched
rejects with a `DidClientError`, so an outage never reads as a forgery.

**3. Verify the signature through the cloud.** The open `verify` endpoint,
one use against the resource key and no licence key needed. A value that does
not read as a 51Did is refused before the request with a `DidArgumentError`
naming the status, and a value the cloud refuses raises `DidArgumentError`
with the cloud's message.

```js
const valid = await client.verify(fodId);   // boolean
```

**4. Redeem a sealed creator context result.** The verify-context and
verify-full endpoints are browser calls, because the creator context describes
the browser's own connection, and they return the verdict only as an encrypted
`result` the browser cannot read or forge. The party that acts on it redeems it
on the server, with the licence key, against the 51Did it knows independently.

```js
const redeemed = await client.redeem(fodId, result, challenge);
redeemed.context      // ContextResult: 'verified', 'mismatch', 'nocontext',
                      // 'notcheckable', 'expired', 'replayed', 'unreadable',
                      // 'unconfirmed'
redeemed.signature    // SignatureResult: 'verified', 'invalid' or 'unknown'
redeemed.factors      // only on a mismatch: { transport, device, browserip,
                      //   connectionip, asn, browser } each 'verified',
                      //   'mismatch' or null where nothing was compared
redeemed.verifiedAt   // Date, on the redeemed and expired outcomes
redeemed.secondsSinceVerified
redeemed.statusCode   // 200, or 503 for 'unconfirmed', which may be retried
redeemed.raw          // the body as received
redeemed.toJSON()     // the cloud's own response shape, for relaying to a page
```

A context string this package does not know maps to `unreadable`, so an
unrecognised outcome is never mistaken for a good one, and `contextRaw` keeps
the string as sent. Every cryptographic failure comes back from the cloud as
the one word `unreadable` by design, a missing licence key included, so the
client does not try to tell them apart either. A value that does not read as
a 51Did is refused before the request with a `DidArgumentError` naming the
status, a cloud that refuses the 51Did raises `DidArgumentError` (HTTP 400),
a host that does not offer the creator context raises `DidNotSupportedError`
(HTTP 404), and any other status raises `DidClientError` carrying
`statusCode` and `body`. A transport failure raises the error `fetch` raised.

## Non-goals

- **No signature verification on read.** Call `verify(publicKeyPem)`,
  `checkSignature(publicKeyPem)` or `DidClient.verifySignature(fodId)` when
  needed (all are asynchronous).
- **No creation of new 51Dids.** Creation is the cloud `json` endpoint through
  the cloud request engine and pipeline, and a page creates from the browser
  because the identifier describes the browser's own connection.
- **No upper bound on the payload.** The lengths of a creator context section
  belong to the cloud.

## Examples

`examples/fodIdExample.js` is the offline reader example described above. The
web demo below calls the 51Degrees cloud, which attaches a creator context to
every 51Did it issues, binding the identifier to the browser and connection it
was created on. The creator context only makes sense from a browser, because
a process verifying its own connection checks itself against itself, so the
demo is a page served by a small server. It needs Node 18 or later for the
built-in `fetch` and depends only on this package, reached by path so the demo
runs against the code beside it.

### Creator context web demo

`examples/creator-context-web/` holds a small demo web app, `server.js`
serving `page.html`, that runs the full 51Did flow the way production does.

1. **Create.** The browser calls the `json` endpoint, which issues a 51Did
   for the browser's connection.
2. **Verify.** The browser calls `verify-full`, the first verification step,
   so the cloud observes the browser's live connection. Both the signature
   outcome and the creator context verdict return only as an encrypted
   `result` that the browser cannot read or forge. (A deployment holding no
   context secret answers in the open instead.) The page then hands the
   encrypted result to its own server.
3. **Redeem.** The server parses the 51Did, checks its signature offline
   against the published public keys, then calls `redeem` with the 51Did, the
   encrypted result and the account's licence key as the second step, and
   receives the signature outcome, the true creator context verdict, when the
   verification happened (`verifiedAt`) and how long ago that was
   (`secondsSinceVerified`).

A fresh `challenge` is issued per page load and bound through both steps by
the cloud. A production server would also remember the value it issued and
reject a redemption carrying any other, which this demo keeps out of scope.

The page carries the licensed probabilistic identifier (`idproblic`) through
verification where the cloud returned it, otherwise the global one
(`idprobglobal`). An account holding no licence keys gets no licensed
identifier at all, and the global one carries the creator context just the
same.

A verdict of `nocontext` is a normal outcome and not an error. A self-hosted
container can be configured not to emit the creator context, so an identifier
it issued redeems as `nocontext`, which the page shows the way it shows any
verdict. Only a transport failure, a status outside 2xx, a body that is not
JSON, or an `errors` answer from the service is a failure, which the page
shows as one naming the status and the start of the body. A 404 from
`verify-full` or `redeem` is different again, because the host answering does
not offer the creator context at all, so the page reports the step as not
supported by this host.

**The part that belongs on your server.** Everything the browser does is in
`page.html`. The one server-side piece is the redeem call, which is where the
licence key is added, and only there, so the browser never sees it. The
`/redeem` route in `server.js` is that piece, and these are its essential
lines, which a developer copies into their own server.

```js
const { FodId, DidClient } = require('fiftyone.pipeline.did');

// Once, at start-up.
const client = new DidClient({ resourceKey, licenceKey });

// In the /redeem route, with 51did, result and challenge from the page.
const read = FodId.tryParse(fiftyOneDid);
if (!read.ok) {
  response.writeHead(400, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    errors: ['51did is not a valid 51Did (' + read.status + ').']
  }));
  return;
}
const fodId = read.value;
const signatureValid = await client.verifySignature(fodId);
const redeemed = await client.redeem(fodId, result, challenge);
const body = redeemed.toJSON();
body.serverSignature = signatureValid ? 'verified' : 'invalid';
response.writeHead(redeemed.statusCode, { 'Content-Type': 'application/json' });
response.end(JSON.stringify(body));
```

The route answers with the cloud's status and a body in the cloud's own shape
(`signature`, `context`, `factors` when present, `verifiedAt`,
`secondsSinceVerified`) built from the typed result, plus `serverSignature`,
the server's own offline check of the identifier's signature. The page ignores
fields it does not know, so `page.html` is the same for every language. A
host without the creator context answers 404 with a text body, which the page
reports as not supported by this host, and an unreachable cloud answers 502
with `{ "error": ... }`.

The creation call requests every 51Did identifier in one request, and the page
shows all six in a table: the probabilistic pair (`IdProbGlobal` and
`IdProbLic`) derived from the connection, the deterministic hashed-email pair
(`IdHemGlobal` and `IdHemLic`) derived from email evidence supplied as
`id.email` (the demo sends `demo@51did.example`, so the pair is the same on
every device that email appears on), and the random pair (`IdRandGlobal` and
`IdRandLic`). Global identifiers are shared across customers, licensed ones are
scoped to the licence key.

```bash
cd examples/creator-context-web
_51DEGREES_RESOURCE_KEY=<resource key> node server.js
```

Then open `http://localhost:5100/`. To demonstrate across two devices, serve
on an address both can reach and open the copied link on the second device.

**The copy-and-paste proof.** Once the 51Did has fully validated, the page
shows a copy-and-paste section with a link carrying the same 51Did, and an
explanation of what will happen next. Open that link in a **different
browser** and the same page loads with the same identifier: the signature
still verifies and the identifier unpacks, because it is genuine, but the
creator context does **not** validate, because the context binds the
identifier to the browser and connection it was created on. That visible
failure is the demonstration that matters, a copied or stolen identifier
caught at presentation with nothing stored server side. Opening the link in
the same browser is not the demonstration, since the same browser presents the
same context and may still verify.

The stylesheet `examples-main.min.css` beside the demo is the design system
build and is refreshed by common-ci's `update-example-assets` step.

### Environment variables

| Variable | Meaning |
| --- | --- |
| `_51DEGREES_RESOURCE_KEY`, then `RESOURCE_KEY` | The resource key. Required. Public by nature, it is what the page carries |
| `_51DEGREES_LICENSE_KEY`, then `LICENSE_KEY` | A licence key of the same account. Optional. Server-side only. Only an account that holds licence keys needs one to redeem, because the licence key is what keeps redemption to the acting party's own servers, and an account holding none has nothing to check against |
| `FOD_CLOUD_API_URL` | Optional. The cloud API base including the `/api/v4/` segment, defaulting to `https://cloud.51degrees.com/api/v4/`. The same variable the cloud request engine and `DidClient` honour, so setting it once points every 51Degrees example at the same place. A host other than `cloud.51degrees.com` would be used to (a) use an on premise web server, or (b) use a privately hosted version of the 51Degrees cloud for performance reasons. This is the private hosting option of the 51Degrees cloud service. Both run the same service, so the examples work unchanged |
| `PORT` | Web demo only. Defaults to `5100` |

### What a run costs

Every call the demo makes to the cloud is one use against the subscription
behind the resource key. Checking a 51Did from the browser makes two,
verify-full from the page and redeem from the server, so a browser-based
context check is two uses every time. Checking only the signature with
`verify` is one use. The public key list the offline check needs is one use
when first fetched and then served from the cache for a day.

## Tests

`npm test` runs the unit tests, which use an injected transport and touch no
network. `tests/didClient.integration.test.js` runs against the live cloud
only when `_51DEGREES_RESOURCE_KEY` (or `RESOURCE_KEY`) is set, and is skipped
otherwise.
