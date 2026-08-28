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
via the `51Degrees/owid-js` fork as a git submodule and a `file:` dependency
(switch to the npm registry once published). owid-js is parse + verify only and
exposes no instance `asBase64`, so `FodId` **composes** an owid instance, keeps
the original base64 for `asBase64()`, and delegates the rest.

The fork was extended with an offline `verifyWithPublicKey(pem, others)` that
works in Node and the browser (Web Crypto), so `FodId.verify()` runs without
contacting a network endpoint.

## Install / build

```bash
git submodule update --init   # fetches owid-js into ../owid-js
npm install
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

## Examples

`examples/fodIdExample.js` is the offline reader example described above. The
web demo below calls the 51Degrees cloud, which attaches a creator context to
every 51Did it issues, binding the identifier to the browser and connection it
was created on. The creator context only makes sense from a browser, because
a process verifying its own connection checks itself against itself, so the
demo is a page served by a small server. It needs Node 18 or later for the
built-in `fetch` and has no dependencies.

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
3. **Redeem.** The server calls `redeem` with the 51Did, the encrypted result
   and the account's licence key as the second step, and receives the
   signature outcome, the true creator context verdict, when the verification
   happened (`verifiedAt`) and how long ago that was (`secondsSinceVerified`).

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
not offer the creator context at all, so the page reports the step as not supported by this
host.

**The part that belongs on your server.** Everything the browser does is in
`page.html`. The one server-side piece is the redeem call, which is where the
licence key is added, and only there, so the browser never sees it. The
`/redeem` route in `server.js` is that piece, and these are its essential
lines, which a developer copies into their own server.

```js
const upstream = new URL(base + 'id/redeem/' + resource);
upstream.searchParams.set('51did', url.searchParams.get('51did') || '');
upstream.searchParams.set('result', url.searchParams.get('result') || '');
upstream.searchParams.set(
  'challenge', url.searchParams.get('challenge') || '');
upstream.searchParams.set('license', licence);
const redeemed = await fetch(upstream, {
  headers: { 'User-Agent': '51did-demo-node' }
});
response.writeHead(redeemed.status, {
  'Content-Type': redeemed.headers.get('content-type') || 'text/plain'
});
response.end(await redeemed.text());
```

The route relays the cloud's status code, content type and body exactly as
received, so a failure reads on the page as what the cloud said, and a
`nocontext` verdict shows as a verdict.

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
| `FOD_CLOUD_API_URL` | Optional. The cloud API base including the `/api/v4/` segment, defaulting to `https://cloud.51degrees.com/api/v4/`. The same variable the cloud request engine honours, so setting it once points every 51Degrees example at the same place. A host other than `cloud.51degrees.com` would be used to (a) use an on premise web server, or (b) use a privately hosted version of the 51Degrees cloud for performance reasons. This is the private hosting option of the 51Degrees cloud service. Both run the same service, so the examples work unchanged |
| `PORT` | Web demo only. Defaults to `5100` |

### What a run costs

Every call the demo makes to the cloud is one use against the subscription
behind the resource key. Checking a 51Did from the browser makes two,
verify-full from the page and redeem from the server, so a browser-based
context check is two uses every time. Checking only the signature with
`verify` is one use.
