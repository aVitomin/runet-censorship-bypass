# Firefox production provider dataset

The Firefox target packages one declarative Anticensority hostname baseline.
It contains no PAC program and no executable provider content. A clean install
verifies and stores the baseline plus its default routing configuration, then
remains `OFF` until the explicit Apply RPC is invoked.

For upstream attribution and the unresolved dataset-licensing distinction,
see [Data sources and attribution](../legal/DATA_SOURCES.md). Generator
licensing is not inferred to cover its output or every input registry.

## Pinned source and deterministic generation

The packaged snapshot was generated from:

- `anticensority/generated-pac-scripts`, branch `master`, commit
  `0448d748585ce0ed31434097d83b2b18236acbfb`;
- `anticensority.pac`, 11,642,139 bytes, SHA-256
  `47334452e4075e1be3e20dca842a9ee62f694ae5404dfc3c154b3de8215ba4f5`;
- `anticensority/pac-script-generator`, branch `golang`, commit
  `869aad85dce20ace9d44d3a9d694b6ac84baea6a`.

The source chain also references `zapret-info/z-i` commit
`9133e4327bbcf9adc1cba24360f50e50a6b4d11c`, SourceForge `zapret-info/code`
SVN revision `r47371`, `ValdikSS/antizapret` commit
`482d68035b3b8461bc404f64ad0c02b8e8b88d1b`, and the live Rublacklist registry
API described by the upstream generator. The generated PAC commit and exact PAC
hash are the reproducibility boundary because the historical API response is
not independently versioned.

Run the checked-in generator from the repository root with the immutable raw
GitHub URL, the two expected commits, and the expected PAC SHA-256. The tool
allows only HTTPS without credentials, bounds redirects and bytes, decodes
strict UTF-8, validates the known proxy policy, parses only the static `inputs`
JSON literal, and never evaluates PAC JavaScript. It rejects non-empty IP/CIDR
tables because `HOST_BUCKETS_V1` represents hostname suffix rules only.

The resulting packaged artifact has:

- dataset version `2025.11.11-0448d748`;
- 662,819 `PROVIDER_PROXY` rules in 80 fixed-width buckets;
- 11,642,895 exact artifact bytes;
- SHA-256
  `4a779826cf70ad5a524f4483bb6aa7a5f5bca19626b32ad8b2597f1a403c0795`.

Two generations from the same pinned PAC produce identical artifact and
envelope bytes. Its 80 fixed-width host strings are byte-for-byte identical to
the previously audited 11,639,379-byte experimental `HOSTNAMES` representation;
the production artifact is larger only because every bucket now carries the
strict `width` and `routeRef` schema fields. The generator can also produce the
updater's strict manifest
and, when given an explicitly selected external Ed25519 private key, its
detached signature. No private key, signed-manifest production URL, or production
public key is committed. This separate signed channel remains disabled until
a fixed HTTPS manifest endpoint and raw Ed25519 public key/stable keyId are
supplied. It accepts trust anchors only through its pinned production-key table.
The enabled fixed HTTPS source channel described below uses a distinct trust
label and does not imply a publisher signature.

For a signed publication, pass explicit monotonically increasing `--sequence`,
stable `--key-id` and an external `--private-key` PKCS#8 PEM path to the same
generator command. Signing refuses omitted sequence/key metadata; the key is
read only for the detached signature and is never copied or printed. The
deterministic outputs are:

- `anticensority-hosts-v1.data`;
- `anticensority-hosts-v1.envelope.json`;
- `anticensority-hosts-v1.manifest.json` with fixed field order, two-space JSON
  indentation and one final LF;
- `anticensority-hosts-v1.manifest.json.sig` containing exactly 64 bytes.

Example from the repository root (the key and output stay outside tracked
source):

```powershell
$Project = '.\extension'
node "$Project\src\tooling\firefox-provider\generate-provider-dataset.js" `
  --source-url 'https://raw.githubusercontent.com/anticensority/generated-pac-scripts/0448d748585ce0ed31434097d83b2b18236acbfb/anticensority.pac' `
  --source-sha256 '47334452e4075e1be3e20dca842a9ee62f694ae5404dfc3c154b3de8215ba4f5' `
  --source-revision '0448d748585ce0ed31434097d83b2b18236acbfb' `
  --generator-revision '869aad85dce20ace9d44d3a9d694b6ac84baea6a' `
  --dataset-version '<public-version>' --sequence '<monotonic-integer>' `
  --key-id '<pinned-key-id>' --private-key '<external-pkcs8-pem>' `
  --output-directory '.local\firefox-provider-publication'
```

Publish all four files at the same HTTPS origin. The manifest `artifactPath` is
relative; signature and artifact redirects are restricted to HTTPS and that
same origin. Key rotation is extension-controlled: multiple keyIds may coexist
in the pinned table, a remote manifest cannot add one, and removing an old key
requires a new extension release.

## Routing policy

The default provider chain preserves the PAC order:

1. HTTPS `localhost:18611`
2. HTTP `localhost:18613`
3. SOCKS5 `localhost:18615`
4. SOCKS4 `localhost:18617`
5. generic PAC SOCKS `localhost:18619`, represented as SOCKS4
6. SOCKS5 Tor Browser `localhost:9150`
7. SOCKS5 local Tor `localhost:9050`

Firefox 154.0.1 wire-level tests showed that PAC `SOCKS` negotiates SOCKS4,
whereas Firefox `ProxyInfo` type `socks` negotiates SOCKS5 even with
`proxyDNS:false`. The production adapter therefore uses `SOCKS4` for the legacy
generic token.

Provider matches retain the complete ordered chain. Chromium's terminal Direct
fallback is intentionally stripped by the Firefox adapter, so exhaustion fails
closed. Provider misses and explicit Direct still use Firefox's true top-level
`null` Direct primitive. Onion routing uses the shared product order of local
Tor and then Tor Browser. Own-proxy and WARP groups remain part of the common
routing configuration schema but are disabled in this initial default config.

## Bootstrap and trust boundary

`PACKAGED_TRUSTED` is assigned only while reading the fixed extension-package
artifact. Bootstrap first keeps a verified default Saved configuration available
so a missing provider database does not prevent choosing manual mode. Exact
artifact bytes must pass the common verifier before the IndexedDB baseline
pointer and subsequent readiness marker are committed. Existing configuration
is never overwritten. Anticensority Apply and durable recovery still reverify
the exact stored artifact before publishing `READY`.

Within one `loadVerifications` call, active, previous-LKG and packaged-baseline
references to the same successfully verified immutable artifact share one read,
hash and parsed dataset. The shared verification is deeply frozen before reuse.
The map belongs only to that call: subsequent loads and event-page recreation
reread pointers and reverify stored bytes, metadata and trust. Failures are not
cached, preserving role-specific diagnostics and retries after read errors.
The `firstUsableOnly` path still stops at the first successful verification.
Deterministic store tests count one artifact read/hash instead of three when
all three references coincide, and two when they name two distinct artifacts;
neither path writes storage. This is operation-count evidence, not a measured
browser startup speedup; distinct artifacts still require separate verification.

When a later extension release bundles dataset B, registration preserves the
previous verified baseline A in the existing active pointer if A was the selected
dataset. That reference and B's baseline are committed in one IndexedDB
transaction; existing active/LKG selections take precedence and are not replaced.
Existing profiles continue using A, including after restart, without changing
Saved/Effective revisions, credentials, or proxy ownership. Pending Saved edits
stay pending. Fresh profiles use B and remain OFF. This compatibility step does
not automatically promote B for existing profiles. Missing, invalid, or untrusted
A cannot be replaced by guessing B during exact recovery: the existing blocked
recovery requires user action and retains the owned protection floor.
Release-default revision zero remains readable across a version-label change
only when its verified routing content/key is identical and it has no credentials.

The bootstrap performs no external request: its only reads use
`browser.runtime.getURL()` for fixed package paths. It does not set proxy
settings or activate routing. Remote checks are separate manual or scheduled
operations; only the signed-manifest configuration remains disabled.

The Firefox settings control plane can save the user-routing portion of the
configuration while `OFF` or active `READY`. Save does not change Effective;
explicit Apply promotes the exact Saved revision. The strict source choice is
`anticensority` or `manual`; omitted legacy values retain Anticensority. Arbitrary
provider keys, artifact identities, candidates and trust are not RPC input.
Selecting manual writes its package-owned policy identity to Saved only; it does
not stage or promote a provider artifact. The manual runtime needs no dataset
read or index, but bootstrap may still attempt to validate the provider cache.

In manual mode, own rules, onion routes, candidate groups and routing flags
remain active; under default flags, unmatched sites use Direct. Scheduled and
manual source checks continue independently. If Saved or Effective selects
manual, Anticensority installation is deferred and the candidate stays staged
without switching either source or recording an installation. Returning to
Anticensority uses explicit Save/Apply before normal provider promotion resumes.

## Fixed HTTPS source updates

The production source channel starts from exactly two Anticensority URLs:

- [primary GitHub Pages PAC](https://anticensority.github.io/generated-pac-scripts/anticensority.pac);
- [raw GitHub fallback PAC](https://raw.githubusercontent.com/anticensority/generated-pac-scripts/master/anticensority.pac).

These URLs are compiled into the downloader; RPC callers cannot supply a URL,
key, trust label or artifact. A fetch/HTTP failure can try the fallback. Invalid
data, an unsafe redirect or an expired deadline does not silently switch sources.
Requests omit credentials and referrer and accept at most three manual redirects.
Every redirect target must be one of these exact two HTTPS URLs, without URL
userinfo, query or fragment; crossing between the two listed sources is allowed.
The final response URL must also be one of the two and match the validated
request. Streaming input is
bounded to 16 MiB under a 30-second total network/parse deadline.

The parser accepts strict UTF-8 and extracts only the known static `inputs` JSON.
It requires the expected proxy-policy constants, empty IP/CIDR tables and one
valid `Updated: YYYY-MM-DD HH:mm:ss ±HHMM` timestamp. Invalid calendar dates and
source dates more than 24 hours ahead of the local clock are rejected. The
shared dataset verifier limits output to 16 MiB, 750,000 rules and 128 buckets.
No downloaded JavaScript is evaluated or installed as executable code.

SHA-256 is computed locally for both source bytes and the exact normalized
`HOST_BUCKETS_V1` artifact. The store binds the source ID/hash/date to the immutable
artifact as `REMOTE_HTTPS_VALIDATED`. The envelope must name exactly that source
ID and `sha256=<source hash>` revision; a contradictory stored envelope or receipt
is rejected. This means HTTPS provenance and strict local
data checks, not `REMOTE_AUTHENTICATED` or an author's cryptographic signature.
The source's operators can change its data; locally computed hashes do not
authenticate authorship. A configured signed channel takes precedence, and an
invalid signed configuration never falls back to this channel.

Pointer schema v3 adds a typed staged channel, an exact HTTPS candidate receipt
with a local sequence, and a separate source-date/content floor. It preserves
v1/v2 active/LKG/baseline identities and the signed channel's authenticated
high-water mark. The source floor starts at the verified packaged baseline:
older dates are rejected, and equal dates with different routing content conflict.
A later observation of identical selected routing content is `UNCHANGED`; it
may advance the date floor but does not overwrite or relabel packaged bytes.
An old artifact that is no longer selected cannot be replayed as a fresh update.
Changed comments/source hashes alone do not force a new routing generation.
There is no age-based expiry: a valid unchanged source may still be old.
The UI therefore separates source-data time from the time of the latest check.

The no-input `firefox.provider.update.check` RPC and the 12-hour alarm run the
same serialized check-and-promotion operation. The first alarm is scheduled
five minutes after initialization when no matching alarm exists. A verified
candidate is installed when the runtime is fully `OFF` or active `READY` and live
ownership permits it and neither Saved nor Effective selects manual;
blocked/external-owner or manual-source cases retain the candidate for later.
The separate no-input install RPC can apply that exact staged candidate.

OFF installation updates dataset selection for the next explicit Apply and never
acquires proxy control. Active installation prepares the replacement with
Effective user settings and credentials, rechecks private access, ownership and
candidate identity, then replaces the generation without Clear or an OFF interval.
Pending Saved changes stay pending. Signed journal versions 1/2 remain readable;
HTTPS versions 3/4 add the exact channel and source receipt. OFF recovery resolves
the cross-store selection; active recovery uses durable ON as the commit decision.
Ambiguity blocks recovery rather than selecting latest Saved. See
[active installation and recovery](FIREFOX_ARCHITECTURE.md) for the transaction.
