---
name: dependency-review
description: Review package/lock or dependency-manager changes, vendored third-party code, and GitHub Action additions or updates; do not use for ordinary source or prose changes.
---

# Dependency review

Identify the exact dependency boundary before installing anything. The only npm
root is `extension`, serving both Chromium and Firefox. Trace build/runtime
consumers before calling a dependency browser-specific; directory names alone
do not establish its impact.

## Review

1. Establish why an existing/platform API is insufficient.
2. Verify package/Action/vendor identity, official source, license, ownership
   history, advisories, maintenance, and provenance for the exact release.
   Wide adoption and project age support the review but never replace it.
   A well-established package update may be used before 168 hours after its
   source, maintainers, code/contents, signatures, provenance and lock delta
   are verified. Record the exact version, integrity, source commit, checks
   and rationale in `scripts/reviewed-dependencies.json` when permitting early
   use. This is a maintainer review record, not an automatic safety certificate.
   For unfamiliar or insufficiently reviewed releases keep the 168-hour
   baseline, but do not treat elapsed time as approval. Stop and resolve any
   uncertain identity, ownership, integrity or behavior before installation.
3. Inspect tarball or vendored contents, size, executable files, lifecycle
   scripts, signatures/integrity, and transitive growth. Reject unexplained
   git/file/URL sources, registry changes, or integrity churn.
4. Review the complete lockfile delta, including resolved URLs, integrity,
   lifecycle flags, optional packages, and additions/removals.
5. For Actions, prove the full SHA belongs to the official release, inspect its
   executable bundle/dependencies, keep permissions minimal, and keep checkout
   credentials disabled unless explicitly needed.

Do not install before identity review, hide accepted dev-only findings, or run
`npm audit fix --force`.

## Evidence and stopping rule

For package/lock changes, run:

```powershell
$Project = '.\extension'
node .\scripts\verify-supply-chain.mjs
node --test .\scripts\verify-supply-chain.test.mjs
npm ci --prefix $Project
npm --prefix $Project run audit:prod
npm audit --prefix $Project
npm audit signatures --prefix $Project
```

For Action or vendored-code changes, run the two supply-chain checks and the
applicable source/bundle verification. Then run the final gate for every
affected target; a tooling-root package/lock change defaults to full `verify`
unless evidence confines its effect to tooling. Record production versus full
audit results, registry/provenance limitations, package impact, and lifecycle
behavior.

Return `APPROVE`, `REJECT`, or `NEEDS USER APPROVAL`. Stop on unresolved source,
ownership, integrity, lifecycle, or release-specific risk; do not request an
additional age exception for an already authorized, satisfactorily reviewed update.
