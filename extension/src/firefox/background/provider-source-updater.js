'use strict';
/* global require */

(function publishFirefoxProviderSourceUpdater(root, factory) {

  const commonJs = typeof module === 'object' && module.exports;
  const api = factory(
      commonJs ? require('../../shared/provider-dataset') : root.mv3ProviderDataset,
      commonJs ? require('./anticensority-source') : root.rucbFirefoxAnticensoritySource,
      root,
  );
  if (commonJs) {
    module.exports = api;
    return;
  }
  root.rucbFirefoxProviderSourceUpdater = api;

})(typeof globalThis === 'object' ? globalThis : this, function(Dataset, Source, root) {

  const SOURCE_ID = 'anticensority-pac';
  const SOURCE_URLS = Object.freeze([
    'https://anticensority.github.io/generated-pac-scripts/anticensority.pac',
    'https://raw.githubusercontent.com/anticensority/generated-pac-scripts/master/anticensority.pac',
  ]);
  const DEFAULT_DEADLINE_MS = 30000;
  const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
  const MAX_REDIRECTS = 3;
  const REDIRECTS = Object.freeze([301, 302, 303, 307, 308]);

  function sourceError(code) {

    const error = new TypeError(code);
    error.code = code;
    return error;

  }

  function safeUrl(value) {

    let url;
    try {
      url = new URL(value);
    } catch (_error) {
      throw sourceError('UNSAFE_SOURCE_URL');
    }
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || !SOURCE_URLS.includes(url.href)) {
      throw sourceError('UNSAFE_SOURCE_URL');
    }
    return url;

  }

  function cancelBody(response) {

    try {
      if (response && response.body && typeof response.body.cancel === 'function') {
        Promise.resolve(response.body.cancel()).catch(() => undefined);
      }
    } catch (_error) {
      // The original download rejection remains authoritative.
    }

  }

  async function readBody(response, signal) {

    const length = response.headers && response.headers.get('content-length');
    if (length !== null && length !== undefined &&
        (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) ||
         Number(length) > Source.MAX_SOURCE_BYTES)) {
      throw sourceError('INVALID_SOURCE_SIZE');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw sourceError('SOURCE_STREAM_REQUIRED');
    }
    const reader = response.body.getReader();
    let complete = false;
    try {
      const chunks = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (signal.aborted) throw sourceError('SOURCE_TIMEOUT');
        if (part.done) break;
        if (!(part.value instanceof Uint8Array)) {
          throw sourceError('INVALID_SOURCE_BYTES');
        }
        size += part.value.byteLength;
        if (size > Source.MAX_SOURCE_BYTES) throw sourceError('INVALID_SOURCE_SIZE');
        chunks.push(part.value.slice());
      }
      if (!size) throw sourceError('INVALID_SOURCE_SIZE');
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      complete = true;
      return bytes;
    } finally {
      if (!complete) {
        // Cancellation errors must not replace the bounded-data rejection.
        try {
          await reader.cancel();
        } catch (_error) {
          // Keep the original bounded-data rejection.
        }
      }
      if (typeof reader.releaseLock === 'function') reader.releaseLock();
    }

  }

  async function createCandidate(sourceBytes, sha256, nowMs = Date.now()) {

    const extracted = Source.extractPacData(sourceBytes);
    if (!Number.isSafeInteger(nowMs) || nowMs <= 0 ||
        Date.parse(extracted.updatedAt) > nowMs + MAX_FUTURE_SKEW_MS) {
      throw sourceError('PROVIDER_TIMESTAMP_FUTURE');
    }
    const payload = Source.createPayload(extracted.inputs);
    const artifactBytes = new TextEncoder().encode(JSON.stringify(payload));
    const [sourceSha256, artifactSha256] = await Promise.all([
      sha256(sourceBytes), sha256(artifactBytes),
    ]);
    if (![sourceSha256, artifactSha256].every((hash) =>
      typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
      throw sourceError('SOURCE_HASH_INVALID');
    }
    const envelope = {
      schemaVersion: Dataset.SCHEMA_VERSION,
      providerKey: 'anticensority',
      datasetVersion: `source-${extracted.updatedAt.replace(/\D/g, '')}-${artifactSha256.slice(0, 12)}`,
      generatedAt: extracted.updatedAt,
      sourceRevisions: [{sourceId: SOURCE_ID, revision: `sha256=${sourceSha256}`}],
      ruleCount: Source.countRules(payload),
      artifactByteCount: artifactBytes.byteLength,
      artifactSha256,
      routeTableVersion: Dataset.ROUTE_TABLE_VERSION,
    };
    const verified = await Dataset.verifyProviderDataset({
      envelope, artifactBytes, sha256, trust: Dataset.TRUST.REMOTE_HTTPS_VALIDATED,
    });
    if (!verified.ok || verified.activationEligible !== true) {
      throw sourceError(verified.code || 'SOURCE_DATASET_REJECTED');
    }
    return {envelope, artifactBytes, source: {
      sourceId: SOURCE_ID, sourceSha256, updatedAt: extracted.updatedAt,
    }};

  }

  function createUpdater(options = {}) {

    const {fetchImpl, sha256, store} = options;
    const AbortControllerImpl = options.AbortController || root.AbortController;
    const now = options.now || Date.now;
    const deadlineMs = options.deadlineMs === undefined ? DEFAULT_DEADLINE_MS : options.deadlineMs;
    if (typeof fetchImpl !== 'function' || typeof sha256 !== 'function' ||
        !store || typeof store.stageHttpsCandidate !== 'function' ||
        typeof AbortControllerImpl !== 'function' || typeof now !== 'function' ||
        !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 120000) {
      throw sourceError('INVALID_SOURCE_UPDATER_DEPENDENCIES');
    }

    async function download(initialUrl, signal) {

      let current = safeUrl(initialUrl);
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        if (signal.aborted) throw sourceError('SOURCE_TIMEOUT');
        let response;
        try {
          response = await fetchImpl(current.href, {cache: 'no-store', credentials: 'omit',
            method: 'GET', redirect: 'manual', referrerPolicy: 'no-referrer', signal});
        } catch (_error) {
          throw sourceError(signal.aborted ? 'SOURCE_TIMEOUT' : 'SOURCE_FETCH_FAILED');
        }
        try {
          if (!response || !Number.isInteger(response.status)) {
            throw sourceError('SOURCE_RESPONSE_REJECTED');
          }
          if (REDIRECTS.includes(response.status)) {
            if (redirects === MAX_REDIRECTS) throw sourceError('SOURCE_REDIRECT_LIMIT');
            const location = response.headers && response.headers.get('location');
            if (!location) throw sourceError('SOURCE_RESPONSE_REJECTED');
            current = safeUrl(new URL(location, current).href);
            cancelBody(response);
            continue;
          }
          if (response.status !== 200) {
            throw sourceError('SOURCE_HTTP_REJECTED');
          }
          if (response.redirected === true || !response.url ||
            safeUrl(response.url).href !== current.href) {
            throw sourceError('SOURCE_FINAL_URL_REJECTED');
          }
          return await readBody(response, signal);
        } catch (error) {
          cancelBody(response);
          throw error;
        }
      }
      throw sourceError('SOURCE_REDIRECT_LIMIT');

    }

    async function prepare(signal) {

      let bytes;
      for (let index = 0; index < SOURCE_URLS.length; index += 1) {
        try {
          bytes = await download(SOURCE_URLS[index], signal);
          break;
        } catch (error) {
          // An invalid payload or redirect never silently selects another source.
          if (index === SOURCE_URLS.length - 1 ||
              !['SOURCE_FETCH_FAILED', 'SOURCE_HTTP_REJECTED'].includes(error.code)) throw error;
        }
      }
      if (signal.aborted) throw sourceError('SOURCE_TIMEOUT');
      const candidate = await createCandidate(bytes, sha256, now());
      if (signal.aborted) throw sourceError('SOURCE_TIMEOUT');
      return candidate;

    }

    async function fetchAndStage() {

      const controller = new AbortControllerImpl();
      let timer;
      let candidate;
      try {
        candidate = await Promise.race([
          prepare(controller.signal),
          new Promise((_resolve, reject) => {
            timer = root.setTimeout(() => {
              controller.abort();
              reject(sourceError('SOURCE_TIMEOUT'));
            }, deadlineMs);
          }),
        ]);
      } catch (error) {
        return Object.freeze({ok: false, status: 'REJECTED',
          code: error.code || 'SOURCE_UPDATE_REJECTED'});
      } finally {
        root.clearTimeout(timer);
        controller.abort();
      }
      // The deadline bounds network/parse work. Only its completed result may
      // enter the store's serialized transaction; a late fetch cannot stage data.
      try {
        return await store.stageHttpsCandidate(candidate);
      } catch (_error) {
        return Object.freeze({ok: false, status: 'REJECTED', code: 'SOURCE_STORAGE_FAILED'});
      }

    }

    return Object.freeze({fetchAndStage});

  }

  return Object.freeze({SOURCE_ID, SOURCE_URLS, DEFAULT_DEADLINE_MS,
    createCandidate, createUpdater});

});
