# Privacy notice — version 1.0

For Runet Censorship Bypass in
[aVitomin/runet-censorship-bypass](https://github.com/aVitomin/runet-censorship-bypass).
Effective date: 24 October 2026. This notice describes version `1.0.0` for
Firefox and Chromium, including locally installed packages. The availability
of each distribution channel is recorded separately on the project's release
page; this notice does not announce a store listing.
The [earlier-release notice](../user/PRIVACY_AND_SECURITY.md) remains separate.

## Data used in your browser

The extension uses the current site's hostname and network-request metadata to
select routes and handle proxy authentication. Browser APIs can provide request
URLs and identifiers; this is not a browser-history collection service. The
extension does not inject analytics scripts into websites or read page content
through content scripts, and it has no telemetry, advertising, crash-report
upload or developer analytics endpoint.

Browser-local storage holds saved rules, proxy addresses and optional
credentials, selected sources, cached routing artifacts, applied settings and
recovery metadata. Limited operational records may include a connection-check
target origin, proxy endpoint, timestamps, failure categories and request-bound
authentication retry state. These are not exported as browsing history or
uploaded to a developer service. Storage is local, not an encrypted password
vault or cloud synchronization service. People/software with access to your
browser profile may be able to access it.

## Data that leaves the browser

- **Ordinary routed traffic:** a destination website and network services see
  the connection in the usual way. When a proxy is selected, it receives the
  destination and whatever traffic its protocol exposes. The extension does
  not add an encryption or anonymity layer; use services you trust.
- **Proxy authentication:** explicitly configured usernames/passwords can be
  supplied to the matching proxy challenger for a request authorized by the
  applied configuration. They are not sent as website login credentials or
  uploaded to the developer. Firefox leaves website authentication to the
  browser without resolving stored proxy credentials. Save alone does not
  change active credentials;
  Apply is separate. Existing connections and browser authentication caches
  may continue using older credentials. HTTP/HTTPS proxy authentication is
  supported; universal SOCKS authentication is not promised. The transport
  chosen for a proxy determines its exposure; local storage is not a promise
  that transmission to an HTTP proxy is encrypted.
- **Chromium routing sources:** selected built-in or user-configured PAC
  sources are fetched manually and through scheduled refresh/retry paths.
  The server receives the source URL and ordinary connection/request metadata,
  including a network-visible IP address; cache validators may be used. Custom
  source URLs may themselves contain sensitive access information, so keep
  them private. The extension does not upload your rule list or configured
  proxy passwords as a provider-update payload.
- **Firefox routing data:** bundled verified data is read locally. Manual
  refresh and scheduled checks every 12 hours fetch static routing data from
  fixed Anticensority sources on `anticensority.github.io` and
  `raw.githubusercontent.com`. Those servers receive ordinary request and
  connection metadata, including a network-visible IP address. Requests omit
  website credentials and referrer and allow at most three redirects, each to
  one of the two exact configured source URLs. The final URL is validated too.
  Requests do not upload your rules or proxy credentials as update data.
  The extension validates format, size, source date and locally computed
  hashes without executing downloaded PAC JavaScript. These checks do not
  establish an author's cryptographic signature; the separate signed update
  channel is unconfigured. Updates do not enable routing when off or apply
  pending user settings when on. Choosing Only my rules and connections does
  not disable these source requests; it defers provider installation while
  saved or applied settings select manual.
- **Connection checks:** Firefox makes a user-requested GET to an eligible
  explicit-Proxy target origin, omits website credentials and referrer, does
  not follow redirects and discards the body. Chromium can check after popup
  Proxy Apply and repeat checks of an established target while it remains
  relevant to the applied configuration. Chromium also omits website
  credentials/referrer but can follow redirects. Checks can therefore contact
  the destination and, on Chromium, redirect recipients. A matching proxy can
  still request and receive configured proxy authentication. A check is not a
  telemetry request or proof of every request's route.
- **Files and support:** exporting downloads a file locally; it does not send
  it to a support service. You choose whether and where to share it. If you
  open GitHub support links or attach a file, GitHub and recipients handle the
  information you choose to send under their own services' policies.

## Import and export

Export settings contains portable Saved configuration, including site rules,
scope and proxy addresses. It excludes unsaved drafts, usernames, passwords,
custom-source URLs, arbitrary notes/labels and active-state internals. A file
can still reveal sensitive interests or network configuration: keep it private.
It is not a complete backup and does not synchronize profiles automatically.

Import validates a JSON file of up to 1 MiB, shows changes, missing credentials
and unsupported fields, and asks before replacing Saved settings. Import
itself makes no network requests and does not apply settings or enable routing.
Missing credentials must be re-entered or explicitly marked unnecessary before
an enabled incomplete profile can be applied. Existing active settings continue
until a separate successful Apply.

Export for support is a different file: export time, browser/extension version,
language, platform and limited active/pending/source-availability status. It
contains no configuration, site rules, proxy/source addresses, usernames,
passwords, cookies, browsing history, raw network logs or applied-generation
identifiers. It cannot be imported as settings. Inspect the file and your
accompanying message before sharing; sanitization does not make your own text
or screenshots safe automatically.

## Permissions and private windows

Broad host/network access is used for routing and proxy authentication, not for
advertising or harvesting page contents. Details are in the
[permission audit](PERMISSIONS_AND_PRIVACY_1_0.md).
Firefox declares `authenticationInfo` and `browsingActivity` because proxy
authentication and destinations can be transmitted as part of routing.
“No developer telemetry” must not be represented as “no data handled.”

Firefox requires private-window access because its browser-wide proxy setting
also affects those windows. The extension cannot grant the permission itself.
If permission is revoked, routing may be blocked until you turn the extension's
proxy control off or restore access. Restricted-site access is separate, and
privileged browser pages are outside ordinary site routing.

## Limited use of user data

In line with the Limited Use requirements of the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use),
user data is used only to provide the disclosed website-routing,
proxy-authentication, source-update and connection-check features.
The developer does not sell user data,
use or transfer it for advertising, unrelated profiling, creditworthiness or
lending, or provide a service for human access to browsing activity or credentials.
Transfers to selected sources, proxies and connection-check destinations are
limited to the functions described above. If you deliberately share information
for support, recipients can review the information you choose to provide; do not
send credentials or private configuration.

For the Chrome Web Store disclosure, authentication information covers configured
proxy credentials; web history covers destinations used for routing; user activity
covers network-request lifecycle/error metadata used for authentication and
connection handling. The last category does not mean tracking mouse movement,
keystrokes or page interaction. Local processing is included in these disclosures.

## Retention, controls and limitations

Edit or remove saved settings and Apply when you want active routing to change.
Turning routing off releases the extension's proxy setting; it does not erase
saved settings. Removing the extension normally removes its browser-local
storage. Separately downloaded export files, browser caches, and files you
shared with others are not removed by uninstalling the extension. The product
does not provide a server-side account or a developer-held cloud backup to delete.

The extension is not a VPN service and does not guarantee bypass, connectivity,
anonymity, encryption, IP hiding, DNS-leak prevention or security protection.
Chromium can connect directly on some browser/PAC failures. Firefox's blocking
fallback has a possible collision with a local service; it is not protection
against compromised local software. Data availability and an active status
do not verify a proxy connection.

## Contact

Ordinary questions: [support forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose).
Possible vulnerabilities: follow the
[security policy](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SECURITY.md)
and use [private reporting](https://github.com/aVitomin/runet-censorship-bypass/security/advisories/new).
Do not put secrets, private configuration, full URLs with tokens, or browser
profiles in public reports. Use the policy's contact-only fallback if private
reporting is unavailable.
