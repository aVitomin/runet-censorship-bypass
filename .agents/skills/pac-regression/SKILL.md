---
name: pac-regression
description: Review PAC generation/cooking, rule matching or precedence, provider fallback, candidate order, Direct/noDirect behavior, or own-proxy scope; exclude copy, styling, unrelated state, and build-only work.
---

# PAC regression

PAC execution is Chromium-specific. Read scoped background instructions only
when background files change. Inspect the complete relevant diff, including
relevant untracked files, and needed callers without printing credentials or
private provider URLs.

1. Identify the changed routing branch and its observable result. Trace only
   needed callers through PAC cooking, site scope, and proxy application.
2. Cover affected and adjacent cases with evaluated `FindProxyForURL` results,
   not string fragments: exact host and `*.domain`, Auto/Proxy/Direct,
   candidate order, provider fallback, `noDirect`, safe defaults, and rule
   precedence. Add cases to `test/pac-regression.js` when semantics change.
3. Preserve explicit Proxy semantics: a usable ordered candidate list, no
   provider fallback, and no unintended `DIRECT`. Auto removes its override;
   Direct remains explicit.

During development, `test:pac` is the focused check. For an unchanged final
tree, do not also run `test:mv3`: Chromium-only completion uses `verify:mv3`,
which includes both; shared routing completion uses full `verify`, which also
includes Firefox/shared suites. Describe Firefox declarative behavior
separately and never imply Firefox executes PAC.

Add browser QA only for Chromium-level parsing/fallback, `mandatory:false`, real
failover, DNS/leaks, or UI-derived scope. Report failures as
`scope | mode | candidates | expected | actual` and separate deterministic
evidence from browser observations.
