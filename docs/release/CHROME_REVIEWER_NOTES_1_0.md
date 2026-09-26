# Chrome reviewer notes — optional 1.0 submission draft

Audited source: `8361608fa4ac52cc118cf5e6d32b3feb8772d167`.
Attach the exact validated candidate version/SHA/checksums when a submission is
authorized. These are instructions, not a claim that a new release or reviewer
test run was performed during documentation preparation.

## Purpose and permissions

The single purpose is user-controlled website routing through automatic PAC
rules, configured proxies or Direct. Clean installation starts off. Save and
configuration import do not activate routing; Apply is a separate user action.

The [permission inventory](PERMISSIONS_AND_PRIVACY_1_0.md) covers every actual
API and host permission. In short: `proxy` applies/releases the browser PAC
setting; `storage` keeps local configuration and recovery state; `alarms`
restores source-update and relevant health-check scheduling; `notifications`
shows attention messages; `activeTab` supplies the current site for the action
popup; `webRequest` and `webRequestAuthProvider` bind request/authentication
lifetimes and handle matching proxy challenges. Broad host access covers user
destinations, configured source hosts and checks. Explicit built-in source
grants overlap the broad grant; do not claim each adds indispensable scope.

No content scripts, telemetry, remote analytics, page-content scraping or
website-password collection is implemented. Local processing still includes
request metadata and optional proxy credentials. See the
[privacy notice](PRIVACY_1_0.md), not a “no data handled” declaration.

## PAC disclosure and publication hold

Chromium fetches selected built-in/custom PAC JavaScript, checks and combines
it with local routing choices, and passes the resulting PAC to the browser's
`chrome.proxy` PAC engine. It does not evaluate downloaded PAC in extension
JavaScript or load it as an extension script. Firefox instead packages verified
declarative routing data and has no user-custom PAC source interface.

This distinction does **not** establish Chrome Web Store approval. The
[proxy API documents PAC scripts](https://developer.chrome.com/docs/extensions/reference/api/proxy),
while the [MV3 policy](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements/)
restricts remotely supplied logic and specifies exceptions. We cannot infer
that this precise PAC path is accepted from absence of extension-side `eval`.
Disclose the behavior, obtain a policy determination for the candidate, and
keep optional Chrome publication on hold until resolved. Do not obscure the
behavior by describing all downloaded PAC as non-executable data.

Also review data-transport policy for user-configured HTTP proxies and the
loopback HTTP PAC exception; this extension does not add encryption. No policy
or security guarantee is inferred here. Any needed runtime change requires a
separate task and re-review, not an edit in this documentation branch.

## Controlled test setup

Use a disposable desktop profile and the exact package's root manifest. Use
reviewer-controlled web origins/proxies and synthetic credentials. Examples
such as `news.example` identify test rules, not reachable public services.
No personal account, third-party paid proxy or browsing profile is required.

For custom-source testing, serve this harmless PAC from a reviewer-controlled
loopback HTTP server, for example `http://127.0.0.1:8765/proxy.pac`:

```javascript
function FindProxyForURL(url, host) {
  return 'DIRECT';
}
```

This fixture deliberately does not establish proxy connectivity. A separate
authorized test proxy is needed to exercise the Proxy/authentication cases.
No test server is started by these notes.

## Expected behavior

1. Load the package in a fresh profile. Confirm routing is off. Open Options,
   select Manual rules only, Save if needed, and explicitly Apply. Active means
   browser routing control, not connection verification.
2. Add `news.example` → Direct with exact-host scope. Save only: previous
   applied settings remain active and Site rules changed is pending. Apply
   separately. Test domain-and-subdomain scope with separate synthetic names.
3. Configure an enabled reviewer-owned proxy and synthetic credentials. Save
   without Apply: active authentication remains unchanged. Apply, generate a
   fresh request to a controlled origin, and verify supported HTTP/HTTPS proxy
   authentication without exposing secrets. Browser auth caches may persist;
   use a fresh test profile/connection when distinguishing generations.
4. In a normal web tab, open the genuine action popup. Choose a new mode but
   close before Apply: the choice is not activated. With other Saved changes
   pending, verify Review in Options applies nothing and Apply all saved changes
   requires explicit confirmation. Unsaved Options drafts are not included.
5. Add the loopback custom PAC source above. Save: the source choice is stored
   but routing is not activated. Check/prepare source data, then Apply the
   reviewed saved configuration. Confirm the browser evaluates its Direct
   result. A reviewer-controlled HTTPS PAC source is also allowed; non-loopback
   HTTP and URL userinfo are rejected. Do not use a secret-bearing source URL.
6. Change the served fixture using only controlled test behavior. Check for
   updates without promoting pending user settings. Apply update rechecks and
   prepares the source, retaining applied user settings. Off routing stays off.
   Test an invalid/unavailable source and confirm failure is visible rather
   than claiming new data was applied. Scheduled refresh uses the same source
   model and does not silently enable routing.
7. Export and preview import. Confirm configuration export contains rules and
   proxy addresses but no usernames/passwords/custom-source URLs. Confirm
   import replaces Saved only and does not fetch PAC, Apply or turn routing on.
   Resolve missing credentials before a later Apply. Support export contains
   environment/status only and cannot be imported as configuration.
8. Review connection-check behavior with an explicit Proxy test origin.
   Chromium can check after popup Proxy Apply and repeat a relevant established
   target automatically; it can follow redirects. Website credentials/referrer
   are omitted, while matching proxy authentication remains possible.
9. Turn off routing and confirm the extension-owned proxy setting is released.
   Another extension/browser policy can prevent ownership; do not overwrite it.
   Chromium uses `mandatory: false`; browser/PAC errors are not a guaranteed
   all-traffic block and can lead to Direct connections.

The [listing draft](CHROME_WEB_STORE_LISTING_1_0.md) and
[publication checklist](STORE_PUBLICATION_CHECKLIST.md) cover metadata,
screenshots and privacy-dashboard completion. Do not use old upstream store
URLs as this fork's publisher, support site or public listing identity.
