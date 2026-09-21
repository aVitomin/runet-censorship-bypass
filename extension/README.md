# Chromium and Firefox MV3 tooling

This directory contains the maintained Chromium MV3 and Firefox MV3 sources,
tests, and build tooling. MV2 is historical and is not built from current
`main`. The historical `extensions/chromium` parent does not limit ownership to
Chromium; both targets share this tooling package and its lockfile.

Canonical instructions are maintained at repository level:

- [Product README](../../../README.md)
- [Development setup](../../../docs/development/DEVELOPMENT.md)
- [Architecture](../../../docs/development/ARCHITECTURE.md)
- [Testing](../../../docs/development/TESTING.md)
- [Release process](../../../docs/development/RELEASE_PROCESS.md)

The Chromium runtime is `src/extension-chromium-mv3` with output
`build/extension-chromium-mv3`. The Firefox runtime is
`src/extension-firefox-mv3` with output `build/extension-firefox-mv3`. There is
no root npm package; scope dependency and script commands to this tooling
directory.
