'use strict';
/* global require */

(function publishFirefoxProviderUpdateControl(root, factory) {

  const updater = typeof module === 'object' && module.exports ?
    require('./provider-updater') : root.rucbFirefoxProviderUpdater;
  const api = factory(updater);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.rucbFirefoxProviderUpdateControl = api;

})(typeof globalThis === 'object' ? globalThis : this,
    function(ProviderUpdater) {

      const STORAGE_KEY = 'firefoxMv3ProviderUpdateStatus';
      const STORAGE_SCHEMA_VERSION = 1;
      const ALARM_NAME = 'firefox.provider.update.check';
      const AUTO_CHECK_INTERVAL_MINUTES = 12 * 60;
      const STARTUP_DELAY_MINUTES = 5;
      const IDENTIFIER_PATTERN =
        /^[a-z0-9](?:[a-z0-9._-]{0,63})$/;
      const SHA256_PATTERN = /^[a-f0-9]{64}$/;
      const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/;
      const TRUST_FIELDS = Object.freeze([
        'enabled', 'manifestUrl', 'providerKey', 'trustedPublicKeys',
      ]);
      const STATE_FIELDS = Object.freeze([
        'lastCheckAt',
        'lastCheckStatus',
        'lastErrorCategory',
        'lastSuccessfulCheckAt',
        'schemaVersion',
      ]);
      const CHECK_STATUSES = Object.freeze([
        'CHECKING', 'FAILED', 'INSTALLED', 'NEVER', 'STAGED', 'UNCHANGED',
      ]);
      const ERRORS = Object.freeze({
        INVALID_DEPENDENCIES: 'INVALID_UPDATE_CONTROL_DEPENDENCIES',
        STATE_UNAVAILABLE: 'UPDATE_STATE_UNAVAILABLE',
        TRUST_NOT_CONFIGURED: 'UPDATE_TRUST_NOT_CONFIGURED',
        UPDATE_FAILED: 'PROVIDER_UPDATE_FAILED',
      });
      const ERROR_CATEGORIES = Object.freeze({
        AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
        DATASET_REJECTED: 'DATASET_REJECTED',
        NETWORK_FAILED: 'NETWORK_FAILED',
        ROLLBACK_REJECTED: 'ROLLBACK_REJECTED',
        SEQUENCE_CONFLICT: 'SEQUENCE_CONFLICT',
        STORAGE_FAILED: 'STORAGE_FAILED',
        TRUST_NOT_CONFIGURED: 'TRUST_NOT_CONFIGURED',
        UPDATE_INTERRUPTED: 'UPDATE_INTERRUPTED',
        UPDATE_REJECTED: 'UPDATE_REJECTED',
      });
      const AUTHENTICATION_CODES = new Set([
        'ED25519_UNAVAILABLE',
        'ED25519_VERIFICATION_FAILED',
        'INVALID_UPDATE_KEY_ID',
        'INVALID_UPDATE_PUBLIC_KEY',
        'INVALID_UPDATE_SIGNATURE',
        'INVALID_UPDATE_SIGNATURE_SIZE',
        'UNKNOWN_UPDATE_KEY_ID',
        'UPDATE_KEY_ID_MISMATCH',
      ]);
      const NETWORK_CODES = new Set([
        'INVALID_UPDATE_RESPONSE',
        'STREAMING_RESPONSE_REQUIRED',
        'TOO_MANY_UPDATE_REDIRECTS',
        'UNEXPECTED_UPDATE_REDIRECT',
        'UNREADABLE_UPDATE_REDIRECT',
        'UNSAFE_ARTIFACT_URL',
        'UNSAFE_FINAL_UPDATE_URL',
        'UNSAFE_MANIFEST_URL',
        'UNSAFE_UPDATE_REDIRECT',
        'UNSAFE_UPDATE_URL',
        'UPDATE_FETCH_FAILED',
        'UPDATE_HTTP_STATUS_REJECTED',
        'UPDATE_TIMEOUT',
      ]);
      const STORAGE_CODES = new Set([
        'AUTHENTICATED_SEQUENCE_STATE_CORRUPT',
        'STAGED_POINTER_CORRUPT',
      ]);

      function controlError(code) {

        const error = new TypeError(code);
        error.code = code;
        return error;

      }

      function isPlainObject(value) {

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;

      }

      function hasExactKeys(value, keys) {

        return isPlainObject(value) && Object.keys(value).length === keys.length &&
          Object.keys(value).every((key) => keys.includes(key));

      }

      function initialState() {

        return Object.freeze({
          schemaVersion: STORAGE_SCHEMA_VERSION,
          lastCheckStatus: 'NEVER',
          lastCheckAt: null,
          lastSuccessfulCheckAt: null,
          lastErrorCategory: null,
        });

      }

      function nullableTimestamp(value) {

        return value === null || Number.isSafeInteger(value) && value >= 1;

      }

      function normalizeState(value) {

        if (!hasExactKeys(value, STATE_FIELDS) ||
            value.schemaVersion !== STORAGE_SCHEMA_VERSION ||
            !CHECK_STATUSES.includes(value.lastCheckStatus) ||
            !nullableTimestamp(value.lastCheckAt) ||
            !nullableTimestamp(value.lastSuccessfulCheckAt) ||
            (value.lastErrorCategory !== null &&
              !Object.values(ERROR_CATEGORIES).includes(
                  value.lastErrorCategory,
              ))) {
          return initialState();
        }
        return Object.freeze({
          schemaVersion: STORAGE_SCHEMA_VERSION,
          lastCheckStatus: value.lastCheckStatus,
          lastCheckAt: value.lastCheckAt,
          lastSuccessfulCheckAt: value.lastSuccessfulCheckAt,
          lastErrorCategory: value.lastErrorCategory,
        });

      }

      function parseManifestUrl(value) {

        let url;
        try {
          url = new URL(value);
        } catch (_error) {
          return null;
        }
        if (url.protocol !== 'https:' || url.username || url.password ||
            url.search || url.hash) {
          return null;
        }
        return url.href;

      }

      function decodePublicKey(value) {

        if (typeof value !== 'string' || !PUBLIC_KEY_PATTERN.test(value)) {
          return null;
        }
        const bytes = new Uint8Array(32);
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2),
              16);
        }
        return bytes;

      }

      function inspectTrustConfiguration(value, expectedProviderKey) {

        if (!hasExactKeys(value, TRUST_FIELDS) ||
            typeof value.enabled !== 'boolean' ||
            typeof value.providerKey !== 'string' ||
            !IDENTIFIER_PATTERN.test(value.providerKey) ||
            value.providerKey !== expectedProviderKey ||
            !isPlainObject(value.trustedPublicKeys)) {
          return Object.freeze({configured: false, reason: 'INVALID'});
        }
        const entries = Object.entries(value.trustedPublicKeys);
        if (value.enabled !== true) {
          return Object.freeze({
            configured: false,
            reason: value.manifestUrl === null && entries.length === 0 ?
              'DISABLED' : 'INVALID',
          });
        }
        const manifestUrl = parseManifestUrl(value.manifestUrl);
        if (!manifestUrl || !entries.length || entries.some(([keyId, hex]) =>
          !IDENTIFIER_PATTERN.test(keyId) || !decodePublicKey(hex))) {
          return Object.freeze({configured: false, reason: 'INVALID'});
        }
        return Object.freeze({
          configured: true,
          manifestUrl,
          providerKey: value.providerKey,
          trustedPublicKeys: new Map(entries.map(([keyId, hex]) => [
            keyId,
            decodePublicKey(hex),
          ])),
        });

      }

      function errorCategory(code) {

        if (code === 'ROLLBACK_REJECTED') {
          return ERROR_CATEGORIES.ROLLBACK_REJECTED;
        }
        if (code === 'SEQUENCE_CONFLICT') {
          return ERROR_CATEGORIES.SEQUENCE_CONFLICT;
        }
        if (AUTHENTICATION_CODES.has(code)) {
          return ERROR_CATEGORIES.AUTHENTICATION_FAILED;
        }
        if (NETWORK_CODES.has(code)) {
          return ERROR_CATEGORIES.NETWORK_FAILED;
        }
        if (STORAGE_CODES.has(code)) {
          return ERROR_CATEGORIES.STORAGE_FAILED;
        }
        if (typeof code === 'string' && (
          code.includes('DATASET') || code.includes('ARTIFACT') ||
          code.includes('MANIFEST') || code.includes('PROVIDER') ||
          code.includes('UTF8') || code.includes('BYTE'))) {
          return ERROR_CATEGORIES.DATASET_REJECTED;
        }
        return ERROR_CATEGORIES.UPDATE_REJECTED;

      }

      function validDatasetIdentity(value, providerKey) {

        return Boolean(value) && typeof value === 'object' &&
          value.providerKey === providerKey &&
          typeof value.datasetVersion === 'string' &&
          IDENTIFIER_PATTERN.test(value.datasetVersion) &&
          typeof value.artifactSha256 === 'string' &&
          SHA256_PATTERN.test(value.artifactSha256);

      }

      function createController(options = {}) {

        const storageArea = options.storageArea;
        const datasetStore = options.datasetStore;
        const alarmsApi = options.alarmsApi;
        const sha256 = options.sha256;
        const providerKey = options.providerKey;
        const trust = inspectTrustConfiguration(
            options.trustConfiguration,
            providerKey,
        );
        const now = typeof options.now === 'function' ?
          options.now : () => Date.now();
        const readCurrentDatasetIdentity = options.readCurrentDatasetIdentity;
        const createUpdater = typeof options.createUpdater === 'function' ?
          options.createUpdater : ProviderUpdater.createUpdater;
        if (!storageArea || typeof storageArea.get !== 'function' ||
            typeof storageArea.set !== 'function' || !datasetStore ||
            typeof datasetStore.loadStaged !== 'function' ||
            typeof datasetStore.stageAuthenticatedCandidate !== 'function' ||
            typeof sha256 !== 'function' ||
            typeof readCurrentDatasetIdentity !== 'function' ||
            typeof providerKey !== 'string' ||
            !IDENTIFIER_PATTERN.test(providerKey)) {
          throw controlError(ERRORS.INVALID_DEPENDENCIES);
        }
        let state = initialState();
        let checking = false;
        let inFlight = null;
        let updater = null;

        async function persistState(next) {

          const normalized = normalizeState(next);
          try {
            await storageArea.set({[STORAGE_KEY]: normalized});
          } catch (_error) {
            throw controlError(ERRORS.STATE_UNAVAILABLE);
          }
          state = normalized;
          return state;

        }

        async function loadState() {

          let stored;
          try {
            stored = await storageArea.get(STORAGE_KEY);
          } catch (_error) {
            throw controlError(ERRORS.STATE_UNAVAILABLE);
          }
          state = normalizeState(stored && stored[STORAGE_KEY]);
          return state;

        }

        function createProductionUpdater() {

          if (!trust.configured) {
            return null;
          }
          if (!updater) {
            updater = createUpdater({
              fetchImpl: options.fetchImpl,
              cryptoSubtle: options.cryptoSubtle,
              trustedPublicKeys: trust.trustedPublicKeys,
              store: datasetStore,
              sha256,
              AbortController: options.AbortController,
              deadlineMs: options.deadlineMs,
            });
          }
          return updater;

        }

        async function inspectDatasets() {

          const values = await Promise.all([
            readCurrentDatasetIdentity(),
            datasetStore.loadStaged(providerKey),
          ]);
          const current = validDatasetIdentity(values[0], providerKey) ?
            values[0] : null;
          const staged = values[1] && values[1].ok === true &&
            values[1].status === 'STAGED' && values[1].verification &&
            values[1].verification.ok === true &&
            validDatasetIdentity(
                values[1].verification.dataset.identity,
                providerKey,
            ) ? values[1].verification.dataset.identity : null;
          return Object.freeze({current, staged});

        }

        async function publicStatus() {

          let datasets;
          try {
            datasets = await inspectDatasets();
          } catch (_error) {
            throw controlError(ERRORS.STATE_UNAVAILABLE);
          }
          const updateAvailable = Boolean(datasets.staged &&
            (!datasets.current || datasets.staged.artifactSha256 !==
              datasets.current.artifactSha256));
          let status = 'IDLE';
          if (!trust.configured) {
            status = 'NOT_CONFIGURED';
          } else if (checking) {
            status = 'CHECKING';
          } else if (updateAvailable) {
            status = 'UPDATE_AVAILABLE';
          } else if (state.lastCheckStatus === 'FAILED') {
            status = 'CHECK_FAILED';
          } else if (state.lastCheckStatus === 'INSTALLED') {
            status = 'UPDATED';
          } else if (state.lastCheckStatus === 'UNCHANGED' ||
              state.lastCheckStatus === 'STAGED') {
            status = 'UP_TO_DATE';
          }
          return Object.freeze({
            schemaVersion: 1,
            trustConfigured: trust.configured,
            automaticChecksEnabled: trust.configured,
            status,
            currentDatasetVersion: datasets.current ?
              datasets.current.datasetVersion : null,
            stagedDatasetVersion: updateAvailable ?
              datasets.staged.datasetVersion : null,
            updateAvailable,
            lastCheckStatus: state.lastCheckStatus,
            lastCheckAt: state.lastCheckAt,
            lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
            errorCategory: state.lastErrorCategory,
          });

        }

        async function runCheck() {

          const checkedAt = now();
          if (!trust.configured) {
            await persistState({
              schemaVersion: STORAGE_SCHEMA_VERSION,
              lastCheckStatus: 'FAILED',
              lastCheckAt: checkedAt,
              lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
              lastErrorCategory: ERROR_CATEGORIES.TRUST_NOT_CONFIGURED,
            });
            return Object.freeze({
              ok: false,
              code: ERRORS.TRUST_NOT_CONFIGURED,
            });
          }
          await persistState({
            schemaVersion: STORAGE_SCHEMA_VERSION,
            lastCheckStatus: 'CHECKING',
            lastCheckAt: checkedAt,
            lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
            lastErrorCategory: null,
          });
          checking = true;
          let result;
          try {
            result = await createProductionUpdater().fetchAndStage({
              manifestUrl: trust.manifestUrl,
              providerKey,
            });
          } catch (_error) {
            result = {ok: false, code: 'UPDATE_REJECTED'};
          } finally {
            checking = false;
          }
          if (!result || result.ok !== true ||
              !['STAGED', 'UNCHANGED'].includes(result.status)) {
            const category = errorCategory(result && result.code);
            await persistState({
              schemaVersion: STORAGE_SCHEMA_VERSION,
              lastCheckStatus: 'FAILED',
              lastCheckAt: checkedAt,
              lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
              lastErrorCategory: category,
            });
            return Object.freeze({ok: false, code: ERRORS.UPDATE_FAILED});
          }
          await persistState({
            schemaVersion: STORAGE_SCHEMA_VERSION,
            lastCheckStatus: result.status,
            lastCheckAt: checkedAt,
            lastSuccessfulCheckAt: checkedAt,
            lastErrorCategory: null,
          });
          return Object.freeze({ok: true, status: result.status});

        }

        function check() {

          if (!inFlight) {
            inFlight = runCheck().finally(() => {
              inFlight = null;
            });
          }
          return inFlight;

        }

        async function markInstalled() {

          await persistState({
            schemaVersion: STORAGE_SCHEMA_VERSION,
            lastCheckStatus: 'INSTALLED',
            lastCheckAt: state.lastCheckAt,
            lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
            lastErrorCategory: null,
          });
          return publicStatus();

        }

        async function clearAlarm() {

          if (alarmsApi && typeof alarmsApi.clear === 'function') {
            await alarmsApi.clear(ALARM_NAME);
          }

        }

        async function ensureAlarm() {

          if (!alarmsApi || typeof alarmsApi.create !== 'function' ||
              typeof alarmsApi.get !== 'function') {
            return null;
          }
          if (!trust.configured) {
            await clearAlarm();
            return null;
          }
          const existing = await alarmsApi.get(ALARM_NAME);
          if (existing && existing.periodInMinutes ===
              AUTO_CHECK_INTERVAL_MINUTES) {
            return existing;
          }
          await alarmsApi.create(ALARM_NAME, {
            delayInMinutes: STARTUP_DELAY_MINUTES,
            periodInMinutes: AUTO_CHECK_INTERVAL_MINUTES,
          });
          return Object.freeze({
            name: ALARM_NAME,
            periodInMinutes: AUTO_CHECK_INTERVAL_MINUTES,
          });

        }

        async function initialize() {

          await loadState();
          if (state.lastCheckStatus === 'CHECKING') {
            await persistState({
              schemaVersion: STORAGE_SCHEMA_VERSION,
              lastCheckStatus: 'FAILED',
              lastCheckAt: state.lastCheckAt,
              lastSuccessfulCheckAt: state.lastSuccessfulCheckAt,
              lastErrorCategory: ERROR_CATEGORIES.UPDATE_INTERRUPTED,
            });
          }
          await ensureAlarm();
          return publicStatus();

        }

        async function handleAlarm(alarm) {

          if (!alarm || alarm.name !== ALARM_NAME || !trust.configured) {
            return Object.freeze({ok: true, status: 'IGNORED'});
          }
          return check();

        }

        return Object.freeze({
          check,
          handleAlarm,
          initialize,
          markInstalled,
          publicStatus,
          trustConfigured() {

            return trust.configured;

          },
        });

      }

      return Object.freeze({
        ALARM_NAME,
        AUTO_CHECK_INTERVAL_MINUTES,
        ERROR_CATEGORIES,
        ERRORS,
        STARTUP_DELAY_MINUTES,
        STORAGE_KEY,
        createController,
        errorCategory,
        inspectTrustConfiguration,
        normalizeState,
      });

    });
