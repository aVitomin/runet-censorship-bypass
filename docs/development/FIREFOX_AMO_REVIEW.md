# Firefox AMO reviewer notes

## Scope and purpose

Submission-note draft for the planned 1.0 release, audited against
`8361608fa4ac52cc118cf5e6d32b3feb8772d167`. No new version has been uploaded.
Attach these notes to the exact validated package and source archive; record
that package's version, source commit and checksums separately. The current
manifest still says `0.0.4.0`, with minimum Firefox `154.0`.

Runet Censorship Bypass controls Firefox routing with Auto, Proxy and Direct
site rules. It is not a VPN or a proxy service. A clean installation starts off.
Save records settings; Apply activates them. Turn off releases the
extension-owned proxy setting without discarding saved settings.

## Permissions and data handling

The complete manifest inventory and per-permission data explanations are in
the [permission audit](../release/PERMISSIONS_AND_PRIVACY_1_0.md).

- `proxy`: apply/release browser proxy control and choose request routes.
- `webRequest` and `webRequestBlocking`: authorize requests, answer matching
  proxy-authentication challenges and clear request-bound retry state.
- `<all_urls>`: cover eligible web destinations for routing/authentication,
  including private windows once access is granted; not page-content scraping.
- `storage`: local settings, credentials, routing data/references, recovery and
  operational state.
- `alarms`: provider-check scheduling, gated by the release trust configuration.
  The current unconfigured remote channel does not perform update requests.
- `notifications`: localized attention notices, without credentials or
  private destination/proxy details.

There are no content scripts, developer telemetry or analytics uploads.
The required Mozilla data types are `authenticationInfo` and
`browsingActivity`: proxy authentication and destination information can be
transmitted as part of the routing function. They are not `none`.
See the [1.0 privacy notice](../release/PRIVACY_1_0.md).

Stored passwords are not returned in UI reads, diagnostics or exports.
Authentication is restricted to the matching request-authorized proxy and its
applied configuration; Save alone cannot replace active credentials.
HTTP/HTTPS proxy authentication is supported; universal SOCKS authentication
is not claimed. Existing connections and browser authentication caches may
outlive Apply.

## Private windows and browser boundaries

Firefox's proxy setting affects private windows too, so the extension requires
explicit private-window access before activation, even from a regular window.
Use Firefox's add-on settings to allow access, return to Options, choose
**Check again**, then **Apply**. The extension cannot grant this permission.
Checking permission does not activate routing.

Restricted-site access is a different browser permission and is not an Apply
prerequisite. The extension does not claim to detect that permission.
Privileged `about:` pages are not ordinary routable sites.

Revoking private access while active can leave requests blocked until the user
turns routing off or restores permission. Loss of proxy ownership withdraws the
active session without overwriting another owner's setting. Do not test in a
personal profile. Firefox's blocking fallback has a possible local-service
collision; there is no universal fail-closed or security-protection guarantee.

## Routing data and connection checks

Firefox packages verified declarative Anticensority routing data, not executable
provider PAC/JavaScript. The production remote update endpoint and keys are
unconfigured, so **Not configured** in Maintenance is expected. Do not insert
an arbitrary key/URL for review. Bundled rules arrive with extension updates.

Automatic proxy routes require separately running compatible local services;
their availability is not established by the data's presence or version.
A user-requested connection check uses an eligible explicit-Proxy origin,
omits website credentials/referrer, does not follow redirects and discards the
body. A matching proxy can still request configured proxy credentials. Limited
health status is not proof of all traffic routes.

Chromium differs: it supports additional PAC/custom sources and automatic
source/health checks. Those capabilities are not Firefox features.

## Reproduce and test

Use a fresh disposable desktop profile, the exact candidate XPI, and only
reviewer-controlled test origins/proxies and synthetic credentials. No personal
account or paid service is required. `news.example` below is a rule identifier,
not a public connectivity-test service. Source reproduction and package layout:
[Firefox build instructions](FIREFOX_RELEASE_BUILD.md).

1. Install the candidate. For unsigned pre-submission functional review, use
   temporary installation; ordinary user installation requires Mozilla signing.
   Confirm routing starts off and existing proxy settings are not activated
   by merely opening Options.
2. With private access denied, confirm Apply is unavailable with an explanation.
   Grant access through Firefox's add-on settings, return, choose Check again.
   Confirm this alone has not activated routing; explicitly Apply initial settings.
3. Add `news.example` → Direct → This exact host. Save without Apply.
   Confirm active settings remain unchanged and the pending summary contains
   **Site rules changed**, not **Proxy connections changed**. Then Apply.
4. Change a controlled proxy endpoint or synthetic credential and Save.
   Confirm **Proxy connections changed** appears and the previous applied
   connection remains in use until Apply. Exercise supported HTTP/HTTPS proxy
   authentication without recording the synthetic password in review logs.
5. Test Direct and Proxy with a reviewer-controlled web origin and enabled
   test proxy. Exercise Auto with the bundled rules and an appropriate local
   service, or record the missing service as an environmental prerequisite.
   Do not interpret a provider match as a working proxy.
6. With Options already open, Apply from the popup/another extension surface.
   Confirm status updates without reload. Repeat with an unsaved Options draft:
   preserve its values, keep Save available and Apply disabled until resolved.
   Popup Apply warns before including other saved changes; Review in Options
   applies nothing. Closing a popup before Apply discards its local choice.
7. Export settings and preview reimport. Confirm rules/proxy endpoints are
   present but usernames/passwords/custom-source URLs are absent. Confirm import
   replaces Saved only, makes no provider request and leaves active routing alone.
   Re-enter missing credentials (or explicitly mark unnecessary), Save, then Apply.
   A support export contains only environment/status and cannot be imported.
8. Confirm Maintenance shows bundled routing data and the unconfigured remote
   channel. Review EN/RU labels, pending summaries and local connection-check results.
9. Recreate the background context or restart Firefox and confirm recovery uses
   previously applied settings, not pending Saved settings. Test private-access
   revocation and external proxy-control loss in the disposable profile.
10. Turn off the extension's proxy control. Confirm the underlying browser proxy
    configuration is restored when the extension still owns the setting.
    Turning off does not erase saved settings.

These are reviewer instructions, not evidence that this documentation task ran
a new release QA cycle. Existing [visual regression evidence](../assets/store/regression-results.json)
covers Firefox 156.0.1 at the preceding runtime revision. Repeat release QA on
the exact submitted package. Firefox native popup remains
**manual pre-release capture required**.

## Maintainer submission attachments

Provide the exact unsigned candidate XPI, reviewer source archive, checksums,
source commit and reproducible build instructions through AMO's appropriate
fields. Do not include profiles, raw logs, secrets or personal test accounts.
Use the [listing draft](../release/FIREFOX_AMO_LISTING_1_0.md) and
[publication checklist](../release/STORE_PUBLICATION_CHECKLIST.md) only after
their final package/privacy review. Do not claim this fork is an already
published AMO listing or reuse a legacy add-on identity.
