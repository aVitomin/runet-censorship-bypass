'use strict';

/* global mv3Storage, mv3State, mv3Hash, mv3PacCook, mv3PacArtifacts */
/* global mv3ProxySettings, mv3ProxyAuth */

(function(exports) {

  const STORAGE_KEY = 'mv3EffectiveConfigurations';
  const SESSION_KEY = 'mv3RequestGenerations';
  const MAX_REQUESTS = 2048;
  const MAX_GENERATIONS = 32;
  let queue = Promise.resolve();
  let verifiedPac = null;
  let bindingFailure = false;

  function clone(value) {

    return JSON.parse(JSON.stringify(value));

  }

  function failure(code = 'EFFECTIVE_GENERATION_UNPROVEN') {

    const error = new Error('Effective proxy configuration could not be confirmed. Apply saved settings again.');
    error.code = code;
    return error;

  }

  function enqueue(operation) {

    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;

  }

  function session(method, value) {

    return new Promise((resolve, reject) => {
      const area = chrome.storage && chrome.storage.session;
      if (!area) return reject(failure('AUTH_BINDING_UNAVAILABLE'));
      area[method](value, (result) => {
        if (chrome.runtime.lastError) reject(failure('AUTH_BINDING_UNAVAILABLE'));
        else resolve(result);
      });
    });

  }

  async function readBindings() {

    const values = await session('get', {[SESSION_KEY]: {entries: [], saturated: false}});
    const value = values[SESSION_KEY];
    if (!value || !Array.isArray(value.entries) || value.entries.length > MAX_REQUESTS ||
        value.entries.some((entry) => typeof entry.requestId !== 'string' ||
          !(entry.generationId === null || typeof entry.generationId === 'string'))) {
      throw failure('AUTH_BINDING_UNAVAILABLE');
    }
    return value;

  }

  async function read() {

    const values = await mv3Storage.get({[STORAGE_KEY]: null});
    const value = values[STORAGE_KEY];
    if (value === null) return null;
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.records) ||
        value.records.length > MAX_GENERATIONS || value.records.some((record) =>
      !record || typeof record.id !== 'string' || !record.config ||
          !record.cookedPacCache || !record.pacCache ||
          !Number.isSafeInteger(record.savedRevision))) throw failure();
    const ids = value.records.map((record) => record.id);
    if (new Set(ids).size !== ids.length || value.effectiveId && !ids.includes(value.effectiveId) ||
        value.transaction && (!ids.includes(value.transaction.candidateId) ||
          !['prepared', 'switching'].includes(value.transaction.phase))) throw failure();
    return value;

  }

  function empty() {

    return {schemaVersion: 1, effectiveId: null, transaction: null, records: [], blocked: false};

  }

  function recordFor(store, id = store && store.effectiveId) {

    return store && store.records.find((record) => record.id === id) || null;

  }

  function configuration(state) {

    return clone({
      currentPacProviderKey: state.currentPacProviderKey,
      customPacProviders: state.customPacProviders,
      pacMods: state.pacMods,
      proxyAuth: {enabled: state.proxyAuth.enabled},
    });

  }

  function sameSaved(state, record) {

    return state.savedRevision === record.savedRevision &&
      JSON.stringify(configuration(state)) === JSON.stringify(record.config);

  }

  function overlay(state, record) {

    return Object.assign({}, state, clone(record.config), {
      savedRevision: record.savedRevision,
      pacCache: clone(record.pacCache),
      cookedPacCache: clone(record.cookedPacCache),
    });

  }

  async function matchesBrowser(record, details) {

    if (!record || details.levelOfControl !== 'controlled_by_this_extension' ||
        !details.value || details.value.mode !== 'pac_script') return false;
    const pac = details.value.pacScript || {};
    return typeof pac.data === 'string' && !pac.url && pac.mandatory !== true &&
      await pacHash(pac.data) === record.cookedPacCache.cookedPacSha256;

  }

  async function pacHash(data) {

    if (verifiedPac && verifiedPac.data === data) return verifiedPac.hash;
    const hash = await mv3Hash.sha256Hex(data);
    verifiedPac = {data, hash};
    return hash;

  }

  async function collect(store) {

    const bindings = await readBindings();
    const needed = new Set(bindings.entries.map((entry) => entry.generationId));
    needed.add(store.effectiveId);
    if (store.transaction) {
      needed.add(store.transaction.candidateId);
      needed.add(store.transaction.previousId);
    }
    store.records = store.records.filter((record) => needed.has(record.id));
    return store;

  }

  async function write(store) {

    await mv3Storage.set({[STORAGE_KEY]: store});

  }

  async function makeRecord(state) {

    const cache = state.cookedPacCache;
    if (!cache.artifactRef || cache.providerKey !== state.currentPacProviderKey ||
        cache.sourceRawPacSha256 !== state.pacCache.rawPacSha256 ||
        cache.pacModsSha256 !== await mv3PacCook.hashPacMods(state.pacMods)) throw failure();
    const artifact = await mv3PacArtifacts.getCookedPacArtifact({
      providerKey: cache.providerKey, sha256: cache.cookedPacSha256,
    });
    if (!artifact || !artifact.cookedPacData ||
        await pacHash(artifact.cookedPacData) !== cache.cookedPacSha256) throw failure();
    return {
      id: crypto.randomUUID(), savedRevision: state.savedRevision,
      config: configuration(state), pacCache: clone(state.pacCache),
      cookedPacCache: clone(cache),
    };

  }

  async function recover() {

    return enqueue(async () => {
      let store = await read();
      const state = await mv3State.loadState();
      if (['cleared', 'clearing'].includes(state.proxyApply.status)) {
        store = store || empty();
        store.effectiveId = null;
        store.transaction = null;
        await write(await collect(store));
        return null;
      }
      const details = await mv3ProxySettings.getProxySettings();
      if (!store) {
        // Legacy PAC provenance cannot prove a password: passwords never enter PAC.
        if (state.proxyApply.status !== 'applied' ||
            mv3ProxyAuth.buildProxyAuthConfig(state).credentialCount ||
            state.proxyApply.providerKey !== state.currentPacProviderKey ||
            state.proxyApply.cookedPacSha256 !== state.cookedPacCache.cookedPacSha256) return null;
        let candidate;
        try {
          candidate = await makeRecord(state);
        } catch (_error) {
          return null;
        }
        if (!await matchesBrowser(candidate, details)) return null;
        store = empty();
        store.records.push(candidate);
        store.effectiveId = candidate.id;
      }
      if (store.transaction) {
        const tx = store.transaction;
        const old = recordFor(store, tx.previousId);
        const candidate = recordFor(store, tx.candidateId);
        const oldMatches = await matchesBrowser(old, details);
        const newMatches = await matchesBrowser(candidate, details);
        if (tx.previousId === tx.candidateId && oldMatches) store.effectiveId = tx.previousId;
        else if (tx.phase === 'prepared' && oldMatches) store.effectiveId = tx.previousId;
        else if (tx.phase === 'switching' && newMatches && !oldMatches) store.effectiveId = tx.candidateId;
        else if (tx.phase === 'switching' && oldMatches && !newMatches) store.effectiveId = tx.previousId;
        else return null; // Identical PAC + interrupted credential promotion is ambiguous.
        store.transaction = null;
      }
      await write(await collect(store));
      const record = recordFor(store);
      return !store.blocked && await matchesBrowser(record, details) ? clone(record) : null;
    });

  }

  async function current() {

    return enqueue(async () => {
      const store = await read();
      if (!store || store.transaction || store.blocked) return null;
      const record = recordFor(store);
      const matched = await matchesBrowser(record, await mv3ProxySettings.getProxySettings());
      return matched ? clone(record) : null;
    });

  }

  async function retained() {

    return enqueue(async () => {
      const store = await read();
      return store && !store.transaction && !store.blocked ? clone(recordFor(store)) : null;
    });

  }

  async function hasHistory() {

    return enqueue(async () => Boolean(await read()));

  }

  async function prepare(state, expectedRevision, refreshId = null, restore = false) {

    let candidate = await makeRecord(state);
    if (expectedRevision !== undefined && expectedRevision !== candidate.savedRevision) throw failure('SAVED_REVISION_CHANGED');
    return enqueue(async () => {
      const store = await read() || empty();
      if (store.transaction || store.blocked) {
        if (refreshId) throw failure('GENERATION_PROMOTION_PENDING');
        // An explicit Apply may resolve ambiguity; it does not authorize old auth.
        store.blocked = true;
        store.transaction = null;
      }
      if (refreshId ? store.effectiveId !== refreshId :
        !sameSaved(await mv3State.loadState(), candidate)) throw failure('SAVED_REVISION_CHANGED');
      if (!refreshId && store.effectiveId &&
          !await matchesBrowser(recordFor(store), await mv3ProxySettings.getProxySettings())) {
        store.blocked = true;
      }
      await collect(store);
      if (restore) {
        const existing = recordFor(store, refreshId);
        if (!existing || !sameSaved(state, existing) ||
            existing.cookedPacCache.cookedPacSha256 !== candidate.cookedPacCache.cookedPacSha256) {
          throw failure();
        }
        candidate = clone(existing);
      } else {
        if (store.records.length >= MAX_GENERATIONS) throw failure('GENERATION_RETENTION_LIMIT');
        store.records.push(candidate);
      }
      store.transaction = {previousId: store.effectiveId, candidateId: candidate.id, phase: 'prepared'};
      await write(store);
      return clone(candidate);
    });

  }

  async function beginSwitch(candidate, refreshId = null, restore = false) {

    return enqueue(async () => {
      const store = await read();
      if (!store || !store.transaction || store.transaction.candidateId !== candidate.id ||
          (refreshId ? store.effectiveId !== refreshId :
            !sameSaved(await mv3State.loadState(), candidate))) throw failure('SAVED_REVISION_CHANGED');
      const details = await mv3ProxySettings.getProxySettings();
      if (!['controlled_by_this_extension', 'controllable_by_this_extension'].includes(details.levelOfControl) ||
          store.effectiveId && !store.blocked && !await matchesBrowser(recordFor(store), details) &&
          !(restore && details.levelOfControl === 'controllable_by_this_extension') &&
          !(refreshId === null && details.levelOfControl === 'controllable_by_this_extension')) throw failure();
      store.transaction.phase = 'switching';
      await write(store);
    });

  }

  async function commit(candidate, refreshId = null) {

    return enqueue(async () => {
      const store = await read();
      if (!store || !store.transaction || store.transaction.candidateId !== candidate.id ||
          store.transaction.phase !== 'switching' ||
          (refreshId ? store.effectiveId !== refreshId :
            !sameSaved(await mv3State.loadState(), candidate)) ||
          !await matchesBrowser(candidate, await mv3ProxySettings.getProxySettings())) {
        throw failure();
      }
      store.effectiveId = candidate.id;
      store.transaction = null;
      store.blocked = false;
      await write(await collect(store));
    });

  }

  async function abortPrepared(candidate) {

    return enqueue(async () => {
      const store = await read();
      if (store && store.transaction && store.transaction.candidateId === candidate.id && store.transaction.phase === 'prepared') {
        store.transaction = null;
        await write(await collect(store));
      }
    });

  }

  // Enqueued synchronously by onBeforeRequest. Redirects keep the first binding.
  function bindRequest(details) {

    return enqueue(() => bindRequestNow(details));

  }

  async function bindRequestNow(details) {

    try {
      const bindings = await readBindings();
      const requestId = String(details.requestId);
      if (bindings.entries.some((entry) => entry.requestId === requestId)) return;
      if (bindingFailure || bindings.saturated || bindings.entries.length >= MAX_REQUESTS) {
        bindings.saturated = true;
      } else {
        const store = await read();
        const record = recordFor(store);
        const valid = store && !store.blocked && (!store.transaction || store.transaction.phase !== 'switching') &&
          await matchesBrowser(record, await mv3ProxySettings.getProxySettings());
        bindings.entries.push({requestId, generationId: valid ? record.id : null});
      }
      await session('set', {[SESSION_KEY]: bindings});
    } catch (_bindingError) {
      // Do not rebind a failed first observation on a later redirect. If storage
      // is unavailable, refuse authentication for this worker's lifetime too.
      bindingFailure = true;
      try {
        const bindings = await readBindings();
        bindings.saturated = true;
        await session('set', {[SESSION_KEY]: bindings});
      } catch (_error) {
        // authState also requires readable session storage and a proven binding.
      }
    }

  }

  async function authState(details) {

    return enqueue(async () => {
      if (bindingFailure) throw failure('AUTH_BINDING_UNAVAILABLE');
      const bindings = await readBindings();
      const bound = bindings.entries.find((entry) => entry.requestId === String(details.requestId));
      const store = await read();
      const record = bound && recordFor(store, bound.generationId);
      if (!record || store.blocked || !await matchesBrowser(recordFor(store), await mv3ProxySettings.getProxySettings())) throw failure('AUTH_GENERATION_UNPROVEN');
      // Only the endpoint is available from Chrome; never guess a generation from it.
      const config = mv3ProxyAuth.buildProxyAuthConfig(record.config);
      const challenger = details.challenger || {};
      const host = String(challenger.host || '').trim().replace(/^\[|\]$/g, '').toLowerCase();
      const endpoint = `${host}:${Number(challenger.port)}`;
      if (!config.credentialsByChallenger[endpoint] || !config.credentialsByChallenger[endpoint].length) throw failure('AUTH_GENERATION_UNPROVEN');
      return Object.assign({}, clone(record.config), {authGenerationId: record.id});
    });

  }

  function releaseRequest(details) {

    return enqueue(async () => {
      const bindings = await readBindings();
      const requestId = String(details.requestId);
      const entries = bindings.entries.filter((entry) => entry.requestId !== requestId);
      if (entries.length === bindings.entries.length) return;
      bindings.entries = entries;
      await session('set', {[SESSION_KEY]: bindings});
      const store = await read();
      if (store) {
        const count = store.records.length;
        await collect(store);
        if (store.records.length !== count) await write(store);
      }
    });

  }

  async function protectsArtifact(ref) {

    return enqueue(async () => {
      const store = await read();
      return Boolean(store && store.records.some((record) =>
        record.pacCache.artifactRef === ref || record.cookedPacCache.artifactRef === ref));
    });

  }

  exports.mv3Effective = Object.freeze({
    STORAGE_KEY, SESSION_KEY, MAX_REQUESTS, MAX_GENERATIONS,
    abortPrepared, authState, beginSwitch, bindRequest, commit, current,
    hasHistory, overlay, prepare, protectsArtifact, recover, releaseRequest, retained, sameSaved,
  });

})(self);
