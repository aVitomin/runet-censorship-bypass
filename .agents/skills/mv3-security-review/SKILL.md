---
name: mv3-security-review
description: Review changes to permissions, background lifecycle, PAC/provider downloads or application, routing precedence or Direct/fail-open behavior, auth/credentials, migration, IndexedDB/persistent state, external requests, proxy ownership/errors, or browser error handling; exclude prose, styling, and tests with no boundary effect.
---

# MV3 security review

Read root instructions and only scoped instructions for changed paths. Review
the complete relevant diff and enough callers to prove each affected boundary.
Never print credentials, browsing data, full custom URLs, or profile contents.

If dependencies, Actions, or vendored code changed, also use
`$dependency-review` for that delta rather than repeating it here.

## Scope and final gate

- Chromium-only: review Chromium semantics; final gate `verify:mv3`.
- Firefox-only: review Firefox semantics; final gate `verify:firefox`.
- Shared runtime, manifest/template, Gulp, or common packaged input: review both
  targets; final gate `verify` plus both package-tree comparisons.
- Prose/tests without executable or boundary effect: stop; this skill does not
  apply.

Use focused `test:pac` only while developing changed Chromium PAC semantics;
the final gates already include deterministic PAC coverage.

## Boundaries

Check only those affected:

1. Permission/host/CSP expansion and executable-code provenance.
2. Untrusted PAC/dataset validation, hashing/signature, schema/size bounds, and
   trust assignment before use.
3. Input/final URLs, credentials, redirects, streaming bounds, deadlines,
   referrer policy, fallback, and disabled-by-default network paths.
4. Credential routing and redaction across PAC/datasets, UI/DOM, storage, RPC,
   events, errors, notifications, and diagnostics.
5. IndexedDB/storage atomicity, journals/pointers, concurrent writers, restart
   reconstruction, alarms, and destructive cleanup.
6. Direct/fail-open paths, callback authorization, live proxy ownership,
   control loss, private access, and proxy/listener errors.
7. Package allowlists, source/runtime correspondence, inactive production
   paths, and unreferenced executable code.

Add real-browser QA only where platform behavior matters: permissions,
proxy/auth, ownership, lifecycle/recovery, IndexedDB, alarms, or browser-level
fallback. Report findings first, then verified invariants, final-gate evidence,
package impact, and unresolved QA. Never describe Chromium PAC as browser-level
fail-closed while it uses `mandatory:false`.
