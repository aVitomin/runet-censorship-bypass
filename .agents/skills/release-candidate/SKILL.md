---
name: release-candidate
description: Prepare or audit a dual-browser Chromium/Firefox release candidate, trusted-main artifacts, version consistency, reproducibility, packaging, signing boundaries, and release QA; exclude ordinary development builds.
---

# Dual-browser release preflight

Read `docs/development/RELEASE_PROCESS.md`. Public releases use exact canonical
artifacts from a successful trusted-main run for the validated `main` SHA;
manual dispatch is trusted only on exact `main` with the complete workflow
green. Local archives are preflight evidence only. Do not commit, publish, upload,
sign, overwrite archives, clean user changes, or expose private values without
explicit authorization.

## Preflight

1. Require a clean tree and record SHA. Verify version authority,
   Chromium/Firefox manifests, Gecko ID, release metadata, and tag/version
   consistency. MV2 is not a target.
2. Run docs, supply-chain verifier/tests, registry signatures, production
   audit, and full `verify`. Confirm dependency/Action/vendor changes completed
   `$dependency-review`.
3. Run `release:chromium` and `release:firefox`. Verify byte-identical clean
   rebuilds, root manifests, package allowlists, checksums, and the Firefox
   reviewer-source archive. Run the current pinned Mozilla addons-linter on the
   exact XPI. Both targets share a tooling root, not identical package contents:
   trace per-target Gulp copies, including shared icons stored under Chromium.
4. Scan staged paths, package trees, and archives without printing matches.
   Reject dependencies, caches, profiles, logs, environment files, keys,
   credentials, private URLs, tests, source maps, and nested output.
5. Confirm the exact trusted-main run passed all jobs and uploaded both
   canonical artifact sets. PR artifacts remain disabled; signing and AMO
   submission stay external.

Use exact packaged candidates in disposable profiles for applicable Chromium
and Firefox QA: clean OFF, UI, routing modes, auth, provider data, Apply/Clear,
restart recovery, ownership loss, and private windows. Distinguish tested
browsers from expected compatibility and record protected-origin contacts and
credential-leak results.

Return version/SHA, artifact names/sizes/checksums, rebuild result, addons-linter
and source-archive results, trusted-run identity, package/security evidence,
browser QA, signing boundary, and blockers. Label every local artifact
non-public.
