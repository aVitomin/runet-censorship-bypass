# Chromium MV3 background

This target uses a service worker, Chromium PAC execution and `chrome.*` APIs,
not Firefox's event-page/proxy-floor model. Preserve top-level `importScripts`
order and register lifecycle, alarm, proxy, auth, error, and message listeners
synchronously.

- Treat worker memory as disposable. Reconstruct from `mv3State`, IndexedDB
  artifacts, Chromium proxy state, and alarms. Serialize whole-state writes and
  reread storage inside each queued mutation; the queue does not survive a
  worker restart.
- Keep downloaded PAC as text. Apply only a current cooked artifact whose
  provider, raw hash, modifier hash, and live proxy-control checks agree. Write
  new bodies to `mv3PacArtifacts`; keep PAC bodies out of ordinary state and RPC
  results, exposing summaries/references only. Remove legacy inline data only
  after its artifact write succeeds.
- Never place usable own-proxy credentials in PAC or persisted events. Accept
  auth only for the request-bound Effective generation and matching proxy
  host/port; preserve generation-bound retry limits across worker recreation.
  Never resolve active credentials from latest Saved or infer generation from
  PAC hash alone. `chrome.proxy.settings` and auth are not a native transaction;
  ambiguous bindings must not receive credentials from another generation.
- Sanitize request URLs before state, notification, or logging. Validate custom
  input before fetch and the final redirect URL before accepting bytes.
- Use module APIs and the state queue; do not split same-field updates across
  calls when concurrent writers can intervene.

Use `$mv3-security-review` for the boundaries named in its trigger and
`$pac-regression` when routing semantics change. `test:pac` is optional focused
feedback; the Chromium-only runtime gate is `verify:mv3`, which includes it.
Add targeted browser QA when behavior depends on real proxy/auth, PAC parsing or
fallback, ownership, worker interruption, alarms, IndexedDB, or migration.
