'use strict';

const Assert = require('node:assert');
const Activation = require('../background/activation-controller');
const Config = require('../background/product-config');
const DatasetStore = require('../background/dataset-store');
const Promotion = require('../background/dataset-promotion');
const OffState = require('../background/off-state');
const Production = require('../background/production-provider');
const ProxyAuth = require('../background/proxy-auth');
const ProxyControl = require('../background/proxy-control');
const Routing = require('../background/routing-adapter');
const Settings = require('../background/settings-control');
const Helpers = require('./dataset-test-helpers');

const sha256 = async (bytes) => Helpers.sha256(Buffer.from(bytes));

function gate() {

  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};

}

async function fixture() {

  const artifact = Helpers.artifact({providerKey: Production.PROVIDER_KEY});
  const datasetStore = DatasetStore.createStore({
    backend: Helpers.memoryBackend(), sha256,
  });
  await datasetStore.commitPackagedBaseline(artifact);
  const config = structuredClone(await Production.createProductionProductConfig(sha256));
  config.datasetIdentity = {
    providerKey: artifact.envelope.providerKey,
    datasetVersion: artifact.envelope.datasetVersion,
    artifactSha256: artifact.envelope.artifactSha256,
  };
  const values = {
    [Config.CONFIG_STORAGE_KEY]: config,
    [OffState.STORAGE_KEY]: OffState.canonicalOffState(),
  };
  const control = {
    privateAccess: true,
    live: {levelOfControl: 'controllable_by_this_extension', value: {proxyType: 'none'}},
    writes: 0,
    clears: 0,
    afterWrite: null,
  };
  const storageArea = {
    async get(keys) {

      return Object.fromEntries((Array.isArray(keys) ? keys : [keys])
          .filter((key) => Object.hasOwn(values, key))
          .map((key) => [key, structuredClone(values[key])]));

    },
    async set(update) {

      Object.assign(values, structuredClone(update));
      if (control.afterWrite) await control.afterWrite(update);

    },
    async remove(key) {

      delete values[key];

    },
  };
  const factoryOptions = {storageArea, sha256, createDatasetStore: () => datasetStore};
  const prepare = Config.createActivationFactory(factoryOptions);
  async function boot() {

    const adapter = Routing.createAdapter({
      runtimeStateForRequest: () => activation.currentRuntimeState(),
      routingInputForRequest: (details) => activation.routingInputForRequest(details),
      credentialResolverForRequest: () => activation.credentialResolverForRequest(),
    });
    const auth = ProxyAuth.createHandler({
      routingAdapter: adapter,
      resolveCredentials: (_ref, details) => adapter.resolveCredentialsForChallenge(details),
    });
    const proxyControl = ProxyControl.createController({
      storageArea,
      generatePort: () => 55111,
      isPrivateAccessAllowed: () => control.privateAccess,
      clearEphemeralState: () => {
        adapter.clearAllAuthorizations();
        auth.clearAllAttempts();
      },
      proxySettings: {
        async get() {
          return control.live;
        },
        async set({value}) {

          control.writes += 1;
          control.live = {levelOfControl: 'controlled_by_this_extension', value};

        },
        async clear() {

          control.clears += 1;
          control.live = {levelOfControl: 'controllable_by_this_extension', value: {proxyType: 'none'}};

        },
      },
    });
    const activation = Activation.createController({
      storageArea, proxyControl, routingAdapter: adapter, proxyAuth: auth,
      recoveryFactory: Config.createRecoveryFactory(factoryOptions),
    });
    const settings = Settings.createController({
      storageArea, sha256,
      activationSnapshot: () => activation.snapshot(),
      datasetIdentityAvailable: () => true,
    });
    const ready = await activation.initializeFromDurable();
    return {activation, adapter, auth, settings, ready};

  }
  const runtime = await boot();
  return Object.assign(runtime, {
    boot, control, factoryOptions, prepare, values, datasetStore, storageArea,
  });

}

function authenticatedSettings(password = 'fixture-old') {

  const settings = Settings.createDefaultSettings();
  settings.rules.proxy = ['beta.example'];
  settings.ownProxies = [{
    id: 'fixture', enabled: true, type: 'HTTP', host: 'proxy.example', port: 18080,
    proxyDNS: false, failoverTimeoutSeconds: null, useAsDirectReplacement: false,
    credentials: {mode: 'SET', username: 'fixture-user', password},
  }];
  return settings;

}

async function activeFixture() {

  const test = await fixture();
  await test.settings.replace(0, authenticatedSettings());
  Assert.strictEqual((await test.activation.activatePrepared(await test.prepare())).ok, true);
  return test;

}

function challenge(test, requestId) {

  test.adapter.onProxyRequest({requestId, url: 'https://beta.example/'});
  Assert.deepStrictEqual(test.adapter.onBeforeRequest({
    requestId, proxyInfo: {type: 'http', host: 'proxy.example', port: 18080},
  }), {cancel: false});
  return {requestId, isProxy: true, challenger: {host: 'proxy.example', port: 18080}};

}

describe('Firefox Saved and Effective generations', function() {

  async function stagedUpdate(test, overrides = {}) {

    const artifact = Helpers.artifact({providerKey: Production.PROVIDER_KEY, datasetVersion: 'next-v2',
      payload: Helpers.payload([{width: 12, routeRef: 'PROVIDER_DIRECT', hosts: 'next.example'}]),
      trust: Helpers.Dataset.TRUST.REMOTE_AUTHENTICATED});
    Assert.strictEqual((await test.datasetStore.stageAuthenticatedCandidate({
      envelope: artifact.envelope, artifactBytes: artifact.artifactBytes, sequence: 2,
    })).ok, true);
    return Promotion.createController(Object.assign({storageArea: test.storageArea,
      datasetStore: test.datasetStore, sha256, providerKey: Production.PROVIDER_KEY,
      activationSnapshot: () => test.activation.snapshot(),
      replacePrepared: (prepared) => test.activation.replacePrepared(prepared),
    }, overrides));

  }

  it('installs provider data while ON using Effective N, never pending Saved N+1, including after restart', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    const oldRequest = challenge(test, 'before-provider');
    const next = authenticatedSettings('pending-password');
    next.rules.direct = ['beta.example'];
    next.rules.proxy = [];
    await test.settings.replace(1, next);
    const saved = structuredClone(test.values[Config.SETTINGS_COMMIT_STORAGE_KEY]);
    const credentials = structuredClone(test.values[Config.CREDENTIALS_STORAGE_KEY]);
    const promotion = await stagedUpdate(test);
    Assert.deepStrictEqual(await promotion.install(), {ok: true, status: 'INSTALLED'});
    Assert.strictEqual(test.activation.snapshot().active, true);
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY].routingDescriptor,
        before.routingDescriptor);
    Assert.notDeepStrictEqual(test.values[OffState.STORAGE_KEY].datasetIdentity,
        before.datasetIdentity);
    Assert.strictEqual((await test.settings.getEffective()).revision, 1);
    Assert.strictEqual((await test.settings.get()).revision, 2);
    Assert.deepStrictEqual(test.values[Config.SETTINGS_COMMIT_STORAGE_KEY], saved);
    Assert.deepStrictEqual(test.values[Config.CREDENTIALS_STORAGE_KEY], credentials);
    Assert.strictEqual(test.auth.onAuthRequired(oldRequest).authCredentials.password, 'fixture-old');
    const afterProvider = challenge(test, 'after-provider');
    Assert.strictEqual(test.auth.onAuthRequired(afterProvider).authCredentials.password, 'fixture-old');
    Assert.strictEqual(test.control.clears, 0);
    Assert.strictEqual(test.control.writes, 1);
    const reboot = await test.boot();
    Assert.strictEqual(reboot.activation.snapshot().active, true);
    Assert.strictEqual((await reboot.settings.getEffective()).revision, 1);
    Assert.strictEqual((await reboot.settings.get()).revision, 2);
    Assert.strictEqual(reboot.auth.onAuthRequired(challenge(reboot, 'restart-provider')).authCredentials.password, 'fixture-old');
    // A later explicit user Apply uses the newly installed data, not its old identity.
    Assert.strictEqual((await reboot.activation.replacePrepared(await test.prepare(2))).ok, true);
    Assert.strictEqual((await reboot.settings.getEffective()).revision, 2);

  });

  it('keeps the old provider and auth serving while staged runtime preparation is paused', async function() {

    const test = await activeFixture();
    const entered = gate();
    const resume = gate();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    const promotion = await stagedUpdate(test, {replacePrepared: (prepared) =>
      test.activation.replacePrepared(Object.assign({}, prepared, {datasetStore: {
        async loadVerifications(...args) {

          entered.resolve();
          await resume.promise;
          return prepared.datasetStore.loadVerifications(...args);

        },
      }}))});
    const installing = promotion.install();
    await entered.promise;
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY], before);
    Assert.strictEqual(test.auth.onAuthRequired(challenge(test, 'preparing-provider')).authCredentials.password, 'fixture-old');
    Assert.strictEqual(test.control.clears, 0);
    resume.resolve();
    Assert.strictEqual((await installing).ok, true);

  });

  it('rolls back a failed provider preparation without changing provider pointers or Effective', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    const promotion = await stagedUpdate(test, {replacePrepared: (prepared) =>
      test.activation.replacePrepared(Object.assign({}, prepared, {datasetStore: {
        loadVerifications: async () => {
          throw new Error('synthetic unavailable candidate');
        },
      }}))});
    const pointers = (await test.datasetStore.loadVerifications(Production.PROVIDER_KEY)).pointers;
    await Assert.rejects(promotion.install());
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY], before);
    const unchanged = await test.datasetStore.loadVerifications(Production.PROVIDER_KEY);
    Assert.deepStrictEqual(unchanged.pointers, pointers);
    Assert.strictEqual(test.activation.snapshot().active, true);
    Assert.strictEqual(test.values[Config.DATASET_PROMOTION_STORAGE_KEY], undefined);
    Assert.strictEqual(test.control.clears, 0);

  });

  it('rejects an unauthenticated staged artifact while active before retaining or promoting it', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values);
    const promotion = await stagedUpdate(test, {datasetStore: Object.assign({}, test.datasetStore, {
      async loadStaged(provider) {

        const staged = await test.datasetStore.loadStaged(provider);
        return Object.assign({}, staged, {verification: Object.assign({}, staged.verification, {
          trust: Helpers.Dataset.TRUST.REMOTE_UNAUTHENTICATED,
        })});

      },
    })});
    await Assert.rejects(promotion.install(), {code: Promotion.ERRORS.NO_STAGED_CANDIDATE});
    Assert.deepStrictEqual(test.values, before);
    Assert.strictEqual(test.activation.snapshot().active, true);
    Assert.strictEqual(test.control.clears, 0);

  });

  it('rechecks authenticated candidate identity before committing an active replacement', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    let checks = 0;
    const promotion = await stagedUpdate(test, {replacePrepared: (prepared) =>
      test.activation.replacePrepared(Object.assign({}, prepared, {async checkSavedRevision() {

        checks += 1;
        if (checks === 2) throw new Error('synthetic candidate invalidated');
        return prepared.checkSavedRevision();

      }}))});
    await Assert.rejects(promotion.install());
    Assert.strictEqual(checks, 2);
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY], before);
    Assert.strictEqual(test.activation.snapshot().active, true);
    Assert.strictEqual(test.control.clears, 0);
    Assert.strictEqual(test.values[Config.DATASET_PROMOTION_STORAGE_KEY], undefined);

  });

  for (const loss of ['permission', 'control']) {
    it(`provider promotion rechecks ${loss} without claiming READY`, async function() {

      const test = await activeFixture();
      const promotion = await stagedUpdate(test, {replacePrepared: (prepared) => {
        if (loss === 'permission') test.control.privateAccess = false;
        else test.control.live = {levelOfControl: 'controlled_by_other_extensions', value: {proxyType: 'none'}};
        return test.activation.replacePrepared(prepared);
      }});
      await Assert.rejects(promotion.install());
      Assert.strictEqual(test.activation.snapshot().active, false);
      Assert.notStrictEqual(test.activation.snapshot().runtimeState, 'READY');
      Assert.strictEqual(test.control.clears, 0);

    });
  }

  it('finishes a committed provider promotion after interrupted pointer persistence', async function() {

    const test = await activeFixture();
    const promotion = await stagedUpdate(test, {datasetStore: Object.assign({}, test.datasetStore, {
      promoteStagedExact: async () => {
        throw new Error('synthetic interrupted pointer write');
      },
    })});
    await Assert.rejects(promotion.install(), {code: Promotion.ERRORS.RECOVERY_REQUIRED});
    Assert.ok(test.values[Config.DATASET_PROMOTION_STORAGE_KEY]);
    await test.activation.requireRecovery();
    Assert.strictEqual(test.activation.snapshot().active, false);
    const recovery = Promotion.createController({storageArea: test.storageArea,
      datasetStore: test.datasetStore, sha256, providerKey: Production.PROVIDER_KEY,
      activationSnapshot: () => test.activation.snapshot()});
    Assert.strictEqual((await recovery.initialize()).status, 'ROLLED_FORWARD');
    Assert.strictEqual((await test.boot()).activation.snapshot().active, true);
    Assert.strictEqual(test.values[OffState.STORAGE_KEY].datasetIdentity.datasetVersion, 'next-v2');

  });

  it('recovers interrupted provider preparation to the old Effective generation', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    const promotion = await stagedUpdate(test, {replacePrepared: async () => {
      throw new Error('interrupted');
    }});
    await Assert.rejects(promotion.install(), {code: Promotion.ERRORS.RECOVERY_REQUIRED});
    Assert.strictEqual((await promotion.initialize()).status, 'ROLLED_BACK');
    const reboot = await test.boot();
    Assert.strictEqual(reboot.activation.snapshot().active, true);
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY].datasetIdentity,
        before.datasetIdentity);

  });

  it('saves while OFF without activating or retaining an Effective generation', async function() {

    const test = await fixture();
    Assert.strictEqual((await test.settings.replace(0, authenticatedSettings())).revision, 1);
    Assert.strictEqual(test.values[Config.GENERATIONS_STORAGE_KEY], undefined);
    Assert.strictEqual(test.activation.snapshot().runtimeState, 'OFF');
    Assert.strictEqual(test.control.writes, 0);

  });

  it('Save while ON leaves routing, credentials, identity and ownership unchanged', async function() {

    const test = await activeFixture();
    const before = structuredClone(test.values[OffState.STORAGE_KEY]);
    const retained = structuredClone(test.values[Config.GENERATIONS_STORAGE_KEY]);
    const oldRequest = challenge(test, 'old');
    const next = authenticatedSettings('fixture-new');
    next.rules.direct = ['beta.example'];
    next.rules.proxy = [];
    await test.settings.replace(1, next);
    Assert.strictEqual((await test.settings.get()).revision, 2);
    Assert.strictEqual((await test.settings.getEffective()).revision, 1);
    Assert.deepStrictEqual(test.values[OffState.STORAGE_KEY], before);
    Assert.deepStrictEqual(test.values[Config.GENERATIONS_STORAGE_KEY], retained);
    Assert.strictEqual(test.auth.onAuthRequired(oldRequest).authCredentials.password, 'fixture-old');
    const newRequest = challenge(test, 'after-save');
    Assert.strictEqual(test.auth.onAuthRequired(newRequest).authCredentials.password, 'fixture-old');
    Assert.strictEqual(test.control.writes, 1);
    Assert.strictEqual(test.control.clears, 0);

  });

  it('Apply swaps generations together and preserves in-flight auth retry binding', async function() {

    const test = await activeFixture();
    const oldRequest = challenge(test, 'old');
    Assert.strictEqual(test.auth.onAuthRequired(oldRequest).authCredentials.password, 'fixture-old');
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    Assert.strictEqual((await test.activation.replacePrepared(await test.prepare())).ok, true);
    Assert.strictEqual((await test.settings.getEffective()).revision, 2);
    Assert.strictEqual(test.auth.onAuthRequired(oldRequest).authCredentials.password, 'fixture-old');
    Assert.deepStrictEqual(test.auth.onAuthRequired(oldRequest), {cancel: true});
    const nextRequest = challenge(test, 'new');
    Assert.strictEqual(test.auth.onAuthRequired(nextRequest).authCredentials.password, 'fixture-new');
    test.adapter.onRequestTerminal(oldRequest);
    test.auth.onRequestTerminal(oldRequest);
    Assert.deepStrictEqual(test.auth.onAuthRequired(oldRequest), {cancel: true});
    Assert.strictEqual(test.control.writes, 1);
    Assert.strictEqual(test.control.clears, 0);

  });

  it('keeps the old session serving throughout candidate preparation', async function() {

    const test = await activeFixture();
    const entered = gate();
    const resume = gate();
    const next = authenticatedSettings();
    next.rules.proxy = [];
    next.rules.direct = ['beta.example'];
    await test.settings.replace(1, next);
    const prepared = await test.prepare();
    const candidate = Object.assign({}, prepared, {datasetStore: {
      async loadVerifications(...args) {

        entered.resolve();
        await resume.promise;
        return prepared.datasetStore.loadVerifications(...args);

      },
    }});
    const replacing = test.activation.replacePrepared(candidate);
    await entered.promise;
    challenge(test, 'during-prepare');
    Assert.strictEqual(test.activation.snapshot().runtimeState, 'READY');
    resume.resolve();
    Assert.strictEqual((await replacing).ok, true);
    Assert.strictEqual(test.adapter.onProxyRequest({requestId: 'after', url: 'https://beta.example/'}), null);

  });

  it('retains the old Effective generation on candidate or stale-revision failure', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    const prepared = await test.prepare();
    const bad = Object.assign({}, prepared, {datasetStore: {
      async loadVerifications() {
        throw new Error('synthetic dataset failure');
      },
    }});
    Assert.strictEqual((await test.activation.replacePrepared(bad)).ok, false);
    await test.settings.replace(2, authenticatedSettings('fixture-newer'));
    Assert.strictEqual((await test.activation.replacePrepared(prepared)).error.code, 'SAVED_REVISION_CHANGED');
    Assert.strictEqual(test.activation.snapshot().runtimeState, 'READY');
    Assert.strictEqual((await test.settings.getEffective()).revision, 1);
    Assert.strictEqual(test.control.clears, 0);

  });

  it('recovers old Effective with newer Saved, even after interrupted Saved writes', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    test.values[Config.SETTINGS_TRANSACTION_STORAGE_KEY] = {schemaVersion: 1, status: 'WRITING'};
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 1);
    Assert.strictEqual(restarted.auth.onAuthRequired(challenge(restarted, 'recovered')).authCredentials.password, 'fixture-old');
    Assert.strictEqual(test.control.writes, 1);

  });

  it('recovers the promoted generation after a successful Apply', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    await test.activation.replacePrepared(await test.prepare());
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 2);
    Assert.strictEqual(restarted.auth.onAuthRequired(challenge(restarted, 'new')).authCredentials.password, 'fixture-new');

  });

  it('recovers the old generation after preparation retained an uncommitted candidate', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    const candidate = await test.prepare();
    await candidate.retainSnapshot();
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 1);
    Assert.strictEqual(test.values[Config.GENERATIONS_STORAGE_KEY].records.length, 2);

  });

  it('rejects a revision change at the last check before promotion', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    const prepared = await test.prepare();
    let checks = 0;
    const candidate = Object.assign({}, prepared, {
      async checkSavedRevision() {

        checks += 1;
        if (checks === 2) await test.settings.replace(2, authenticatedSettings('fixture-newer'));
        return prepared.checkSavedRevision();

      },
    });
    Assert.strictEqual((await test.activation.replacePrepared(candidate)).error.code, 'SAVED_REVISION_CHANGED');
    Assert.strictEqual((await test.settings.getEffective()).revision, 1);
    Assert.strictEqual(test.activation.snapshot().runtimeState, 'READY');

  });

  it('binds an explicit Apply revision to the captured Saved snapshot', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    await Assert.rejects(test.prepare(1), (error) => error.code === 'SAVED_REVISION_CHANGED');
    const prepared = await test.prepare(2);
    Assert.strictEqual((await test.activation.replacePrepared(prepared)).ok, true);
    Assert.strictEqual((await test.settings.getEffective()).revision, 2);

  });

  it('pins matching legacy state during boot and keeps retained history bounded', async function() {

    const test = await activeFixture();
    delete test.values[Config.GENERATIONS_STORAGE_KEY];
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual(test.values[Config.GENERATIONS_STORAGE_KEY].records.length, 1);
    for (let revision = 1; revision <= 3; revision += 1) {
      await restarted.settings.replace(revision, authenticatedSettings(`fixture-${revision}`));
      const applied = await restarted.activation.replacePrepared(await test.prepare());
      Assert.strictEqual(applied.ok, true);
    }
    Assert.strictEqual(test.values[Config.GENERATIONS_STORAGE_KEY].records.length, 2);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 4);

  });

  it('keeps revision zero recoverable after default activation and a later Save', async function() {

    const test = await fixture();
    Assert.strictEqual((await test.activation.activatePrepared(await test.prepare())).ok, true);
    await test.settings.replace(0, authenticatedSettings());
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 0);
    Assert.strictEqual((await restarted.settings.get()).revision, 1);

  });

  it('blocks ambiguous promotion writes and recovers the exact durable commit', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    test.control.afterWrite = async (update) => {
      if (update[OffState.STORAGE_KEY]) throw new Error('write completed, reply lost');
    };
    Assert.strictEqual((await test.activation.replacePrepared(await test.prepare())).ok, false);
    Assert.strictEqual(test.activation.snapshot().runtimeState, 'FAILED');
    Assert.deepStrictEqual(test.adapter.onBeforeRequest({requestId: 'blocked'}), {cancel: true});
    Assert.strictEqual(test.control.clears, 0);
    test.control.afterWrite = null;
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 2);

  });

  it('pins provable legacy ON state before saving a newer revision', async function() {

    const test = await activeFixture();
    delete test.values[Config.GENERATIONS_STORAGE_KEY];
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, true);
    Assert.strictEqual((await restarted.settings.getEffective()).revision, 1);

  });

  it('blocks legacy recovery when latest Saved cannot prove the effective identity', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    delete test.values[Config.GENERATIONS_STORAGE_KEY];
    const restarted = await test.boot();
    Assert.strictEqual(restarted.ready.ok, false);
    Assert.strictEqual(restarted.activation.snapshot().runtimeState, 'FAILED');
    Assert.strictEqual(test.control.clears, 0);

  });

  for (const loss of ['private', 'control']) {
    it(`does not publish READY after ${loss} loss during promotion`, async function() {

      const test = await activeFixture();
      await test.settings.replace(1, authenticatedSettings('fixture-new'));
      test.control.afterWrite = async (update) => {
        if (!update[OffState.STORAGE_KEY]) return;
        if (loss === 'private') test.control.privateAccess = false;
        else test.control.live = {levelOfControl: 'controlled_by_other_extensions', value: {proxyType: 'none'}};
      };
      Assert.strictEqual((await test.activation.replacePrepared(await test.prepare())).ok, false);
      Assert.strictEqual(test.activation.snapshot().runtimeState, 'FAILED');
      Assert.strictEqual(test.control.clears, 0);
      Assert.strictEqual(test.control.writes, 1);

    });
  }

  it('withdraws synchronously on a control-loss event during replacement', async function() {

    const test = await activeFixture();
    await test.settings.replace(1, authenticatedSettings('fixture-new'));
    let reconciliation;
    test.control.afterWrite = async (update) => {
      if (!update[OffState.STORAGE_KEY] || update[OffState.STORAGE_KEY].intent !== 'ON') return;
      test.control.live = {
        levelOfControl: 'controlled_by_other_extensions', value: {proxyType: 'none'},
      };
      const lost = test.activation.handleProxySettingsChange(test.control.live);
      reconciliation = lost.reconciliation;
      Assert.strictEqual(test.activation.snapshot().runtimeState, 'FAILED');
    };
    Assert.strictEqual((await test.activation.replacePrepared(await test.prepare())).ok, false);
    await reconciliation;
    Assert.strictEqual(test.values[OffState.STORAGE_KEY].intent, 'OFF');
    Assert.notStrictEqual(test.activation.snapshot().runtimeState, 'READY');
    Assert.strictEqual(test.control.clears, 0);
    Assert.strictEqual(test.control.writes, 1);

  });

});
