# Chromium and Firefox extension tooling

This is the only npm root. Both supported browsers use Manifest V3 and share
this tooling package and lockfile, not one runtime implementation.

Canonical instructions are maintained at repository level:

- [Product README](../README.md)
- [Development setup](../docs/development/DEVELOPMENT.md)
- [Architecture](../docs/development/ARCHITECTURE.md)
- [Testing](../docs/development/TESTING.md)
- [Release process](../docs/development/RELEASE_PROCESS.md)

The Chromium runtime is `src/chromium` with output
`build/chromium`. The Firefox runtime is
`src/firefox` with output `build/firefox`. There is
no root npm package; scope dependency and script commands to this tooling
directory.

`src/shared` contains browser-neutral modules with explicit per-target copy
rules. `src/tooling` is never packaged. `src/chromium-compat` preserves five
Chromium-only compatibility files at their existing packaged `pages/lib` paths;
it is not shared Firefox code. Icons under `src/chromium/icons` are used by both
targets. Historical MV2 sources are not a maintained build target.
