'use strict';

const Assert = require('node:assert');
const Fs = require('node:fs');
const Path = require('node:path');
const Settings = require('../background/settings-control');
const Ui = require('../pages/shared/ui-runtime');
const Popup = require('../pages/popup');
const Options = require('../pages/options');

const sourceRoot = Path.resolve(__dirname, '..');

function capabilities(overrides = {}) {

  return Object.assign({
    apiVersion: 2,
    browser: 'FIREFOX',
    manifestVersion: 3,
    runtimeModel: 'BACKGROUND_EVENT_PAGE',
    runtimeState: 'OFF',
    durableIntent: 'OFF',
    recoveryStatus: 'OFF',
    recoveryFailureCode: null,
    privateWindowAccess: 'GRANTED',
    routingImplemented: true,
    activationSupported: true,
    providerDatasetImplemented: true,
    providerDatasetAvailable: true,
    providerUpdateImplemented: true,
    providerUpdateConfigured: false,
  }, overrides);

}

function settingsResult(revision = 0, patch = null) {

  const settings = Settings.createDefaultSettings();
  if (patch) {
    patch(settings);
  }
  return {revision, settings};

}

function siteState(overrides = {}) {

  return Object.assign({
    schemaVersion: 1,
    revision: 0,
    target: {
      controllable: true,
      host: 'sub.example.com',
      reasonCode: null,
    },
    route: {mode: 'AUTO', scope: 'DOMAIN', pattern: '*.example.com'},
    patterns: {
      exact: 'sub.example.com',
      wildcard: '*.example.com',
      wildcardAvailable: true,
    },
    proxyCandidateAvailable: true,
  }, overrides);

}

function operationalResult(overrides = {}) {

  return Object.assign({
    schemaVersion: 1,
    health: {
      status: 'UNKNOWN', code: null, checkedAt: null, candidateType: null,
    },
    diagnostics: {
      schemaVersion: 1,
      generatedAt: 1000,
      extensionVersion: '0.0.4.0',
      browserName: 'Firefox',
      browserVersion: '154.0.1',
      runtimeState: 'OFF',
      durableIntent: 'OFF',
      recoveryStatus: 'OFF',
      recoveryFailureCode: null,
      controlLevel: 'controllable_by_this_extension',
      datasetAvailable: true,
      datasetVersion: 'public-v1',
      configuredProxyCount: 4,
      enabledProxyCount: 0,
      proxyTypes: ['HTTPS', 'SOCKS5'],
      privateWindowAccess: 'GRANTED',
      notificationsAvailable: true,
    },
  }, overrides);

}

function providerUpdateResult(overrides = {}) {

  return Object.assign({
    schemaVersion: 1,
    trustConfigured: false,
    automaticChecksEnabled: false,
    status: 'NOT_CONFIGURED',
    currentDatasetVersion: 'public-v1',
    stagedDatasetVersion: null,
    updateAvailable: false,
    lastCheckStatus: 'NEVER',
    lastCheckAt: null,
    lastSuccessfulCheckAt: null,
    errorCategory: null,
  }, overrides);

}

function configurationRpc(rpc) {

  let revision = 0;
  let active = false;
  return {async call(message) {

    if (message.type === 'firefox.configuration.get') {
      return {
        savedRevision: revision, effectiveId: active ? 'generation-a' : null,
        active, pending: false, applying: false, blocked: false,
        reason: null, pendingCategories: [],
      };
    }
    const result = await rpc.call(message);
    if (message.type === 'firefox.settings.get' || message.type === 'firefox.settings.replace') revision = result.revision;
    if (message.type === 'firefox.capabilities.get') active = result.runtimeState === 'READY';
    return result;

  }};

}

function optionsController(options) {

  return Options.createController(Object.assign({}, options, {rpc: configurationRpc(options.rpc)}));

}

function popupController(options) {

  options = Object.assign({}, options, {rpc: configurationRpc(options.rpc)});

  return Popup.createController(Object.assign({
    getActiveTabUrl: async () => 'https://sub.example.com/private',
  }, options));

}

function failure(code) {

  const error = new Error('synthetic secret-bearing detail');
  error.code = code;
  return error;

}

function deferred() {

  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};

}

describe('Firefox Options external status synchronization', function() {
  function fixture() {
    let revision = 0;
    let status = {savedRevision: 0, effectiveId: null, active: false,
      pending: false, applying: false, blocked: false, reason: null, pendingCategories: []};
    let gate = null;
    const rendered = [];
    const controller = Options.createController({changed: (state) => rendered.push(state), rpc: {
      async call(message) {
        const value = message.type === 'firefox.configuration.get' ? Object.assign({}, status) :
          message.type === 'firefox.capabilities.get' ? capabilities({
            runtimeState: status.active ? 'READY' : status.blocked ? 'FAILED' : 'OFF',
            privateWindowAccess: status.reason === 'PRIVATE_ACCESS_REQUIRED' ? 'DENIED' : 'GRANTED',
          }) : message.type === 'firefox.settings.get' ? settingsResult(revision) :
          message.type === 'firefox.operational.get' ? operationalResult() : providerUpdateResult();
        if (message.type === 'firefox.configuration.get' && gate) {
          const waiting = gate;
          gate = null;
          await waiting.promise;
        }
        return value;
      },
    }});
    return {controller, rendered,
      status(patch) {
        status = Object.assign({}, status, patch);
      },
      revision(value) {
        revision = value; status.savedRevision = value;
      },
      hold() {
        gate = deferred(); return gate;
      },
    };
  }

  it('observes external Apply start, success and OFF without a reload', async function() {
    const f = fixture();
    await f.controller.load();
    f.status({applying: true});
    await f.controller.refresh();
    Assert.strictEqual(f.controller.snapshot().configuration.applying, true);
    f.status({applying: false, active: true, effectiveId: 'active-a'});
    await f.controller.refresh();
    Assert.strictEqual(f.controller.snapshot().configuration.applying, false);
    Assert.strictEqual(f.controller.snapshot().capabilities.runtimeState, 'READY');
    Assert.strictEqual(f.controller.snapshot().pending, false);
    f.status({active: false, effectiveId: null});
    await f.controller.refresh();
    Assert.strictEqual(f.controller.snapshot().capabilities.runtimeState, 'OFF');
  });

  for (const initial of [true, false]) {
    for (const when of ['during', 'before-resolution', 'after-resolution']) {
      it(`coalesces ${when} invalidation of ${initial ? 'initial' : 'status'} load without rendering an old response`, async function() {
        const f = fixture();
        if (!initial) await f.controller.load();
        const gate = f.hold();
        const loading = f.controller.load();
        f.status({active: true, effectiveId: 'newest', applying: false});
        if (when === 'before-resolution') {
          gate.resolve();
          void f.controller.refresh();
        } else if (when === 'after-resolution') {
          gate.resolve();
          await loading;
          await f.controller.refresh();
        } else {
          void f.controller.refresh();
          void f.controller.refresh();
          gate.resolve();
        }
        await loading;
        const final = f.controller.snapshot();
        Assert.strictEqual(final.configuration.effectiveId, 'newest');
        Assert.strictEqual(final.configuration.active, true);
        Assert.strictEqual(final.pending, false);
        if (when !== 'after-resolution') {
          const completed = f.rendered.filter((s) => !s.pending && s.configuration);
          Assert.strictEqual(completed.at(-1).configuration.effectiveId, 'newest');
          Assert.strictEqual(
              completed.slice(initial ? 0 : 1).every((s) => s.configuration.active), true,
          );
        }
      });
    }
  }

  it('preserves the draft base and dirty state through Apply and a newer Saved revision', async function() {
    const f = fixture();
    await f.controller.load();
    const base = f.controller.snapshot().settings;
    f.controller.edit();
    f.status({applying: true});
    await f.controller.refresh();
    f.revision(1);
    f.status({active: true, applying: false, effectiveId: 'newest'});
    await f.controller.refresh();
    const state = f.controller.snapshot();
    Assert.strictEqual(state.settings, base);
    Assert.strictEqual(state.revision, 0);
    Assert.strictEqual(state.dirty, true);
    Assert.strictEqual(state.stale, true);
    Assert.strictEqual(state.configuration.active, true);
    Assert.strictEqual(state.configuration.applying, false);
    Assert.strictEqual(await f.controller.save(base), false);
  });

  for (const reason of [null, 'CONTROL_LOSS', 'PRIVATE_ACCESS_REQUIRED']) {
    it(`converges after external failure (${reason || 'safe old active'}) without losing edits`, async function() {
      const f = fixture();
      f.status({active: true, effectiveId: 'old'});
      await f.controller.load();
      f.controller.edit();
      const base = f.controller.snapshot().settings;
      f.status({applying: true});
      await f.controller.refresh();
      f.status({applying: false, active: !reason, blocked: Boolean(reason), reason});
      await f.controller.refresh();
      const state = f.controller.snapshot();
      Assert.strictEqual(state.configuration.applying, false);
      Assert.strictEqual(state.configuration.active, !reason);
      Assert.strictEqual(state.configuration.reason, reason);
      Assert.strictEqual(state.settings, base);
      Assert.strictEqual(state.dirty, true);
      Assert.strictEqual(state.pending, false);
    });
  }
});

function fakeParent() {

  const document = {
    createElement(tagName) {

      return {
        setAttribute(name, value) {

          this[name] = value;

        },
        addEventListener(type, listener) {

          this.listeners[type] = listener;

        },
        appendChild(child) {

          this.children.push(child);

        },
        children: [],
        className: '',
        dataset: {},
        listeners: {},
        ownerDocument: document,
        tagName,
        textContent: '',
      };

    },
  };
  return document.createElement('div');

}

describe('Firefox production UI controllers', function() {
  it('renders confirmed provider phases in RU/EN without internal data or connectivity claims', function() {

    const cases = [
      [{status: 'CHECKING'}, {}, 'providerLifecycleChecking'],
      [{status: 'UP_TO_DATE'}, {}, 'providerLifecycleVerified'],
      [{status: 'UPDATE_AVAILABLE', updateAvailable: true}, {}, 'providerLifecyclePrepared'],
      [{status: 'UPDATED'}, {configuration: {active: true}}, 'providerLifecycleApplied'],
      [{status: 'UPDATED'}, {configuration: {active: false}}, 'providerLifecycleAppliedOff'],
      [{status: 'UPDATED'}, {configuration: {active: false, blocked: true}}, 'unifiedBlocked'],
      [{status: 'CHECK_FAILED', errorCategory: 'AUTHENTICATION_FAILED'}, {}, 'providerLifecycleFailed'],
      [{status: 'IDLE'}, {providerOperation: 'APPLYING'}, 'providerLifecycleApplying'],
      [{status: 'NOT_CONFIGURED', trustConfigured: false}, {}, 'providerUpdateStatusUnavailable'],
    ];
    for (const language of ['en', 'ru']) {
      const catalog = JSON.parse(Fs.readFileSync(
          Path.join(sourceRoot, '_locales', language, 'messages.json'), 'utf8',
      ));
      for (const [update, local, label] of cases) {
        const parent = fakeParent();
        const providerUpdate = Options.validateProviderUpdateStatus(providerUpdateResult(
            Object.assign({trustConfigured: true}, update),
        ));
        const state = Object.assign({providerUpdate}, local,
            {internalHash: 'secret-hash', generation: 'private-generation'});
        const status = Options.renderProviderUpdateStatus(parent, state, (key) => {
          Assert.ok(catalog[key], key);
          return catalog[key].message;
        });
        Assert.strictEqual(status.textContent, catalog[label].message);
        Assert.strictEqual(status['aria-live'], 'polite');
        const text = parent.children.map((node) => node.textContent).join(' ');
        Assert.doesNotMatch(text, /secret-hash|private-generation|journal|cooking|promotion/i);
        Assert.doesNotMatch(status.textContent, /healthy|connected|anonymous/i);
        if (label === 'providerLifecycleAppliedOff') {
          Assert.match(text, language === 'en' ? /Protection remains off/ : /Защита остаётся выключенной/);
        }
        if (label === 'unifiedBlocked') {
          Assert.doesNotMatch(text, /Protection remains off|Защита остаётся выключенной/);
        }
      }
    }

  });

  it('shows provider progress for the duration of the real UI call and preserves Draft', async function() {

    const waiting = deferred();
    const calls = [];
    const controller = optionsController({rpc: {async call(message) {
      calls.push(message.type);
      if (message.type === 'firefox.capabilities.get') return capabilities();
      if (message.type === 'firefox.settings.get') return settingsResult();
      if (message.type === 'firefox.operational.get') return operationalResult();
      if (message.type === 'firefox.provider.update.install') return waiting.promise;
      return providerUpdateResult({trustConfigured: true, status: 'UPDATE_AVAILABLE', updateAvailable: true});
    }}});
    await controller.load();
    controller.edit();
    const installing = controller.installProviderUpdate();
    Assert.strictEqual(Options.providerUpdateView(controller.snapshot()).label, 'providerLifecycleApplying');
    waiting.resolve({status: 'INSTALLED'});
    await installing;
    Assert.strictEqual(controller.snapshot().providerOperation, null);
    Assert.strictEqual(controller.snapshot().dirty, true);
    Assert.ok(!calls.includes('firefox.activation.apply'));
    Assert.ok(!calls.includes('firefox.settings.replace'));

  });

  it('keeps provider verification and preparation failures distinct without displaying exceptions', function() {

    for (const category of ['AUTHENTICATION_FAILED', 'DATASET_REJECTED', 'TRUST_NOT_CONFIGURED']) {
      const state = {providerUpdate: providerUpdateResult({trustConfigured: true,
        status: 'CHECK_FAILED', errorCategory: category})};
      Assert.strictEqual(Options.providerUpdateView(state).help, `providerUpdateError_${category}`);
    }
    const state = {providerOperationFailed: true, errorCode: 'UI_RPC_FAILED',
      providerUpdate: providerUpdateResult({trustConfigured: true, status: 'UPDATE_AVAILABLE'})};
    Assert.strictEqual(Options.providerUpdateView(state).help, 'providerLifecyclePreparationFailed');

  });
  it('round-trips existing rule buckets, overlaps and legacy patterns without normalization', function() {

    const original = {direct: ['exact.example', '*.example.com', '*legacy.example'],
      proxy: ['*.example.com', 'proxy.example'], whitelist: ['*', '*.allowed.example']};
    const before = structuredClone(original);
    const rows = Options.ruleRowsFromRules(original);
    Assert.deepStrictEqual(rows[0], {host: 'exact.example', route: 'DIRECT', scope: 'HOST'});
    Assert.deepStrictEqual(rows[1], {host: 'example.com', route: 'DIRECT', scope: 'DOMAIN'});
    Assert.deepStrictEqual(rows[2], {host: '*legacy.example', route: 'DIRECT', scope: 'PATTERN'});
    Assert.strictEqual(rows[5].route, 'WHITELIST');
    Assert.deepStrictEqual(Options.rulesFromRuleRows(rows), original);
    Assert.deepStrictEqual(original, before);

  });

  it('adds, edits and deletes exact/domain rules; Auto removes only its selected entry', function() {

    const rows = Options.ruleRowsFromRules({direct: ['*.example.com'], proxy: ['exact.example'], whitelist: ['allowed.example']});
    rows.push({host: 'new.example', route: 'PROXY', scope: 'DOMAIN'});
    rows[1] = {host: 'edited.example', route: 'DIRECT', scope: 'HOST'};
    rows.splice(2, 1);
    Assert.deepStrictEqual(Options.rulesFromRuleRows(rows), {
      direct: ['*.example.com', 'edited.example'], proxy: ['*.new.example'], whitelist: [],
    });
    rows[1].route = 'AUTO';
    Assert.deepStrictEqual(Options.rulesFromRuleRows(rows), {
      direct: ['*.example.com'], proxy: ['*.new.example'], whitelist: [],
    });

  });

  function unifiedUi() {

    let saved = settingsResult(1);
    let effectiveRevision = 1;
    let blocked = false;
    let failApply = false;
    const calls = [];
    const configuration = () => ({savedRevision: saved.revision,
      effectiveId: `generation-${effectiveRevision}`, active: !blocked,
      pending: effectiveRevision !== saved.revision, blocked, applying: false,
      reason: blocked ? 'CONTROL_LOSS' : null,
      pendingCategories: effectiveRevision !== saved.revision ? ['routingSettings'] : []});
    const rpc = {async call(message) {

      calls.push(message);
      if (message.type === 'firefox.configuration.get') return configuration();
      if (message.type === 'firefox.capabilities.get') {
        return capabilities({
          runtimeState: blocked ? 'FAILED' : 'READY', durableIntent: 'ON',
          recoveryStatus: blocked ? 'BLOCKED_CONTROL_LOSS' : 'ACTIVE',
        });
      }
      if (message.type === 'firefox.settings.get') return structuredClone(saved);
      if (message.type === 'firefox.operational.get') return operationalResult();
      if (message.type === 'firefox.provider.update.get') return providerUpdateResult();
      if (message.type === 'firefox.settings.replace') {
        if (message.expectedRevision !== saved.revision) throw failure('SETTINGS_REVISION_CONFLICT');
        saved = {revision: saved.revision + 1, settings: structuredClone(message.settings)};
        return structuredClone(saved);
      }
      if (message.type === 'firefox.activation.apply') {
        if (message.expectedRevision !== saved.revision) throw failure('SAVED_REVISION_CHANGED');
        if (failApply) throw failure('DATASET_NOT_READY');
        effectiveRevision = saved.revision;
        return {intent: 'ON', status: 'ACTIVE'};
      }
      throw failure('UNKNOWN_RPC');

    }};
    return {rpc, calls, configuration, controller: Options.createController({rpc}),
      externalSave() {
        saved.revision += 1; saved.settings.flags.noDirect = true;
      },
      fail(controlLost = false) {
        failApply = true; blocked = controlLost;
      }};

  }

  it('keeps active Draft local, blocks Apply until Save, then promotes displayed Saved', async function() {

    const test = unifiedUi();
    await test.controller.load();
    Assert.strictEqual(test.controller.snapshot().configuration.pending, false);
    test.controller.edit();
    Assert.strictEqual(await test.controller.applySaved(), false);
    const next = structuredClone(test.controller.snapshot().settings);
    next.flags.noDirect = true;
    Assert.strictEqual(await test.controller.save(next), true);
    Assert.strictEqual(test.controller.snapshot().notice, 'SAVED');
    Assert.strictEqual(test.controller.snapshot().configuration.pending, true);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');
    Assert.strictEqual(await test.controller.applySaved(), true);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-2');
    Assert.strictEqual(test.calls.filter((value) => value.type === 'firefox.activation.clear').length, 0);

  });

  it('preserves a stale Draft through an external Save and discards only local edits', async function() {

    const test = unifiedUi();
    await test.controller.load();
    test.controller.edit();
    test.externalSave();
    await test.controller.load();
    Assert.strictEqual(test.controller.snapshot().revision, 1);
    Assert.strictEqual(test.controller.snapshot().dirty, true);
    Assert.strictEqual(test.controller.snapshot().stale, true);
    Assert.strictEqual(await test.controller.save(Settings.createDefaultSettings()), false);
    Assert.strictEqual(test.calls.some((entry) => entry.type === 'firefox.settings.replace'), false);
    await test.controller.discard();
    Assert.strictEqual(test.controller.snapshot().revision, 2);
    Assert.strictEqual(test.controller.snapshot().settings.flags.noDirect, true);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');

  });

  it('edits active site rules in Draft, saves only, and applies the exact resulting revision', async function() {

    const test = unifiedUi();
    await test.controller.load();
    Assert.strictEqual(test.controller.snapshot().editable, true);
    const draft = structuredClone(test.controller.snapshot().settings);
    draft.rules = Options.rulesFromRuleRows([
      {host: 'exact.example', route: 'DIRECT', scope: 'HOST'},
      {host: 'domain.example', route: 'PROXY', scope: 'DOMAIN'},
    ]);
    test.controller.edit();
    Assert.deepStrictEqual(test.controller.snapshot().settings.rules.proxy, []);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');
    Assert.strictEqual(await test.controller.save(draft), true);
    Assert.deepStrictEqual(test.controller.snapshot().settings.rules, draft.rules);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');
    Assert.strictEqual(await test.controller.applySaved(), true);
    Assert.strictEqual(test.calls.find((call) => call.type === 'firefox.activation.apply').expectedRevision, 2);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-2');

  });

  it('protects a structured-rule Draft from an external revision instead of overwriting it', async function() {

    const test = unifiedUi();
    await test.controller.load();
    const draft = structuredClone(test.controller.snapshot().settings);
    draft.rules = Options.rulesFromRuleRows([{host: 'draft.example', scope: 'HOST', route: 'PROXY'}]);
    test.controller.edit();
    test.externalSave();
    await test.controller.load();
    Assert.strictEqual(test.controller.snapshot().stale, true);
    Assert.strictEqual(await test.controller.save(draft), false);
    Assert.deepStrictEqual(draft.rules.proxy, ['draft.example']);
    Assert.strictEqual(test.calls.some((call) => call.type === 'firefox.settings.replace'), false);
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');

  });

  it('rejects stale Apply and requires a renewed action on refreshed Saved', async function() {

    const test = unifiedUi();
    await test.controller.load();
    test.externalSave();
    Assert.strictEqual(await test.controller.applySaved(), false);
    Assert.strictEqual(test.controller.snapshot().errorCode, 'SAVED_REVISION_CHANGED');
    Assert.strictEqual(test.configuration().effectiveId, 'generation-1');
    Assert.strictEqual(await test.controller.applySaved(), true);

  });

  it('distinguishes a confirmed safe preparation failure from control loss', async function() {

    for (const lost of [false, true]) {
      const test = unifiedUi();
      await test.controller.load();
      await test.controller.save(Settings.createDefaultSettings());
      test.fail(lost);
      Assert.strictEqual(await test.controller.applySaved(), false);
      Assert.strictEqual(test.controller.snapshot().notice === 'APPLY_FAILED_SAFE', !lost);
      Assert.strictEqual(test.controller.snapshot().configuration.blocked, lost);
    }

  });

  it('rejects secret-bearing status projections and unknown pending categories', function() {

    const test = unifiedUi();
    Assert.throws(() => Ui.validateConfiguration(Object.assign(test.configuration(), {password: 'secret'})));
    Assert.throws(() => Ui.validateConfiguration(Object.assign(test.configuration(), {pendingCategories: ['proxy.example']})));

  });

  it('popup sends explicit pending confirmation and retains saved-not-applied outcome', async function() {

    const test = unifiedUi();
    test.externalSave();
    const calls = [];
    const controller = Popup.createController({getActiveTabUrl: async () => 'https://example.com/', rpc: {
      async call(message) {

        calls.push(message);
        if (message.type === 'firefox.site.get') return siteState();
        if (message.type === 'firefox.site.apply') {
          return {applied: false, saved: true,
            previousActive: true, errorCode: 'DATASET_NOT_READY'};
        }
        return test.rpc.call(message);

      },
    }});
    await controller.refresh();
    Assert.strictEqual(await controller.apply({mode: 'DIRECT', scope: 'HOST'}, true), false);
    const sent = calls.find((entry) => entry.type === 'firefox.site.apply');
    Assert.strictEqual(sent.expectedRevision, 2);
    Assert.strictEqual(sent.expectedEffectiveId, 'generation-1');
    Assert.strictEqual(sent.applyAll, true);
    Assert.strictEqual(controller.snapshot().notice, 'SITE_SAVED_NOT_APPLIED');
    Assert.strictEqual(calls.some((entry) => entry.type === 'firefox.site.replace'), false);

  });

  it('renders OFF as Enable without claiming active protection', function() {

    const view = Popup.presentation(capabilities());

    Assert.strictEqual(view.kind, 'OFF');
    Assert.strictEqual(view.action, 'ENABLE');
    Assert.notStrictEqual(view.titleKey, 'popupStateActive');

  });

  it('renders INITIALIZING without an unsafe action', function() {

    const view = Popup.presentation(capabilities({
      runtimeState: 'INITIALIZING',
      recoveryStatus: 'INITIALIZING',
    }));

    Assert.strictEqual(view.kind, 'INITIALIZING');
    Assert.strictEqual(view.action, 'NONE');

  });

  it('renders READY as ACTIVE only after runtime readiness', function() {

    const view = Popup.presentation(capabilities({
      runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'ACTIVE',
    }));

    Assert.strictEqual(view.kind, 'ACTIVE');
    Assert.strictEqual(view.action, 'DISABLE');

  });

  it('distinguishes a recovered READY session', function() {

    const view = Popup.presentation(capabilities({
      runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'RECOVERED',
    }));

    Assert.strictEqual(view.kind, 'RECOVERED');
    Assert.strictEqual(view.titleKey, 'popupStateRecovered');

  });

  it('renders control loss as external and permits safe Disable', function() {

    const view = Popup.presentation(capabilities({
      runtimeState: 'FAILED',
      durableIntent: 'ON',
      recoveryStatus: 'BLOCKED_CONTROL_LOSS',
    }));

    Assert.strictEqual(view.kind, 'EXTERNAL');
    Assert.strictEqual(view.action, 'DISABLE');

  });

  it('never shows ACTIVE when private access is denied', function() {

    const view = Popup.presentation(capabilities({
      runtimeState: 'READY',
      durableIntent: 'ON',
      recoveryStatus: 'ACTIVE',
      privateWindowAccess: 'DENIED',
    }));

    Assert.strictEqual(view.kind, 'BLOCKED');
    Assert.strictEqual(view.helpKey, 'popupHelpPrivateBlocked');

  });

  it('allows activation only after private access is granted', function() {

    Assert.strictEqual(Popup.activationAllowed(capabilities({
      privateWindowAccess: 'DENIED',
    })), false);
    Assert.strictEqual(Popup.activationAllowed(capabilities({
      privateWindowAccess: 'UNKNOWN',
    })), false);
    const granted = capabilities({privateWindowAccess: 'GRANTED'});
    Assert.strictEqual(Popup.activationAllowed(granted), true);
    Assert.strictEqual(
        Object.hasOwn(granted, 'restrictedSiteAccess'),
        false,
    );

  });

  it('renders permission instructions and a working Check again action',
      function() {

        const parent = fakeParent();
        let checks = 0;
        const rendered = Ui.renderPrivateAccessOnboarding(
            parent,
            capabilities({privateWindowAccess: 'DENIED'}),
            {
              checkAgain: () => {
                checks += 1;
              },
              translate: (key) => key,
            },
        );
        Assert.match(rendered.notice.className, /warning/);
        Assert.deepStrictEqual(
            rendered.notice.children.map((child) => child.textContent),
            [
              'permissionPrivateAccessTitle',
              'permissionPrivateAccessExplanation',
              'permissionPrivateAccessSteps',
              'permissionCheckAgain',
            ],
        );
        rendered.check.listeners.click();
        Assert.strictEqual(checks, 1);
        Assert.strictEqual(
            Ui.renderPrivateAccessOnboarding(
                fakeParent(), capabilities(), {
                  checkAgain: () => {}, translate: (key) => key,
                },
            ),
            null,
        );

      });

  it('shows an explicit unknown-permission explanation', function() {

    const rendered = Ui.renderPrivateAccessOnboarding(
        fakeParent(),
        capabilities({privateWindowAccess: 'UNKNOWN'}),
        {checkAgain: () => {}, translate: (key) => key},
    );
    Assert.deepStrictEqual(
        rendered.notice.children.map((child) => child.textContent),
        [
          'permissionPrivateAccessTitle',
          'permissionPrivateAccessExplanation',
          'permissionPrivateAccessUnknown',
          'permissionPrivateAccessSteps',
          'permissionCheckAgain',
        ],
    );
    Assert.strictEqual(
        Popup.userErrorKey('PRIVATE_ACCESS_CHECK_FAILED'),
        'popupErrorPrivateAccessCheck',
    );

  });

  it('rechecks popup private access without reloading unrelated state',
      async function() {

        let privateAccess = 'DENIED';
        const calls = [];
        const controller = popupController({rpc: {async call(message) {

          calls.push(message.type);
          if (message.type === 'firefox.capabilities.get') {
            return capabilities({privateWindowAccess: privateAccess});
          }
          if (message.type === 'firefox.site.get') return siteState();
          return operationalResult();

        }}});
        await controller.refresh();
        Assert.strictEqual(
            controller.snapshot().capabilities.privateWindowAccess,
            'DENIED',
        );
        privateAccess = 'GRANTED';
        Assert.strictEqual(await controller.checkPrivateAccess(), true);
        Assert.strictEqual(
            controller.snapshot().capabilities.privateWindowAccess,
            'GRANTED',
        );
        Assert.deepStrictEqual(calls, [
          'firefox.capabilities.get',
          'firefox.site.get',
          'firefox.operational.get',
          'firefox.capabilities.get',
        ]);

      });

  it('runs Apply then refreshes capabilities', async function() {

    const calls = [];
    const controller = popupController({rpc: {async call(message) {

      calls.push(message);
      if (message.type === 'firefox.site.apply') {
        return {applied: true};
      }
      if (message.type === 'firefox.site.get') {
        return siteState();
      }
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      return capabilities({
        runtimeState: calls.length > 1 ? 'READY' : 'OFF',
        durableIntent: calls.length > 1 ? 'ON' : 'OFF',
        recoveryStatus: calls.length > 1 ? 'ACTIVE' : 'OFF',
      });

    }}});
    await controller.refresh();
    calls.length = 0;
    Assert.strictEqual(await controller.apply(), true);

    Assert.deepStrictEqual(calls.map((item) => item.type), [
      'firefox.site.apply',
      'firefox.capabilities.get',
      'firefox.site.get',
      'firefox.operational.get',
    ]);
    Assert.strictEqual(controller.snapshot().capabilities.runtimeState, 'READY');

  });

  it('runs Clear then refreshes to OFF', async function() {

    const calls = [];
    const controller = popupController({rpc: {async call(message) {

      calls.push(message.type);
      if (message.type === 'firefox.capabilities.get') return capabilities();
      if (message.type === 'firefox.site.get') return siteState();
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      return {intent: 'OFF', status: 'OFF'};

    }}});

    Assert.strictEqual(await controller.clear(), true);
    Assert.deepStrictEqual(calls, [
      'firefox.activation.clear', 'firefox.capabilities.get',
      'firefox.site.get', 'firefox.operational.get',
    ]);
    Assert.strictEqual(controller.snapshot().capabilities.runtimeState, 'OFF');

  });

  it('locks duplicate popup operations while one is pending', async function() {

    const gate = deferred();
    let calls = 0;
    const controller = popupController({rpc: {async call(message) {

      calls += 1;
      if (message.type === 'firefox.site.apply') {
        await gate.promise;
        return {applied: true};
      }
      if (message.type === 'firefox.site.get') return siteState();
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      return capabilities({
        runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'ACTIVE',
      });

    }}});
    await controller.refresh();
    calls = 0;
    const first = controller.apply();
    Assert.strictEqual(await controller.apply(), false);
    gate.resolve();
    Assert.strictEqual(await first, true);
    Assert.strictEqual(calls, 4);

  });

  it('maps unknown popup failures to generic sanitized state', async function() {

    const controller = popupController({rpc: {async call() {

      throw new Error('private URL and raw browser detail');

    }}});

    Assert.strictEqual(await controller.refresh(), false);
    Assert.strictEqual(controller.snapshot().errorCode, 'UI_RPC_FAILED');
    Assert.strictEqual(Popup.userErrorKey('UNEXPECTED'), 'popupErrorGeneric');

  });

  it('rejects malformed capability responses', function() {

    Assert.throws(
        () => Ui.validateCapabilities({runtimeState: 'READY'}),
        (error) => error.code === 'UI_RPC_FAILED',
    );

  });

  it('validates a minimal secret-free current-site response', function() {

    const value = Popup.validateSiteState(siteState());
    Assert.strictEqual(value.target.host, 'sub.example.com');
    Assert.strictEqual(value.route.mode, 'AUTO');
    Assert.deepStrictEqual(Object.keys(value).sort(), [
      'patterns', 'proxyCandidateAvailable', 'revision', 'route',
      'schemaVersion', 'target',
    ]);
    Assert.deepStrictEqual(Object.keys(value.target).sort(), [
      'controllable', 'host', 'reasonCode',
    ]);
    Assert.strictEqual(Object.hasOwn(value, 'tabUrl'), false);
    Assert.throws(
        () => Popup.validateSiteState(Object.assign(siteState(), {
          unexpectedTabData: 'must-not-cross-the-response-boundary',
        })),
        (error) => error.code === 'UI_RPC_FAILED',
    );

  });

  it('distinguishes pending site changes from the applied route', function() {

    const site = siteState();
    Assert.strictEqual(Popup.isDraftDirty(site, {
      mode: 'AUTO', scope: 'DOMAIN',
    }), false);
    Assert.strictEqual(Popup.isDraftDirty(site, {
      mode: 'DIRECT', scope: 'HOST',
    }), true);

  });

  it('uses one revision-safe RPC for the current-site draft and Apply', async function() {

    const calls = [];
    const controller = popupController({rpc: {async call(message) {

      calls.push(message);
      if (message.type === 'firefox.site.apply') return {applied: true};
      if (message.type === 'firefox.site.get') {
        return siteState({
          revision: calls.some((item) =>
            item.type === 'firefox.site.apply') ? 1 : 0,
          route: calls.some((item) =>
            item.type === 'firefox.site.apply') ?
            {mode: 'DIRECT', scope: 'HOST', pattern: 'sub.example.com'} :
            {mode: 'AUTO', scope: 'DOMAIN', pattern: '*.example.com'},
        });
      }
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      return capabilities({
        runtimeState: calls.some((item) =>
          item.type === 'firefox.activation.apply') ? 'READY' : 'OFF',
        durableIntent: calls.some((item) =>
          item.type === 'firefox.activation.apply') ? 'ON' : 'OFF',
        recoveryStatus: calls.some((item) =>
          item.type === 'firefox.activation.apply') ? 'ACTIVE' : 'OFF',
      });

    }}});
    await controller.refresh();
    Assert.strictEqual(await controller.apply({
      mode: 'DIRECT', scope: 'HOST',
    }), true);
    Assert.deepStrictEqual(calls.map((item) => item.type), [
      'firefox.capabilities.get',
      'firefox.site.get',
      'firefox.operational.get',
      'firefox.site.apply',
      'firefox.capabilities.get',
      'firefox.site.get',
      'firefox.operational.get',
    ]);
    Assert.deepStrictEqual(calls[3], {
      type: 'firefox.site.apply',
      tabUrl: 'https://sub.example.com/private',
      expectedRevision: 0,
      expectedEffectiveId: null,
      applyAll: false,
      mode: 'DIRECT',
      scope: 'HOST',
    });

  });

  it('shows external-control loss distinctly from generic blocked state',
      function() {

        const view = Popup.presentation(capabilities({
          runtimeState: 'FAILED',
          durableIntent: 'OFF',
          recoveryStatus: 'BLOCKED_CONTROL_LOSS',
          recoveryFailureCode: 'CONTROL_LOSS',
        }));
        Assert.strictEqual(view.kind, 'EXTERNAL');
        Assert.strictEqual(view.titleKey, 'popupStateExternal');

      });

  it('permits Options Saved editing while OFF or active, but not blocked', function() {

    Assert.strictEqual(Options.editableFromCapabilities(capabilities()), true);
    Assert.strictEqual(Options.editableFromCapabilities(capabilities({
      runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'ACTIVE',
    })), true);
    for (const value of [
      capabilities({runtimeState: 'INITIALIZING',
        recoveryStatus: 'INITIALIZING'}),
      capabilities({runtimeState: 'FAILED', durableIntent: 'ON',
        recoveryStatus: 'BLOCKED_PRIVATE_ACCESS'}),
      capabilities({recoveryStatus: 'OFF_RECONCILIATION_FAILED'}),
    ]) {
      Assert.strictEqual(Options.editableFromCapabilities(value), false);
    }

  });

  it('keeps native popup sizing on body without viewport feedback', function() {

    const css = Fs.readFileSync(
        Path.join(sourceRoot, 'pages', 'popup', 'popup.css'), 'utf8',
    );
    Assert.match(css, /body\s*\{[^}]*width:\s*392px;/);
    Assert.doesNotMatch(css, /max-width:\s*100vw/);
    Assert.doesNotMatch(css, /@media\s*\(max-width:\s*300px\)/);

  });

  it('preserves rule text for background-authoritative normalization', function() {

    Assert.deepStrictEqual(
        Options.parseRuleLines(' Example.COM. \n\n*.Example.org '),
        ['Example.COM.', '*.Example.org'],
    );

  });

  it('keeps imported credentials missing until explicitly replaced or removed', function() {
    Assert.deepStrictEqual(Options.credentialPayload({mode: 'MISSING'}, 'MISSING', '', ''),
        {mode: 'MISSING'});
    Assert.strictEqual(Options.userErrorKey('REQUIRED_CREDENTIAL_MISSING'), 'transferCredentialsRequired');
  });

  it('encodes password KEEP without a password value', function() {

    Assert.deepStrictEqual(
        Options.credentialPayload(
            {mode: 'KEEP', username: 'user'}, 'KEEP', 'user', 'ignored',
        ),
        {mode: 'KEEP', username: 'user'},
    );

  });

  it('encodes explicit password replacement and clear', function() {

    Assert.deepStrictEqual(
        Options.credentialPayload(null, 'SET', 'user', 'new-value'),
        {mode: 'SET', username: 'user', password: 'new-value'},
    );
    Assert.deepStrictEqual(
        Options.credentialPayload(
            {mode: 'KEEP', username: 'user'}, 'NONE', '', '',
        ),
        {mode: 'NONE'},
    );

  });

  it('validates proxy host, port, type, and identifier locally', function() {

    const valid = {
      id: 'fixture', type: 'HTTPS', host: 'proxy.example', port: 443,
      proxyDNS: false, failoverTimeoutSeconds: null,
    };
    Assert.strictEqual(Options.validateCandidate(valid, true), valid);
    for (const invalid of [
      Object.assign({}, valid, {host: ''}),
      Object.assign({}, valid, {port: 0}),
      Object.assign({}, valid, {port: 65536}),
      Object.assign({}, valid, {type: 'DIRECT'}),
      Object.assign({}, valid, {id: ''}),
    ]) {
      Assert.throws(() => Options.validateCandidate(invalid, true));
    }

  });

  it('loads capabilities, settings, and exact revision', async function() {

    const rpc = {async call(message) {

      return message.type === 'firefox.capabilities.get' ?
        capabilities() : message.type === 'firefox.settings.get' ?
          settingsResult(7) : message.type === 'firefox.operational.get' ?
            operationalResult() : providerUpdateResult();

    }};
    const controller = optionsController({rpc});

    Assert.strictEqual(await controller.load(), true);
    Assert.strictEqual(controller.snapshot().revision, 7);
    Assert.strictEqual(controller.snapshot().editable, true);

  });

  it('rechecks options private access without reloading settings',
      async function() {

        let privateAccess = 'DENIED';
        const calls = [];
        const rpc = {async call(message) {

          calls.push(message.type);
          if (message.type === 'firefox.capabilities.get') {
            return capabilities({privateWindowAccess: privateAccess});
          }
          if (message.type === 'firefox.settings.get') {
            return settingsResult(5);
          }
          if (message.type === 'firefox.operational.get') {
            return operationalResult();
          }
          return providerUpdateResult();

        }};
        const controller = optionsController({rpc});
        await controller.load();
        privateAccess = 'GRANTED';
        Assert.strictEqual(await controller.checkPrivateAccess(), true);
        Assert.strictEqual(
            controller.snapshot().capabilities.privateWindowAccess,
            'GRANTED',
        );
        Assert.strictEqual(controller.snapshot().revision, 5);
        Assert.deepStrictEqual(calls, [
          'firefox.capabilities.get',
          'firefox.settings.get',
          'firefox.operational.get',
          'firefox.provider.update.get',
          'firefox.capabilities.get',
        ]);

      });

  it('saves with the exact loaded revision', async function() {

    const calls = [];
    const rpc = {async call(message) {

      calls.push(message);
      if (message.type === 'firefox.capabilities.get') return capabilities();
      if (message.type === 'firefox.settings.get') {
        return settingsResult(
          calls.some((entry) => entry.type === 'firefox.settings.replace') ? 4 : 3,
        );
      }
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      if (message.type === 'firefox.provider.update.get') {
        return providerUpdateResult();
      }
      return settingsResult(4, (settings) => {
        settings.flags.noDirect = true;
      });

    }};
    const controller = optionsController({rpc});
    await controller.load();
    const next = Settings.createDefaultSettings();
    next.flags.noDirect = true;

    Assert.strictEqual(await controller.save(next), true);
    Assert.strictEqual(calls[4].expectedRevision, 3);
    Assert.strictEqual(calls[4].settings.flags.noDirect, true);
    Assert.strictEqual(controller.snapshot().revision, 4);

  });

  it('preserves the Draft base on revision conflict until explicit discard', async function() {

    let settingsReads = 0;
    const rpc = {async call(message) {

      if (message.type === 'firefox.capabilities.get') return capabilities();
      if (message.type === 'firefox.settings.get') {
        settingsReads += 1;
        return settingsResult(settingsReads === 1 ? 1 : 2, (settings) => {
          settings.flags.noDirect = settingsReads > 1;
        });
      }
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      if (message.type === 'firefox.provider.update.get') {
        return providerUpdateResult();
      }
      throw failure('SETTINGS_REVISION_CONFLICT');

    }};
    const controller = optionsController({rpc});
    await controller.load();

    Assert.strictEqual(
        await controller.save(Settings.createDefaultSettings()),
        false,
    );
    Assert.strictEqual(controller.snapshot().notice, 'REVISION_CONFLICT');
    Assert.strictEqual(controller.snapshot().revision, 1);
    Assert.strictEqual(controller.snapshot().settings.flags.noDirect, false);
    Assert.strictEqual(controller.snapshot().stale, true);
    await controller.discard();
    Assert.strictEqual(controller.snapshot().revision, 2);
    Assert.strictEqual(controller.snapshot().stale, false);

  });

  it('saves while active without sending Apply or Clear', async function() {

    const calls = [];
    const rpc = {async call(message) {

      calls.push(message.type);
      if (message.type === 'firefox.capabilities.get') {
        return capabilities({
          runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'ACTIVE',
        });
      }
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      if (message.type === 'firefox.provider.update.get') {
        return providerUpdateResult();
      }
      return settingsResult();

    }};
    const controller = optionsController({rpc});
    await controller.load();

    Assert.strictEqual(
        await controller.save(Settings.createDefaultSettings()),
        true,
    );
    Assert.strictEqual(calls.includes('firefox.settings.replace'), true);
    Assert.strictEqual(calls.includes('firefox.activation.apply'), false);
    Assert.strictEqual(calls.includes('firefox.activation.clear'), false);

  });

  it('applies the displayed Saved revision without an implicit Save or Clear', async function() {

    const calls = [];
    const controller = optionsController({rpc: {async call(message) {

      calls.push(message);
      if (message.type === 'firefox.capabilities.get') {
        return capabilities({
          runtimeState: 'READY', durableIntent: 'ON', recoveryStatus: 'ACTIVE',
        });
      }
      if (message.type === 'firefox.settings.get') return settingsResult(5);
      if (message.type === 'firefox.operational.get') return operationalResult();
      if (message.type === 'firefox.provider.update.get') return providerUpdateResult();
      return {intent: 'ON', status: 'ACTIVE'};

    }}});
    await controller.load();
    Assert.strictEqual(await controller.applySaved(), true);
    Assert.deepStrictEqual(calls[4], {
      type: 'firefox.activation.apply', expectedRevision: 5,
    });
    Assert.strictEqual(controller.snapshot().notice, 'APPLIED');
    Assert.strictEqual(calls.some((message) => [
      'firefox.activation.clear', 'firefox.settings.replace',
    ].includes(message.type)), false);

  });

  it('locks duplicate option saves while one is pending', async function() {

    const gate = deferred();
    let replaceCalls = 0;
    const rpc = {async call(message) {

      if (message.type === 'firefox.capabilities.get') return capabilities();
      if (message.type === 'firefox.settings.get') return settingsResult();
      if (message.type === 'firefox.operational.get') {
        return operationalResult();
      }
      if (message.type === 'firefox.provider.update.get') {
        return providerUpdateResult();
      }
      replaceCalls += 1;
      await gate.promise;
      return settingsResult(1);

    }};
    const controller = optionsController({rpc});
    await controller.load();
    const first = controller.save(Settings.createDefaultSettings());
    Assert.strictEqual(
        await controller.save(Settings.createDefaultSettings()),
        false,
    );
    gate.resolve();
    Assert.strictEqual(await first, true);
    Assert.strictEqual(replaceCalls, 1);

  });

  it('rejects malformed settings responses without rendering them', function() {

    Assert.throws(
        () => Options.validateSettingsResult({revision: 0, settings: {}}),
        (error) => error.code === 'UI_RPC_FAILED',
    );
    const secretBearing = settingsResult();
    secretBearing.settings.ownProxies.push({
      id: 'unexpected-secret',
      enabled: true,
      type: 'HTTP',
      host: 'proxy.example',
      port: 8080,
      proxyDNS: false,
      failoverTimeoutSeconds: null,
      useAsDirectReplacement: false,
      credentials: {
        mode: 'KEEP',
        username: 'fixture',
        password: 'must-not-enter-ui-state',
      },
    });
    Assert.throws(
        () => Options.validateSettingsResult(secretBearing),
        (error) => error.code === 'UI_RPC_FAILED',
    );

  });

  it('validates only the fixed sanitized operational schema', function() {

    const value = Ui.validateOperationalStatus(operationalResult());
    Assert.strictEqual(value.health.status, 'UNKNOWN');
    Assert.deepStrictEqual(value.diagnostics.proxyTypes, ['HTTPS', 'SOCKS5']);
    const malformed = operationalResult();
    malformed.diagnostics = Object.assign({}, malformed.diagnostics, {
      proxyEndpoint: 'must-not-enter-diagnostics',
    });
    Assert.throws(
        () => Ui.validateOperationalStatus(malformed),
        (error) => error.code === 'UI_RPC_FAILED',
    );
    const unknownHealth = operationalResult();
    unknownHealth.health = Object.assign({}, unknownHealth.health, {
      code: 'UNTRUSTED_HEALTH_TEXT',
    });
    Assert.throws(
        () => Ui.validateOperationalStatus(unknownHealth),
        (error) => error.code === 'UI_RPC_FAILED',
    );
    const unknownRecovery = operationalResult();
    unknownRecovery.diagnostics = Object.assign(
        {}, unknownRecovery.diagnostics, {recoveryStatus: 'UNTRUSTED_STATE'},
    );
    Assert.throws(
        () => Ui.validateOperationalStatus(unknownRecovery),
        (error) => error.code === 'UI_RPC_FAILED',
    );

  });

  it('exports diagnostics without credentials, URLs, hashes, or floor data',
      function() {

        const exported = JSON.parse(Options.diagnosticsExport(
            operationalResult(),
        ));
        Assert.deepStrictEqual(Object.keys(exported).sort(),
            [...Ui.DIAGNOSTIC_KEYS].sort());
        for (const forbidden of [
          'credentials', 'password', 'authRef', 'tabUrl', 'targetOrigin',
          'proxyEndpoint', 'datasetHash', 'floorIdentity',
        ]) {
          Assert.strictEqual(Object.hasOwn(exported, forbidden), false);
        }

      });

  it('runs popup health for the exact transient tab URL then refreshes',
      async function() {

        const calls = [];
        const controller = popupController({rpc: {async call(message) {

          calls.push(message);
          if (message.type === 'firefox.capabilities.get') {
            return capabilities({
              runtimeState: 'READY', durableIntent: 'ON',
              recoveryStatus: 'ACTIVE',
            });
          }
          if (message.type === 'firefox.site.get') {
            return siteState({
              route: {
                mode: 'PROXY', scope: 'HOST', pattern: 'sub.example.com',
              },
            });
          }
          if (message.type === 'firefox.health.check') {
            return {
              status: 'OK', code: null, checkedAt: 1001,
              candidateType: 'ownProxy',
            };
          }
          if (message.type === 'firefox.provider.update.get') {
            return providerUpdateResult();
          }
          return operationalResult();

        }}});
        await controller.refresh();
        Assert.strictEqual(await controller.checkHealth(), true);
        const request = calls.find((message) =>
          message.type === 'firefox.health.check');
        Assert.deepStrictEqual(request, {
          type: 'firefox.health.check',
          tabUrl: 'https://sub.example.com/private',
        });

      });

  it('runs the Maintenance health check without caller-controlled config',
      async function() {

        const calls = [];
        const rpc = {async call(message) {

          calls.push(message);
          if (message.type === 'firefox.capabilities.get') {
            return capabilities({
              runtimeState: 'READY', durableIntent: 'ON',
              recoveryStatus: 'ACTIVE',
            });
          }
          if (message.type === 'firefox.settings.get') {
            return settingsResult();
          }
          if (message.type === 'firefox.health.check') {
            return {
              status: 'INCONCLUSIVE', code: 'HEALTH_TARGET_REQUIRED',
              checkedAt: 1001, candidateType: null,
            };
          }
          if (message.type === 'firefox.provider.update.get') {
            return providerUpdateResult();
          }
          return operationalResult();

        }};
        const controller = optionsController({rpc});
        await controller.load();
        Assert.strictEqual(await controller.checkHealth(), true);
        Assert.deepStrictEqual(calls.find((message) =>
          message.type === 'firefox.health.check'), {
          type: 'firefox.health.check',
        });

      });

  it('checks updates with no caller-controlled trust or dataset input',
      async function() {

        const calls = [];
        let checked = false;
        const controller = optionsController({rpc: {
          async call(message) {

            calls.push(message);
            if (message.type === 'firefox.capabilities.get') {
              return capabilities({providerUpdateConfigured: true});
            }
            if (message.type === 'firefox.settings.get') {
              return settingsResult();
            }
            if (message.type === 'firefox.operational.get') {
              return operationalResult();
            }
            if (message.type === 'firefox.provider.update.get') {
              return providerUpdateResult(checked ? {
                trustConfigured: true,
                automaticChecksEnabled: true,
                status: 'UPDATE_AVAILABLE',
                updateAvailable: true,
                stagedDatasetVersion: 'public-v2',
                lastCheckStatus: 'STAGED',
                lastCheckAt: 1000,
                lastSuccessfulCheckAt: 1000,
              } : {
                trustConfigured: true,
                automaticChecksEnabled: true,
                status: 'IDLE',
              });
            }
            if (message.type === 'firefox.provider.update.check') {
              checked = true;
              return {status: 'STAGED'};
            }
            throw failure('UNEXPECTED_RPC');

          },
        }});
        await controller.load();
        Assert.strictEqual(await controller.checkProviderUpdate(), true);
        Assert.deepStrictEqual(calls.find((message) =>
          message.type === 'firefox.provider.update.check'), {
          type: 'firefox.provider.update.check',
        });
        Assert.strictEqual(
            controller.snapshot().providerUpdate.updateAvailable,
            true,
        );

      });

  it('installs a staged update while OFF without activating protection',
      async function() {

        const calls = [];
        let installed = false;
        const controller = optionsController({rpc: {
          async call(message) {

            calls.push(message);
            if (message.type === 'firefox.capabilities.get') {
              return capabilities();
            }
            if (message.type === 'firefox.settings.get') {
              return settingsResult();
            }
            if (message.type === 'firefox.operational.get') {
              return operationalResult();
            }
            if (message.type === 'firefox.provider.update.get') {
              return providerUpdateResult({
                trustConfigured: true,
                automaticChecksEnabled: true,
                status: installed ? 'UPDATED' : 'UPDATE_AVAILABLE',
                currentDatasetVersion: installed ? 'public-v2' : 'public-v1',
                stagedDatasetVersion: installed ? null : 'public-v2',
                updateAvailable: !installed,
                lastCheckStatus: installed ? 'INSTALLED' : 'STAGED',
              });
            }
            if (message.type === 'firefox.provider.update.install') {
              installed = true;
              return {status: 'INSTALLED'};
            }
            throw failure('UNEXPECTED_RPC');

          },
        }});
        await controller.load();
        Assert.strictEqual(await controller.installProviderUpdate(), true);
        Assert.deepStrictEqual(calls.find((message) =>
          message.type === 'firefox.provider.update.install'), {
          type: 'firefox.provider.update.install',
        });
        Assert.strictEqual(
            controller.snapshot().providerUpdate.currentDatasetVersion,
            'public-v2',
        );

      });

  it('requests staged installation while ACTIVE without applying an unsaved rules Draft', async function() {

    const calls = [];
    const controller = optionsController({rpc: {
      async call(message) {

        calls.push(message.type);
        if (message.type === 'firefox.capabilities.get') {
          return capabilities({
            runtimeState: 'READY', durableIntent: 'ON',
            recoveryStatus: 'ACTIVE', providerUpdateConfigured: true,
          });
        }
        if (message.type === 'firefox.settings.get') {
          return settingsResult();
        }
        if (message.type === 'firefox.operational.get') {
          return operationalResult();
        }
        return providerUpdateResult({
          trustConfigured: true,
          automaticChecksEnabled: true,
          status: 'UPDATE_AVAILABLE',
          stagedDatasetVersion: 'public-v2',
          updateAvailable: true,
          lastCheckStatus: 'STAGED',
        });

      },
    }});
    await controller.load();
    controller.edit();
    Assert.strictEqual(await controller.installProviderUpdate(), true);
    Assert.strictEqual(controller.snapshot().dirty, true);
    Assert.strictEqual(
        calls.includes('firefox.provider.update.install'),
        true,
    );
    Assert.strictEqual(calls.includes('firefox.settings.replace'), false);
    Assert.strictEqual(calls.includes('firefox.activation.apply'), false);

  });

  it('rejects secret-bearing provider update status', function() {

    for (const unsafe of [
      Object.assign(providerUpdateResult(), {
        manifestUrl: 'https://updates.example/private',
      }),
      providerUpdateResult({
        status: 'CHECK_FAILED',
        errorCategory: 'https://updates.example/private',
      }),
    ]) {
      Assert.throws(
          () => Options.validateProviderUpdateStatus(unsafe),
          (error) => error.code === 'UI_RPC_FAILED',
      );
    }

  });

  it('refreshes blocked activation after a failed active provider install and preserves Draft', async function() {

    const test = unifiedUi();
    const controller = Options.createController({rpc: {async call(message) {

      if (message.type === 'firefox.provider.update.get') {
        return providerUpdateResult({trustConfigured: true, status: 'UPDATE_AVAILABLE',
          updateAvailable: true, stagedDatasetVersion: 'public-v2'});
      }
      if (message.type === 'firefox.provider.update.install') {
        test.fail(true);
        throw failure('CONTROL_LOSS');
      }
      return test.rpc.call(message);

    }}});
    await controller.load();
    controller.edit();
    Assert.strictEqual(await controller.installProviderUpdate(), false);
    Assert.strictEqual(controller.snapshot().dirty, true);
    Assert.strictEqual(controller.snapshot().editable, false);
    Assert.strictEqual(controller.snapshot().configuration.blocked, true);
    Assert.strictEqual(controller.snapshot().configuration.active, false);
    Assert.strictEqual(controller.snapshot().notice, null);

  });

  it('falls back to the message key without throwing', function() {

    const browserApi = {i18n: {getMessage() {

      return '';

    }}};
    Assert.strictEqual(Ui.translate(browserApi, 'missingMessage'),
        'missingMessage');
    Assert.strictEqual(Ui.translate({}, 'missingMessage'), 'missingMessage');

  });

  it('keeps English and Russian catalogs complete and distinct', function() {

    const catalogs = ['en', 'ru'].map((language) => JSON.parse(
        Fs.readFileSync(
            Path.join(sourceRoot, '_locales', language, 'messages.json'),
            'utf8',
        ),
    ));
    Assert.deepStrictEqual(
        Object.keys(catalogs[0]).sort(), Object.keys(catalogs[1]).sort(),
    );
    Assert.ok(Object.values(catalogs[0]).every((entry) => entry.message));
    Assert.ok(Object.values(catalogs[1]).every((entry) => entry.message));
    Assert.notStrictEqual(
        catalogs[0].popupStateActive.message,
        catalogs[1].popupStateActive.message,
    );
    Assert.strictEqual(catalogs[0].unifiedSaveSection.message, 'Save settings');
    Assert.strictEqual(catalogs[1].unifiedSaveSection.message, 'Сохранить настройки');
    Assert.strictEqual(catalogs[0].optionsApplySaved.message, 'Apply');
    Assert.strictEqual(catalogs[1].optionsApplySaved.message, 'Применить');
    Assert.strictEqual(catalogs[0].optionsNavAutomaticRouting.message, 'Routing source');
    Assert.strictEqual(catalogs[1].optionsNavAutomaticRouting.message, 'Источник правил');
    Assert.strictEqual(catalogs[0].providerLifecycleName.message, 'Routing data');
    Assert.strictEqual(catalogs[1].providerLifecycleName.message, 'Данные маршрутизации');
    Assert.strictEqual(catalogs[0].popupModePROXY.message, 'Proxy');
    Assert.strictEqual(catalogs[1].popupModePROXY.message, 'Через прокси');
    Assert.strictEqual(catalogs[0].diagnosticsRuntimeState.message, 'Protection state');
    Assert.strictEqual(catalogs[1].diagnosticsRuntimeState.message, 'Состояние защиты');
    Assert.strictEqual(catalogs[0].popupSiteEditingRequiresOff, undefined);
    Assert.strictEqual(catalogs[1].popupSiteEditingRequiresOff, undefined);

  });

  it('describes active provider updates without requiring protection to be off', function() {

    const catalogs = ['en', 'ru'].map((language) => JSON.parse(
        Fs.readFileSync(
            Path.join(sourceRoot, '_locales', language, 'messages.json'),
            'utf8',
        ),
    ));
    Assert.match(catalogs[0].providerUpdateHelp.message, /protection active/i);
    Assert.doesNotMatch(catalogs[0].providerUpdateHelp.message, /protection off/i);
    Assert.match(catalogs[0].providerUpdateActiveHelp.message, /saved changes stay pending/i);
    Assert.match(catalogs[1].providerUpdateHelp.message, /включённой защите/i);
    Assert.doesNotMatch(catalogs[1].providerUpdateHelp.message, /выключенной защите/i);
    Assert.match(catalogs[1].providerUpdateActiveHelp.message, /ожидающими применения/i);

  });

  it('defines every static and generated UI message in both catalogs', function() {

    const catalogs = ['en', 'ru'].map((language) => JSON.parse(
        Fs.readFileSync(
            Path.join(sourceRoot, '_locales', language, 'messages.json'),
            'utf8',
        ),
    ));
    const sources = [
      'pages/popup/index.js',
      'pages/options/index.js',
    ].map((relative) => Fs.readFileSync(
        Path.join(sourceRoot, relative), 'utf8',
    )).join('\n');
    const used = new Set(Array.from(
        sources.matchAll(/\bt\('([^']+)'/g),
        (match) => match[1],
    ));
    for (const key of [
      'credentialKEEP',
      'credentialNONE',
      'credentialSET',
      'flagNoDirect',
      'flagOwnProxiesOnlyForOwnSites',
      'flagReplaceDirectWithProxy',
      'flagUseProviderProxies',
      'popupPillOFF',
      'popupPillACTIVE',
      'popupPillRECOVERED',
      'popupPillINITIALIZING',
      'popupPillBLOCKED',
      'popupPillEXTERNAL',
      'popupModeAUTO',
      'popupModePROXY',
      'popupModeDIRECT',
      'healthCode_HEALTH_CHECK_FAILED',
      'healthCode_HEALTH_CHECK_INTERRUPTED',
      'healthCode_HEALTH_CHECK_SUPERSEDED',
      'healthCode_HEALTH_CHECK_TIMEOUT',
      'healthCode_HEALTH_NOT_ACTIVE',
      'healthCode_HEALTH_PROXY_CANDIDATE_UNAVAILABLE',
      'healthCode_HEALTH_PROXY_RULE_REQUIRED',
      'healthCode_HEALTH_TARGET_REQUIRED',
      'providerUpdateError_AUTHENTICATION_FAILED',
      'providerUpdateError_DATASET_REJECTED',
      'providerUpdateError_NETWORK_FAILED',
      'providerUpdateError_ROLLBACK_REJECTED',
      'providerUpdateError_SEQUENCE_CONFLICT',
      'providerUpdateError_STORAGE_FAILED',
      'providerUpdateError_TRUST_NOT_CONFIGURED',
      'providerUpdateError_UPDATE_INTERRUPTED',
      'providerUpdateError_UPDATE_REJECTED',
    ]) {
      used.add(key);
    }
    for (const key of used) {
      Assert.ok(catalogs[0][key] && catalogs[0][key].message, `en:${key}`);
      Assert.ok(catalogs[1][key] && catalogs[1][key].message, `ru:${key}`);
    }

  });

  it('uses text-only DOM construction and never embeds stored passwords', function() {

    const sources = [
      'pages/shared/ui-runtime.js',
      'pages/popup/index.js',
      'pages/options/index.js',
    ].map((relative) => Fs.readFileSync(
        Path.join(sourceRoot, relative), 'utf8',
    )).join('\n');
    for (const forbidden of [
      'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'console.',
      'setAttribute(\'value\'', 'setAttribute("value"',
    ]) {
      Assert.strictEqual(sources.includes(forbidden), false, forbidden);
    }
    Assert.match(sources, /fieldNewPassword', 'password', '', 'password'/);

  });

});
