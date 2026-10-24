# Data sources and attribution

## Bundled Anticensority routing data (Firefox)

This extension includes routing data generated from the Anticensority project.
The data is used to provide routing decisions in Firefox.

- **Dataset:** Anticensority hostname routing baseline,
  version `2025.11.11-0448d748`.
- **Upstream project:** [Anticensority](https://github.com/anticensority/runet-censorship-bypass).
  The upstream generated-data README credits `ilyaigpetrov` for the Anticensority PAC.
- **Source:** [the pinned Anticensority PAC](https://raw.githubusercontent.com/anticensority/generated-pac-scripts/0448d748585ce0ed31434097d83b2b18236acbfb/anticensority.pac)
  from `anticensority/generated-pac-scripts` commit
  `0448d748585ce0ed31434097d83b2b18236acbfb`.
- **Upstream generator reference:** [pac-script-generator](https://github.com/anticensority/pac-script-generator/tree/869aad85dce20ace9d44d3a9d694b6ac84baea6a).

The extension's build-time generator extracts static hostname data from that
pinned PAC without executing its JavaScript. Firefox bundles the resulting
declarative `provider/anticensority-hosts-v1.data` and its provenance envelope,
not the PAC program. The data supports provider hostname lookups within the
extension's routing rules; it does not supply a proxy service or establish
proxy availability. A dataset update does not verify connectivity.

The [committed envelope](../../extension/src/firefox/provider/anticensority-hosts-v1.envelope.json)
records the source revisions, input PAC hash and generated artifact identity.
See [provider provenance and generation](../development/FIREFOX_PROVIDER_DATASET.md)
for the source chain, exact hashes and deterministic extraction procedure.
These immutable references describe the bundled snapshot. A runtime refresh
has its own source hash/date and normalized artifact hash; it does not acquire
the pinned commit's identity merely because it comes from the same project.

## Runtime Anticensority source refresh

Firefox can refresh routing data from the fixed
[GitHub Pages source](https://anticensority.github.io/generated-pac-scripts/anticensority.pac)
and [raw GitHub fallback](https://raw.githubusercontent.com/anticensority/generated-pac-scripts/master/anticensority.pac).
The runtime extracts the same bounded static hostname format without executing
downloaded JavaScript. HTTPS provenance, source-date checks and locally computed
hashes are distinct from an author signature; the separate signed update channel
remains unconfigured. The source may contain unchanged older data, and refreshing
it does not verify proxy availability. See the
[update contract](../development/FIREFOX_PROVIDER_DATASET.md#fixed-https-source-updates)
for validation, rollback protection and installation behavior.

Upstream attribution remains applicable to refreshed source data. Runtime
availability, successful validation and HTTPS delivery do not supply a license
grant or resolve the licensing distinction below.

## Licensing scope

The following distinction concerns the pinned upstream revisions above.
The [pinned generated-data repository](https://github.com/anticensority/generated-pac-scripts/tree/0448d748585ce0ed31434097d83b2b18236acbfb)
contains a README and PAC file, with no separate dataset license file or grant
in its README. The upstream generator has an
[Unlicense notice for its software](https://github.com/anticensority/pac-script-generator/blob/869aad85dce20ace9d44d3a9d694b6ac84baea6a/LICENSE);
that is not treated as a license for the generated dataset or all input registries.

This document records attribution and provenance. It does not reproduce a
dataset-specific license grant for the pinned snapshot or treat the generator's
software license as one. Upstream permission and license notices belong with
distribution records separately from these reproducibility hashes and commits.

The existing Firefox distribution attribution is in
[THIRD_PARTY_NOTICES/NOTICE.txt](../../extension/assets/notices/firefox.txt)
(linked to its source file here). It already records this distinction and is
unchanged. Other components' licenses are listed separately in the
[distribution inventory](../../extension/assets/README.md).
