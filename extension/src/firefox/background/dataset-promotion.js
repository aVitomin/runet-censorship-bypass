'use strict';
/* global require */

(function publishFirefoxDatasetPromotion(root, factory) {

  const dataset = typeof module === 'object' && module.exports ?
    require('../../shared/provider-dataset') :
    root.mv3ProviderDataset;
  const productConfig = typeof module === 'object' && module.exports ?
    require('./product-config') : root.rucbFirefoxProductConfig;
  const offState = typeof module === 'object' && module.exports ?
    require('./off-state') : root.rucbFirefoxOffState;
  const datasetStore = typeof module === 'object' && module.exports ?
    require('./dataset-store') : root.rucbFirefoxDatasetStore;
  const api = factory(dataset, productConfig, offState, datasetStore);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.rucbFirefoxDatasetPromotion = api;

})(typeof globalThis === 'object' ? globalThis : this,
    function(Dataset, ProductConfig, OffState, DatasetStore) {

      const JOURNAL_SCHEMA_VERSION = 1;
      const JOURNAL_STATUS = 'PREPARED';
      const JOURNAL_KEYS = Object.freeze([
        'newConfig',
        'oldActiveArtifactSha256',
        'oldConfig',
        'oldPreviousLkgArtifactSha256',
        'providerKey',
        'schemaVersion',
        'sequence',
        'stagedArtifactSha256',
        'status',
      ]);
      const ERRORS = Object.freeze({
        ALREADY_INSTALLED: 'DATASET_PROMOTION_ALREADY_INSTALLED',
        CONFIGURATION_INVALID: 'DATASET_PROMOTION_CONFIGURATION_INVALID',
        DATASET_STORE_FAILED: 'DATASET_PROMOTION_DATASET_STORE_FAILED',
        INVALID_DEPENDENCIES: 'INVALID_DATASET_PROMOTION_DEPENDENCIES',
        NO_STAGED_CANDIDATE: 'NO_STAGED_AUTHENTICATED_DATASET',
        OFF_REQUIRED: 'DATASET_PROMOTION_REQUIRES_OFF',
        POINTER_STATE_INVALID: 'DATASET_PROMOTION_POINTER_STATE_INVALID',
        PROVIDER_MISMATCH: 'DATASET_PROMOTION_PROVIDER_MISMATCH',
        RECOVERY_REQUIRED: 'DATASET_PROMOTION_RECOVERY_REQUIRED',
        SEQUENCE_INVALID: 'DATASET_PROMOTION_SEQUENCE_INVALID',
        STORAGE_FAILED: 'DATASET_PROMOTION_STORAGE_FAILED',
      });
      const SHA256_PATTERN = /^[a-f0-9]{64}$/;

      function promotionError(code) {

        const error = new TypeError(code);
        error.code = code;
        return error;

      }

      function exactKeys(value, keys) {

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }
        const actual = Object.keys(value).sort();
        const expected = [...keys].sort();
        return actual.length === expected.length &&
          actual.every((key, index) => key === expected[index]);

      }

      function sameIdentity(left, right) {

        return Boolean(left && right &&
          left.providerKey === right.providerKey &&
          left.datasetVersion === right.datasetVersion &&
          left.artifactSha256 === right.artifactSha256);

      }

      function sameConfig(left, right) {

        try {
          return JSON.stringify(
              ProductConfig.canonicalProductConfig(left).config,
          ) === JSON.stringify(
              ProductConfig.canonicalProductConfig(right).config,
          );
        } catch (_error) {
          return false;
        }

      }

      function canonicalJournal(value) {

        const active = value && [2, 4].includes(value.schemaVersion);
        const https = value && [3, 4].includes(value.schemaVersion);
        const keys = [...JOURNAL_KEYS,
          ...(active ? ['effectiveRoutingDescriptor'] : []),
          ...(https ? ['channel', 'source'] : [])];
        if (!exactKeys(value, keys) ||
            ![JOURNAL_SCHEMA_VERSION, 2, 3, 4].includes(value.schemaVersion) ||
            value.status !== JOURNAL_STATUS ||
            typeof value.providerKey !== 'string' ||
            !Number.isSafeInteger(value.sequence) || value.sequence < 1 ||
            typeof value.stagedArtifactSha256 !== 'string' ||
            !SHA256_PATTERN.test(value.stagedArtifactSha256) ||
            !(value.oldActiveArtifactSha256 === null ||
              SHA256_PATTERN.test(value.oldActiveArtifactSha256)) ||
            !(value.oldPreviousLkgArtifactSha256 === null ||
              SHA256_PATTERN.test(value.oldPreviousLkgArtifactSha256))) {
          throw promotionError(ERRORS.RECOVERY_REQUIRED);
        }
        if (https) {
          try {
            if (value.channel !== 'HTTPS' || value.providerKey !== 'anticensority') {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            value = Object.assign({}, value, {
              source: DatasetStore.canonicalHttpsSource(value.source),
            });
          } catch (_error) {
            throw promotionError(ERRORS.RECOVERY_REQUIRED);
          }
        }
        if (active && !OffState.canonicalizeRoutingDescriptor(value.effectiveRoutingDescriptor)) {
          throw promotionError(ERRORS.RECOVERY_REQUIRED);
        }
        const oldConfig = ProductConfig.canonicalProductConfig(
            value.oldConfig,
        ).config;
        const newConfig = ProductConfig.canonicalProductConfig(
            value.newConfig,
        ).config;
        if (oldConfig.providerKey !== value.providerKey ||
            newConfig.providerKey !== value.providerKey ||
            JSON.stringify(oldConfig.routingDescriptor) !==
              JSON.stringify(newConfig.routingDescriptor) ||
            oldConfig.datasetIdentity.artifactSha256 ===
              value.stagedArtifactSha256 ||
            newConfig.datasetIdentity.artifactSha256 !==
              value.stagedArtifactSha256) {
          throw promotionError(ERRORS.RECOVERY_REQUIRED);
        }
        return Object.freeze(Object.assign({}, value, {oldConfig, newConfig}));

      }

      function stagedChannel(staged) {

        return staged.channel || staged.verification &&
          staged.verification.trust === Dataset.TRUST.REMOTE_AUTHENTICATED && 'SIGNED';

      }

      function matchesJournalVerification(verification, journal) {

        const channel = journal.channel || 'SIGNED';
        return Boolean(verification && verification.ok &&
          verification.trust === DatasetStore.trustForChannel(channel) &&
          (channel !== 'HTTPS' || verification.source &&
            verification.source.sourceId === journal.source.sourceId &&
            verification.source.sourceSha256 === journal.source.sourceSha256 &&
            verification.source.updatedAt === journal.source.updatedAt));

      }

      function createController(options = {}) {

        const storageArea = options.storageArea;
        const datasetStore = options.datasetStore;
        const sha256 = options.sha256;
        const activationSnapshot = options.activationSnapshot;
        const providerKey = options.providerKey;
        if (!storageArea || typeof storageArea.get !== 'function' ||
            typeof storageArea.set !== 'function' ||
            typeof storageArea.remove !== 'function' || !datasetStore ||
            typeof datasetStore.loadStaged !== 'function' ||
            typeof datasetStore.loadVerifications !== 'function' ||
            typeof datasetStore.promoteStagedExact !== 'function' ||
            typeof sha256 !== 'function' ||
            typeof activationSnapshot !== 'function' ||
            typeof providerKey !== 'string') {
          throw promotionError(ERRORS.INVALID_DEPENDENCIES);
        }
        let queue = Promise.resolve();

        function enqueue(operation) {

          const result = queue.then(operation, operation);
          queue = result.catch(() => undefined);
          return result;

        }

        async function readStorage() {

          try {
            const stored = await storageArea.get([
              ProductConfig.CONFIG_STORAGE_KEY,
              ProductConfig.DATASET_PROMOTION_STORAGE_KEY,
              ProductConfig.SETTINGS_TRANSACTION_STORAGE_KEY,
              OffState.STORAGE_KEY,
            ]);
            if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
              throw new TypeError('invalid storage result');
            }
            return stored;
          } catch (_error) {
            throw promotionError(ERRORS.STORAGE_FAILED);
          }

        }

        async function writeConfig(config) {

          try {
            await storageArea.set({
              [ProductConfig.CONFIG_STORAGE_KEY]: config,
            });
          } catch (_error) {
            throw promotionError(ERRORS.STORAGE_FAILED);
          }

        }

        async function removeJournal() {

          try {
            await storageArea.remove(
                ProductConfig.DATASET_PROMOTION_STORAGE_KEY,
            );
          } catch (_error) {
            throw promotionError(ERRORS.STORAGE_FAILED);
          }

        }

        async function pointerPhase(journal) {

          let verifications;
          let staged;
          try {
            [verifications, staged] = await Promise.all([
              datasetStore.loadVerifications(journal.providerKey),
              datasetStore.loadStaged(journal.providerKey),
            ]);
          } catch (_error) {
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          const pointers = verifications && verifications.pointers;
          if (!pointers || staged === null || staged === undefined) {
            throw promotionError(ERRORS.POINTER_STATE_INVALID);
          }
          const oldDatasetAvailable = [
            verifications.active,
            verifications.previousLkg,
            verifications.packagedBaseline,
          ].some((verification) => verification &&
            verification.ok === true && sameIdentity(
              verification.dataset.identity,
              journal.oldConfig.datasetIdentity,
          ));
          const channel = journal.channel || 'SIGNED';
          const candidateStateMatches = DatasetStore.matchesCandidateState(
              pointers, channel, journal.sequence, journal.stagedArtifactSha256, journal.source,
          );
          const oldPhase =
            candidateStateMatches &&
            pointers.activeArtifactSha256 === journal.oldActiveArtifactSha256 &&
            pointers.previousLkgArtifactSha256 ===
              journal.oldPreviousLkgArtifactSha256 &&
            staged.ok === true && staged.status === 'STAGED' &&
            stagedChannel(staged) === channel &&
            matchesJournalVerification(staged.verification, journal) &&
            staged.sequence === journal.sequence &&
            staged.verification.dataset.identity.artifactSha256 ===
              journal.stagedArtifactSha256 &&
            oldDatasetAvailable && sameIdentity(
                staged.verification.dataset.identity,
                journal.newConfig.datasetIdentity,
            );
          const newPhase =
            candidateStateMatches && oldDatasetAvailable &&
            pointers.activeArtifactSha256 === journal.stagedArtifactSha256 &&
            pointers.previousLkgArtifactSha256 ===
              journal.oldConfig.datasetIdentity.artifactSha256 &&
            staged.ok === true && staged.status === 'EMPTY' &&
            matchesJournalVerification(verifications.active, journal) &&
            sameIdentity(
                verifications.active.dataset.identity,
                journal.newConfig.datasetIdentity,
            );
          if (oldPhase === newPhase) {
            throw promotionError(ERRORS.POINTER_STATE_INVALID);
          }
          return oldPhase ? 'OLD' : 'NEW';

        }

        async function recoverNow() {

          const stored = await readStorage();
          const rawJournal = stored[ProductConfig.DATASET_PROMOTION_STORAGE_KEY];
          if (rawJournal === undefined) {
            return Object.freeze({ok: true, status: 'NO_RECOVERY_NEEDED'});
          }
          let journal;
          try {
            journal = canonicalJournal(rawJournal);
            const verified = await Promise.all([
              ProductConfig.verifyProductConfig(journal.oldConfig, sha256),
              ProductConfig.verifyProductConfig(journal.newConfig, sha256),
            ]);
            journal = Object.freeze(Object.assign({}, journal, {
              oldConfig: verified[0].config,
              newConfig: verified[1].config,
            }));
          } catch (_error) {
            throw promotionError(ERRORS.RECOVERY_REQUIRED);
          }
          if (journal.providerKey !== providerKey) {
            throw promotionError(ERRORS.PROVIDER_MISMATCH);
          }
          let phase = await pointerPhase(journal);
          if ([2, 4].includes(journal.schemaVersion)) {
            const state = stored[OffState.STORAGE_KEY];
            if (!OffState.isCanonicalOnState(state) || state.providerKey !== providerKey ||
                !OffState.ROUTING_DESCRIPTOR_KEYS.every((key) =>
                  state.routingDescriptor[key] === journal.effectiveRoutingDescriptor[key])) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            const committed = sameIdentity(state.datasetIdentity,
                journal.newConfig.datasetIdentity);
            if (!committed && (!sameIdentity(state.datasetIdentity,
                journal.oldConfig.datasetIdentity) ||
                phase !== 'OLD')) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            if (committed && phase === 'OLD') {
              const promoted = await datasetStore.promoteStagedExact({providerKey,
                stagedArtifactSha256: journal.stagedArtifactSha256,
                stagedSequence: journal.sequence,
                channel: journal.channel || 'SIGNED', source: journal.source,
                currentDatasetIdentity: journal.oldConfig.datasetIdentity});
              if (!promoted || !promoted.ok) {
                throw promotionError(ERRORS.RECOVERY_REQUIRED);
              }
              phase = await pointerPhase(journal);
              if (phase !== 'NEW') throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            // Recovery must not overwrite an unrelated Saved revision.
            if (!sameConfig(stored[ProductConfig.CONFIG_STORAGE_KEY], journal.oldConfig) &&
                !sameConfig(stored[ProductConfig.CONFIG_STORAGE_KEY], journal.newConfig)) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
          }
          const target = phase === 'OLD' ? journal.oldConfig : journal.newConfig;
          if (!sameConfig(stored[ProductConfig.CONFIG_STORAGE_KEY], target)) {
            await writeConfig(target);
          }
          await removeJournal();
          return Object.freeze({
            ok: true,
            status: phase === 'OLD' ? 'ROLLED_BACK' : 'ROLLED_FORWARD',
          });

        }

        async function installNow() {

          await recoverNow();
          const activation = activationSnapshot();
          const active = activation && activation.active === true && activation.runtimeState === 'READY' &&
            activation.durableIntent === 'ON' && typeof options.replacePrepared === 'function';
          if (!active && (!activation || activation.active === true ||
              activation.durableIntent !== 'OFF' ||
              activation.runtimeState !== 'OFF')) {
            throw promotionError(ERRORS.OFF_REQUIRED);
          }
          const stored = await readStorage();
          if (stored[ProductConfig.SETTINGS_TRANSACTION_STORAGE_KEY] !==
              undefined) {
            throw promotionError(ERRORS.CONFIGURATION_INVALID);
          }
          let verifiedConfig;
          try {
            verifiedConfig = await ProductConfig.verifyProductConfig(
                stored[ProductConfig.CONFIG_STORAGE_KEY],
                sha256,
            );
          } catch (_error) {
            throw promotionError(ERRORS.CONFIGURATION_INVALID);
          }
          const oldConfig = verifiedConfig.config;
          const effectiveRecords = active ?
            await ProductConfig.readEffectiveRecords(storageArea) : null;
          // Manual Saved or Effective must never be switched by a provider
          // refresh. Keep the verified candidate cached until an explicit Apply
          // selects this provider with no pending source change.
          if (oldConfig.providerKey === 'manual' || effectiveRecords &&
              effectiveRecords[ProductConfig.CONFIG_STORAGE_KEY].providerKey === 'manual') {
            return Object.freeze({ok: true, status: 'DEFERRED'});
          }
          if (active && (!effectiveRecords || !sameIdentity(
              effectiveRecords[ProductConfig.CONFIG_STORAGE_KEY].datasetIdentity,
              oldConfig.datasetIdentity))) {
            throw promotionError(ERRORS.CONFIGURATION_INVALID);
          }
          if (oldConfig.providerKey !== providerKey) {
            throw promotionError(ERRORS.PROVIDER_MISMATCH);
          }
          let staged;
          try {
            staged = await datasetStore.loadStaged(providerKey);
          } catch (_error) {
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          if (!staged || staged.ok !== true || staged.status !== 'STAGED' ||
              !staged.verification || staged.verification.ok !== true ||
              !DatasetStore.trustForChannel(stagedChannel(staged)) ||
              staged.verification.trust !== DatasetStore.trustForChannel(stagedChannel(staged))) {
            throw promotionError(ERRORS.NO_STAGED_CANDIDATE);
          }
          const identity = staged.verification.dataset.identity;
          const channel = stagedChannel(staged);
          if (identity.providerKey !== providerKey) {
            throw promotionError(ERRORS.PROVIDER_MISMATCH);
          }
          if (!DatasetStore.matchesCandidateState(staged.pointers, channel,
              staged.sequence, identity.artifactSha256, staged.source)) {
            throw promotionError(ERRORS.SEQUENCE_INVALID);
          }
          if (sameIdentity(identity, oldConfig.datasetIdentity)) {
            throw promotionError(ERRORS.ALREADY_INSTALLED);
          }
          let currentVerifications;
          try {
            currentVerifications = await datasetStore.loadVerifications(
                providerKey,
            );
          } catch (_error) {
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          if (![currentVerifications.active,
            currentVerifications.previousLkg,
            currentVerifications.packagedBaseline,
          ].some((verification) => verification &&
            verification.ok === true && sameIdentity(
              verification.dataset.identity,
              oldConfig.datasetIdentity,
          ))) {
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          const newConfig = (await ProductConfig.verifyProductConfig(
              Object.assign({}, oldConfig, {datasetIdentity: identity}),
              sha256,
          )).config;
          const journal = canonicalJournal(Object.assign({
            schemaVersion: channel === 'HTTPS' ? active ? 4 : 3 : active ? 2 : JOURNAL_SCHEMA_VERSION,
            status: JOURNAL_STATUS,
            providerKey,
            sequence: staged.sequence,
            stagedArtifactSha256: identity.artifactSha256,
            oldActiveArtifactSha256: staged.pointers.activeArtifactSha256,
            oldPreviousLkgArtifactSha256:
              staged.pointers.previousLkgArtifactSha256,
            oldConfig,
            newConfig,
          }, channel === 'HTTPS' ? {channel, source: staged.source} : {},
          active ? {effectiveRoutingDescriptor:
            effectiveRecords[ProductConfig.CONFIG_STORAGE_KEY].routingDescriptor} : {}));
          let prepared;
          if (active) {
            const checkCandidate = async () => {
              if (await pointerPhase(journal) !== 'OLD') throw promotionError(ERRORS.POINTER_STATE_INVALID);
            };
            // An exact channel-bound staged view is used only for preparation;
            // the serving runtime and durable dataset pointers remain untouched.
            const stagedView = {async loadVerifications() {

              await checkCandidate();
              const current = await datasetStore.loadStaged(providerKey);
              if (!current || !current.ok || !current.verification ||
                  !sameIdentity(current.verification.dataset.identity, identity) ||
                  stagedChannel(current) !== channel ||
                  !matchesJournalVerification(current.verification, journal)) {
                throw promotionError(ERRORS.NO_STAGED_CANDIDATE);
              }
              return {active: current.verification, previousLkg: null, packagedBaseline: null};

            }};
            prepared = await ProductConfig.prepareDatasetReplacement({storageArea, sha256,
              createDatasetStore: () => stagedView}, effectiveRecords, identity, checkCandidate);
          }
          try {
            await storageArea.set({
              [ProductConfig.DATASET_PROMOTION_STORAGE_KEY]: journal,
            });
          } catch (_error) {
            throw promotionError(ERRORS.STORAGE_FAILED);
          }
          if (active) {
            let replacement;
            try {
              replacement = await options.replacePrepared(prepared);
              // The existing ON record is the active recovery commit decision:
              // OLD rolls back, NEW finalizes pointers and Saved dataset metadata.
              await recoverNow();
            } catch (_error) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            if (!replacement || replacement.ok !== true) {
              throw promotionError(replacement && replacement.error && replacement.error.code ||
                ERRORS.RECOVERY_REQUIRED);
            }
            return Object.freeze({ok: true, status: 'INSTALLED'});
          }
          let promoted;
          try {
            promoted = await datasetStore.promoteStagedExact({
              providerKey,
              stagedArtifactSha256: identity.artifactSha256,
              stagedSequence: staged.sequence,
              channel, source: staged.source,
              currentDatasetIdentity: oldConfig.datasetIdentity,
            });
          } catch (_error) {
            try {
              await recoverNow();
            } catch (_recoveryError) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          if (!promoted || promoted.ok !== true) {
            try {
              await recoverNow();
            } catch (_error) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
            throw promotionError(ERRORS.DATASET_STORE_FAILED);
          }
          try {
            await writeConfig(newConfig);
            await removeJournal();
          } catch (_error) {
            try {
              await recoverNow();
            } catch (_recoveryError) {
              throw promotionError(ERRORS.RECOVERY_REQUIRED);
            }
          }
          return Object.freeze({ok: true, status: 'INSTALLED'});

        }

        return Object.freeze({
          initialize: () => enqueue(async () => {
            try {
              return await recoverNow();
            } catch (error) {
              return Object.freeze({
                ok: false,
                status: 'RECOVERY_REQUIRED',
                code: error && error.code ? error.code : ERRORS.RECOVERY_REQUIRED,
              });
            }
          }),
          install: () => enqueue(installNow),
        });

      }

      return Object.freeze({
        ERRORS,
        JOURNAL_SCHEMA_VERSION,
        JOURNAL_STATUS,
        canonicalJournal,
        createController,
      });

    });
