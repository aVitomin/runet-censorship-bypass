'use strict';
/* global require */

(function publishFirefoxProductConfig(root, factory) {

  const routing = typeof module === 'object' && module.exports ?
    require('../../shared/routing-contract') :
    root.mv3RoutingContract;
  const offState = typeof module === 'object' && module.exports ?
    require('./off-state') : root.rucbFirefoxOffState;
  const api = factory(routing, offState);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.rucbFirefoxProductConfig = api;

})(typeof globalThis === 'object' ? globalThis : this,
    function(Routing, OffState) {

      const CONFIG_STORAGE_KEY = 'firefoxMv3ProductRoutingConfig';
      const CREDENTIALS_STORAGE_KEY = 'firefoxMv3ProxyCredentials';
      const GENERATIONS_STORAGE_KEY = 'firefoxMv3EffectiveConfigurations';
      const SETTINGS_COMMIT_STORAGE_KEY = 'firefoxMv3SettingsCommit';
      const SETTINGS_TRANSACTION_STORAGE_KEY = 'firefoxMv3SettingsMutation';
      const DATASET_PROMOTION_STORAGE_KEY =
        'firefoxMv3DatasetPromotionJournal';
      const SCHEMA_VERSION = 1;
      const MAX_RULES = 4096;
      const MAX_CANDIDATES = 256;
      const MAX_CREDENTIALS = 256;
      const MAX_PATTERN_LENGTH = 512;
      const MAX_CREDENTIAL_FIELD_LENGTH = 4096;
      const GROUP_NAMES = Object.freeze([
        'own',
        'localTor',
        'torBrowser',
        'warp',
      ]);
      const ROUTING_CONFIG_KEYS = Object.freeze([
        'candidateGroups',
        'flags',
        'providerCandidates',
        'providerFallback',
        'rules',
      ]);
      const RULE_KEYS = Object.freeze(['direct', 'proxy', 'whitelist']);
      const CANDIDATE_GROUP_KEYS = Object.freeze([
        'configured',
        'directReplacement',
        'onion',
      ]);
      const FLAG_KEYS = Object.freeze([
        'noDirect',
        'ownProxiesOnlyForOwnSites',
        'replaceDirectWithProxy',
        'useProviderProxies',
      ]);
      const CANDIDATE_KEYS = Object.freeze([
        'authRef',
        'failoverTimeoutSeconds',
        'host',
        'id',
        'port',
        'proxyDNS',
        'type',
      ]);
      const CONFIG_KEYS = Object.freeze([
        'datasetIdentity',
        'providerKey',
        'routingConfig',
        'routingDescriptor',
        'schemaVersion',
      ]);
      const CREDENTIALS_KEYS = Object.freeze([
        'entries',
        'routingDescriptor',
        'schemaVersion',
      ]);
      const CREDENTIAL_ENTRY_KEYS = Object.freeze([
        'authRef',
        'password',
        'username',
      ]);
      const SETTINGS_COMMIT_KEYS = Object.freeze([
        'revision',
        'routingDescriptor',
        'schemaVersion',
        'settings',
      ]);
      const AUTH_REF_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
      const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
      const SHA256_PATTERN = /^[a-f0-9]{64}$/;
      const ERRORS = Object.freeze({
        ACTIVATION_PREPARATION_FAILED: 'ACTIVATION_PREPARATION_FAILED',
        CREDENTIAL_CONFIG_DESCRIPTOR_MISMATCH:
          'CREDENTIAL_CONFIG_DESCRIPTOR_MISMATCH',
        CREDENTIAL_CONFIG_MALFORMED: 'CREDENTIAL_CONFIG_MALFORMED',
        CREDENTIAL_CONFIG_VERSION_UNSUPPORTED:
          'CREDENTIAL_CONFIG_VERSION_UNSUPPORTED',
        DATASET_STORE_UNAVAILABLE: 'DATASET_STORE_UNAVAILABLE',
        INVALID_PRODUCT_CONFIG_DEPENDENCIES:
          'INVALID_PRODUCT_CONFIG_DEPENDENCIES',
        PRODUCT_CONFIG_DATASET_MISMATCH: 'PRODUCT_CONFIG_DATASET_MISMATCH',
        PRODUCT_CONFIG_DESCRIPTOR_MISMATCH:
          'PRODUCT_CONFIG_DESCRIPTOR_MISMATCH',
        PRODUCT_CONFIG_HASH_MISMATCH: 'PRODUCT_CONFIG_HASH_MISMATCH',
        PRODUCT_CONFIG_MALFORMED: 'PRODUCT_CONFIG_MALFORMED',
        PRODUCT_CONFIG_MISSING: 'PRODUCT_CONFIG_MISSING',
        PRODUCT_CONFIG_PROVIDER_MISMATCH: 'PRODUCT_CONFIG_PROVIDER_MISMATCH',
        PRODUCT_CONFIG_STORAGE_UNAVAILABLE:
          'PRODUCT_CONFIG_STORAGE_UNAVAILABLE',
        PRODUCT_CONFIG_UPDATE_INCOMPLETE:
          'PRODUCT_CONFIG_UPDATE_INCOMPLETE',
        PRODUCT_CONFIG_VERSION_UNSUPPORTED:
          'PRODUCT_CONFIG_VERSION_UNSUPPORTED',
        REQUIRED_CREDENTIAL_MISSING: 'REQUIRED_CREDENTIAL_MISSING',
        ROUTING_CONFIG_TOO_LARGE: 'ROUTING_CONFIG_TOO_LARGE',
        SAVED_REVISION_CHANGED: 'SAVED_REVISION_CHANGED',
        EFFECTIVE_CONFIG_UNAVAILABLE: 'EFFECTIVE_CONFIG_UNAVAILABLE',
      });

      function configError(code) {

        const error = new TypeError(code);
        error.code = code;
        return error;

      }

      function hasExactKeys(value, expected) {

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }
        const actual = Object.keys(value).sort();
        const required = [...expected].sort();
        return actual.length === required.length &&
          actual.every((key, index) => key === required[index]);

      }

      function sameDescriptor(leftValue, rightValue) {

        const left = OffState.canonicalizeRoutingDescriptor(leftValue);
        const right = OffState.canonicalizeRoutingDescriptor(rightValue);
        return Boolean(left && right &&
          OffState.ROUTING_DESCRIPTOR_KEYS.every((key) =>
            left[key] === right[key]));

      }

      function sameDatasetIdentity(leftValue, rightValue) {

        const left = OffState.canonicalizeDatasetIdentity(leftValue);
        const right = OffState.canonicalizeDatasetIdentity(rightValue);
        return Boolean(left && right &&
          OffState.DATASET_IDENTITY_KEYS.every((key) =>
            left[key] === right[key]));

      }

      function canonicalPattern(value) {

        if (typeof value !== 'string' || value.length < 1 ||
            value.length > MAX_PATTERN_LENGTH || value !== value.trim() ||
            value !== value.toLowerCase() || hasUnsafeHostCharacter(value) ||
            value.slice(1).includes('*')) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return value;

      }

      function hasUnsafeHostCharacter(value) {

        return Array.from(value).some((character) =>
          character.charCodeAt(0) <= 32 || '/\\?#@'.includes(character));

      }

      function canonicalRules(value) {

        if (!hasExactKeys(value, RULE_KEYS)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        let count = 0;
        const result = {};
        for (const key of RULE_KEYS) {
          if (!Array.isArray(value[key])) {
            throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
          }
          const seen = new Set();
          result[key] = value[key].map((pattern) => {
            const canonical = canonicalPattern(pattern);
            if (seen.has(canonical)) {
              throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
            }
            seen.add(canonical);
            count += 1;
            if (count > MAX_RULES) {
              throw configError(ERRORS.ROUTING_CONFIG_TOO_LARGE);
            }
            return canonical;
          });
        }
        return result;

      }

      function validCandidateHost(value) {

        return typeof value === 'string' && value.length > 0 &&
          value.length <= 253 && value === value.trim() &&
          value === value.toLowerCase() &&
          !hasUnsafeHostCharacter(value);

      }

      function canonicalCandidate(value) {

        if (!hasExactKeys(value, CANDIDATE_KEYS) ||
            typeof value.id !== 'string' ||
            !CANDIDATE_ID_PATTERN.test(value.id) ||
            !Routing.CANDIDATE_TYPES.includes(value.type) ||
            !validCandidateHost(value.host) ||
            !Number.isSafeInteger(value.port) || value.port < 1 ||
            value.port > 65535 || typeof value.proxyDNS !== 'boolean' ||
            (value.authRef !== null &&
              (typeof value.authRef !== 'string' ||
               !AUTH_REF_PATTERN.test(value.authRef))) ||
            (value.failoverTimeoutSeconds !== null &&
              (!Number.isSafeInteger(value.failoverTimeoutSeconds) ||
               value.failoverTimeoutSeconds < 1))) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return {
          id: value.id,
          type: value.type,
          host: value.host,
          port: value.port,
          proxyDNS: value.proxyDNS,
          authRef: value.authRef,
          failoverTimeoutSeconds: value.failoverTimeoutSeconds,
        };

      }

      function canonicalCandidateList(value, accounting) {

        if (!Array.isArray(value)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return value.map((candidate) => {
          accounting.count += 1;
          if (accounting.count > MAX_CANDIDATES) {
            throw configError(ERRORS.ROUTING_CONFIG_TOO_LARGE);
          }
          const canonical = canonicalCandidate(candidate);
          const endpoint = `${canonical.host}:${canonical.port}`;
          if (accounting.authRefsByEndpoint.has(endpoint) &&
              accounting.authRefsByEndpoint.get(endpoint) !==
                canonical.authRef) {
            throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
          }
          accounting.authRefsByEndpoint.set(endpoint, canonical.authRef);
          if (canonical.authRef !== null) {
            accounting.requiredAuthRefs.add(canonical.authRef);
          }
          return canonical;
        });

      }

      function canonicalCandidateGroups(value, accounting) {

        if (!hasExactKeys(value, CANDIDATE_GROUP_KEYS)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        const result = {};
        for (const groupKey of CANDIDATE_GROUP_KEYS) {
          const source = value[groupKey];
          if (!hasExactKeys(source, GROUP_NAMES)) {
            throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
          }
          const group = {};
          for (const name of GROUP_NAMES) {
            group[name] = canonicalCandidateList(source[name], accounting);
          }
          result[groupKey] = group;
        }
        return result;

      }

      function canonicalFlags(value) {

        if (!hasExactKeys(value, FLAG_KEYS) ||
            FLAG_KEYS.some((key) => typeof value[key] !== 'boolean')) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return {
          noDirect: value.noDirect,
          ownProxiesOnlyForOwnSites: value.ownProxiesOnlyForOwnSites,
          replaceDirectWithProxy: value.replaceDirectWithProxy,
          useProviderProxies: value.useProviderProxies,
        };

      }

      function canonicalRoutingConfig(value) {

        if (!hasExactKeys(value, ROUTING_CONFIG_KEYS)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        const accounting = {
          authRefsByEndpoint: new Map(),
          count: 0,
          requiredAuthRefs: new Set(),
        };
        const candidateGroups = canonicalCandidateGroups(
            value.candidateGroups,
            accounting,
        );
        const providerCandidates = canonicalCandidateList(
            value.providerCandidates,
            accounting,
        );
        if (!Object.values(Routing.FALLBACKS).includes(
            value.providerFallback,
        )) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return Object.freeze({
          value: {
            rules: canonicalRules(value.rules),
            candidateGroups,
            flags: canonicalFlags(value.flags),
            providerCandidates,
            providerFallback: value.providerFallback,
          },
          requiredAuthRefs: Object.freeze(
              [...accounting.requiredAuthRefs].sort(),
          ),
        });

      }

      function deepFreeze(value) {

        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
          return value;
        }
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);

      }

      function routingConfigBytes(value) {

        const canonical = canonicalRoutingConfig(value).value;
        return new TextEncoder().encode(JSON.stringify(canonical));

      }

      function canonicalProductConfig(value) {

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        if (value.schemaVersion !== SCHEMA_VERSION) {
          throw configError(Number.isSafeInteger(value.schemaVersion) ?
            ERRORS.PRODUCT_CONFIG_VERSION_UNSUPPORTED :
            ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        if (!hasExactKeys(value, CONFIG_KEYS)) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        const datasetIdentity = OffState.canonicalizeDatasetIdentity(
            value.datasetIdentity,
        );
        const routingDescriptor = OffState.canonicalizeRoutingDescriptor(
            value.routingDescriptor,
        );
        const routingConfig = canonicalRoutingConfig(value.routingConfig);
        if (!datasetIdentity || !routingDescriptor ||
            value.providerKey !== datasetIdentity.providerKey) {
          throw configError(ERRORS.PRODUCT_CONFIG_MALFORMED);
        }
        return Object.freeze({
          config: deepFreeze({
            schemaVersion: SCHEMA_VERSION,
            providerKey: value.providerKey,
            datasetIdentity,
            routingDescriptor,
            routingConfig: routingConfig.value,
          }),
          requiredAuthRefs: routingConfig.requiredAuthRefs,
        });

      }

      async function verifyProductConfig(value, sha256) {

        if (typeof sha256 !== 'function') {
          throw configError(ERRORS.INVALID_PRODUCT_CONFIG_DEPENDENCIES);
        }
        const canonical = canonicalProductConfig(value);
        let digest;
        try {
          digest = await sha256(routingConfigBytes(
              canonical.config.routingConfig,
          ));
        } catch (_error) {
          throw configError(ERRORS.PRODUCT_CONFIG_HASH_MISMATCH);
        }
        if (typeof digest !== 'string' || !SHA256_PATTERN.test(digest) ||
            digest !== canonical.config.routingDescriptor.configurationSha256) {
          throw configError(ERRORS.PRODUCT_CONFIG_HASH_MISMATCH);
        }
        return canonical;

      }

      function canonicalCredentialConfig(value) {

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw configError(ERRORS.CREDENTIAL_CONFIG_MALFORMED);
        }
        if (value.schemaVersion !== SCHEMA_VERSION) {
          throw configError(Number.isSafeInteger(value.schemaVersion) ?
            ERRORS.CREDENTIAL_CONFIG_VERSION_UNSUPPORTED :
            ERRORS.CREDENTIAL_CONFIG_MALFORMED);
        }
        if (!hasExactKeys(value, CREDENTIALS_KEYS) ||
            !Array.isArray(value.entries) ||
            value.entries.length > MAX_CREDENTIALS) {
          throw configError(ERRORS.CREDENTIAL_CONFIG_MALFORMED);
        }
        const routingDescriptor = OffState.canonicalizeRoutingDescriptor(
            value.routingDescriptor,
        );
        if (!routingDescriptor) {
          throw configError(ERRORS.CREDENTIAL_CONFIG_MALFORMED);
        }
        const seen = new Set();
        const entries = value.entries.map((entry) => {
          if (!hasExactKeys(entry, CREDENTIAL_ENTRY_KEYS) ||
              typeof entry.authRef !== 'string' ||
              !AUTH_REF_PATTERN.test(entry.authRef) ||
              typeof entry.username !== 'string' ||
              entry.username.length > MAX_CREDENTIAL_FIELD_LENGTH ||
              typeof entry.password !== 'string' ||
              entry.password.length > MAX_CREDENTIAL_FIELD_LENGTH ||
              seen.has(entry.authRef)) {
            throw configError(ERRORS.CREDENTIAL_CONFIG_MALFORMED);
          }
          seen.add(entry.authRef);
          return Object.freeze({
            authRef: entry.authRef,
            username: entry.username,
            password: entry.password,
          });
        });
        return Object.freeze({
          schemaVersion: SCHEMA_VERSION,
          routingDescriptor: Object.freeze(routingDescriptor),
          entries: Object.freeze(entries),
        });

      }

      function createRoutingBaseInput(routingConfig) {

        const frozen = deepFreeze(routingConfig);
        return function routingBaseInputForRequest() {

          return frozen;

        };

      }

      function createCredentialResolver(entries) {

        const credentials = new Map(entries.map((entry) => [
          entry.authRef,
          Object.freeze({username: entry.username, password: entry.password}),
        ]));
        return function resolveCredentials(authRef) {

          return credentials.get(authRef) || null;

        };

      }

      const SAVED_KEYS = Object.freeze([
        CONFIG_STORAGE_KEY, CREDENTIALS_STORAGE_KEY,
        SETTINGS_COMMIT_STORAGE_KEY, SETTINGS_TRANSACTION_STORAGE_KEY,
        DATASET_PROMOTION_STORAGE_KEY,
      ]);

      async function readStorage(storageArea, keys) {

        try {
          const value = await storageArea.get(keys);
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('INVALID_STORAGE_RESULT');
          }
          return value;
        } catch (_error) {
          throw configError(ERRORS.PRODUCT_CONFIG_STORAGE_UNAVAILABLE);
        }

      }

      function matchesEffective(config, state) {

        return Boolean(config && state && config.providerKey === state.providerKey &&
          sameDatasetIdentity(config.datasetIdentity, state.datasetIdentity) &&
          sameDescriptor(config.routingDescriptor, state.routingDescriptor));

      }

      function snapshotRecords(stored) {

        const result = {};
        for (const key of SAVED_KEYS) {
          if (Object.prototype.hasOwnProperty.call(stored, key)) {
            result[key] = stored[key];
          }
        }
        return result;

      }

      function sameRecords(left, right) {

        return JSON.stringify(snapshotRecords(left)) ===
          JSON.stringify(snapshotRecords(right));

      }

      function retainedRecords(stored, state) {

        const generations = stored[GENERATIONS_STORAGE_KEY];
        if (!hasExactKeys(generations, ['schemaVersion', 'records']) ||
            generations.schemaVersion !== 1 ||
            !Array.isArray(generations.records) ||
            generations.records.length > 2) {
          throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
        }
        const matches = generations.records.filter((record) =>
          matchesEffective(record && record[CONFIG_STORAGE_KEY], state));
        if (matches.length !== 1) {
          throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
        }
        return matches[0];

      }

      // The existing durable ON descriptor + dataset identity is the Effective
      // reference. Retain at most that immutable generation and one candidate.
      // Saved writes never update these records.
      async function retainGeneration(storageArea, record) {

        const stored = await storageArea.get([
          GENERATIONS_STORAGE_KEY, OffState.STORAGE_KEY,
        ]);
        const state = stored[OffState.STORAGE_KEY];
        const records = [];
        if (state && state.intent === OffState.ON) {
          if (!OffState.isCanonicalOnState(state)) {
            throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
          }
          const effective = stored[GENERATIONS_STORAGE_KEY] === undefined ?
            record : retainedRecords(stored, state);
          if (!matchesEffective(effective[CONFIG_STORAGE_KEY], state)) {
            throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
          }
          records.push(effective);
        }
        if (records.some((existing) => matchesEffective(
            existing[CONFIG_STORAGE_KEY], record[CONFIG_STORAGE_KEY],
        ))) {
          if (!sameRecords(records[0], record)) {
            throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
          }
        } else {
          records.push(snapshotRecords(record));
        }
        await storageArea.set({
          [GENERATIONS_STORAGE_KEY]: {schemaVersion: 1, records},
        });

      }

      async function preserveLegacyEffective(options) {

        const stored = await options.storageArea.get([
          ...SAVED_KEYS, GENERATIONS_STORAGE_KEY, OffState.STORAGE_KEY,
        ]);
        const state = stored[OffState.STORAGE_KEY];
        if (!state || state.intent !== OffState.ON) return;
        if (!OffState.isCanonicalOnState(state)) {
          throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
        }
        const record = stored[GENERATIONS_STORAGE_KEY] === undefined ?
          snapshotRecords(stored) : retainedRecords(stored, state);
        const prepared = await createProductSnapshotLoader(options)(record);
        if (!matchesEffective(prepared, state)) {
          throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
        }
        if (stored[GENERATIONS_STORAGE_KEY] === undefined) {
          await retainGeneration(options.storageArea, record);
        }

      }

      async function readEffectiveRecords(storageArea) {

        const stored = await storageArea.get([
          GENERATIONS_STORAGE_KEY, OffState.STORAGE_KEY,
        ]);
        const state = stored[OffState.STORAGE_KEY];
        if (!state || state.intent !== OffState.ON) return null;
        if (!OffState.isCanonicalOnState(state)) {
          throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
        }
        return retainedRecords(stored, state);

      }

      function createProductSnapshotLoader(options = {}) {

        const storageArea = options.storageArea;
        const createDatasetStore = options.createDatasetStore;
        const sha256 = options.sha256;
        if (!storageArea || typeof storageArea.get !== 'function' ||
            typeof createDatasetStore !== 'function' ||
            typeof sha256 !== 'function') {
          throw configError(ERRORS.INVALID_PRODUCT_CONFIG_DEPENDENCIES);
        }
        return async function loadProductSnapshot(records = null) {

          let stored;
          try {
            stored = records || await storageArea.get(SAVED_KEYS);
          } catch (_error) {
            throw configError(ERRORS.PRODUCT_CONFIG_STORAGE_UNAVAILABLE);
          }
          if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
            throw configError(ERRORS.PRODUCT_CONFIG_STORAGE_UNAVAILABLE);
          }
          if (!Object.prototype.hasOwnProperty.call(stored, CONFIG_STORAGE_KEY)) {
            throw configError(ERRORS.PRODUCT_CONFIG_MISSING);
          }
          if (Object.prototype.hasOwnProperty.call(
              stored,
              SETTINGS_TRANSACTION_STORAGE_KEY,
          ) || Object.prototype.hasOwnProperty.call(
              stored,
              DATASET_PROMOTION_STORAGE_KEY,
          )) {
            throw configError(ERRORS.PRODUCT_CONFIG_UPDATE_INCOMPLETE);
          }
          const verified = await verifyProductConfig(
              stored[CONFIG_STORAGE_KEY],
              sha256,
          );
          const config = verified.config;
          if (Object.prototype.hasOwnProperty.call(
              stored,
              SETTINGS_COMMIT_STORAGE_KEY,
          )) {
            const commit = stored[SETTINGS_COMMIT_STORAGE_KEY];
            if (!hasExactKeys(commit, SETTINGS_COMMIT_KEYS) ||
                commit.schemaVersion !== 1 ||
                !Number.isSafeInteger(commit.revision) ||
                commit.revision < 1 || !sameDescriptor(
                commit.routingDescriptor,
                config.routingDescriptor,
            ) || !commit.settings || typeof commit.settings !== 'object' ||
                Array.isArray(commit.settings)) {
              throw configError(ERRORS.PRODUCT_CONFIG_DESCRIPTOR_MISMATCH);
            }
          }
          const hasCredentialConfig = Object.prototype.hasOwnProperty.call(
              stored,
              CREDENTIALS_STORAGE_KEY,
          );
          let credentialConfig = null;
          if (hasCredentialConfig) {
            credentialConfig = canonicalCredentialConfig(
                stored[CREDENTIALS_STORAGE_KEY],
            );
            if (!sameDescriptor(
                credentialConfig.routingDescriptor,
                config.routingDescriptor,
            )) {
              throw configError(
                  ERRORS.CREDENTIAL_CONFIG_DESCRIPTOR_MISMATCH,
              );
            }
          }
          const entries = credentialConfig ? credentialConfig.entries : [];
          const savedSettings = stored[SETTINGS_COMMIT_STORAGE_KEY] &&
            stored[SETTINGS_COMMIT_STORAGE_KEY].settings;
          if (savedSettings && Array.isArray(savedSettings.ownProxies) &&
              savedSettings.ownProxies.some((proxy) => proxy.enabled &&
                proxy.credentials && proxy.credentials.mode === 'MISSING')) {
            throw configError(ERRORS.REQUIRED_CREDENTIAL_MISSING);
          }
          const entriesByAuthRef = new Map(entries.map((entry) => [
            entry.authRef,
            entry,
          ]));
          if (verified.requiredAuthRefs.some((authRef) =>
            !entriesByAuthRef.has(authRef)) || entries.some((entry) =>
            !verified.requiredAuthRefs.includes(entry.authRef))) {
            throw configError(ERRORS.REQUIRED_CREDENTIAL_MISSING);
          }

          let datasetStore;
          try {
            datasetStore = createDatasetStore();
          } catch (_error) {
            throw configError(ERRORS.DATASET_STORE_UNAVAILABLE);
          }
          if (!datasetStore ||
              typeof datasetStore.loadVerifications !== 'function') {
            throw configError(ERRORS.DATASET_STORE_UNAVAILABLE);
          }
          return Object.freeze({
            datasetIdentity: config.datasetIdentity,
            datasetStore,
            providerKey: config.providerKey,
            resolveCredentials: createCredentialResolver(entries),
            routingBaseInputForRequest: createRoutingBaseInput(
                config.routingConfig,
            ),
            routingDescriptor: config.routingDescriptor,
          });

        };

      }

      function createActivationFactory(options = {}) {

        const loadProductSnapshot = createProductSnapshotLoader(options);
        return async function prepareProductActivation(expectedRevision = null) {

          try {
            const records = snapshotRecords(await readStorage(options.storageArea, SAVED_KEYS));
            const commit = records[SETTINGS_COMMIT_STORAGE_KEY];
            if (expectedRevision !== null &&
                (commit ? commit.revision : 0) !== expectedRevision) {
              throw configError(ERRORS.SAVED_REVISION_CHANGED);
            }
            const prepared = await loadProductSnapshot(records);
            return Object.freeze(Object.assign({}, prepared, {
              async retainSnapshot() {

                await preserveLegacyEffective(options);
                await retainGeneration(options.storageArea, records);

              },
              async checkSavedRevision() {

                const current = await options.storageArea.get(SAVED_KEYS);
                if (!sameRecords(records, current)) {
                  throw configError(ERRORS.SAVED_REVISION_CHANGED);
                }

              },
            }));
          } catch (error) {
            if (error && Object.values(ERRORS).includes(error.code)) {
              throw error;
            }
            throw configError(ERRORS.ACTIVATION_PREPARATION_FAILED);
          }

        };

      }

      function createRecoveryFactory(options = {}) {

        const loadProductSnapshot = createProductSnapshotLoader(options);
        return async function recoverProductConfiguration(durableState) {

          const stored = await readStorage(options.storageArea, [
            ...SAVED_KEYS, GENERATIONS_STORAGE_KEY,
          ]);
          const legacy = stored[GENERATIONS_STORAGE_KEY] === undefined;
          const records = legacy ? snapshotRecords(stored) :
            retainedRecords(stored, durableState);
          const prepared = await loadProductSnapshot(records);
          if (prepared.providerKey !== durableState.providerKey) {
            throw configError(ERRORS.PRODUCT_CONFIG_PROVIDER_MISMATCH);
          }
          if (!sameDatasetIdentity(
              prepared.datasetIdentity,
              durableState.datasetIdentity,
          )) {
            throw configError(ERRORS.PRODUCT_CONFIG_DATASET_MISMATCH);
          }
          if (!sameDescriptor(
              prepared.routingDescriptor,
              durableState.routingDescriptor,
          )) {
            throw configError(ERRORS.PRODUCT_CONFIG_DESCRIPTOR_MISMATCH);
          }
          if (legacy) {
            // Pin only after all legacy durable bindings have been proven.
            await retainGeneration(options.storageArea, records);
          }
          return Object.freeze({
            datasetStore: prepared.datasetStore,
            resolveCredentials: prepared.resolveCredentials,
            routingBaseInputForRequest: prepared.routingBaseInputForRequest,
            routingDescriptor: prepared.routingDescriptor,
          });

        };

      }

      async function prepareDatasetReplacement(
          options, effectiveRecords, datasetIdentity, checkCandidate) {

        const records = snapshotRecords(effectiveRecords);
        records[CONFIG_STORAGE_KEY] = (await verifyProductConfig(Object.assign({},
            records[CONFIG_STORAGE_KEY], {datasetIdentity}), options.sha256)).config;
        const prepared = await createProductSnapshotLoader(options)(records);
        return Object.freeze(Object.assign({}, prepared, {
          async retainSnapshot() {

            await retainGeneration(options.storageArea, records);

          },
          async checkSavedRevision() {

            // This guard deliberately checks Effective, not latest Saved. It is
            // also called after the durable ON commit and before publication.
            const current = await readEffectiveRecords(options.storageArea);
            if (!current || (!sameRecords(current, effectiveRecords) &&
                !sameRecords(current, records))) {
              throw configError(ERRORS.EFFECTIVE_CONFIG_UNAVAILABLE);
            }
            await checkCandidate();

          },
        }));

      }

      async function createProductConfig(options = {}) {

        const routingConfig = canonicalRoutingConfig(options.routingConfig);
        if (typeof options.sha256 !== 'function') {
          throw configError(ERRORS.INVALID_PRODUCT_CONFIG_DEPENDENCIES);
        }
        const configurationSha256 = await options.sha256(
            routingConfigBytes(routingConfig.value),
        );
        const value = {
          schemaVersion: SCHEMA_VERSION,
          providerKey: options.providerKey,
          datasetIdentity: options.datasetIdentity,
          routingDescriptor: {
            schemaVersion: OffState.ROUTING_DESCRIPTOR_SCHEMA_VERSION,
            configurationKey: options.configurationKey,
            configurationVersion: options.configurationVersion,
            configurationSha256,
          },
          routingConfig: routingConfig.value,
        };
        return (await verifyProductConfig(value, options.sha256)).config;

      }

      return Object.freeze({
        CONFIG_STORAGE_KEY,
        CREDENTIALS_STORAGE_KEY,
        GENERATIONS_STORAGE_KEY,
        DATASET_PROMOTION_STORAGE_KEY,
        SETTINGS_COMMIT_STORAGE_KEY,
        SETTINGS_TRANSACTION_STORAGE_KEY,
        ERRORS,
        MAX_CANDIDATES,
        MAX_CREDENTIALS,
        MAX_RULES,
        SCHEMA_VERSION,
        canonicalCredentialConfig,
        canonicalProductConfig,
        canonicalRoutingConfig,
        createActivationFactory,
        createCredentialResolver,
        createProductConfig,
        createRecoveryFactory,
        preserveLegacyEffective,
        prepareDatasetReplacement,
        readEffectiveRecords,
        routingConfigBytes,
        verifyProductConfig,
      });

    });
