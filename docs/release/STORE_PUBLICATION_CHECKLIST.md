# Store publication checklist — planned 1.0

**Unexecuted publication plan.** Firefox Add-ons is primary; Chrome Web Store
submission is optional. This documentation task grants no permission to bump
versions, sign, tag, create releases, upload or submit store packages. Obtain
separate maintainer authorization for those actions.

Prepared against `8361608fa4ac52cc118cf5e6d32b3feb8772d167`. Current manifests
still identify `0.0.4.0`; do not upload them as a new “1.0” release based on this
document alone. Record the final approved version, exact main SHA, browser QA,
trusted-main run, artifact names and SHA-256 in the release record.

## Before any upload

- [ ] Agree on the supported browsers/platforms, release version, channels and
  publisher identities. Review any localized listing copy against English.
- [ ] Approve and make any required version/localized manifest-description
  changes in a separate release task. Verify version authority, both built
  manifests, immutable Firefox Gecko ID, minimum versions and all locale text.
- [ ] Use a clean exact validated main commit and the current
  [release process](../development/RELEASE_PROCESS.md). For that separate release
  task, install pinned dependencies from the extension npm root, run required
  supply-chain/aggregate gates, and build both packages. Local preflight commands
  include `npm --prefix $Project run verify`, `release:chromium` and
  `release:firefox`, with `$Project = '.\extension'` set at repository root.
  These commands are instructions only here, not executed validation evidence.
- [ ] Require all trusted-main CI jobs, including Verify MV3 and canonical
  artifact uploads, to succeed for that exact SHA. Use canonical artifacts from
  that run; do not substitute an independently rebuilt package or PR artifact.
- [ ] Check deterministic rebuild evidence, archive root manifests, version,
  package allowlists, licenses, checksums and Firefox reviewer-source archive.
  Run the pinned Mozilla validator on the exact XPI as required by the release
  process. No docs, screenshots, profiles, logs, tests or secrets in packages.
- [ ] Verify icons at packaged sizes and store-specific upload sizes. Confirm
  branding/publisher identity without implying affiliation with old upstream
  listings or claiming a verified homepage domain the publisher does not own.
- [ ] Verify [screenshots and provenance](../assets/store/README.md) against the
  final package: truthful state, readable text, correct dimensions, no private
  data. Firefox native popup: **manual pre-release capture required**. Resolve
  the mixed-language native file-input label if required for the chosen locale.
- [ ] Repeat reviewer/browser QA on the exact candidate: clean off, private
  access, modes/scope, Save/Apply, pending categories, imports, auth, recovery,
  updates and ownership loss. Old screenshot QA is not complete release QA.
- [ ] Compare every built permission and data declaration to the
  [audit](PERMISSIONS_AND_PRIVACY_1_0.md). Do not copy explanations for absent
  permissions or silently broaden grants.
- [ ] Approve the [privacy notice](PRIVACY_1_0.md) against actual network/storage
  behavior. Distinguish local settings from proxy/source/check transmissions;
  preserve sensitive-export warnings and no-password/support-export claims.
- [ ] Publish the approved privacy notice on main and verify it is reachable
  without sign-in before entering a store privacy URL. Planned canonical URL:
  `https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md`.
  It is a future URL until this document set is merged, not a verified live
  policy during draft preparation.
- [ ] Recheck repository, documentation, support, privacy and security links
  using the [public-link audit](LINK_AUDIT_1_0.md). Verify support/private-report
  forms in the maintainer account; no report needs to be submitted as a test.
- [ ] Recheck current store requirements. Review
  [Mozilla submission guidance](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
  and [Chrome listing guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/).

## Firefox Add-ons — primary

- [ ] Sign in to the authorized publisher account. Confirm whether to create
  this fork's listed entry or update its existing legitimate entry; preserve
  its Gecko ID. Do not reuse an upstream add-on/store identity.
- [ ] Upload the exact validated unsigned XPI and requested reviewer-source
  archive. Check validation findings and provide reproducible build instructions.
  Keep credentials outside the repository/CI; signing is performed through
  Mozilla, not by this documentation workflow.
- [ ] Enter the [Firefox listing](FIREFOX_AMO_LISTING_1_0.md): title, summary,
  description, category, natural tags, homepage and support. Review locales and
  supported desktop platforms; do not infer Android support from MV3 support.
- [ ] Supply the approved privacy policy and confirm `authenticationInfo` and
  `browsingActivity` disclosures. “No telemetry” is not “no data transmitted.”
- [ ] Upload reviewed Firefox screenshots and icon with accurate captions.
  Do not describe a standalone popup page as a native popup.
- [ ] Attach the [AMO reviewer notes](../development/FIREFOX_AMO_REVIEW.md),
  candidate identifiers/checksums, source/build information and safe synthetic
  testing instructions. No personal credentials or browser profile attachments.
- [ ] Review visibility/release timing, submit only with authorization, monitor
  validation/review, and respond accurately to requests. Do not announce a
  listed or approved release merely because an upload/signing step succeeded.
- [ ] Retrieve the signed result, verify identity/version and runtime contents
  against the reviewed candidate accounting for signing metadata, and smoke-test
  normal installation. Record the actual public AMO URL only once available.

## Chrome Web Store — optional

- [ ] First resolve the [PAC/remote-code policy review](CHROME_REVIEWER_NOTES_1_0.md#pac-disclosure-and-publication-hold)
  and data-transport review. If unresolved, keep Chrome preparation unpublished;
  do not make an unsupported remote-code/secure-transmission certification.
- [ ] Use the authorized publisher account and correct extension identity.
  Upload the canonical Chromium ZIP with its manifest at archive root; record
  the exact artifact and checksum. Do not upload the source tree.
- [ ] Enter the [Chrome listing copy](CHROME_WEB_STORE_LISTING_1_0.md), confirm
  package-derived title/short description/locales, choose the current relevant
  category and distribution preferences, and verify homepage/support links.
- [ ] Complete the privacy dashboard: single purpose, every permission/host
  justification, user-data categories, remote PAC disclosure and Limited Use
  certifications. Publish the approved privacy policy URL first.
- [ ] Upload the reviewed store icon, five 1280x800 screenshots and 440x280
  promotional tile; verify current
  [image requirements](https://developer.chrome.com/docs/webstore/images).
- [ ] Provide [reviewer notes](CHROME_REVIEWER_NOTES_1_0.md), then submit only
  with authorization. Review results and smoke-test the accepted store package.
  Record the actual listing URL; do not invent one or link to a legacy package.

## After approval and authorized publication

- [ ] Confirm the approved store item/version is actually available in the
  intended channel; signing, acceptance and public listing are distinct states.
- [ ] Create the approved version tag at the exact validated main SHA, following
  the release process. Do not move an existing published tag.
- [ ] Create the GitHub release using that tag and canonical approved assets
  (including the verified Mozilla-signed XPI where appropriate). Record hashes,
  browser QA, actual store availability and any unpublished optional target.
  Download published assets again and verify contents/checksums before announcing.
- [ ] Update `docs/release-current.json`, current-release README/user docs,
  installation links and the final privacy policy coherently. This checklist
  does not change them in advance. Re-run docs/link checks and require green CI.
- [ ] Announce only confirmed capabilities and available channels, linking this
  fork's actual release/store pages. Include known limitations and support links;
  do not promise connectivity, anonymity, encryption or security protection.
- [ ] Monitor support/review feedback without requesting secrets, raw browser
  profiles or configuration exports in public issues.
