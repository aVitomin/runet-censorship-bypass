---
name: pac-regression
description: Review PAC generation/cooking, rule matching or precedence, provider fallback, candidate order, Direct/noDirect behavior, or own-proxy scope; exclude copy, styling, unrelated state, and build-only work.
---

# PAC regression

PAC execution is Chromium-specific. Read the applicable browser/scoped
instructions for changed files. Inspect the complete relevant diff, including
relevant untracked files, and needed callers without printing credentials or
private provider URLs.

1. Identify the changed routing branch and its observable result. Trace only
   needed Chromium PAC/site-scope/apply callers or Firefox declarative adapter
   callers. Shared contract changes require both; evaluated PAC results alone
   do not prove Firefox behavior.
2. For Chromium, cover affected and adjacent cases with evaluated
   `FindProxyForURL` results, not string fragments: exact host and `*.domain`,
   Auto/Proxy/Direct, candidate order, provider fallback, `noDirect`, safe defaults,
   and rule precedence. Add Chromium cases to
   `src/extension-chromium-mv3/test/pac-regression.js` when semantics change;
   cover corresponding Firefox declarative decisions when that target is affected,
   rather than copying PAC assumptions.
3. Preserve explicit Proxy semantics: a usable ordered candidate list, no
   provider fallback, and no unintended `DIRECT`. Auto removes its override;
   Direct remains explicit.

During Chromium PAC development, `test:pac` is the focused check. For an
unchanged final tree, do not also run `test:mv3`: Chromium-only completion uses
`verify:mv3`, which includes both. Firefox-only declarative changes use
`verify:firefox`, not Chromium PAC checks; shared routing uses full `verify`,
including Firefox/shared suites. Describe Firefox declarative behavior
separately and never imply this target executes PAC.

For Chromium, add browser QA only for parsing/fallback, `mandatory:false`, real
failover, DNS/leaks, or UI-derived scope. Report failures as
`scope | mode | candidates | expected | actual` and separate deterministic
evidence from browser observations.
