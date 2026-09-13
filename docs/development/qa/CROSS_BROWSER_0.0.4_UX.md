# 0.0.4.0 cross-browser UX gate

This record covers the local release-cleanup branch for the first shared
Chromium/Firefox milestone. It is evidence, not a publication record: no tag,
GitHub Release, store submission, or AMO submission was created.

## Browser matrix

The same `build/extension-chromium-mv3` release-candidate tree was used for all
Chromium runs.

| Browser | Exact local version | Method | Result |
| --- | --- | --- | --- |
| Google Chrome | 153.0.8010.37 | Automated packaged-extension routing/auth/restart smoke | PASS |
| Microsoft Edge | 153.0.4234.32 | Automated packaged-extension routing/auth/restart smoke over an attached CDP endpoint | PASS |
| Brave | 1.95.101 (Chromium 153.0.8010.37) | Automated packaged-extension routing/auth/restart smoke | PASS |
| Firefox | 154.0.1 | Automated packaged UI plus local routing/auth/recovery/private/control-loss smoke | PASS |
| Яндекс Браузер | Not installed in the QA environment | Not run | RELEASE GATE OPEN |
| Opera | Not installed in the QA environment | Not run | RELEASE GATE OPEN |
| Vivaldi | Not installed; optional matrix entry | Not run | OPTIONAL |

An absent browser is never reported as tested. Яндекс Браузер and Opera remain
release-gate work even though the product supports modern Chromium browsers with
the required MV3 APIs.

## Functional result

Chrome, Edge and Brave passed the same real-background checks: extension load,
Options/background RPC, Auto/Proxy/Direct routing, own authenticated HTTP/HTTPS
proxy, provider routing, durable settings/restart recovery, external proxy
takeover, Clear and restoration after restart. The browser/version label comes
from the browser process rather than user-agent inference.

Firefox passed the packaged popup/Options workflow, Apply/Clear, explicit
Direct/Proxy, provider match/miss, authenticated proxy, settings revision and
password `KEEP / SET / NONE`, toolbar `OFF/A/P/D/!`, connection-check success and
failure, redacted diagnostics, notifications, genuine event-page recovery,
private-access revocation and previous-manual-proxy restoration.

All local routing fixtures used synthetic hostnames and loopback servers.
Unexpected protected-origin contacts: **0**. Credential leaks: **0**. External
fixture traffic: **0**.

## Deterministic visual harness

Run both maintained UI engines after building both packages:

```powershell
$env:CHROMIUM_BIN = '<installed Chromium executable>'
$env:FIREFOX_BIN = '<installed Firefox executable>'
node ./scripts/cross-browser-visual-qa.mjs
```

The harness copies the exact built packages to disposable locations, injects a
read-only popup fixture only into those copies, and never modifies the packages
being compared. Options uses the real page/controller with deterministic local
state. Output is ignored under `.local/cross-browser-visual-qa/`.

For each engine it captures 96 screenshots:

- popup `OFF`, Auto, explicit Proxy, explicit Direct, pending/not-applied,
  Active, external control, blocked/error and health warning;
- Options Overview, Automatic routing, Site rules, Proxy connections,
  Maintenance, Advanced and About;
- English and Russian;
- device scales 100%, 125% and 150%, including a 300 CSS-pixel narrow popup
  probe.

The automated tolerance is structural rather than pixel-identical:

- required root/navigation/section must exist;
- no horizontal document overflow;
- no horizontally clipped visible control;
- interactive controls must remain at least 12 CSS pixels in both dimensions,
  except intentionally styled native radio/checkbox inputs;
- engine-specific font metrics, antialiasing and line wrapping may differ.

The completed matrix reported zero missing sections, clipping failures or
horizontal-overflow failures. Selected EN/RU frames at all three scales were
also visually inspected. Chromium is denser and Firefox uses a taller popup,
but both retain the same status → site route → secondary-information hierarchy;
no text/control overlap, broken scrolling or unusable button/input was found.

## Edge launcher note

This Edge build delegates the initial process and exits before Puppeteer's
normal launch handshake completes. The smoke therefore starts Edge with a
workspace-disposable profile and local DevTools endpoint, then connects through
CDP. The extension assertions are unchanged. Shutdown is bounded and profile
deletion tolerates Edge's delayed final file release.

## Release decision

The UI parity matrix has no `MISSING` product rows and the browsers available in
this environment passed. Public `0.0.4.0` release remains blocked until the same
release-critical script is completed on Яндекс Браузер and Opera and the
results are added here.
