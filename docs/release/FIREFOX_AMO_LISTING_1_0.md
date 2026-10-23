# Firefox Add-ons listing — 1.0 draft

English submission copy for development version `1.0.0`; not uploaded or
approved. Verify against the exact release build and review any Russian
localization before submission. UI languages currently include English and Russian.

## Listing fields

- **Title:** Runet Censorship Bypass
- **Summary:** Choose Auto, Proxy or Direct for websites. Manage site rules and proxy connections, with separate Save and Apply controls.
- **Category:** Other. One category is sufficient; no security-benefit category
  or keyword is needed to describe routing control.
- **Keywords/tags:** proxy, routing, site rules, network tools, censorship.
  Use naturally; confirm the available tags in the live submission form.
- **Homepage:** [repository](https://github.com/aVitomin/runet-censorship-bypass).
- **Support URL:** [issue forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose).
- **Privacy URL:** publish the [1.0 privacy draft](PRIVACY_1_0.md) on main first;
  use its canonical public URL recorded in the publication checklist. Do not
  submit a draft-branch or not-yet-existing main URL.

The summary is deliberately below Mozilla's 250-character limit. The
[AMO listing guidance](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)
also recommends natural keywords and choosing only relevant categories.
Confirm the [Other category](https://addons.mozilla.org/en-US/firefox/extensions/category/other/)
in the live submission form.

## Description — copy from here

### What the extension does

Runet Censorship Bypass lets you control how Firefox routes websites: follow
automatic rules, use a configured proxy, or connect directly. It manages
browser routing; it does not provide a VPN, a proxy subscription or a separate
network service.

Firefox includes verified Anticensority routing data. Its automatic proxy
routes need a compatible local service, such as Anticensority, Tor Browser or
Tor, running separately. You can also configure your own connection for
explicit Proxy rules. Alternatively, choose Only my rules and connections:
manual routing needs no Anticensority database and keeps your rules, onion routes
and routing settings. Under default flags, unmatched sites use Direct.
The extension does not install or start proxy services.
See [routing-data attribution and provenance](../legal/DATA_SOURCES.md) for
the bundled source and the distinction between attribution and licensing.

### Main features

- Choose Auto, Proxy or Direct for the current website.
- Create exact-host rules or rules for a domain and its subdomains.
- Edit settings while existing applied settings remain in use.
- Save changes for review, then Apply them when ready.
- Preview and import portable settings, or export settings for manual transfer.
- Create a separate, sanitized support export.
- Refresh validated routing data manually or automatically every 12 hours.
- View the source-data date separately from the last check and run a limited connection check.
- Configure supported HTTP/HTTPS proxy authentication.

### How routing control works

Auto follows automatic rules after applicable explicit overrides are removed.
Proxy uses an enabled configured connection. Direct bypasses this extension's
proxy routing for that site; it does not bypass a system VPN. A rule can apply
to one exact host or a domain and its subdomains. Explicit Direct takes
precedence over explicit Proxy.

Save does not activate changes. Apply activates the saved settings you reviewed.
If the popup also finds other saved changes, it asks you to review them or
explicitly apply all saved changes. Unsaved edits in another Options window
are not included. “Protection active” means routing control is active, not that
all websites or proxy connections have been tested.

### Privacy and local data

Settings and optional proxy credentials are stored in the local browser
profile. There is no developer telemetry, analytics or cloud synchronization.
Routing uses destination/request information; selected proxies receive the
destination and traffic visible to their protocol. Configured proxy credentials
may be sent to the matching proxy when it requests authentication. This is why
Firefox declares authentication information and browsing activity.
Routing-data checks contact the fixed Anticensority HTTPS sources, whose servers
receive ordinary connection metadata. Source requests omit website credentials
and referrer; they do not upload your rules or configured proxy passwords.

Settings exports omit usernames and passwords, but still contain site rules
and proxy addresses: keep them private. Support exports contain only limited
environment and status information; inspect them before sharing. Import only
saves settings and does not contact providers, activate routing or turn it on.

### Firefox limitations

Private-window access is required before activation because Firefox's proxy
setting also affects private windows. Grant it in the add-on's settings, return
to Options and choose Check again, then Apply. Access to restricted Firefox
sites is separate. Privileged browser pages are not ordinary sites for routing.

Firefox includes a local routing baseline and can refresh it from the fixed
Anticensority HTTPS sources. Downloads are parsed as bounded static data without
executing PAC JavaScript. HTTPS and locally computed hashes do not establish
an author's cryptographic signature. The source may still contain older data;
a successful check does not mean a new dataset exists or a connection works.
Updates keep protection off when it is off and preserve the applied user
settings when it is on; saved changes remain pending. Blocked updates can
remain prepared until the protection state permits installation. Manual mode
does not disable source checks; an update stays prepared while either saved or
applied settings select manual and cannot switch the source for you.

Chromium's arbitrary PAC-source interface is not available here. Existing
connections and browser authentication caches may persist after Apply.
Website authentication remains handled by Firefox; stored proxy credentials
are not supplied to website challenges. SOCKS authentication depends on browser
support and is not promised.

The extension does not guarantee bypass, connectivity, anonymity, encryption
or security protection. Choose services you trust and consider what they can
observe. It controls Firefox traffic, not all applications on your device.

### Support

See the [project and documentation](https://github.com/aVitomin/runet-censorship-bypass).
For ordinary problems, use the
[support forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose)
with browser/version, steps and a sanitized result. Never post credentials,
private configuration exports or browser profiles. Report possible
vulnerabilities privately using the
[security policy](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SECURITY.md).

## Maintainer attachments — not part of description

Use the [current AMO reviewer notes](../development/FIREFOX_AMO_REVIEW.md),
[permission/privacy audit](PERMISSIONS_AND_PRIVACY_1_0.md), and the five
[Firefox screenshots](../assets/store/README.md#store-inventory).
Firefox native popup remains **manual pre-release capture required**; do not
substitute a standalone page. The English import screenshot has a Russian
native file-input label; review whether to recapture for listing consistency.
Do not claim Android support or expand tested desktop platforms from the
manifest minimum alone.
