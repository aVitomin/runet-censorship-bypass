# 1.0 publication feature inventory

Documentation audit of `8361608fa4ac52cc118cf5e6d32b3feb8772d167`, dated
2026-09-26. These are implemented development features, not a declaration that
1.0 is released. The manifests still identify `0.0.4.0`. Recheck this inventory
against the eventual release artifact. No runtime or release actions are part
of this documentation change.

## Claims supported by the current implementation

| Area | Shared user-facing behavior | Browser differences / necessary qualification |
| --- | --- | --- |
| Routing control | Starts off. Apply activates saved routing settings; turning routing off releases the extension's setting when it owns it. | Controls browser traffic, not a device-wide VPN. Another extension or policy can prevent control. An active badge is not a connectivity or security guarantee. |
| Auto | Uses the automatic rules after applicable explicit overrides are removed. | Chromium selects PAC/manual sources; Firefox looks up verified local Anticensority data. Auto is not synonymous with Direct. |
| Proxy | Selects an enabled configured connection for the rule. | Explicit Proxy needs suitable candidates. It is not a promise that a public proxy service is provided or reachable. |
| Direct | Bypasses this extension's proxy routing for the selected scope. | Does not bypass a system VPN or promise a particular external IP. Explicit Direct takes precedence over explicit Proxy. |
| Site rules | Exact host or domain plus subdomains; IP addresses and localhost use exact-host rules. | Import previews flag unsupported target features; do not imply every Chromium rule option transfers to Firefox. |
| Save / Apply | Save changes stored settings only. Apply activates the reviewed saved revision. Pending changes can coexist with active routing. | Options and popup have different controls: popup Apply saves and applies its site choice; it warns before including other saved changes. Unsaved Options drafts are not included. |
| Import / Export | Manual JSON transfer, preview, replacement of Saved only, separate Apply; not cloud sync or a full backup. | Firefox retains its bundled source and warns about unsupported source/language/disabled-rule options. Credentials must be re-entered or explicitly marked unnecessary. |
| Data updates | Data freshness and connection availability are separate. Updates retain applied user settings, leaving pending settings pending and off routing off. | Chromium downloads/checks PAC sources and can refresh automatically. Firefox's remote channel is unconfigured; rules currently arrive with extension updates. |
| Connection checks | Limited connectivity evidence; no proof of anonymity, all page requests or future availability. | Firefox checks are user-triggered and do not follow redirects. Chromium can check after popup Proxy Apply and repeat checks for a relevant established target; redirects can be followed. |
| Authentication | Configured HTTP/HTTPS proxy authentication; Save alone does not replace active credentials. Stored passwords are not returned in UI reads or exports. | Credentials remain tied to the request's applied configuration and matching proxy. Firefox additionally tracks the selected descriptor. SOCKS authentication is browser/implementation dependent. Existing connections/auth caches may outlive Apply. |
| Local storage | Rules, proxy configuration, credentials, routing artifacts, recovery and operational metadata remain in the browser profile. | This does not mean no data leaves the browser: routed requests, proxy authentication, configured source retrieval, connection checks and manually shared files have recipients. |
| Firefox access | Explicit private-window permission is required before activation because proxy settings affect private windows too. | Restricted-site permission is separate and not an activation prerequisite; privileged browser pages are not ordinary routable sites. Chromium has no equivalent Firefox-specific activation gate. |

Firefox's bundled proxy routes expect separately running compatible local
services (Anticensority, Tor Browser or Tor). Own proxies for explicit Proxy
rules are configured separately. Neither browser starts or installs those
services. A name such as Tor or WARP describes an integration option, not an
anonymity or encryption promise by this extension.

## Publication wording boundaries

Do not advertise a VPN/proxy subscription, anonymity, encryption, security
protection, guaranteed bypass, guaranteed connectivity, universal SOCKS
authentication, identical browser internals, or automatic Firefox remote data
updates. Explain the UI's “Protection active” label as routing control only.
Chromium's browser PAC failure behavior can allow Direct; Firefox's proxy-chain
exhaustion normally fails instead, but its documented local blocking fallback
has a possible local-service collision. Neither is a universal fail-closed or
leak-prevention claim.

## Implementation evidence

- Permissions/version: [Firefox manifest](../../extension/src/firefox/manifest.json),
  [Chromium template](../../extension/src/chromium/manifest.tmpl.json),
  [version authority](../../extension/src/templates-data.js).
- Routing and scope: [shared contract](../../extension/src/shared/routing-contract.js),
  [Firefox site control](../../extension/src/firefox/background/site-control.js),
  [Chromium worker](../../extension/src/chromium/background/service-worker.js).
- Saved/active behavior: [Firefox settings](../../extension/src/firefox/background/settings-control.js),
  [Chromium effective configuration](../../extension/src/chromium/background/effective-config.js).
- Transfer: [strict format](../../extension/src/shared/configuration-transfer.js),
  [Firefox adapter](../../extension/src/firefox/background/configuration-transfer.js),
  [Chromium adapter](../../extension/src/chromium/background/configuration-transfer.js).
- Provider data: [Firefox production provider](../../extension/src/firefox/background/production-provider.js)
  (`UPDATE_TRUST_CONFIGURATION.enabled` is false),
  [Chromium source definitions](../../extension/src/chromium/background/pac-providers.js),
  [Chromium download handling](../../extension/src/chromium/background/pac-download.js).
- Authentication: [Firefox handler](../../extension/src/firefox/background/proxy-auth.js),
  [Firefox request binding](../../extension/src/firefox/background/routing-adapter.js),
  [Chromium handler](../../extension/src/chromium/background/proxy-auth.js).
- Health/notifications: [Firefox operational status](../../extension/src/firefox/background/operational-status.js),
  Chromium worker `runAutomaticProxyHealthCheck`, `getProxyHealthRelevance`,
  `runProxyHealthCheckInternal`, and
  [Chromium action status](../../extension/src/chromium/background/action-status.js).
- User workflows: [unreleased guide](../development/UPCOMING_1_0_USER_GUIDE.md).

## Documentation alignment findings

The older AMO notes used Enable/Disable and described a check as sending no
credentials without distinguishing website credentials from proxy
authentication. The current notes use Apply/Turn off and explain that split.
The published privacy page's manual-only check wording also needed a Chromium
qualification: the `v0.0.4.0` worker already contains the automatic health-check
alarm. Its release scope is retained; new Import/Export policy is documented
separately in the [1.0 privacy draft](PRIVACY_1_0.md).

Chrome publication needs a specific PAC/remote-code policy review. The browser
evaluates downloaded PAC logic; the absence of extension-side `eval` alone
does not settle store policy. Do not hide this behavior in a “no remote code”
certification. This is a publication review item, not a runtime change here.
