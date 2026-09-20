# Chromium MV3 pages

Use `pages/shared/rpc-client.js`; do not reach into background globals or load
remote scripts. Build DOM with text nodes/`textContent` and existing helpers,
not HTML injection sinks.

- Display stored passwords only as `***` and restore the original when that
  placeholder is saved unchanged. Keep credentials out of DOM attributes,
  errors, diagnostics, and logs; show full custom provider URLs only in their
  dedicated input.
- Keep popup/options routing language aligned: Auto removes the applicable
  override, Proxy requires a candidate, and Direct is explicit. Test exact-host
  and base/subdomain forms; `tldts` uses private domains, while legacy two-label
  wildcards are compatibility-only.
- Add normal user-facing strings to both English and Russian locales without
  changing placeholder shapes.

The final Chromium gate is `verify:mv3`. Inspect affected pages in Chromium and
manually cover the behavior changed: masking, keyboard/forms, both locales, and
routing actions as applicable. Styling-only work does not trigger security or
PAC skills unless it changes one of their named boundaries.
