# Firefox AMO reviewer notes

## Scope and purpose

Reviewer reference for the prepared `1.0.1` update. Published `1.0.0` was
verified on 2026-10-28; preparation of this update does not establish its
submission, approval or signing. Attach the exact source commit and checksums
for the package being submitted.
The prepared manifest minimum is Firefox `140.0`, calculated from required
APIs; see [compatibility and actual QA](BROWSER_COMPATIBILITY.md).

Runet Censorship Bypass — Revived controls Firefox routing with Auto, Proxy and Direct
site rules. It is not a VPN or a proxy service. A clean installation starts off.
Save records settings; Apply activates them. Turn off releases the
extension-owned proxy setting without discarding saved settings.

## Permissions and data handling

The complete manifest inventory and per-permission data explanations are in
the [permission audit](../release/PERMISSIONS_AND_PRIVACY_1_0.md).

- `proxy`: apply/release browser proxy control and choose request routes.
- `webRequest` and `webRequestBlocking`: authorize requests, answer matching
  proxy-authentication challenges and clear request-bound retry state.
  The website-auth retry guard requests response headers but checks only
  status 401 and the presence of the WWW-Authenticate header name; it does not
  read or retain header values.
- `<all_urls>`: cover eligible web destinations for routing/authentication,
  including private windows once access is granted; not page-content scraping.
- `storage`: local settings, credentials, routing data/references, recovery and
  operational state.
- `alarms`: fixed HTTPS routing-data checks every 12 hours, with validated
  promotion when the runtime and selected source permit it. Refresh keeps OFF
  off and does not apply pending user settings.
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
outlive Apply. Website authentication remains handled by Firefox; the extension
does not answer website challenges with stored proxy credentials.

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

Firefox packages a verified declarative Anticensority baseline and can refresh
it from two fixed HTTPS sources. It extracts bounded static data without executing
downloaded PAC JavaScript. Source/date/format/hash checks do not authenticate an
author signature; the separate signed-manifest endpoint and keys remain
unconfigured. **Update routing data** and the 12-hour alarm use the same safe
check-and-promotion operation. A valid source may be old and unchanged.

**Only my rules and connections** uses a package-owned policy without provider
dataset reads during Apply/recovery. Existing rules, onion routing and flags
still apply; default unmatched routing is Direct. Source checks continue, but
updates stay prepared while Saved or Effective selects manual. Changing the
source requires explicit Save and Apply.

Source attribution and the pinned dataset provenance are available in
[Data sources and attribution](../legal/DATA_SOURCES.md) and the packaged
`THIRD_PARTY_NOTICES/NOTICE.txt`. These are attribution statements, not a claim
that the generator's license covers the dataset or grants redistribution rights.

Automatic proxy routes require separately running compatible local services;
their availability is not established by the data's presence or version.
A user-requested connection check uses an eligible explicit-Proxy origin,
omits website credentials/referrer, does not follow redirects and discards the
body. A matching proxy can still request configured proxy credentials. Limited
health status is not proof of all traffic routes.

Chromium additionally supports PAC/custom sources and automatic relevant
connection-health checks. Firefox has automatic source refresh but only
user-triggered connection checks. Terminal Direct fallback and exhausted
proxy-auth retry behavior remain documented routing differences.

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
   Do not interpret a provider match as a working proxy. Also choose Only my
   rules and connections, Save and Apply; verify controlled explicit Proxy
   and Direct routes without depending on an Anticensority match.
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
8. Confirm Maintenance distinguishes source-data time, check time and HTTPS
   validation without an author signature. Refresh may return unchanged older
   data. Verify OFF stays off and an active refresh leaves pending Saved
   settings pending. In manual mode, a candidate remains prepared without
   switching sources. Review EN/RU labels and local connection-check results.
9. Recreate the background context or restart Firefox and confirm recovery uses
   previously applied settings, not pending Saved settings. Test private-access
   revocation and external proxy-control loss in the disposable profile.
10. Turn off the extension's proxy control. Confirm the underlying browser proxy
    configuration is restored when the extension still owns the setting.
    Turning off does not erase saved settings.

These are reviewer instructions, not evidence that every scenario was repeated
on the current package. Record exact-package QA separately. The
[published 1.0 gallery](../assets/releases/1.0/README.md) includes a genuine
toolbar popup from that release; capture new listing images from the updated
package rather than relabelling earlier screenshots.

## Maintainer submission attachments

Provide the exact unsigned candidate XPI, reviewer source archive, checksums,
source commit and reproducible build instructions through AMO's appropriate
fields. Do not include profiles, raw logs, secrets or personal test accounts.
Use the [listing draft](../release/FIREFOX_AMO_LISTING_1_0.md) and
[publication checklist](../release/STORE_PUBLICATION_CHECKLIST.md) only after
their final package/privacy review. Update the existing fork listing, retaining
its Gecko ID and URL; do not reuse the upstream add-on identity or claim that
the prepared update has already been published.
