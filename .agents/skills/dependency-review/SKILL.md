---
name: dependency-review
description: Review package/lock or dependency-manager changes, vendored third-party code, and GitHub Action additions or updates; do not use for ordinary source or prose changes.
---

# Dependency review

Identify the exact dependency boundary before installing anything. The only npm
root is the extension tooling package.

## Review

1. Establish why an existing/platform API is insufficient.
2. Verify package/Action/vendor identity, official source, license, ownership
   history, advisories, maintenance, and provenance. A new direct package
   version must be at least 168 hours old; otherwise return
   `NEEDS USER APPROVAL` with the emergency rationale.
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
$Project = '.\extensions\chromium\runet-censorship-bypass'
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
ownership, integrity, lifecycle, or young-version risk.
