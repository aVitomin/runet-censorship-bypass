# Manifest permissions and privacy audit — 1.0

Audited 2026-09-26 at `8361608fa4ac52cc118cf5e6d32b3feb8772d167`.
Sources: [Firefox manifest](../../extension/src/firefox/manifest.json) and
[Chromium manifest template](../../extension/src/chromium/manifest.tmpl.json).
No permission or manifest was changed. Repeat this exact comparison on the
final built manifests before submission; this is not approval of future grants.

“Not collected” below describes product behavior, not what a broad browser
permission could theoretically expose. No listed permission is used for
developer telemetry, advertising, resale or a browsing-history upload service.
Proxy/destination transmission still occurs as explained in the
[privacy notice](PRIVACY_1_0.md).

## API permissions — complete manifest inventory

| Permission | Target | Why required / user-visible purpose | Data accessed or stored | What this implementation does not collect/do with it |
| --- | --- | --- | --- | --- |
| `proxy` | Both | Apply or release the extension's browser routing configuration; Firefox also chooses per-request routes and guards inactive/unready routing. | Browser proxy ownership/settings; configured endpoints; Firefox destination/request information. | Does not supply a VPN service, read page bodies or upload browsing history to the developer. |
| `storage` | Both | Keep settings, credentials, routing artifacts/references and restart/recovery state. | Local rules, proxy/source settings, credential records and operational metadata; Chromium also uses session request/auth bookkeeping. | No product cloud sync, website-cookie database access or developer backup upload. Not a claim of encrypted secret storage. |
| `alarms` | Both | Restore scheduling after background restarts. Chromium refreshes PAC data and supervises relevant connection checks. Firefox has a provider-check scheduler gated by release trust. | Schedule times, last-check/status records and an established Chromium health target. | No general activity timer or telemetry schedule. Firefox's unconfigured remote channel does not make update requests. |
| `notifications` | Both | Show localized attention/status notices and let the user open Options. | Fixed status/error categories and notification bookkeeping. | No advertising notifications, page-content collection or credential-bearing notification text. |
| `webRequest` | Both | Bind request lifetimes to applied routing/auth settings, handle proxy challenges and clear retries/errors. | Browser request IDs, URLs/metadata, proxy challenger host/port, completion/error events. | No requested `requestBody`, `requestHeaders` or `responseHeaders` capture; no content scraping or history database. Metadata access is still data handling. |
| `webRequestBlocking` | Firefox only | Synchronously authorize/cancel requests and answer bounded matching proxy-auth challenges. | Request authorization, selected proxy and matching configured credentials. | Does not send stored proxy passwords to website-auth challenges or arbitrary unrelated challengers. |
| `webRequestAuthProvider` | Chromium only | Answer supported HTTP/HTTPS proxy authentication challenges using the request's applied configuration. | Proxy challenge endpoint, configured username/password, bounded retry state. | Does not create website accounts, collect website passwords or promote newly saved credentials without Apply. |
| `activeTab` | Chromium only | Identify the site when the user opens the action popup and selects Auto/Proxy/Direct. | Current tab URL, reduced to a normalized host for site controls. | No bookmark/history collection or injected page scripts. This is not the only host grant: broad host permissions below also exist. |

Firefox has no `activeTab` or `tabs` permission; it uses existing host access for
the current-site interface. Neither manifest declares `history`, `bookmarks`,
`cookies`, `scripting`, `downloads`, `management` or `nativeMessaging`.
There are no declared content scripts or optional API/host permissions.
Do not invent permission justifications for absent features.

## Host permissions — every literal entry

The six explicit Chromium provider grants overlap `<all_urls>`; they are
present source-host declarations, not six additional independent functional
requirements. A future minimum-permission cleanup would need a separate
runtime review and is not performed here. These upstream provider domains are
actual runtime data sources, **not** project/support/privacy links or proposed
publisher identities.

| Host permission | Target | Why present / user-visible purpose | Data accessed / sent | Not collected by this source fetch |
| --- | --- | --- | --- | --- |
| `<all_urls>` | Both | Route/authenticate user-selected normal web destinations. Firefox's request guard and proxy decisions require coverage; Chromium also supports user-chosen PAC hosts and connection checks. | Request metadata/destinations, current-site host, matching proxy challenges; permitted source/check requests. | No injected analytics or bulk page-content/history upload. Does not override browser restrictions on privileged pages. |
| `https://e.cen.rodeo:8443/*` | Chromium | Primary built-in Antizapret PAC endpoint. | PAC body, cache validators and ordinary fetch/connection metadata visible to that server. | No upload of local rule lists or proxy-password records. |
| `https://antizapret.prostovpn.org/*` | Chromium | Built-in Antizapret fallback PAC host. | Same source-fetch data as above. | No upload of local rule lists or proxy-password records. |
| `https://antizapret.prostovpn.org:8443/*` | Chromium | Alternate configured Antizapret endpoint. | Same source-fetch data as above. | No upload of local rule lists or proxy-password records. |
| `https://antizapret.prostovpn.org:18443/*` | Chromium | Alternate configured Antizapret endpoint. | Same source-fetch data as above. | No upload of local rule lists or proxy-password records. |
| `https://anticensority.github.io/*` | Chromium | Built-in Anticensority PAC endpoint. | Same source-fetch data as above. | No upload of local rule lists or proxy-password records. |
| `https://raw.githubusercontent.com/*` | Chromium | Built-in Anticensority PAC fallback on GitHub's raw-content host. | Same source-fetch data as above. | No repository-account access or upload of local rule/password records. |

Source mapping: [Chromium providers](../../extension/src/chromium/background/pac-providers.js).
Custom inputs allow HTTPS or loopback HTTP only, reject URL userinfo and
validate the final response URL. Do not describe this as authenticating every
custom source, preventing every intermediary contact, or trusting arbitrary
PAC content. Source selection remains the user's trust decision.

## Firefox declarations and browser settings

| Declaration | Meaning / publication wording |
| --- | --- |
| `incognito: "spanning"` | Browser setting, not an API permission. Private-window access must be granted by the user before Apply because routing settings also affect private windows. Revoke/ownership loss can block routing; Turn off remains available. |
| Required `authenticationInfo` | Optional user-configured proxy credentials can be transmitted to a matching authorized proxy. Required data-type declaration does not mean every user must configure a password. |
| Required `browsingActivity` | Routing processes destinations and sends destination information to a selected proxy. This is not developer telemetry and cannot be relabeled `none`. |
| `strict_min_version: "154.0"` | Manifest compatibility floor, not evidence of complete QA on every OS/version. No Android listing claim is prepared. |

Mozilla counts handling outside the add-on/local browser as transmission in its
[built-in data-consent guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
The current declaration matches the supported routing/authentication functions;
the final submission still needs maintainer review against the exact package.

## Privacy alignment conclusions

- Save and import write Saved only. Active request credentials remain associated
  with the applied request configuration and matching proxy; no “any configured
  password for any challenge” behavior is advertised.
- Stored passwords are not returned through routine UI reads, pending summaries,
  diagnostics or configuration/support exports. The user still enters a new
  secret in the password form; do not claim passwords never exist in memory.
- Configuration exports omit usernames/passwords/custom-source URLs and arbitrary
  notes, but contain site rules and proxy endpoints. They are sensitive files.
- Support exports contain export time, environment and short status only, not
  configuration or network logs. Sharing is manual and still deserves review.
- Import itself performs no network activity. It does not imply that an already
  active browser stops its independent routing, source refresh or health checks.
- Source servers and health-check targets receive ordinary network metadata.
  Firefox remote updates are disabled by current trust configuration; Chromium
  PAC refresh and relevant automatic health checks exist now.
- Website cookies/credentials are omitted from connection-check fetches. Proxy
  authentication can still occur; Chromium redirects can contact other origins.
- Local operational origins/endpoints exist; “no browsing-history service” is
  accurate, while “no network metadata is ever stored locally” is not.
- Neither store should be told “no user data handled” merely because there is no
  analytics service. Chrome requires disclosure even for locally processed data:
  [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/).

The [feature inventory](FEATURE_INVENTORY_1_0.md#implementation-evidence) lists
the implementation paths inspected. No authentication, provider trust,
permissions, persistence or export behavior was changed by this audit.
