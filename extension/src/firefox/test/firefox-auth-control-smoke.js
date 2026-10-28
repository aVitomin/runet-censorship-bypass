'use strict';

const Assert = require('node:assert/strict');
const ChildProcess = require('node:child_process');
const Crypto = require('node:crypto');
const Fs = require('node:fs');
const Http = require('node:http');
const Os = require('node:os');
const Path = require('node:path');
const Smoke = require('./firefox-lifecycle-smoke');

const projectRoot = Path.resolve(__dirname, '..', '..', '..');
const packageRoot = process.env.FIREFOX_PACKAGE_ROOT ?
  Path.resolve(process.env.FIREFOX_PACKAGE_ROOT) : Path.join(projectRoot, 'build', 'firefox');
const OWNER_ID = 'firefox-auth-owner-smoke@example.invalid';

function writeOwnerFixture(directory, port) {
  Fs.writeFileSync(Path.join(directory, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Firefox auth ownership fixture', version: '1.0',
    permissions: ['proxy'], host_permissions: ['<all_urls>'],
    browser_specific_settings: {gecko: {id: OWNER_ID, strict_min_version: '128.0',
      data_collection_permissions: {required: ['none']}}},
    background: {scripts: ['owner.js']},
  }));
  Fs.writeFileSync(Path.join(directory, 'owner.js'),
      'browser.proxy.settings.set({value:' + JSON.stringify({
        proxyType: 'manual', http: `127.0.0.1:${port}`, httpProxyAll: true,
        ssl: '', socks: '', socksVersion: 5, proxyDNS: false,
        passthrough: '', autoConfigUrl: '',
      }) + '});\n');
}

async function bounded(promise, milliseconds = 25000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('SMOKE_TIMEOUT')), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const username = Crypto.randomBytes(12).toString('hex');
  const passwords = {A: Crypto.randomBytes(20).toString('hex'),
    B: Crypto.randomBytes(20).toString('hex'),
    origin: Crypto.randomBytes(20).toString('hex')};
  const headers = Object.fromEntries(Object.entries(passwords).map(([key, password]) =>
    [key, 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')]));
  const observations = new Map();
  const servers = [];
  const report = {checks: [], cleanup: {}, packageKind: 'UNPACKED', authCacheClearCount: 0,
    recreationChecked: false};
  const quick = process.argv.includes('--quick');
  const manual = process.argv.includes('--manual');
  report.manualMode = manual;
  report.quickMode = quick;
  let client;
  let child;
  let profile;
  let ownerDirectory;
  let manualPackage;
  let phase = 'START';
  let origin;
  let controlHandle;
  let probeHandle;
  let directRequests = 0;
  let externalRequests = 0;
  let unexpectedCredentials = false;
  let allowed = 'A';
  let lastCommand = null;

  function checked(name) {
    report.checks.push(name);
    console.log('PASS: ' + name);
  }

  async function command(name, args) {
    lastCommand = name;
    return Smoke.webdriverValue(await bounded(client.command(name, args)));
  }

  async function execute(source, args = [], asynchronous = false) {
    return command(asynchronous ? 'WebDriver:ExecuteAsyncScript' : 'WebDriver:ExecuteScript', {
      script: source, args, newSandbox: false, sandbox: 'default',
      filename: 'firefox-auth-control-smoke.js', line: 1,
    });
  }

  async function rpc(type, fields = {}) {
    const response = await execute(`
      const done = arguments[arguments.length - 1];
      window.wrappedJSObject.browser.runtime.sendMessage(arguments[0]).then(
        done, () => done({ok: false}));
    `, [Object.assign({type}, fields)], true);
    Assert.equal(response.ok, true, 'RPC_FAILED');
    // Assertions must never dump a credential-bearing record on failure.
    Assert.equal(Object.values(passwords).some((value) =>
      JSON.stringify(response).includes(value)), false, 'RPC_EXPOSED_PASSWORD');
    return response.result;
  }

  async function clearAuthCache() {
    await command('Marionette:SetContext', {value: 'chrome'});
    try {
      await execute(`
        Components.classes['@mozilla.org/network/http-auth-manager;1']
          .getService(Components.interfaces.nsIHttpAuthManager).clearAll();
        return true;
      `);
      report.authCacheClearCount += 1;
    } finally {
      await command('Marionette:SetContext', {value: 'content'});
    }
  }

  async function waitFor(check, code) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await check()) return;
      await Smoke.delay(100);
    }
    throw new Error(code);
  }

  async function liveControl() {
    return execute(`
      const done = arguments[arguments.length - 1];
      window.wrappedJSObject.browser.proxy.settings.get({}).then(done);
    `, [], true);
  }

  async function badge() {
    return execute(`
      const done = arguments[arguments.length - 1];
      const b = window.wrappedJSObject.browser;
      b.tabs.query({active:true, currentWindow:true}).then(tabs =>
        b.action.getBadgeText({tabId:tabs[0].id})).then(done);
    `, [], true);
  }

  async function plainProbe(label, expected, directPort) {
    phase = label;
    await clearAuthCache();
    await command('WebDriver:SwitchToWindow', {handle: probeHandle});
    await command('WebDriver:Navigate', {url: `http://127.0.0.1:${directPort}/probe/${label}`});
    Assert.equal(await execute('return document.body.textContent === arguments[0];',
        [expected]), true, 'CONTROL_ROUTE_MISMATCH');
    await command('WebDriver:SwitchToWindow', {handle: controlHandle});
    checked(label);
  }

  async function probe(label, expected, directPort, options = {}) {
    phase = label;
    observations.set(label, []);
    await clearAuthCache();
    await command('WebDriver:SwitchToWindow', {handle: probeHandle});
    const url = `http://127.0.0.1:${directPort}/probe/${label}`;
    if (options.expectedStatus) {
      const result = await execute(`
        const done = arguments[arguments.length - 1];
        fetch(arguments[0], {cache: 'no-store', credentials: 'omit',
          signal: AbortSignal.timeout(10000)}).then(
          response => ({status: response.status}),
          () => ({networkError: true})).then(done);
      `, [url], true);
      Assert.equal(result.status, options.expectedStatus, 'ORIGIN_RESPONSE_BLOCKED');
      Assert.deepEqual(observations.get(label), ['NONE']);
    } else if (options.succeeds !== false) {
      await command('WebDriver:Navigate', {url});
      const bodyMatches = await execute('return document.body.textContent === arguments[0];',
          ['PROXY_' + expected]);
      Assert.equal(bodyMatches, true, 'PROXY_RESPONSE_MISMATCH');
      Assert.deepEqual(observations.get(label), ['NONE', expected]);
    } else {
      // Canceled navigation may never emit the load event Marionette awaits.
      // Observe a real same-origin page request's network rejection instead.
      const result = await execute(`
        const done = arguments[arguments.length - 1];
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        fetch(arguments[0], {cache: 'no-store', signal: controller.signal}).then(
          () => ({networkError: false, aborted: false}),
          error => ({networkError: error.name === 'TypeError', aborted: error.name === 'AbortError'})
        ).then(result => {clearTimeout(timer); done(result);});
      `, [url], true);
      Assert.equal(result.networkError, true, 'REJECTED_REQUEST_DID_NOT_FAIL');
      Assert.equal(result.aborted, false, 'REJECTED_REQUEST_TIMED_OUT');
      Assert.deepEqual(observations.get(label), options.sequence || ['NONE', expected, expected]);
    }
    await command('WebDriver:SwitchToWindow', {handle: controlHandle});
    checked(label);
  }

  async function originAuthenticationProbe(directPort, label = 'origin-authenticated') {
    phase = label;
    observations.set(label, []);
    await clearAuthCache();
    await command('WebDriver:SwitchToWindow', {handle: probeHandle});
    const result = await execute(`
      const done = arguments[arguments.length - 1];
      const request = new XMLHttpRequest();
      request.open('GET', arguments[0], true, arguments[1], arguments[2]);
      request.timeout = 10000;
      request.onload = () => done({status: request.status,
        authenticated: request.responseText === 'ORIGIN_AUTHENTICATED'});
      request.onerror = () => done({networkError: true});
      request.ontimeout = () => done({timedOut: true});
      request.send();
    `, [`http://127.0.0.1:${directPort}/probe/${label}`, username, passwords.origin], true);
    Assert.equal(result.status, 200, 'ORIGIN_AUTHENTICATION_BLOCKED');
    Assert.equal(result.authenticated, true, 'ORIGIN_AUTHENTICATION_FAILED');
    Assert.ok(observations.get(label).length > 0, 'ORIGIN_REQUEST_MISSING');
    Assert.ok(observations.get(label).every((category) => category === 'NONE'),
        'PROXY_CREDENTIALS_SENT_TO_ORIGIN');
    await command('WebDriver:SwitchToWindow', {handle: controlHandle});
    checked(label);
  }

  function respondToOriginAuthentication(request, response) {
    const originAuth = request.headers.authorization;
    unexpectedCredentials = unexpectedCredentials ||
      Boolean(request.headers['proxy-authorization']) ||
      Boolean(originAuth && originAuth !== headers.origin);
    const authenticated = originAuth === headers.origin;
    response.writeHead(authenticated ? 200 : 401, {
      'www-authenticate': 'Basic realm="origin-authenticated-fixture"',
      'content-type': 'text/plain', 'cache-control': 'no-store', 'connection': 'close',
    });
    response.end(authenticated ? 'ORIGIN_AUTHENTICATED' : 'ORIGIN_AUTH_REQUIRED');
  }

  try {
    const direct = Http.createServer((request, response) => {
      directRequests += 1;
      if (request.url === '/probe/origin-direct') {
        observations.get('origin-direct').push(request.headers['proxy-authorization'] ?
          'OTHER' : 'NONE');
        respondToOriginAuthentication(request, response);
        return;
      }
      unexpectedCredentials = unexpectedCredentials || Boolean(
          request.headers.authorization || request.headers['proxy-authorization']);
      response.writeHead(200, {'content-type': 'text/plain', 'cache-control': 'no-store'});
      response.end('DIRECT');
    });
    const proxy = Http.createServer((request, response) => {
      const label = new URL(request.url, 'http://fixture.invalid').pathname.split('/').at(-1);
      const observed = request.headers['proxy-authorization'];
      const category = !observed ? 'NONE' : observed === headers.A ? 'A' :
        observed === headers.B ? 'B' : 'OTHER';
      const entries = observations.get(label);
      if (entries) entries.push(category);
      if (label === 'origin-authenticated') {
        respondToOriginAuthentication(request, response);
        return;
      }
      unexpectedCredentials = unexpectedCredentials || Boolean(request.headers.authorization);
      if (label === 'origin-401') {
        response.writeHead(401, {'www-authenticate': 'Basic realm="origin-fixture"',
          'content-type': 'text/plain', 'cache-control': 'no-store', 'connection': 'close'});
        response.end('ORIGIN_AUTH_REQUIRED');
        return;
      }
      if (category !== allowed || !entries) {
        response.writeHead(entries && entries.length > 4 ? 502 : 407, {
          'proxy-authenticate': 'Basic realm="firefox-auth-smoke"',
          'content-type': 'text/plain', 'cache-control': 'no-store', 'connection': 'close',
        });
        response.end('AUTH_REQUIRED');
        return;
      }
      response.writeHead(200, {'content-type': 'text/plain',
        'cache-control': 'no-store', 'connection': 'close'});
      response.end('PROXY_' + category);
    });
    const external = Http.createServer((request, response) => {
      externalRequests += 1;
      unexpectedCredentials = unexpectedCredentials || Boolean(
          request.headers.authorization || request.headers['proxy-authorization']);
      response.writeHead(200, {'content-type': 'text/plain',
        'cache-control': 'no-store', 'connection': 'close'});
      response.end('EXTERNAL');
    });
    servers.push(direct, proxy, external);
    for (const server of servers) await Smoke.listen(server);
    const directPort = direct.address().port;
    const proxyPort = proxy.address().port;
    const firefox = Smoke.resolveFirefox();
    report.browser = Smoke.firefoxVersion(firefox);
    profile = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'rucb-firefox-auth-profile-'));
    const port = await Smoke.unusedPort();
    Fs.writeFileSync(Path.join(profile, 'user.js'), Smoke.profilePreferences(port, proxyPort) +
      '\nuser_pref("network.proxy.type", 0);\nuser_pref("intl.locale.requested", "en-US");\n');
    child = ChildProcess.spawn(firefox, ['-headless', '-no-remote', '-profile', profile,
      '-marionette', '-remote-allow-system-access', 'about:blank'], {
      env: Object.assign({}, process.env, {MOZ_CRASHREPORTER_DISABLE: '1',
        MOZ_DISABLE_NONLOCAL_CONNECTIONS: '1', MOZ_NO_REMOTE: '1', MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1'}),
      stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true,
    });
    phase = 'CONNECT';
    client = await Smoke.connectMarionette(port);
    await command('WebDriver:NewSession', {
      capabilities: {alwaysMatch: {pageLoadStrategy: 'normal'}, firstMatch: [{}]},
    });
    await command('WebDriver:SetTimeouts', {implicit: 0, pageLoad: 15000, script: 15000});
    controlHandle = (await command('WebDriver:GetWindowHandles')).at(-1);
    await command('WebDriver:SwitchToWindow', {handle: controlHandle});
    if (manual) {
      // A disposable package without the provider artifact proves the real
      // manual startup path cannot borrow a valid Anticensority baseline.
      manualPackage = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'rucb-firefox-manual-package-'));
      Fs.cpSync(packageRoot, manualPackage, {recursive: true,
        filter: (source) => Path.basename(source) !== 'anticensority-hosts-v1.data'});
    }
    await command('Addon:Install', {path: manualPackage || packageRoot,
      temporary: true, allowPrivateBrowsing: true});
    origin = await Smoke.extensionOrigin(client);
    await command('WebDriver:Navigate', {url: origin + '/pages/options/index.html'});
    const originalControl = await liveControl();
    phase = 'CONFIGURE_A';
    const initial = await rpc('firefox.settings.get');
    const settings = initial.settings;
    if (manual) settings.source = 'manual';
    settings.rules = {direct: [], proxy: ['127.0.0.1'], whitelist: []};
    settings.flags = {useProviderProxies: false, ownProxiesOnlyForOwnSites: true,
      replaceDirectWithProxy: false, noDirect: manual};
    for (const key of ['localTor', 'torBrowser']) {
      Object.assign(settings[key], {
        useForProxyRules: false, useForOnion: false, useAsDirectReplacement: false,
      });
    }
    Object.assign(settings.warp, {useForProxyRules: false, useAsDirectReplacement: false});
    settings.ownProxies = [{id: 'auth-fixture', enabled: true, type: 'HTTP',
      host: '127.0.0.1', port: proxyPort, proxyDNS: false, failoverTimeoutSeconds: null,
      useAsDirectReplacement: false,
      credentials: {mode: 'SET', username, password: passwords.A}}];
    await rpc('firefox.settings.replace', {expectedRevision: initial.revision, settings});
    Assert.equal((await rpc('firefox.configuration.get')).active, false);
    const savedA = await rpc('firefox.settings.get');
    await rpc('firefox.activation.apply', {expectedRevision: savedA.revision});
    const activeA = await rpc('firefox.configuration.get');
    Assert.equal(activeA.active, true);
    probeHandle = (await command('WebDriver:NewWindow', {type: 'tab'})).handle;
    await probe('initial-A', 'A', directPort);
    if (manual) {
      const beforeUpdate = await rpc('firefox.configuration.get');
      Assert.equal((await rpc('firefox.provider.update.install')).status, 'DEFERRED');
      Assert.equal((await rpc('firefox.configuration.get')).effectiveId, beforeUpdate.effectiveId);
      checked('manual-install-request-preserves-source');
      const beforeDirect = directRequests;
      const result = await execute(`
        const done = arguments[arguments.length - 1];
        fetch(arguments[0], {signal: AbortSignal.timeout(5000)}).then(
          () => done(false), error => done(error.name === 'TypeError'));
      `, [`http://localhost:${directPort}/probe/manual-no-direct`], true);
      Assert.equal(result, true, 'MANUAL_NO_DIRECT_FAILED');
      Assert.equal(directRequests, beforeDirect);
      checked('manual-noDirect-blocks-unlisted-route');
    }

    phase = 'SAVE_PASSWORD_B';
    const settingsB = savedA.settings;
    if (manual) settingsB.source = 'anticensority';
    settingsB.ownProxies[0].credentials = {mode: 'SET', username, password: passwords.B};
    await rpc('firefox.settings.replace', {expectedRevision: savedA.revision, settings: settingsB});
    const pendingB = await rpc('firefox.configuration.get');
    Assert.equal(pendingB.pending, true);
    Assert.equal(pendingB.effectiveId, activeA.effectiveId);
    await probe('saved-B-still-A', 'A', directPort);

    if (!quick) {
      const bootId = await execute(
          'return window.wrappedJSObject.browser.extension.getBackgroundPage().rucbFirefoxRuntime.bootId;');
      await command('WebDriver:Navigate', {url: 'about:blank'});
      phase = 'IDLE_RECREATION';
      console.log('Waiting for genuine event-page recreation with pending password B...');
      await Smoke.delay(65000);
      await command('WebDriver:Navigate', {url: origin + '/pages/options/index.html'});
      const recovered = await rpc('firefox.configuration.get');
      Assert.equal(recovered.active, true);
      Assert.equal(recovered.pending, true);
      Assert.equal(recovered.effectiveId, activeA.effectiveId);
      Assert.notEqual(await execute(
          'return window.wrappedJSObject.browser.extension.getBackgroundPage().rucbFirefoxRuntime.bootId;'),
      bootId);
      await probe('recovered-A', 'A', directPort);
      report.recreationChecked = true;
    }

    phase = 'APPLY_PASSWORD_B';
    let applyRevision = pendingB.savedRevision;
    if (manual) {
      const failed = await execute(`
        const done = arguments[arguments.length - 1];
        window.wrappedJSObject.browser.runtime.sendMessage({type:'firefox.activation.apply',
          expectedRevision: arguments[0]}).then(done);
      `, [applyRevision], true);
      Assert.equal(failed.ok, false, 'MISSING_PROVIDER_APPLY_SUCCEEDED');
      Assert.equal((await rpc('firefox.configuration.get')).effectiveId, activeA.effectiveId);
      settingsB.source = 'manual';
      const saved = await rpc('firefox.settings.replace', {expectedRevision: applyRevision, settings: settingsB});
      applyRevision = saved.revision;
      checked('failed-provider-Apply-preserves-manual');
    }
    await rpc('firefox.activation.apply', {expectedRevision: applyRevision});
    allowed = 'B';
    const activeB = await rpc('firefox.configuration.get');
    Assert.equal(activeB.active, true);
    Assert.equal(activeB.pending, false);
    Assert.notEqual(activeB.effectiveId, activeA.effectiveId);
    await probe('applied-B', 'B', directPort);
    allowed = 'NEVER';
    await probe('rejected-B-bounded', 'B', directPort, {succeeds: false});
    allowed = 'B';
    await probe('new-request-B', 'B', directPort);
    await probe('origin-401', null, directPort, {expectedStatus: 401});
    await originAuthenticationProbe(directPort);
    phase = 'APPLY_PASSWORDLESS';
    const passwordless = await rpc('firefox.settings.get');
    passwordless.settings.ownProxies[0].credentials = {mode: 'NONE'};
    await rpc('firefox.settings.replace', {
      expectedRevision: passwordless.revision, settings: passwordless.settings,
    });
    await rpc('firefox.activation.apply', {expectedRevision: passwordless.revision + 1});
    await probe('passwordless-407', null, directPort, {succeeds: false, sequence: ['NONE']});
    Assert.equal(directRequests, 0, 'UNEXPECTED_DIRECT_REQUEST');

    phase = 'APPLY_DIRECT_RULE';
    const directSettings = await rpc('firefox.settings.get');
    directSettings.settings.rules = {direct: ['127.0.0.1'], proxy: [], whitelist: []};
    await rpc('firefox.settings.replace', {
      expectedRevision: directSettings.revision, settings: directSettings.settings,
    });
    await rpc('firefox.activation.apply', {expectedRevision: directSettings.revision + 1});
    await originAuthenticationProbe(directPort, 'origin-direct');

    phase = 'EXTERNAL_TAKEOVER';
    const externalPort = external.address().port;
    ownerDirectory = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'rucb-firefox-auth-owner-'));
    writeOwnerFixture(ownerDirectory, externalPort);
    await command('Addon:Install', {
      path: ownerDirectory, temporary: true, allowPrivateBrowsing: true,
    });
    await waitFor(async () => {
      const control = await liveControl();
      const capabilities = await rpc('firefox.capabilities.get');
      return control.levelOfControl === 'controlled_by_other_extensions' &&
        capabilities.runtimeState === 'OFF' && capabilities.durableIntent === 'OFF';
    }, 'TAKEOVER_NOT_RECONCILED');
    Assert.equal((await rpc('firefox.configuration.get')).active, false);
    await waitFor(async () => await badge() === 'EXT', 'EXTERNAL_BADGE_MISSING');
    await plainProbe('external-owner-routing', 'EXTERNAL', directPort);

    phase = 'CLEAR_UNDER_EXTERNAL_OWNER';
    const clear = await execute(`
      const done = arguments[arguments.length - 1];
      window.wrappedJSObject.browser.runtime.sendMessage({type:'firefox.activation.clear'}).then(done);
    `, [], true);
    Assert.equal(clear.ok, false);
    Assert.equal(clear.error.code, 'OWNERSHIP_MISMATCH');
    const stillExternal = await liveControl();
    Assert.equal(stillExternal.levelOfControl, 'controlled_by_other_extensions');
    Assert.equal(stillExternal.value.http === `127.0.0.1:${externalPort}`, true);
    await plainProbe('clear-preserves-external-owner', 'EXTERNAL', directPort);

    phase = 'EXTERNAL_RELEASE';
    await command('Addon:Uninstall', {id: OWNER_ID});
    await waitFor(async () => {
      const control = await liveControl();
      const capabilities = await rpc('firefox.capabilities.get');
      return control.levelOfControl === originalControl.levelOfControl &&
        control.value.proxyType === originalControl.value.proxyType &&
        capabilities.runtimeState === 'OFF' && capabilities.durableIntent === 'OFF';
    }, 'RELEASE_NOT_RECONCILED');
    await waitFor(async () => await badge() === 'OFF', 'OFF_BADGE_MISSING');
    await plainProbe('release-stays-off-and-direct', 'DIRECT', directPort);
    Assert.equal((await rpc('firefox.configuration.get')).active, false);
    Assert.equal(unexpectedCredentials, false, 'CREDENTIALS_REACHED_WRONG_RECEIVER');
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    report.phase = phase;
    report.lastCommand = lastCommand;
    const failureLine = String(error && error.stack).match(/firefox-auth-control-smoke\.js:(\d+)/);
    report.failureLine = failureLine ? Number(failureLine[1]) : null;
    // Never serialize raw browser errors, request headers or RPC arguments.
    const safeFailures = ['SMOKE_TIMEOUT', 'TAKEOVER_NOT_RECONCILED',
      'EXTERNAL_BADGE_MISSING', 'RELEASE_NOT_RECONCILED', 'OFF_BADGE_MISSING'];
    report.failure = safeFailures.includes(error && error.message) ? error.message :
      error && error.code === 'ERR_ASSERTION' ? 'ASSERTION_FAILED' : 'SMOKE_FAILED';
    process.exitCode = 1;
  } finally {
    report.authentication = Object.fromEntries(observations);
    report.directRequests = directRequests;
    report.externalRequests = externalRequests;
    report.unexpectedCredentials = unexpectedCredentials;
    if (client) {
      await bounded(client.command('Marionette:Quit', {flags: ['eForceQuit']}), 5000)
          .catch(() => undefined);
      client.close();
    }
    if (child) {
      await Smoke.waitForExit(child, 10000).catch(async () => {
        child.kill();
        await Smoke.waitForExit(child, 5000);
      });
      report.cleanup.browserExited = child.exitCode !== null;
    }
    for (const server of servers) {
      server.closeAllConnections();
      await Smoke.closeServer(server);
    }
    report.cleanup.serversClosed = true;
    if (profile) {
      Smoke.safeRemoveTemporary(profile, 'rucb-firefox-auth-profile-');
      report.cleanup.profileRemoved = !Fs.existsSync(profile);
    }
    if (ownerDirectory) {
      Smoke.safeRemoveTemporary(ownerDirectory, 'rucb-firefox-auth-owner-');
      report.cleanup.ownerRemoved = !Fs.existsSync(ownerDirectory);
    }
    if (manualPackage) {
      Smoke.safeRemoveTemporary(manualPackage, 'rucb-firefox-manual-package-');
      report.cleanup.manualPackageRemoved = !Fs.existsSync(manualPackage);
    }
    console.log(JSON.stringify(report, null, 2));
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('Firefox auth smoke cleanup failed.');
    process.exitCode = 1;
  });
}
