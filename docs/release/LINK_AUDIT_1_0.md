# Public-link audit — 1.0 publication drafts

Checked 2026-09-26. Scope: the public project, documentation, support, privacy,
security and official store-guidance links used by this publication set.
Historical/upstream attribution in `docs/legacy/` is not rewritten.

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

The [new privacy draft](PRIVACY_1_0.md) and other documents in this directory
are validated repository-relative targets in this PR. Their future main URLs
do not exist until merge. Do not give stores a draft-branch URL or claim that
a not-yet-published policy is live. After merge and final policy approval,
verify the canonical URL specified in the
[publication checklist](STORE_PUBLICATION_CHECKLIST.md) without authentication.
The currently published privacy page is not a substitute for that review.

No 1.0 release, AMO listing or Chrome listing URL is invented in these drafts.
Record actual public listing URLs only after authorized publication.

## Official guidance

The Mozilla listing/consent/submission pages and Chrome listing/privacy,
description-limit, proxy-API and MV3-policy pages linked from these drafts were
retrieved over HTTPS. They are external requirements, not publisher identities.
Store rules and dashboard fields may change; recheck them before submission.
The search service was unavailable, so official pages were read directly.

All project/support/privacy/security hyperlinks in the new publication copy
use the current fork. Literal upstream PAC host permissions in the
[manifest audit](PERMISSIONS_AND_PRIVACY_1_0.md#host-permissions--every-literal-entry)
describe existing runtime sources, not obsolete support/store URLs. They were
not changed or advertised as controlled by this fork.
