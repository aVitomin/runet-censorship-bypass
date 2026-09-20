# Chromium MV3 pages

Use `pages/shared/rpc-client.js`; do not reach into background globals or load
remote scripts. Build DOM with text nodes/`textContent` and existing helpers,
not HTML injection sinks.

- Send the redacted unchanged-password placeholder through the existing RPC;
  only the backend preserves the bound secret. Never recover it into page state.
  Keep credentials out of DOM attributes, errors, diagnostics, and logs; show
  full custom provider URLs only in their dedicated input.
- Keep popup/options routing language aligned: Auto removes the applicable
  override, Proxy requires a candidate, and Direct is explicit. Test exact-host
  and base/subdomain forms; `tldts` uses private domains, while legacy two-label
  wildcards are compatibility-only.
- Add normal user-facing strings to both English and Russian locales without
  changing placeholder shapes.
- Keep Draft local and preserve it on revision conflicts. Options Save/import
  writes Saved only; Apply targets the displayed revision. Popup uses the
  revision-safe composite RPC and requires explicit confirmation before also
  applying pre-existing pending Saved changes.

For Chromium-only runtime/UI changes, the final gate is `verify:mv3`.
Inspect affected pages in Chromium and manually cover the behavior changed:
masking, keyboard/forms, both locales, and routing actions as applicable.
Styling-only work does not trigger security or PAC skills unless it changes one
of their named boundaries.
