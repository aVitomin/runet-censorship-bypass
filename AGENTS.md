# Repository instructions

## Priority and scope

Apply instructions in this order: the current user request, the hard
invariants here, the most specific applicable `AGENTS.md`, an applicable
repository skill, then defaults. A request defines scope but does not silently
waive a safety invariant. Report any forced stop or material scope expansion.

Read this file once. Read a scoped `AGENTS.md` only when changing files below
that directory, and load a skill only when its description matches the task.

## Repository map and working boundary

- The only npm root is `extensions/chromium/runet-censorship-bypass`
  (`$Project`). Run commands from the repository root in PowerShell and never
  run root npm install/scripts. If dependencies are missing, use
  `npm ci --prefix $Project`.
- Maintained targets are Chromium MV3 (`src/extension-chromium-mv3`), Firefox
  MV3 (`src/extension-firefox-mv3`), and shared runtime
  (`src/extension-mv3-common`). MV2 is historical; use Git history or the
  frozen development branch rather than rebuilding it on `main`.
- Chromium background starts at `background/service-worker.js`; Chromium UI is
  under `pages/`; Firefox starts at `background/event-page.js`.
- Version/build authority is `src/templates-data.js`, `gulpfile.js`, and the
  maintained manifests/templates. Chromium recursively packages every file
  under `src/extension-common/pages/lib`; additions change packaged bytes.
  Firefox uses explicit Gulp allowlists. Do not broaden package globs implicitly.
- For user-facing UI strings, update both `en` and `ru` locale catalogs for
  every affected browser target.
- Build output, `dist`, `node_modules`, coverage, archives, profiles, logs,
  `.tmp`, and `.local` are generated/local-only. Do not broadly inspect
  minified vendor files or recreate the removed nested Options package.
- Preserve unrelated work and `docs/legacy/**`. Prefer the smallest complete
  change; avoid broad formatting and lockfile churn. Never commit, push,
  publish, upload, tag, or release without separate authorization.

## Hard supply-chain invariants

Use `$dependency-review` for package/lock, vendored code, dependency-manager,
or GitHub Action changes. Prefer existing/platform APIs. A new direct version
must have been public for at least 168 hours; an emergency exception requires
the user's explicit approval. Verify registry/source identity, license,
ownership, lifecycle scripts, integrity, and the complete lock delta before
installation. Reject unexplained non-registry sources or integrity/ownership
changes. Pin Actions to verified full SHAs with least privilege and checkout
credentials disabled unless write access is required. Never run
`npm audit fix --force`; vendoring does not bypass review.

## Hard runtime and data invariants

- Downloaded PAC is untrusted data: validate, hash, store, and cook it without
  extension-side `eval` or `Function`. New raw/cooked bodies belong in IndexedDB
  artifacts; normal state stores references/metadata. Keep legacy inline data
  until migration succeeds.
- Keep valid proxy credentials out of PAC, UI/DOM attributes, logs, events,
  errors, diagnostics, migration summaries, and reports. Preserve the redacted
  unchanged-password placeholder. Treat custom URLs and query strings as
  sensitive.
- Custom provider input and final redirect URLs allow HTTPS and loopback HTTP
  only; reject URL credentials and revalidate redirects before accepting bytes.
- Routing precedence is explicit Direct, explicit Proxy, whitelist miss,
  `.onion`, then provider. Plain patterns match exact hosts; `*.example` covers
  base and subdomains. Candidate order is own proxies, local Tor, Tor Browser,
  then WARP. Explicit Chromium Proxy requires usable candidates and contains no
  provider fallback or unintended `DIRECT`; `mandatory:false` is not a browser
  fail-closed guarantee.
- Safe defaults keep provider proxies enabled, own proxies limited to own
  sites, Direct replacement off, and `noDirect` off. Refresh may update
  artifacts while control is off but must not enable control; reapply only when
  durable identity and live ownership still match.
- Reconstruct durable behavior from storage, IndexedDB, browser proxy state,
  and alarms. In-memory locks disappear on worker recreation. Serialize
  whole-state writes and reread storage inside queued mutations.

## Select checks once

Focused commands are optional development feedback; a final local gate is the
completion evidence. Do not repeat a focused command after an unchanged final
gate that already includes it. See `docs/development/TESTING.md` only when the
detailed command or browser-QA matrix is needed.

Run commands from the repository root in PowerShell after setting:

```powershell
$Project = '.\extensions\chromium\runet-censorship-bypass'
```

| Final affected scope | Required local gate |
| --- | --- |
| Agent/skill/docs only | `node .\scripts\verify-docs.mjs`, relevant skill/metadata validation, `git diff --check` |
| Chromium runtime/UI only | `npm --prefix $Project run verify:mv3` |
| Firefox runtime/UI only | `npm --prefix $Project run verify:firefox` |
| Shared runtime/templates/Gulp/common packaged input | `npm --prefix $Project run verify`, then compare both package trees with baselines |
| Dependency/Action/vendored code | `$dependency-review` checks plus the affected final gate |
| Release/provenance/package audit | `$release-candidate` and `docs/development/RELEASE_PROCESS.md` |

Before every PR, run `node .\scripts\verify-docs.mjs` and `git diff --check`
in addition to the applicable row. For agent/skill/docs-only work, those checks
and relevant skill/metadata validation are the final gate; do not run product,
browser, or release commands.

For PAC work, `test:pac` is the fast focused check; `verify:mv3` includes
`test:mv3`, and `test:mv3` includes PAC regression. Aggregate `verify` includes
all maintained deterministic suites once. `scripts/required-checks.mjs` is an
advisory path mapper; this table, applicable skills, and CI are authoritative.
CI additionally runs policy/supply-chain helpers, tooling verification,
per-browser gates, and Chromium smoke; trusted-main release jobs create
canonical artifacts. Do not claim unrun CI or browser QA locally.

## Documentation and handoff

Update current documentation when installation, behavior, browser support,
privacy/security, developer commands, architecture, or release procedure
changes. Use current fork links; upstream links are attribution/history. README
describes the latest published release. For new untracked Markdown, ensure docs
validation includes it without staging the real index.

Before handoff, review the complete relevant diff, run the applicable final
gate, and confirm no generated/profile/secret material is staged or packaged.
Summarize changed files, security/routing impact, each check and exit status,
failures/blockers, browser gaps, generated artifacts, and final
`git status --short`. Keep successful logs summarized; retain full command
output in the transcript and quote enough failure output to diagnose it. If a
required gate cannot run, report the work incomplete and name the blocker.
