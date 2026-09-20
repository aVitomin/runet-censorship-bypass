'use strict';

const Assert = require('node:assert/strict');
const {createRuntimeHarness, CHANGED_RAW_PAC} = require('./runtime-performance-harness');

function proxy(password = 'synthetic-A') {

  return {enabled: true, type: 'HTTPS', host: 'proxy.example', port: 8443,
    username: 'synthetic-user', password, useAsDirectReplacement: false};

}

async function active() {

  const h = await createRuntimeHarness({pacMods: {ownProxies: [proxy()]}});
  Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
  return h;

}

async function save(h, patch = {}) {

  const saved = await h.callRpc('getPacMods');
  await h.callRpc('setPacMods', {pacMods: Object.assign(saved, {ownProxies: [proxy('synthetic-B')]}, patch)});
  return h.getState().savedRevision;

}

function challenge(h, requestId, host = 'proxy.example') {

  return new Promise((resolve) => h.events.webAuth.dispatch({
    requestId, isProxy: true, challenger: {host, port: 8443},
  }, resolve));

}

function start(h, requestId) {

  h.events.webBeforeRequest.dispatch({requestId, url: 'https://synthetic.example/'});

}

async function effective(h) {

  return h.context.mv3Effective.current();

}

describe('Chromium Saved and Effective generations', function() {
  it('projects clean and pending categories independently of storage object-key order', async function() {

    const h = await active();
    const storage = h.getLocalStorage();
    const store = storage[h.context.mv3Effective.STORAGE_KEY];
    for (const record of store.records) {
      record.config = JSON.parse(JSON.stringify(record.config, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item) ?
          Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));
    }
    const resumed = await createRuntimeHarness({initialLocalStorage: storage,
      pacMods: h.getState().pacMods, initialProxyDetails: h.getProxyDetails()});
    Assert.equal((await resumed.callRpc('getConfigurationStatus')).pending, false);
    const mods = await resumed.callRpc('getPacMods');
    mods.rules.push({pattern: 'new.example', action: 'DIRECT', enabled: true});
    await resumed.callRpc('setPacMods', {pacMods: mods});
    Assert.deepEqual(Array.from((await resumed.callRpc('getConfigurationStatus')).pendingCategories), ['siteRules']);

  });

  it('projects credential-only pending changes without credential material', async function() {

    const h = await active();
    const before = await h.callRpc('getConfigurationStatus');
    Assert.equal(before.pending, false);
    await save(h);
    const status = await h.callRpc('getConfigurationStatus');
    Assert.equal(status.active, true);
    Assert.equal(status.pending, true);
    Assert.equal(status.effectiveId, before.effectiveId);
    Assert.ok(status.pendingCategories.includes('proxyConnections'));
    Assert.doesNotMatch(JSON.stringify(status), /synthetic-|proxy\.example|username|password/);

  });

  it('serializes two UI Saves from one revision and rejects the second', async function() {

    const h = await active();
    const status = await h.callRpc('getConfigurationStatus');
    const mods = await h.callRpc('getPacMods');
    const results = await Promise.all([false, true].map((noDirect) => h.callRpcRaw('setPacMods', {
      expectedRevision: status.savedRevision,
      pacMods: Object.assign({}, mods, {ownProxies: [proxy('changed')], noDirect}),
    })));
    Assert.equal(results.filter((value) => value.ok).length, 1);
    Assert.equal(results.find((value) => !value.ok).error.code, 'SAVED_REVISION_CHANGED');
    Assert.equal((await effective(h)).id, status.effectiveId);

  });

  it('rejects stale Options Apply without promoting latest Saved', async function() {

    const h = await active();
    const status = await h.callRpc('getConfigurationStatus');
    await save(h);
    const result = await h.callRpcRaw('applySavedConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
    });
    Assert.equal(result.error.code, 'SAVED_REVISION_CHANGED');
    Assert.equal((await effective(h)).id, status.effectiveId);

  });

  it('requires explicit popup confirmation before saving or applying pending settings', async function() {

    const h = await active();
    await save(h);
    const status = await h.callRpc('getConfigurationStatus');
    const result = await h.callRpcRaw('applySiteConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
      tabUrl: 'https://sub.example.com/', mode: 'direct', scope: 'domain', applyAll: false,
    });
    Assert.equal(result.error.code, 'PENDING_CONFIRMATION_REQUIRED');
    Assert.equal(h.getState().savedRevision, status.savedRevision);
    Assert.equal((await effective(h)).id, status.effectiveId);

  });

  it('popup confirmation promotes the exact patched revision without Clear', async function() {

    const h = await active();
    await save(h);
    const status = await h.callRpc('getConfigurationStatus');
    const result = await h.callRpc('applySiteConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
      tabUrl: 'https://sub.example.com/', mode: 'direct', scope: 'domain', applyAll: true,
    });
    Assert.equal(result.ok, true);
    Assert.equal((await effective(h)).savedRevision, status.savedRevision + 1);
    Assert.equal((await h.callRpc('getConfigurationStatus')).pending, false);
    Assert.equal(h.counts.proxySettingsClears, 0);
    start(h, 'confirmed');
    Assert.equal((await challenge(h, 'confirmed')).authCredentials.password, 'synthetic-B');
    Assert.equal((await h.callRpc('getPopupState', {tabUrl: 'https://sub.example.com/'})).mode, 'direct');

  });

  it('rejects confirmation when a provider refresh changed Effective identity', async function() {

    const h = await active();
    const status = await h.callRpc('getConfigurationStatus');
    await h.audit.applyCookedPacAndPersist({});
    const result = await h.callRpcRaw('applySiteConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
      tabUrl: 'https://example.com/', mode: 'direct', scope: 'host', applyAll: true,
    });
    Assert.equal(result.error.code, 'SAVED_REVISION_CHANGED');
    Assert.equal(h.getState().savedRevision, status.savedRevision);

  });

  it('keeps a successfully Saved site patch when candidate cooking fails', async function() {

    const h = await active();
    const status = await h.callRpc('getConfigurationStatus');
    h.context.mv3PacCook = Object.assign({}, h.context.mv3PacCook, {
      cookPac: async () => {
        throw new Error('synthetic cooking failure');
      },
    });
    const result = await h.callRpc('applySiteConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
      tabUrl: 'https://example.com/', mode: 'direct', scope: 'host', applyAll: false,
    });
    Assert.equal(result.ok, false);
    Assert.equal(result.saved, true);
    Assert.equal(result.previousActive, true);
    Assert.equal((await effective(h)).id, status.effectiveId);
    Assert.equal(h.getState().savedRevision, status.savedRevision + 1);

  });
  it('Save-only password changes preserve Effective and active authentication', async function() {

    const h = await active();
    const before = await effective(h);
    const revision = await save(h);
    const after = await effective(h);
    Assert.ok(revision > before.savedRevision);
    Assert.deepEqual(after, before);
    start(h, 'after-save');
    Assert.equal((await challenge(h, 'after-save')).authCredentials.password, 'synthetic-A');

  });

  it('promotes password-only changes with an identical PAC and a distinct generation', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h);
    const applied = await h.audit.applyCookedPacAndPersist({
      expectedRevision: h.getState().savedRevision,
    });
    Assert.equal(applied.ok, true);
    const after = await effective(h);
    Assert.notEqual(after.id, before.id);
    Assert.equal(after.cookedPacCache.cookedPacSha256, before.cookedPacCache.cookedPacSha256);
    start(h, 'new');
    Assert.equal((await challenge(h, 'new')).authCredentials.password, 'synthetic-B');
    Assert.equal(h.counts.proxySettingsClears, 0);

  });

  it('binds matching routing and credentials for a PAC-changing Apply', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h, {exceptions: [{pattern: 'synthetic.example', action: 'PROXY', enabled: true}]});
    Assert.equal((await h.audit.cookPacAndPersist({})).ok, true);
    Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
    const after = await effective(h);
    Assert.notEqual(after.cookedPacCache.cookedPacSha256, before.cookedPacCache.cookedPacSha256);
    start(h, 'new-route');
    Assert.equal((await challenge(h, 'new-route')).authCredentials.password, 'synthetic-B');

  });

  it('rejects an explicit stale Saved revision without a proxy write', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h);
    h.resetCounts();
    Assert.equal((await h.audit.applyCookedPacAndPersist({expectedRevision: before.savedRevision})).status, 'stale');
    Assert.equal(h.counts.proxySettingsWrites, 0);
    Assert.equal((await effective(h)).id, before.id);

  });

  it('does not switch to latest Saved after preparing an older revision', async function() {

    const h = await active();
    const before = await effective(h);
    const gate = h.blockCookedArtifactRead();
    const applying = h.audit.applyCookedPacAndPersist({});
    await gate.started;
    await save(h);
    gate.release();
    Assert.equal((await applying).status, 'stale');
    Assert.equal((await effective(h)).id, before.id);

  });

  it('keeps old Effective serving when candidate validation fails', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h, {noDirect: true});
    Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, false);
    Assert.equal((await effective(h)).id, before.id);
    start(h, 'after-failure');
    Assert.equal((await challenge(h, 'after-failure')).authCredentials.password, 'synthetic-A');

  });

  it('keeps request-start generation A through same-endpoint B and repeated challenges', async function() {

    const h = await active();
    start(h, 'A-request');
    await save(h);
    await h.audit.applyCookedPacAndPersist({});
    Assert.equal((await challenge(h, 'A-request')).authCredentials.password, 'synthetic-A');
    start(h, 'A-request'); // redirect: same request ID, never rebind
    Assert.equal((await challenge(h, 'A-request')).authCredentials.password, 'synthetic-A');
    Assert.equal((await challenge(h, 'A-request')).cancel, true);
    start(h, 'B-request');
    Assert.equal((await challenge(h, 'B-request')).authCredentials.password, 'synthetic-B');

  });

  it('denies requests starting inside the PAC promotion boundary', async function() {

    const h = await active();
    await save(h);
    const gate = h.blockProxySettingsSetCallback();
    const applying = h.audit.applyCookedPacAndPersist({});
    await gate.started;
    start(h, 'ambiguous');
    Assert.equal((await challenge(h, 'ambiguous')).cancel, true);
    gate.release();
    Assert.equal((await applying).ok, true);
    Assert.equal((await challenge(h, 'ambiguous')).cancel, true);

  });

  for (const event of ['webCompleted', 'webError']) {
    it(`${event} releases old generation bindings and credentials`, async function() {

      const h = await active();
      const before = await effective(h);
      start(h, 'old');
      await challenge(h, 'old');
      await save(h);
      await h.audit.applyCookedPacAndPersist({});
      const api = h.context.mv3Effective;
      Assert.ok(h.getLocalStorage()[api.STORAGE_KEY].records.some((r) => r.id === before.id));
      h.events[event].dispatch({requestId: 'old', error: 'net::ERR_ABORTED'});
      await effective(h); // queue barrier
      Assert.ok(!h.getLocalStorage()[api.STORAGE_KEY].records.some((r) => r.id === before.id));
      Assert.equal((await challenge(h, 'old')).cancel, true);

    });
  }

  it('recovers old Effective with newer Saved after worker/browser recreation', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h);
    const restarted = await createRuntimeHarness({
      pacMods: h.getState().pacMods, initialLocalStorage: h.getLocalStorage(),
      initialProxyDetails: h.getProxyDetails(),
    });
    Assert.equal((await effective(restarted)).id, before.id);
    start(restarted, 'restart');
    Assert.equal((await challenge(restarted, 'restart')).authCredentials.password, 'synthetic-A');

  });

  it('preserves request generation and retry budget across worker recreation', async function() {

    const h = await active();
    start(h, 'old');
    await challenge(h, 'old');
    await save(h);
    await h.audit.applyCookedPacAndPersist({});
    const restarted = await createRuntimeHarness({
      pacMods: h.getState().pacMods, initialLocalStorage: h.getLocalStorage(),
      initialProxyDetails: h.getProxyDetails(), initialSessionStorage: h.getSessionStorage(),
    });
    Assert.equal((await challenge(restarted, 'old')).authCredentials.password, 'synthetic-A');
    Assert.equal((await challenge(restarted, 'old')).cancel, true);
    start(restarted, 'fresh');
    Assert.equal((await challenge(restarted, 'fresh')).authCredentials.password, 'synthetic-B');

  });

  it('refreshes Effective provider data without promoting pending Saved edits', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h, {noDirect: true});
    const saved = h.getState();
    h.setDownloadResult(h.createDownloadResult(CHANGED_RAW_PAC));
    const result = await h.audit.executePeriodicUpdatePipeline({trigger: 'test', applyIfSafe: true});
    Assert.equal(result.ok, true);
    const after = await effective(h);
    Assert.notEqual(after.cookedPacCache.cookedPacSha256, before.cookedPacCache.cookedPacSha256);
    Assert.equal(after.savedRevision, before.savedRevision);
    Assert.deepEqual(after.config, before.config);
    Assert.deepEqual(h.getState().pacMods, saved.pacMods);
    Assert.equal((await h.callRpc('getConfigurationStatus')).pending, true);
    Assert.equal((await h.callRpc('getConfigurationStatus')).savedRevision, saved.savedRevision);
    start(h, 'refresh');
    Assert.equal((await challenge(h, 'refresh')).authCredentials.password, 'synthetic-A');

  });

  it('does not infer a generation from mismatched browser PAC or latest Saved', async function() {

    const h = await active();
    await save(h);
    const restarted = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      initialProxyDetails: {levelOfControl: 'controlled_by_this_extension',
        value: {mode: 'pac_script', pacScript: {data: 'unproven PAC'}}}});
    Assert.equal(await effective(restarted), null);
    Assert.equal(restarted.getState().proxyApply.status, 'error');
    start(restarted, 'unknown');
    Assert.equal((await challenge(restarted, 'unknown')).cancel, true);

  });

  it('keeps an interrupted identical-PAC credential promotion ambiguous after restart', async function() {

    const h = await active();
    await save(h);
    const candidate = await h.context.mv3Effective.prepare(h.getState());
    await h.context.mv3Effective.beginSwitch(candidate);
    const restarted = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      pacMods: h.getState().pacMods, initialProxyDetails: h.getProxyDetails()});
    Assert.equal(await effective(restarted), null);
    Assert.equal(restarted.getState().proxyApply.error.code, 'EFFECTIVE_GENERATION_UNPROVEN');
    start(restarted, 'unknown');
    Assert.equal((await challenge(restarted, 'unknown')).cancel, true);
    Assert.equal((await restarted.audit.applyCookedPacAndPersist({})).ok, true);

  });

  it('migrates provable credential-free legacy PAC, but never guesses legacy passwords', async function() {

    const safe = await createRuntimeHarness();
    Assert.ok(await effective(safe));
    const ambiguous = await createRuntimeHarness({pacMods: {ownProxies: [proxy()]}});
    Assert.equal(await effective(ambiguous), null);
    start(ambiguous, 'legacy');
    Assert.equal((await challenge(ambiguous, 'legacy')).cancel, true);
    Assert.equal(ambiguous.counts.proxySettingsClears, 0);
    Assert.equal((await ambiguous.audit.applyCookedPacAndPersist({})).ok, true);

  });

  it('never supplies generation credentials to an unknown endpoint or unbound request', async function() {

    const h = await active();
    await save(h, {ownProxies: [proxy(),
      Object.assign(proxy('saved-only'), {host: 'other.example'})]});
    start(h, 'known');
    Assert.equal((await challenge(h, 'known', 'other.example')).cancel, true);
    const status = await h.callRpc('getProxyAuthStatus');
    const rejection = status.lastEvents.find((event) => event.requestId === 'known');
    Assert.equal(rejection.type, 'error');
    Assert.equal(rejection.isProxy, true);
    Assert.equal(rejection.host, 'other.example');
    Assert.equal(rejection.port, '8443');
    Assert.equal((await challenge(h, 'missing')).cancel, true);

  });

  it('restores the exact retained generation from system mode while Saved is newer', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h);
    const restored = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      pacMods: h.getState().pacMods, initialProxyDetails: {
        levelOfControl: 'controllable_by_this_extension', value: {mode: 'system'},
      }});
    Assert.equal((await effective(restored)).id, before.id);
    start(restored, 'restored');
    Assert.equal((await challenge(restored, 'restored')).authCredentials.password, 'synthetic-A');
    Assert.equal(restored.counts.proxySettingsClears, 0);

  });

  it('recovers old Effective after interrupted preparation, ignoring its retained candidate', async function() {

    const h = await active();
    const before = await effective(h);
    await save(h);
    await h.context.mv3Effective.prepare(h.getState());
    const restarted = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      pacMods: h.getState().pacMods, initialProxyDetails: h.getProxyDetails()});
    Assert.equal((await effective(restarted)).id, before.id);

  });

  it('does not acknowledge a Save racing the native set callback as applied', async function() {

    const h = await active();
    await save(h);
    const gate = h.blockProxySettingsSetCallback();
    const applying = h.audit.applyCookedPacAndPersist({});
    await gate.started;
    await save(h, {ownProxies: [proxy('synthetic-C')]});
    gate.release();
    Assert.equal((await applying).ok, false);
    Assert.equal(await effective(h), null);
    start(h, 'uncertain');
    Assert.equal((await challenge(h, 'uncertain')).cancel, true);

  });

  it('does not let a pending provider selection replace the Effective refresh source', async function() {

    const h = await active();
    const before = await effective(h);
    await h.callRpc('setCurrentPacProvider', {providerKey: 'Антицензорити'});
    h.setDownloadResult(h.createDownloadResult(CHANGED_RAW_PAC));
    const result = await h.audit.executePeriodicUpdatePipeline({trigger: 'test', applyIfSafe: true});
    Assert.equal(result.ok, true);
    Assert.equal((await effective(h)).config.currentPacProviderKey,
        before.config.currentPacProviderKey);
    Assert.equal(h.getState().currentPacProviderKey, 'Антицензорити');

  });

  it('keeps immutable credentials out of public status, diagnostics and RPC state', async function() {

    const h = await active();
    await save(h);
    const status = JSON.stringify(await h.callRpc('getState'));
    Assert.ok(!status.includes('synthetic-A') && !status.includes('synthetic-B'));
    Assert.ok(!status.includes('mv3EffectiveConfigurations'));

  });

  it('reconciles status after Effective committed but the status write was interrupted', async function() {

    const h = await active();
    await save(h);
    const candidate = await h.context.mv3Effective.prepare(h.getState());
    await h.context.mv3Effective.beginSwitch(candidate);
    await h.context.mv3Effective.commit(candidate);
    await h.context.mv3State.saveStatePatch({proxyApply: {status: 'error'}});
    const resumed = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      pacMods: h.getState().pacMods, initialProxyDetails: h.getProxyDetails()});
    Assert.equal((await effective(resumed)).id, candidate.id);
    Assert.equal(resumed.getState().proxyApply.status, 'applied');
    start(resumed, 'committed');
    Assert.equal((await challenge(resumed, 'committed')).authCredentials.password, 'synthetic-B');

  });

  it('never rebinds a redirect after its original binding could not be persisted', async function() {

    const h = await active();
    const area = h.context.chrome.storage.session;
    const original = area.set;
    area.set = (_value, callback) => {
      area.set = original;
      h.context.chrome.runtime.lastError = {message: 'Synthetic storage failure'};
      callback();
      h.context.chrome.runtime.lastError = null;
    };
    start(h, 'unpersisted');
    await effective(h);
    await save(h);
    await h.audit.applyCookedPacAndPersist({});
    start(h, 'unpersisted');
    Assert.equal((await challenge(h, 'unpersisted')).cancel, true);
    Assert.equal(h.getSessionStorage()[h.context.mv3Effective.SESSION_KEY].saturated, true);

  });

  it('bounds retained generations and preserves live auth when promotion hits the limit', async function() {

    const h = await active();
    const api = h.context.mv3Effective;
    for (let i = 1; i < api.MAX_GENERATIONS; i += 1) {
      start(h, String(i));
      await challenge(h, String(i));
      await save(h, {ownProxies: [proxy('synthetic-' + i)]});
      Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
    }
    const before = await effective(h);
    start(h, 'last');
    await challenge(h, 'last');
    await save(h);
    Assert.equal((await h.audit.applyCookedPacAndPersist({})).error.code, 'GENERATION_RETENTION_LIMIT');
    Assert.equal((await effective(h)).id, before.id);
    Assert.equal(h.getLocalStorage()[api.STORAGE_KEY].records.length, api.MAX_GENERATIONS);

  });

  it('bounds request storage without evicting or rebinding existing requests', async function() {

    const h = await active();
    const api = h.context.mv3Effective;
    const generation = await effective(h);
    const entries = Array.from({length: api.MAX_REQUESTS}, (_, i) => ({
      requestId: String(i), generationId: generation.id,
    }));
    const resumed = await createRuntimeHarness({initialLocalStorage: h.getLocalStorage(),
      initialProxyDetails: h.getProxyDetails(), pacMods: h.getState().pacMods,
      initialSessionStorage: {[api.SESSION_KEY]: {entries, saturated: false}}});
    start(resumed, 'overflow');
    Assert.equal((await challenge(resumed, 'overflow')).cancel, true);
    Assert.equal(resumed.getSessionStorage()[api.SESSION_KEY].entries.length, api.MAX_REQUESTS);
    Assert.equal(resumed.getSessionStorage()[api.SESSION_KEY].saturated, true);

  });
});
