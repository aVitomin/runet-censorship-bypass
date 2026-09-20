# Firefox MV3

This target uses a non-persistent event page, `browser.*` APIs and verified
declarative provider data, not Chromium's service worker or PAC execution.

- Preserve manifest script order and synchronous registration of proxy,
  blocking request/auth, lifecycle, alarm and RPC listeners before async boot.
- `browser.proxy.settings` owns the fail-closed floor; `proxy.onRequest` supplies
  routes and the request guard enforces them. Preserve exact live ownership
  checks, retained-floor recovery and control-loss handling. Do not introduce a
  Clear/OFF interval for Apply or provider installation, or weaken blocking to
  claim READY when the effective identity cannot be proven.
- Recheck `browser.extension.isAllowedIncognitoAccess()` before activation or
  active replacement. Denied/unknown private-window access blocks activation;
  restricted/quarantined-site access is separate, not a detected prerequisite.
- Recover the exact durable Effective configuration and verified dataset, not
  latest Saved or whichever baseline a new release bundles. Keep credentials
  bound to the Effective snapshot and request-authorized proxy challenger.
- Keep UI Draft/conflict handling in the existing runtime/RPC helpers. Settings
  may be saved while active; popup save+apply remains one revision-safe backend
  operation with explicit confirmation for other pending Saved changes. Use
  text-only DOM construction and preserve private-access onboarding and RU/EN.
- Gulp explicitly lists Firefox package inputs and copies icons from the
  Chromium source directory. A file's location alone does not define its target.

For lifecycle/recovery changes, consult
`docs/development/FIREFOX_MV3_ARCHITECTURE.md`; for dataset changes, consult
`docs/development/FIREFOX_PROVIDER_DATASET.md`. Keep trust verification and the
unconfigured remote channel intact. Firefox-only runtime/UI uses
`verify:firefox`; shared packaged inputs use the root aggregate gate. Guidance
changes alone use the root docs/metadata checks, not runtime or browser suites.
