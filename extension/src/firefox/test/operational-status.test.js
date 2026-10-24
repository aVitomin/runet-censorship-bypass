'use strict';

const Assert = require('node:assert');
const Operational = require('../background/operational-status');

function settings() {

  return {
    schemaVersion: 1,
    rules: {direct: [], proxy: ['proxy.example'], whitelist: []},
    ownProxies: [{
      id: 'fixture',
      enabled: true,
      type: 'HTTPS',
      host: 'proxy.internal',
      port: 8443,
      proxyDNS: false,
      failoverTimeoutSeconds: null,
      useAsDirectReplacement: false,
      credentials: {mode: 'KEEP', username: 'fixture-user'},
    }],
    localTor: {
      type: 'SOCKS5', host: 'localhost', port: 9050, proxyDNS: true,
      failoverTimeoutSeconds: null, useForProxyRules: false,
      useForOnion: true, useAsDirectReplacement: false,
    },
    torBrowser: {
      type: 'SOCKS5', host: 'localhost', port: 9150, proxyDNS: true,
      failoverTimeoutSeconds: null, useForProxyRules: false,
      useForOnion: true, useAsDirectReplacement: false,
    },
    warp: {
      candidates: [{
        id: 'warp', type: 'SOCKS5', host: '127.0.0.1', port: 40000,
        proxyDNS: true, failoverTimeoutSeconds: null,
      }],
      useForProxyRules: false,
      useAsDirectReplacement: false,
    },
    flags: {
      useProviderProxies: true,
      ownProxiesOnlyForOwnSites: true,
      replaceDirectWithProxy: false,
      noDirect: false,
    },
  };

}

function harness(overrides = {}) {

  const stored = overrides.stored || {};
  const actionCalls = [];
  const notifications = [];
  const createdTabs = [];
  let activation = overrides.activation || {
    runtimeState: 'READY',
    active: true,
    durableIntent: 'ON',
    recoveryStatus: 'ACTIVE',
    failureCode: null,
  };
  let now = overrides.now || 1000;
  let fetchCalls = 0;
  const fetchInits = [];
  let settingsWrites = 0;
  let settingsReads = 0;
  let siteReads = 0;
  let tabReads = 0;
  let controlReads = 0;
  let routingWrites = 0;
  const actionApi = {};
  for (const method of [
    'setBadgeBackgroundColor', 'setBadgeText', 'setBadgeTextColor',
    'setIcon', 'setTitle',
  ]) {
    actionApi[method] = async (params) => actionCalls.push({method, params});
  }
  const options = {
    storageArea: {
      async get(key) {

        return {[key]: stored[key]};

      },
      async set(update) {

        Object.assign(stored, JSON.parse(JSON.stringify(update)));

      },
    },
    actionApi,
    notificationsApi: {
      async create(id, details) {

        notifications.push({id, details});
        return id;

      },
      async clear() {

        return true;

      },
    },
    tabsApi: {
      async query() {

        tabReads += 1;
        if (overrides.tabQuery) return overrides.tabQuery();
        return [{id: 7, active: true, url: 'https://proxy.example/private'}];

      },
      async get(tabId) {

        tabReads += 1;
        if (overrides.tabGet) return overrides.tabGet(tabId);
        return {id: tabId, active: true, url: 'https://proxy.example/path'};

      },
      async create(params) {

        createdTabs.push(params);

      },
    },
    runtimeApi: {
      getManifest: () => ({version: '0.0.4.0'}),
      getBrowserInfo: async () => ({name: 'Firefox', version: '154.0.1'}),
      getURL: (path) => `moz-extension://fixture/${path}`,
    },
    extensionApi: {
      isAllowedIncognitoAccess: async () => overrides.privateAccess !== false,
    },
    proxySettings: {
      async get() {

        controlReads += 1;
        if (overrides.controlRead) return overrides.controlRead();
        return {levelOfControl: overrides.controlLevel ||
          'controlled_by_this_extension'};

      },
    },
    settingsController: {
      async get() {

        settingsReads += 1;
        return {revision: 3, settings: settings()};

      },
      async replace() {

        settingsWrites += 1;

      },
    },
    siteController: {
      async get(tabUrl) {

        siteReads += 1;
        if (overrides.siteGet) return overrides.siteGet(tabUrl);
        return {
          target: {controllable: true, host: new URL(tabUrl).hostname},
          route: {mode: overrides.siteMode || 'PROXY'},
        };

      },
      async replace() {

        routingWrites += 1;

      },
    },
    activationSnapshot: () => activation,
    async fetch(url, init) {

      fetchCalls += 1;
      fetchInits.push(init);
      if (overrides.fetchError) {
        throw overrides.fetchError;
      }
      return {
        url,
        init,
        body: {cancel: async () => undefined},
      };

    },
    AbortController,
    getMessage: (key) => `message:${key}`,
    getDatasetInfo: () => ({available: true, version: 'public-v1'}),
    now: () => ++now,
  };
  const controller = Operational.createController(options);
  return {
    actionCalls,
    controller,
    createdTabs,
    fetchCalls: () => fetchCalls,
    fetchInits,
    notifications,
    operationalState: () => stored[Operational.STORAGE_KEY],
    routingWrites: () => routingWrites,
    setActivation(value) {

      activation = value;

    },
    settingsWrites: () => settingsWrites,
    settingsReads: () => settingsReads,
    siteReads: () => siteReads,
    tabReads: () => tabReads,
    controlReads: () => controlReads,
    stored,
  };

}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};
}

describe('Firefox operational status', function() {

  it('normalizes health state without exposing its target origin', function() {

    const state = Operational.normalizeState({
      schemaVersion: 1,
      health: {
        status: 'ERROR',
        code: 'HEALTH_CHECK_FAILED',
        checkedAt: 42,
        candidateType: 'ownProxy',
        targetOrigin: 'https://example.com/private?q=secret',
      },
      lastNotification: {key: 'CONTROL_LOSS', at: 40},
    });
    Assert.strictEqual(state.health.targetOrigin, 'https://example.com');
    Assert.deepStrictEqual(Operational.publicHealth(state.health), {
      status: 'ERROR',
      code: 'HEALTH_CHECK_FAILED',
      checkedAt: 42,
      candidateType: 'ownProxy',
    });

  });

  it('rejects credential-bearing and non-http health targets', function() {

    Assert.strictEqual(
        Operational.normalizeOrigin('https://user:pass@example.com'), null,
    );
    Assert.strictEqual(Operational.normalizeOrigin('file:///secret'), null);

  });

  it('summarizes only proxy types and counts', function() {

    const summary = Operational.proxySummary(settings());
    Assert.deepStrictEqual(summary, {
      candidateType: 'ownProxy',
      configuredCount: 4,
      enabledCount: 1,
      types: ['HTTPS', 'SOCKS5'],
    });
    Assert.strictEqual(Object.hasOwn(summary, 'host'), false);
    Assert.strictEqual(Object.hasOwn(summary, 'credentials'), false);

  });

  for (const [mode, badge] of [
    ['AUTO', 'A'], ['PROXY', 'P'], ['DIRECT', 'D'],
  ]) {
    it(`derives the active ${mode} toolbar state`, function() {

      const value = Operational.deriveToolbarPresentation({
        activation: {runtimeState: 'READY'},
        controlLevel: 'controlled_by_this_extension',
        health: {status: 'UNKNOWN'},
        site: {target: {controllable: true}, route: {mode}},
      }, (key) => key);
      Assert.strictEqual(value.kind, mode);
      Assert.strictEqual(value.badgeText, badge);

    });
  }

  it('derives OFF, busy, external, and blocked toolbar states', function() {

    const translate = (key) => key;
    const base = {controlLevel: 'controllable_by_this_extension'};
    Assert.strictEqual(Operational.deriveToolbarPresentation(Object.assign({
      activation: {runtimeState: 'OFF'},
    }, base), translate).badgeText, 'OFF');
    Assert.strictEqual(Operational.deriveToolbarPresentation(Object.assign({
      activation: {runtimeState: 'OFF'}, operation: 'APPLY',
    }, base), translate).kind, 'BUSY');
    Assert.strictEqual(Operational.deriveToolbarPresentation({
      activation: {runtimeState: 'READY'},
      controlLevel: 'controlled_by_other_extensions',
    }, translate).badgeText, 'EXT');
    Assert.strictEqual(Operational.deriveToolbarPresentation(Object.assign({
      activation: {runtimeState: 'FAILED', recoveryStatus: 'FAILED'},
    }, base), translate).badgeText, '!');

  });

  it('lets a health error override the active mode badge', function() {

    const value = Operational.deriveToolbarPresentation({
      activation: {runtimeState: 'READY'},
      controlLevel: 'controlled_by_this_extension',
      health: {status: 'ERROR', code: 'HEALTH_CHECK_FAILED'},
      site: {target: {controllable: true}, route: {mode: 'PROXY'}},
    }, (key) => key);
    Assert.strictEqual(value.kind, 'HEALTH_ERROR');
    Assert.strictEqual(value.badgeText, '!');

  });

  it('checks a Proxy origin without mutating routing or settings', async function() {

    const test = harness();
    const result = await test.controller.checkHealth(
        'https://proxy.example/private?q=secret',
    );
    Assert.strictEqual(result.status, 'OK');
    Assert.strictEqual(test.fetchCalls(), 1);
    Assert.strictEqual(test.fetchInits[0].mode, 'no-cors');
    Assert.strictEqual(test.fetchInits[0].credentials, 'omit');
    Assert.strictEqual(test.fetchInits[0].redirect, 'manual');
    Assert.strictEqual(test.fetchInits[0].referrerPolicy, 'no-referrer');
    Assert.strictEqual(test.routingWrites(), 0);
    Assert.strictEqual(test.settingsWrites(), 0);
    Assert.strictEqual(
        test.operationalState().health.targetOrigin,
        'https://proxy.example',
    );

  });

  it('does not check health while protection is OFF', async function() {

    const test = harness({
      activation: {
        runtimeState: 'OFF', active: false, durableIntent: 'OFF',
        recoveryStatus: 'OFF', failureCode: null,
      },
    });
    const result = await test.controller.checkHealth('https://proxy.example');
    Assert.strictEqual(result.code, 'HEALTH_NOT_ACTIVE');
    Assert.strictEqual(test.fetchCalls(), 0);

  });

  it('requires an explicit Proxy rule for the health target', async function() {

    const test = harness({siteMode: 'AUTO'});
    const result = await test.controller.checkHealth('https://proxy.example');
    Assert.strictEqual(result.code, 'HEALTH_PROXY_RULE_REQUIRED');
    Assert.strictEqual(test.fetchCalls(), 0);

  });

  it('records a sanitized failure and creates a fixed notification', async function() {

    const test = harness({fetchError: new Error('secret.example/private')});
    const result = await test.controller.checkHealth('https://proxy.example');
    Assert.strictEqual(result.status, 'ERROR');
    Assert.strictEqual(result.code, 'HEALTH_CHECK_FAILED');
    Assert.strictEqual(test.notifications.length, 1);
    Assert.deepStrictEqual(Object.keys(test.notifications[0].details).sort(), [
      'iconUrl', 'message', 'title', 'type',
    ]);
    Assert.strictEqual(
        test.notifications[0].details.message,
        'message:notificationHealthFailure',
    );

  });

  it('does not notify twice inside the attention cooldown', async function() {

    const test = harness();
    Assert.strictEqual((await test.controller.notify('CONTROL_LOSS')).ok, true);
    Assert.strictEqual((await test.controller.notify('CONTROL_LOSS')).ok, false);
    Assert.strictEqual(test.notifications.length, 1);

  });

  it('notifies blocked private recovery but not normal OFF startup', async function() {

    const blocked = harness({
      activation: {
        runtimeState: 'FAILED', active: false, durableIntent: 'ON',
        recoveryStatus: 'BLOCKED_PRIVATE_ACCESS',
        failureCode: 'PRIVATE_ACCESS_REQUIRED',
      },
    });
    Assert.strictEqual(
        (await blocked.controller.reconcileStartupAttention()).ok, true,
    );
    const off = harness({
      activation: {
        runtimeState: 'OFF', active: false, durableIntent: 'OFF',
        recoveryStatus: 'OFF', failureCode: null,
      },
    });
    Assert.strictEqual(
        (await off.controller.reconcileStartupAttention()).status,
        'NOT_REQUIRED',
    );

  });

  it('returns a strictly redacted diagnostics record', async function() {

    const test = harness();
    const result = await test.controller.publicStatus();
    Assert.strictEqual(result.diagnostics.extensionVersion, '0.0.4.0');
    Assert.strictEqual(result.diagnostics.browserVersion, '154.0.1');
    Assert.strictEqual(result.diagnostics.datasetVersion, 'public-v1');
    Assert.deepStrictEqual(result.diagnostics.proxyTypes, ['HTTPS', 'SOCKS5']);
    for (const forbidden of [
      'host', 'port', 'password', 'credentials', 'authRef', 'floorIdentity',
      'artifactSha256', 'targetOrigin',
    ]) {
      Assert.strictEqual(
          Object.hasOwn(result.diagnostics, forbidden), false, forbidden,
      );
    }

  });

  it('uses a supplied verified snapshot only for that diagnostics call', async function() {
    const test = harness();
    const verified = {revision: 2, settings: settings()};
    verified.settings.ownProxies = [];
    const bundled = await test.controller.publicStatus(verified);
    Assert.strictEqual(test.settingsReads(), 0);
    const fresh = await test.controller.publicStatus();
    Assert.strictEqual(test.settingsReads(), 1);
    Assert.strictEqual(fresh.diagnostics.configuredProxyCount,
        bundled.diagnostics.configuredProxyCount + 1);
  });

  it('maps an unknown internal recovery status to a fixed failure state',
      async function() {

        const test = harness({activation: {
          runtimeState: 'FAILED', active: false, durableIntent: 'ON',
          recoveryStatus: 'secret-bearing-unknown-state',
          failureCode: 'INVALID recovery detail',
        }});
        const result = await test.controller.publicStatus();
        Assert.strictEqual(result.diagnostics.recoveryStatus, 'FAILED');
        Assert.strictEqual(result.diagnostics.recoveryFailureCode, null);

      });

  it('restores health and toolbar presentation after recreation', async function() {

    const first = harness({fetchError: new Error('fixture failure')});
    await first.controller.checkHealth('https://proxy.example');
    const second = harness({stored: first.stored});
    await second.controller.refreshToolbar();
    const badge = second.actionCalls.find((call) =>
      call.method === 'setBadgeText');
    Assert.strictEqual(badge.params.text, '!');
    Assert.strictEqual(
        (await second.controller.publicStatus()).health.status, 'ERROR',
    );

  });

  it('skips unused site reads but still checks live control', async function() {
    for (const [activation, health, badge] of [
      [{runtimeState: 'OFF'}, 'UNKNOWN', 'OFF'],
      [{runtimeState: 'INITIALIZING'}, 'UNKNOWN', '…'],
      [{runtimeState: 'FAILED'}, 'UNKNOWN', '!'],
      [{runtimeState: 'READY', recoveryStatus: 'BLOCKED_PRIVATE_ACCESS'}, 'UNKNOWN', '!'],
      [{runtimeState: 'READY', failureCode: 'CONTROL_LOSS'}, 'UNKNOWN', 'EXT'],
      [{runtimeState: 'READY'}, 'ERROR', '!'],
    ]) {
      const test = harness({activation, stored: {[Operational.STORAGE_KEY]: {
        schemaVersion: 1, health: {status: health},
      }}});
      await test.controller.refreshToolbar();
      Assert.strictEqual(test.siteReads(), 0);
      Assert.strictEqual(test.controlReads(), 1);
      Assert.strictEqual(test.actionCalls.find((call) =>
        call.method === 'setBadgeText').params.text, badge);
    }
    const external = harness({activation: {runtimeState: 'OFF'},
      controlLevel: 'controlled_by_other_extensions'});
    await external.controller.refreshToolbar();
    Assert.strictEqual(external.siteReads(), 0);
    Assert.strictEqual(external.actionCalls.find((call) =>
      call.method === 'setBadgeText').params.text, 'EXT');
  });

  it('skips route reads while busy and rereads after the operation', async function() {
    for (const kind of ['APPLY', 'CLEAR', 'HEALTH']) {
      const test = harness();
      const operation = test.controller.beginOperation(kind);
      await test.controller.restoreToolbar();
      Assert.strictEqual(test.siteReads(), 0);
      Assert.strictEqual(test.actionCalls.filter((call) =>
        call.method === 'setBadgeText').at(-1).params.text, '…');
      await test.controller.endOperation(operation);
      Assert.strictEqual(test.siteReads(), 1);
      Assert.strictEqual(test.actionCalls.filter((call) =>
        call.method === 'setBadgeText').at(-1).params.text, 'P');
    }
  });

  it('reads only the latest simultaneous refresh and rereads on later events', async function() {
    const options = {siteMode: 'PROXY'};
    const test = harness(options);
    const results = await Promise.all(Array.from({length: 12}, (_, index) =>
      test.controller.refreshToolbar({tabId: index + 1})));
    Assert.ok(results.slice(0, -1).every((result) => result.status === 'SUPERSEDED'));
    Assert.strictEqual(results.at(-1).status, 'UPDATED');
    Assert.strictEqual(test.tabReads(), 1);
    Assert.strictEqual(test.siteReads(), 1);
    Assert.strictEqual(test.controlReads(), 1);
    Assert.strictEqual(test.actionCalls.length, 5);
    Assert.ok(test.actionCalls.every((call) => call.params.tabId === 12));
    options.siteMode = 'DIRECT';
    await test.controller.refreshToolbar({tabId: 12});
    Assert.strictEqual(test.siteReads(), 2);
    Assert.strictEqual(test.actionCalls.filter((call) =>
      call.method === 'setBadgeText').at(-1).params.text, 'D');
  });

  it('abandons a superseded tab lookup before reading site settings', async function() {
    const entered = deferred();
    const release = deferred();
    const test = harness({tabGet: async (id) => {
      if (id === 1) {
        entered.resolve();
        await release.promise;
      }
      return {id, url: 'https://proxy.example/'};
    }});
    const first = test.controller.refreshToolbar({tabId: 1});
    await entered.promise;
    await test.controller.refreshToolbar({tabId: 2});
    release.resolve();
    Assert.strictEqual((await first).status, 'SUPERSEDED');
    Assert.strictEqual(test.siteReads(), 1);
    Assert.strictEqual(test.controlReads(), 1);
    Assert.ok(test.actionCalls.every((call) => call.params.tabId === 2));
  });

  it('discards an in-flight site result after a newer tab refresh', async function() {
    const entered = deferred();
    const release = deferred();
    const test = harness({siteGet: async (url) => {
      if (url.endsWith('/old')) {
        entered.resolve();
        await release.promise;
      }
      return {target: {controllable: true}, route: {mode: 'DIRECT'}};
    }});
    const first = test.controller.refreshToolbar({tab: {id: 1, url: 'https://proxy.example/old'}});
    await entered.promise;
    const second = test.controller.refreshToolbar({
      tab: {id: 2, url: 'https://proxy.example/new'},
    });
    release.resolve();
    await second;
    Assert.strictEqual((await first).status, 'SUPERSEDED');
    Assert.strictEqual(test.siteReads(), 2);
    Assert.strictEqual(test.controlReads(), 1);
    Assert.ok(test.actionCalls.every((call) => call.params.tabId === 2));
  });

  it('uses activation changes that arrive during the final live-control read', async function() {
    const entered = deferred();
    const release = deferred();
    const test = harness({controlRead: async () => {
      entered.resolve();
      await release.promise;
      return {levelOfControl: 'controlled_by_this_extension'};
    }});
    const pending = test.controller.refreshToolbar();
    await entered.promise;
    test.setActivation({runtimeState: 'FAILED', recoveryStatus: 'BLOCKED_PRIVATE_ACCESS'});
    release.resolve();
    await pending;
    Assert.strictEqual(test.siteReads(), 1);
    Assert.strictEqual(test.actionCalls.find((call) =>
      call.method === 'setBadgeText').params.text, '!');
  });

  for (const fails of [false, true]) {
    it(`reads only the latest queued tab after a slow read (failure=${fails})`, async function() {
      const entered = deferred();
      const release = deferred();
      const urls = [];
      const test = harness({siteGet: async (url) => {
        urls.push(url);
        entered.resolve();
        await release.promise;
        if (fails && url.endsWith('/0')) throw new Error('fixture failure');
        return {target: {controllable: true}, route: {mode: 'DIRECT'}};
      }});
      const pending = [test.controller.refreshToolbar({
        tab: {id: 0, url: 'https://proxy.example/0'},
      })];
      await entered.promise;
      for (let id = 1; id < 12; id += 1) {
        pending.push(test.controller.refreshToolbar({
          tab: {id, url: `https://proxy.example/${id}`},
        }));
        await new Promise((resolve) => setImmediate(resolve));
      }
      const readsWhilePending = test.siteReads();
      release.resolve();
      const results = await Promise.all(pending);
      Assert.strictEqual(readsWhilePending, 1);
      Assert.deepStrictEqual(urls, ['https://proxy.example/0', 'https://proxy.example/11']);
      Assert.ok(results.slice(0, -1).every((result) => result.status === 'SUPERSEDED'));
      Assert.strictEqual(results.at(-1).status, 'UPDATED');
      Assert.ok(test.actionCalls.every((call) => call.params.tabId === 11));
      Assert.strictEqual(test.controlReads(), 1);
      await test.controller.refreshToolbar({tab: {id: 11, url: 'https://proxy.example/11'}});
      Assert.strictEqual(test.siteReads(), 3);
    });
  }

  it('publishes OFF and busy without waiting for a pending site read', async function() {
    const entered = deferred();
    const release = deferred();
    const test = harness({siteGet: async () => {
      entered.resolve();
      await release.promise;
      return {target: {controllable: true}, route: {mode: 'PROXY'}};
    }});
    const first = test.controller.refreshToolbar();
    await entered.promise;
    const waiting = test.controller.refreshToolbar();
    await new Promise((resolve) => setImmediate(resolve));
    try {
      test.setActivation({runtimeState: 'OFF'});
      await test.controller.refreshToolbar();
      Assert.strictEqual(test.actionCalls.filter((call) =>
        call.method === 'setBadgeText').at(-1).params.text, 'OFF');
      test.setActivation({runtimeState: 'READY'});
      const operation = test.controller.beginOperation('HEALTH');
      await test.controller.restoreToolbar();
      Assert.strictEqual(test.actionCalls.filter((call) =>
        call.method === 'setBadgeText').at(-1).params.text, '…');
      Assert.strictEqual(test.siteReads(), 1);
      release.resolve();
      const results = await Promise.all([first, waiting]);
      Assert.ok(results.every((result) => result.status === 'SUPERSEDED'));
      await test.controller.endOperation(operation);
      Assert.strictEqual(test.siteReads(), 2);
      Assert.strictEqual(test.actionCalls.filter((call) =>
        call.method === 'setBadgeText').at(-1).params.text, 'P');
    } finally {
      release.resolve();
      await Promise.all([first, waiting]);
    }
  });

  it('rechecks activation before reading a site after waiting', async function() {
    const entered = deferred();
    const release = deferred();
    const test = harness({siteGet: async () => {
      entered.resolve();
      await release.promise;
      return {target: {controllable: true}, route: {mode: 'PROXY'}};
    }});
    const first = test.controller.refreshToolbar();
    await entered.promise;
    const latest = test.controller.refreshToolbar();
    await new Promise((resolve) => setImmediate(resolve));
    test.setActivation({runtimeState: 'FAILED', recoveryStatus: 'BLOCKED_PRIVATE_ACCESS'});
    release.resolve();
    await Promise.all([first, latest]);
    Assert.strictEqual(test.siteReads(), 1);
    Assert.strictEqual(test.controlReads(), 1);
    Assert.strictEqual(test.actionCalls.find((call) =>
      call.method === 'setBadgeText').params.text, '!');
  });

  it('replaces the global loading fallback before restoring the active tab',
      async function() {

        const test = harness({activation: {
          runtimeState: 'OFF',
          active: false,
          durableIntent: 'OFF',
          recoveryStatus: 'OFF',
          failureCode: null,
        }});
        await test.controller.showLoading();
        await test.controller.restoreToolbar();
        const badges = test.actionCalls.filter((call) =>
          call.method === 'setBadgeText').map((call) => ({
          tabId: call.params.tabId || null,
          text: call.params.text,
        }));
        Assert.deepStrictEqual(badges, [
          {tabId: null, text: '…'},
          {tabId: null, text: 'OFF'},
          {tabId: 7, text: 'OFF'},
        ]);

      });

  it('marks an interrupted health operation inconclusive on recreation', async function() {

    const state = {
      [Operational.STORAGE_KEY]: {
        schemaVersion: 1,
        health: {
          status: 'CHECKING', code: null, checkedAt: 5,
          candidateType: 'ownProxy', targetOrigin: 'https://proxy.example',
        },
        lastNotification: {key: null, at: null},
      },
    };
    const test = harness({stored: state});
    await test.controller.initialize();
    Assert.strictEqual(
        test.operationalState().health.code,
        'HEALTH_CHECK_INTERRUPTED',
    );

  });

  it('opens only the local Maintenance page from its notification', async function() {

    const test = harness();
    Assert.strictEqual(await test.controller.handleNotificationClicked(
        'unrelated-notification'), false);
    Assert.strictEqual(await test.controller.handleNotificationClicked(
        'firefox-operational-CONTROL_LOSS'), true);
    Assert.deepStrictEqual(test.createdTabs, [{
      url: 'moz-extension://fixture/pages/options/index.html#maintenance',
    }]);

  });

});
