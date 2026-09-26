# Chrome Web Store materials — optional 1.0 draft

English preparation only, based on
`8361608fa4ac52cc118cf5e6d32b3feb8772d167`. No store upload, manifest change or
approval is implied. Firefox Add-ons remains the primary publication target.
Resolve the PAC policy review in the [Chrome reviewer notes](CHROME_REVIEWER_NOTES_1_0.md)
before deciding to submit.

## Short description

Control website routing with Auto, Proxy and Direct rules, configurable PAC sources, and separate Save and Apply.

This proposed copy is below the
[132-character manifest description limit](https://developer.chrome.com/docs/extensions/reference/manifest/description).
Chrome takes the short description from packaged/localized manifest metadata;
this document does not change it. Reconcile the eventual approved English and
Russian package descriptions in a separately authorized release change.

## Long description — copy from here

Runet Censorship Bypass lets you choose how Chrome routes websites: follow an
automatic routing source, use a configured proxy, or connect directly. It is
a browser routing tool, not a VPN service or a proxy subscription.

### Features

- Auto, Proxy and Direct controls for the current website.
- Exact-host and domain-and-subdomain site rules.
- Built-in PAC sources, Manual rules only, and advanced custom PAC sources.
- Configurable own proxies and connections to separately running local tools.
- Separate Save and Apply, with a summary of saved but inactive changes.
- Manual settings Import/Export with preview and compatibility warnings.
- A separate sanitized support export.
- Routing-data status, source updates and limited connection-health checks.
- Supported HTTP/HTTPS proxy authentication.

### Review changes before applying

Auto follows the selected source after applicable explicit overrides are
removed; it does not always mean Direct. Proxy needs a suitable enabled
connection. Direct bypasses this extension's proxy routing for the selected
scope, not a system VPN. Exact-host rules affect one host; domain rules include
subdomains. Explicit Direct takes precedence over explicit Proxy.

Save records settings without changing active routing or credentials. Apply
activates the saved settings you reviewed. The popup warns when its Apply would
also include other saved changes. Unsaved edits in Options are not included.
Existing connections and browser authentication caches may outlive Apply.

### Sources and connections

Chromium supports PAC sources and advanced custom source URLs over HTTPS or
loopback HTTP. Use only sources and proxies you trust: the source determines
automatic routes, and a selected proxy may observe destinations and traffic
visible to its protocol. The extension does not install or start local services.
Manual rules only does not require a remote routing-data source.

Source checks and updates are distinct from connection checks. Updating routing
data retains applied user settings and leaves pending settings pending; it does
not turn routing on when off. Chromium can refresh sources automatically and
repeat connection checks for an established target while it remains relevant.
These checks are limited evidence, not a guarantee that every request uses a
particular route or that a service will remain available.

Firefox uses a different verified local routing-data model; it does not provide
this Chromium custom-PAC interface. Do not assume settings or source options
transfer identically between browsers.

### Privacy and transfer

Settings and configured credentials remain in your browser profile. There is
no developer telemetry, analytics or cloud synchronization. Routing and proxy
authentication process destination information and can transmit it, or matching
proxy credentials, to the services you use. Source downloads and connection
checks also make network requests. They are not analytics uploads.

Settings exports omit usernames, passwords and custom-source URLs, but still
contain site rules and proxy addresses: keep them private. Import previews and
replaces saved settings only; it does not download sources, Apply or turn on
routing. Re-enter missing credentials before applying. Support export is a
separate environment/status file, not a configuration backup; review it before
sharing.

“Protection active” means that the extension controls browser routing. The
extension does not promise anonymity, encryption, security protection,
guaranteed bypass or guaranteed connectivity. Chromium can connect directly
on some browser/PAC errors. SOCKS authentication depends on browser support and
is not universally supported. This extension does not route other applications
on your device.

### Support

Project and documentation:
[aVitomin/runet-censorship-bypass](https://github.com/aVitomin/runet-censorship-bypass).
Report ordinary problems through the
[support forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose).
Include browser/version, steps and sanitized results, not passwords, private
source URLs, configuration exports or profiles. For possible vulnerabilities,
follow the [security policy](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SECURITY.md).

## Permission justifications for the dashboard

Use the exact Chromium rows in the
[complete permission audit](PERMISSIONS_AND_PRIVACY_1_0.md#api-permissions--complete-manifest-inventory)
for `proxy`, `alarms`, `storage`, `notifications`, `webRequest`,
`webRequestAuthProvider` and `activeTab`. The host-permission table covers every
literal host grant, including `<all_urls>` and the overlapping built-in source
hosts. Do not add Firefox's `webRequestBlocking` justification to Chrome.

Single-purpose field draft:

> Let users control browser website routing through automatic PAC rules,
> configured proxies or direct connections, with explicit application of saved
> routing settings.

Privacy-practices preparation:

- Declare **Authentication information** for configured proxy credentials and
  **Web history** for destination/request information handled for routing, even
  though there is no developer browsing-history upload. Review any other live
  dashboard category against the exact package and routed-data disclosures.
- Explain local storage, source retrieval, proxy transmission, and limited
  connection checks using the [privacy notice](PRIVACY_1_0.md). Do not certify
  “no user data handled” on the basis of local processing alone.
- Explain PAC download/browser evaluation explicitly in the remote-code field;
  the reviewer notes identify the unresolved policy determination. Do not
  automatically choose “No” or assert an exemption/approval.
- Complete Limited Use/no-sale/purpose-restriction certifications only after
  the publisher has reviewed the exact submission. This draft is not consent
  to certify on the publisher's behalf.
- Publish and verify the approved privacy notice on main before entering its
  public URL. Use the repository homepage and issue forms above; no legacy store
  listing or upstream publisher URL is a substitute.

The [privacy dashboard guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
and [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/)
require accurate permission/data disclosures, including locally handled data.
Checked on 2026-09-26; reconfirm the live form before submission.

## Images and submission scope

Use the five [Chromium store screenshots](../assets/store/README.md#store-inventory),
the 440x280 promotional PNG and the verified packaged icon. Native popup images
are genuine documentation workflow captures, not padded 1280x800 store shots.
Follow the [current listing guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
and [image requirements](https://developer.chrome.com/docs/webstore/images).
The material is preparation only; there is no new public Chrome store URL to announce.
