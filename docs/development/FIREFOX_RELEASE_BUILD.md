# Firefox release candidate build

Firefox follows the repository release train. Both targets use the complete
version from `extension/src/templates-data.js`; the Chromium manifest template
uses `storeVersion` without an added prefix. The prepared source version is `1.0.1`;
the latest published release is `1.0.0`. Source version and local artifacts do not establish store approval.
See the [channel status](../release/STORE_PUBLICATION_CHECKLIST.md#current-channel-status).
Update the shared version and maintained manifests through the release process,
without introducing an independent Firefox-only version.

The immutable Firefox Gecko ID is
`{adf5f697-1149-42a2-92eb-c163cb9a4146}`. It is a newly generated UUIDv4 for
this Firefox product and is not a legacy AMO identity. Do not change it in
later releases.

## Reproducible local build

Use Node.js 22 and a clean checkout. From the repository root:

```powershell
$Project = '.\extension'
npm ci --prefix $Project
node .\scripts\verify-docs.mjs
node .\scripts\verify-supply-chain.mjs
npm --prefix $Project run verify:firefox
npm --prefix $Project run release:firefox
```

`release:firefox` performs two independent Firefox builds, runs the exact
package allowlist/integrity verifier after each build, and compares both
release sets byte for byte. It refuses a dirty tracked tree and refuses to
overwrite an existing release output. It then writes:

- `extension/dist/firefox-release/runet-censorship-bypass-firefox-1.0.1.xpi` — unsigned
  release candidate with `manifest.json` at archive root;
- the matching `.xpi.sha256` file;
- `runet-censorship-bypass-firefox-1.0.1-source.zip` — all tracked source
  files needed for review and reproduction, under one versioned root;
- the matching source-archive `.sha256` file.

Both archives use sorted entries, fixed ZIP timestamps, fixed file modes and
the stored ZIP method. No generated profile, dependency directory, log,
credential, signing key or local file is included. The source archive includes
the exact `package-lock.json`; dependencies are restored only through npm.
The large provider table is named `anticensority-hosts-v1.data` so Mozilla's
source-code linter does not parse a declarative 11.6 MiB artifact as source.
Its bytes are JSON-compatible, human-reviewable and verified against the
committed byte count and SHA-256 before the extension constructs an index.

The unsigned XPI is a local/reviewer artifact, not a public release. Install it
temporarily in Firefox 140 or later through `about:debugging`, Marionette, or a pinned
`web-ext` development command. Normal end-user installation requires Mozilla
signing, which is outside the local build and requires a separate submission.
The minimum is calculated from required APIs; it does not mean every version
was tested. See [compatibility and actual QA](BROWSER_COMPATIBILITY.md).

## Mozilla validation

Audit the exact release candidate with a reviewed, pinned Mozilla
`addons-linter` version and record that version with the results. Recheck its
source, integrity and dependency advisories at the release stage. The following
reference invocation is not evidence of completed validation:

```powershell
npx --yes --ignore-scripts addons-linter@10.10.0 `
  "$Project\dist\firefox-release\runet-censorship-bypass-firefox-1.0.1.xpi"
```

This command is an explicit release audit tool invocation; it is not a project
dependency and does not change `package.json` or `package-lock.json`.

Trusted-main CI builds the same deterministic release set for the exact main
SHA. Pull requests build and verify the package once but neither pay the
release-only reproducibility cost nor upload artifacts. Only a successful
trusted-main push or an explicitly dispatched workflow on exact `main` builds
and uploads the unsigned XPI, checksums and reviewer source archive. AMO
submission and signing remain manual future release actions.
