# Public-link audit — 1.0 publication drafts

Checked 2026-09-26. Scope: the public project, documentation, support, privacy,
security and official store-guidance links used by this publication set.
This dated record does not establish current URL availability.
Historical/upstream attribution in `docs/legacy/` is not rewritten.

## Revived preparation — 2026-10-28

The following is the current link set for the next branding update. Public
Chrome listing HTML and the Mozilla API still show the 1.0.0 names. Their
homepage/support links already point to this fork; Chrome also links the
1.0 privacy notice below. Renaming the product does not require moving these URLs.

| Field | URL to retain |
| --- | --- |
| Homepage / source | [repository](https://github.com/aVitomin/runet-censorship-bypass) |
| Support | [issue forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose) |
| Privacy for the current 1.0 behavior | [privacy notice](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md) |
| Downloads | [installation](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/INSTALLATION.md) |
| Chrome Web Store | [existing item](https://chromewebstore.google.com/detail/poohkdbmgajmcifcaijdjgiihghlgbph) |
| Firefox Add-ons | [existing item](https://addons.mozilla.org/ru/firefox/addon/runet-censorship-bypass-mv3/) |

The prepared manifests identify aVitomin as the fork maintainer and link the
same repository. Original authorship and license notices remain intact.
At release, recheck the live cards and the exact release's privacy notice;
change links only if their destinations actually change. Do not insert an
unpublished news-issue URL or alter the Chrome/Firefox installation identifiers.

The remaining sections are the original dated audit, not a current status report.

## Fork-owned public destinations

| Purpose | Canonical link | Observed result |
| --- | --- | --- |
| Repository / homepage | [aVitomin/runet-censorship-bypass](https://github.com/aVitomin/runet-censorship-bypass) | HTTP 200, correct repository. |
| Published documentation index | [docs on main](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/README.md) | HTTP 200, correct path. |
| Unreleased workflow guide | [1.0 preparation](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/development/UPCOMING_1_0_USER_GUIDE.md) | HTTP 200; explicitly not a published release. |
| Ordinary support | [issue forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose) | HTTP 200 after expected GitHub sign-in redirect. |
| Contact-only fallback | [bug-report form](https://github.com/aVitomin/runet-censorship-bypass/issues/new?template=bug_report.yml) | HTTP 200 after expected sign-in redirect; use SECURITY.md instructions, no secrets. |
| Published-release privacy | [privacy/security](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/PRIVACY_AND_SECURITY.md) | HTTP 200; describes published 0.0.4.0, not the complete unreleased transfer workflow. |
| Security policy | [SECURITY.md](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SECURITY.md) | HTTP 200. |
| Private vulnerability reports | [private report form](https://github.com/aVitomin/runet-censorship-bypass/security/advisories/new) | HTTP 200 after expected sign-in redirect. GitHub's repository API separately reports private vulnerability reporting enabled. |

Reachability of a sign-in page is not a claim that a form was submitted or
fully exercised while authenticated. No issues/advisories were created.
The publisher should check the signed-in forms before publication.

## New privacy/documentation URLs

Before submission, verify that the [privacy notice](PRIVACY_1_0.md) and other
required documents are available at their canonical main URLs without
authentication. Use the URL in the
[publication checklist](STORE_PUBLICATION_CHECKLIST.md), not a draft-branch URL.
Repository-relative validation and this historical link record do not prove
that the final published policy is reachable or covers the selected release.

No 1.0 release, AMO listing or Chrome listing URL is invented in these drafts.
Record actual public listing URLs only after authorized publication.

## Official guidance

The Mozilla listing/consent/submission pages and Chrome listing/privacy,
description-limit, proxy-API and MV3-policy pages linked from these drafts were
retrieved over HTTPS. They are external requirements, not publisher identities.
Store rules and dashboard fields may change; recheck them before submission.

All project/support/privacy/security hyperlinks in the new publication copy
use the current fork. Literal upstream PAC host permissions in the
[manifest audit](PERMISSIONS_AND_PRIVACY_1_0.md#host-permissions--every-literal-entry)
describe existing runtime sources, not obsolete support/store URLs. They were
not changed or advertised as controlled by this fork.
