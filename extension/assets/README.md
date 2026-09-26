# Distribution licenses and asset attribution

## Installable inventory

The baseline Chromium ZIP and Firefox XPI from trusted-main commit
`4c274ee521571471d044157bbe7ac7f211d32ada` each contain 71 files.
This notice-only packaging change adds five files to Chromium and three to
Firefox; the existing files must remain byte-identical.

| Material / packaged location | Browser | Source and license | Required distribution notice |
| --- | --- | --- | --- |
| Project code, HTML, CSS, locales; legacy `pages/lib/keep-links-clickable.js` (Chromium only) | Both | This fork and Anticensority project contributors; repository GPLv3 | Root `LICENSE`, copied from the [repository license](../../LICENSE), and target attribution |
| Generated `icons/action-*.png` | Both | Repository [icon generator](../src/chromium/test/generate-action-icons.js); project GPLv3 | Root `LICENSE`; no third-party icon pack is copied |
| `background/vendor/tldts/dist/index.umd.min.js`, including tldts-core | Both | [tldts 7.4.8](https://github.com/remusao/tldts/tree/v7.4.8); MIT, Thomas Parisot and Rémi Berson | Existing `background/vendor/tldts/LICENSE`; retain without duplicating it |
| Public Suffix List data compiled into tldts | Both | [Pinned PSL source](https://raw.githubusercontent.com/publicsuffix/list/b9a86cf0cd115f1e60b5815533f3fcfd2f9e8f4b/public_suffix_list.dat); MPL-2.0 | `THIRD_PARTY_NOTICES/MPL-2.0.txt`, Exhibit A notice and source-form URL in target attribution |
| `pages/lib/fonts/emoji.woff` | Chromium | [Emoji icon font](https://github.com/jslegers/emoji-icon-font); MIT, John Slegers (2014) | `THIRD_PARTY_NOTICES/EMOJI-MIT.txt` and source attribution |
| `pages/lib/chrome-style/index.css`, `check.png` | Chromium | Chromium-derived stylesheet and image; BSD-3-Clause | `THIRD_PARTY_NOTICES/CHROMIUM-BSD-3-CLAUSE.txt`; retain stylesheet header and source attribution |
| `provider/anticensority-hosts-v1.data` and envelope | Firefox | Generated hostname data; [documented provenance](../../docs/development/FIREFOX_PROVIDER_DATASET.md) | Attribution and pinned input source in target notice; separate data-license determination remains open (below) |

The packaged attribution file is `THIRD_PARTY_NOTICES/NOTICE.txt`, selected
from the [Chromium notice](notices/chromium.txt) or
[Firefox notice](notices/firefox.txt).

Build/test-only npm packages, downloaded PAC bodies, archived SVG authoring
sources, store screenshots and branding exports are not installable inputs.
Firefox does not package the Chromium compatibility font or stylesheet.
The Firefox reviewer source archive is separate from the installed XPI.

## Notice provenance

### Emoji icon font

The shipped font and the
[archived SVG authoring sources](../../docs/legacy/assets/icon-font-sources/)
were introduced together in legacy commit
`653d415bee3200364d396cc65b0b0896d85dbc6d`.
The [MIT text](licenses/EMOJI-MIT.txt) retains the copyright and permission
notice published in the
[upstream README](https://github.com/jslegers/emoji-icon-font/blob/master/README.md).
That README also credits Icomoon, Wikimedia and Open Sans inputs; the packaged
attribution preserves those credits without asserting an additional license
grant for them.

### Chromium stylesheet and image

The local stylesheet is adapted from Chromium's
[extension.css](https://github.com/chromium/chromium/blob/58.0.3029.110/extensions/renderer/resources/extension.css).
The 161-byte `check.png` matches Chromium's
[image at that revision](https://github.com/chromium/chromium/blob/58.0.3029.110/ui/webui/resources/images/check.png).
The local import is recorded in commit
`51cd8095d35b2f7dd956c873cdd5318495d55d67`.

The packaged [BSD text](licenses/CHROMIUM-BSD-3-CLAUSE.txt) comes from the
[historical Chromium LICENSE](https://github.com/chromium/chromium/blob/58.0.3029.110/LICENSE),
including its original copyright and disclaimer. The existing stylesheet
copyright header and `links.txt` are retained.

### Public Suffix List and tldts

The tldts `v7.4.8` publicsuffix submodule pins
`b9a86cf0cd115f1e60b5815533f3fcfd2f9e8f4b`.
The packaged [MPL text](licenses/MPL-2.0.txt) is from that revision's
[LICENSE](https://github.com/publicsuffix/list/blob/b9a86cf0cd115f1e60b5815533f3fcfd2f9e8f4b/LICENSE).
Trailing whitespace is normalized; legal text is unchanged.
Each target notice preserves the PSL license notice and provides the pinned
source form for the data compiled into the library.
The MIT license for tldts/tldts-core continues to come from the installed,
lockfile-pinned package, with one copy per browser distribution.

## Dataset licensing decision remains open

The [pinned generated-data repository](https://github.com/anticensority/generated-pac-scripts/tree/0448d748585ce0ed31434097d83b2b18236acbfb)
contains the PAC input and README but no explicit data license.
The [generator's Unlicense](https://github.com/anticensority/pac-script-generator/blob/869aad85dce20ace9d44d3a9d694b6ac84baea6a/LICENSE)
covers that generator's code; this change does not assume it grants rights
to every input dataset. Neither generator code nor PAC JavaScript is included
in the Firefox XPI.

This change records the dataset's provenance, not a new license grant.
Before claiming full release-compliance clearance, the maintainer must record
upstream permission or a supported data-licensing determination. No provider,
dataset bytes or trust behavior is changed here.

## Packaging and verification

[The notice inventory](../src/tooling/distribution-notices.js) explicitly lists
each copied file. Gulp does not copy the entire assets or documentation tree.
The existing browser package gates require regular, nonempty, source-identical
license files, including the already-bundled tldts license. The notice directory
rejects unexpected files, and the Firefox exact-file allowlist remains enforced.

Deterministic tests cover both browser inventories, ZIP preservation, missing,
empty, truncated or substituted notices, and unexpected QA material. Browser
package-gate tests prove the checks are integrated into both builds.

From the repository root, run `npm --prefix ./extension run verify`,
`node ./scripts/verify-docs.mjs` and `git diff --check`. Compare both package
trees against the trusted baseline: only the explicitly listed license and
attribution files may be added; no existing packaged bytes may change.
