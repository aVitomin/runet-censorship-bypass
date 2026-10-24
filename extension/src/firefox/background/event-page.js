'use strict';

(function startFirefoxEventPage(root) {

  const offState = root.rucbFirefoxOffState;
  const proxyControlApi = root.rucbFirefoxProxyControl;
  const proxyAuthApi = root.rucbFirefoxProxyAuth;
  const routing = root.rucbFirefoxRoutingAdapter;
  const activationApi = root.rucbFirefoxActivationController;
  const datasetStoreApi = root.rucbFirefoxDatasetStore;
  const providerUpdateControlApi = root.rucbFirefoxProviderUpdateControl;
  const productConfigApi = root.rucbFirefoxProductConfig;
  const productionProviderApi = root.rucbFirefoxProductionProvider;
  const datasetPromotionApi = root.rucbFirefoxDatasetPromotion;
  const settingsControlApi = root.rucbFirefoxSettingsControl;
  const transfer = root.rucbConfigurationTransfer;
  const transferAdapter = root.rucbFirefoxConfigurationTransfer;
  const siteControlApi = root.rucbFirefoxSiteControl;
  const operationalStatusApi = root.rucbFirefoxOperationalStatus;
  let activationController = null;
  let settingsController = null;
  let siteController = null;
  let operationalController = null;
  let productionDatasetStore = null;
  let datasetPromotionController = null;
  let providerUpdateController = null;
  // Historical display metadata only: never a trust/availability/routing cache.
  // Settings, activation and recovery still verify artifacts on every read.
  const verifiedSourceDates = new Map();

  function datasetMetadataKey(identity) {

    return JSON.stringify([identity.providerKey, identity.datasetVersion, identity.artifactSha256]);

  }

  function rememberSourceDate(verification) {

    const dataset = verification.dataset;
    const timestamp = Date.parse(dataset.envelope.generatedAt);
    const key = datasetMetadataKey(dataset.identity);
    verifiedSourceDates.delete(key);
    verifiedSourceDates.set(key,
        Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null);
    if (verifiedSourceDates.size > 3) {
      verifiedSourceDates.delete(verifiedSourceDates.keys().next().value);
    }

  }
  let providerBootstrapState = Object.freeze({
    ok: false,
    status: 'INITIALIZING',
    datasetAvailable: false,
    productConfigAvailable: false,
  });

  async function sha256(bytes) {

    const digest = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0')).join('');

  }

  function createProductionDatasetStore() {

    if (!productionDatasetStore) {
      // Construct the data backend only for an actual dataset operation. Manual
      // routing must remain available when IndexedDB itself cannot be opened.
      let indexedBackend;
      const backend = Object.fromEntries(['readArtifact', 'readPointers', 'commit'].map((method) =>
        [method, async (...args) => {
          if (!indexedBackend) {
            indexedBackend = datasetStoreApi.createIndexedDbBackend(root.indexedDB);
          }
          return indexedBackend[method](...args);
        }]));
      productionDatasetStore = datasetStoreApi.createStore({backend, sha256});
    }
    return productionDatasetStore;

  }

  async function readPackagedAsset(relativePath, maximumBytes) {

    const packagedUrl = browser.runtime.getURL(relativePath);
    const response = await root.fetch(packagedUrl, {
      cache: 'no-store',
      credentials: 'omit',
      method: 'GET',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response || response.ok !== true || response.status !== 200 ||
        response.redirected === true || response.url !== packagedUrl) {
      const error = new TypeError('PACKAGED_ASSET_READ_FAILED');
      error.code = 'PACKAGED_ASSET_READ_FAILED';
      throw error;
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maximumBytes) {
      const error = new TypeError('PACKAGED_ASSET_TOO_LARGE');
      error.code = 'PACKAGED_ASSET_TOO_LARGE';
      throw error;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > maximumBytes) {
      const error = new TypeError('PACKAGED_ASSET_TOO_LARGE');
      error.code = 'PACKAGED_ASSET_TOO_LARGE';
      throw error;
    }
    return bytes;

  }

  const productFactoryOptions = {
    storageArea: browser.storage.local,
    createDatasetStore: createProductionDatasetStore,
    sha256,
  };
  const activationFactory = productConfigApi.createActivationFactory(
      productFactoryOptions,
  );
  const recoveryFactory = productConfigApi.createRecoveryFactory(
      productFactoryOptions,
  );
  const providerBootstrap = productionProviderApi.createBootstrap({
    storageArea: browser.storage.local,
    datasetStore: createProductionDatasetStore(),
    sha256,
    readPackagedAsset,
  });
  const routingAdapter = routing.createAdapter({
    runtimeStateForRequest: () => activationController ?
      activationController.currentRuntimeState() : routing.STATES.INITIALIZING,
    routingInputForRequest: (details) =>
      activationController.routingInputForRequest(details),
    credentialResolverForRequest: () =>
      activationController.credentialResolverForRequest(),
  });
  const proxyAuth = proxyAuthApi.createHandler({
    routingAdapter,
    resolveCredentials: (_authRef, details) =>
      routingAdapter.resolveCredentialsForChallenge(details),
  });
  function clearEphemeralState() {

    routingAdapter.clearAllAuthorizations();
    proxyAuth.clearAllAttempts();

  }
  const proxyControl = proxyControlApi.createController({
    proxySettings: browser.proxy.settings,
    storageArea: browser.storage.local,
    isPrivateAccessAllowed: () =>
      browser.extension.isAllowedIncognitoAccess(),
    clearEphemeralState,
  });
  activationController = activationApi.createController({
    proxyControl,
    recoveryFactory,
    routingAdapter,
    proxyAuth,
    storageArea: browser.storage.local,
  });
  settingsController = settingsControlApi.createController({
    storageArea: browser.storage.local,
    sha256,
    activationSnapshot: () => activationController.snapshot(),
    async currentProviderDatasetIdentity() {

      const loaded = await createProductionDatasetStore().loadVerifications(
          productionProviderApi.PROVIDER_KEY, {firstUsableOnly: true},
      );
      const selected = [loaded.active, loaded.previousLkg, loaded.packagedBaseline]
          .find((value) => value && value.ok);
      return selected ? selected.dataset.identity : productionProviderApi.datasetIdentity();

    },
    async datasetIdentityAvailable(identity) {

      const stored = await createProductionDatasetStore().loadVerifications(
          identity.providerKey,
      );
      const matching = [stored.active, stored.previousLkg, stored.packagedBaseline]
          .find((verification) => verification && verification.ok === true &&
            verification.dataset.identity.providerKey === identity.providerKey &&
            verification.dataset.identity.datasetVersion ===
              identity.datasetVersion &&
            verification.dataset.identity.artifactSha256 ===
              identity.artifactSha256);
      if (matching) rememberSourceDate(matching);
      providerBootstrapState = Object.assign({}, providerBootstrapState, {
        datasetAvailable: Boolean(matching),
      });
      return Boolean(matching);

    },
  });
  const routingSettingsController = {
    get: () => settingsController.getEffective(),
    replace: (...args) => settingsController.replace(...args),
  };
  siteController = siteControlApi.createController({
    settingsController: routingSettingsController,
  });
  const savedSiteController = siteControlApi.createController({
    settingsController,
  });
  operationalController = operationalStatusApi.createController({
    storageArea: browser.storage.local,
    actionApi: browser.action,
    notificationsApi: browser.notifications,
    tabsApi: browser.tabs,
    runtimeApi: browser.runtime,
    extensionApi: browser.extension,
    proxySettings: browser.proxy.settings,
    settingsController: routingSettingsController,
    siteController,
    activationSnapshot: () => activationController.snapshot(),
    fetch: root.fetch.bind(root),
    AbortController: root.AbortController,
    getMessage: (key) => browser.i18n.getMessage(key),
    getDatasetInfo: async () => {
      const identity = await readRoutingIdentity();
      return {available: Boolean(identity && routingSourceAvailable(identity.providerKey)),
        version: identity && identity.datasetVersion};
    },
  });
  datasetPromotionController = datasetPromotionApi.createController({
    storageArea: browser.storage.local,
    datasetStore: createProductionDatasetStore(),
    sha256,
    activationSnapshot: () => activationController.snapshot(),
    providerKey: productionProviderApi.PROVIDER_KEY,
    replacePrepared: (prepared) => activationController.replacePrepared(prepared),
  });
  async function readRoutingIdentity() {

    const activation = activationController.snapshot();
    const effective = activation && activation.durableIntent === offState.ON ?
      await productConfigApi.readEffectiveRecords(browser.storage.local) : null;
    if (effective) return effective[productConfigApi.CONFIG_STORAGE_KEY].datasetIdentity;
    const stored = await browser.storage.local.get(
        productConfigApi.CONFIG_STORAGE_KEY,
    );
    if (!stored || !Object.prototype.hasOwnProperty.call(
        stored,
        productConfigApi.CONFIG_STORAGE_KEY,
    )) {
      return null;
    }
    const verified = await productConfigApi.verifyProductConfig(
        stored[productConfigApi.CONFIG_STORAGE_KEY],
        sha256,
    );
    return verified.config.datasetIdentity;

  }
  function routingSourceAvailable(providerKey) {

    return providerKey === 'manual' || providerKey === productionProviderApi.PROVIDER_KEY &&
      providerBootstrapState.datasetAvailable === true;

  }
  async function readCurrentDatasetIdentity() {

    const identity = await readRoutingIdentity();
    return identity && identity.providerKey === productionProviderApi.PROVIDER_KEY ?
      identity : null;

  }
  async function readCurrentDatasetInfo() {

    const identity = await readCurrentDatasetIdentity();
    if (!identity) return {identity: null, sourceUpdatedAt: null};
    const key = datasetMetadataKey(identity);
    if (verifiedSourceDates.has(key)) {
      return {identity, sourceUpdatedAt: verifiedSourceDates.get(key)};
    }
    const loaded = await createProductionDatasetStore().loadVerifications(identity.providerKey);
    const verified = [loaded.active, loaded.previousLkg, loaded.packagedBaseline].find((value) =>
      value && value.ok && value.dataset.identity.artifactSha256 === identity.artifactSha256 &&
      value.dataset.identity.datasetVersion === identity.datasetVersion);
    if (verified) rememberSourceDate(verified);
    return {identity, sourceUpdatedAt: verifiedSourceDates.get(key) || null};

  }
  providerUpdateController = providerUpdateControlApi.createController({
    storageArea: browser.storage.local,
    datasetStore: createProductionDatasetStore(),
    alarmsApi: browser.alarms,
    fetchImpl: root.fetch.bind(root),
    cryptoSubtle: root.crypto.subtle,
    AbortController: root.AbortController,
    sha256,
    providerKey: productionProviderApi.PROVIDER_KEY,
    trustConfiguration: productionProviderApi.UPDATE_TRUST_CONFIGURATION,
    sourceUpdateEnabled: productionProviderApi.SOURCE_UPDATE_ENABLED,
    readCurrentDatasetIdentity,
    readCurrentDatasetInfo,
  });
  const bootId = root.crypto && typeof root.crypto.randomUUID === 'function' ?
    root.crypto.randomUUID() :
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  function errorResponse(code) {

    return {ok: false, error: {code}};

  }

  const SAFE_APPLY_ERROR_CODES = new Set([
    ...Object.values(productConfigApi.ERRORS),
    ...Object.values(activationApi.ERRORS),
    ...Object.values(proxyControlApi.ERRORS),
    'DATASET_INDEX_BUILD_FAILED',
    'NO_USABLE_PROVIDER_DATASET',
    'SELECTED_DATASET_UNAVAILABLE',
  ]);
  const SAFE_SETTINGS_ERROR_CODES = new Set(
      Object.values(settingsControlApi.ERRORS)
          .concat(Object.values(siteControlApi.ERRORS)),
  );
  const SAFE_PROMOTION_ERROR_CODES = new Set(
      [...Object.values(datasetPromotionApi.ERRORS), ...SAFE_APPLY_ERROR_CODES],
  );

  function exactRpcRequest(message, type) {

    return Boolean(message) && typeof message === 'object' &&
      !Array.isArray(message) && message.type === type &&
      Object.keys(message).length === 1;

  }

  function safeApplyErrorCode(value) {

    const code = typeof value === 'string' ? value :
      value && typeof value === 'object' ? value.code : null;
    return SAFE_APPLY_ERROR_CODES.has(code) ? code :
      activationApi.ERRORS.ACTIVATION_FAILED;

  }

  function safeSettingsErrorCode(value) {

    const code = typeof value === 'string' ? value :
      value && typeof value === 'object' ? value.code : null;
    return SAFE_SETTINGS_ERROR_CODES.has(code) ? code :
      settingsControlApi.ERRORS.SETTINGS_STATE_UNAVAILABLE;

  }

  function safePromotionErrorCode(value) {

    const code = typeof value === 'string' ? value :
      value && typeof value === 'object' ? value.code : null;
    return SAFE_PROMOTION_ERROR_CODES.has(code) ? code :
      datasetPromotionApi.ERRORS.RECOVERY_REQUIRED;

  }

  function safeProviderUpdateErrorCode(value) {

    const code = typeof value === 'string' ? value :
      value && typeof value === 'object' ? value.code : null;
    return Object.values(providerUpdateControlApi.ERRORS).includes(code) ?
      code : providerUpdateControlApi.ERRORS.UPDATE_FAILED;

  }

  function exactSettingsReplaceRequest(message) {

    return Boolean(message) && typeof message === 'object' &&
      !Array.isArray(message) &&
      message.type === 'firefox.settings.replace' &&
      Object.keys(message).length === 3 &&
      Object.prototype.hasOwnProperty.call(message, 'expectedRevision') &&
      Object.prototype.hasOwnProperty.call(message, 'settings');

  }

  function exactTabStateRequest(message, type) {

    return Boolean(message) && typeof message === 'object' &&
      !Array.isArray(message) && message.type === type &&
      Object.keys(message).length === 2 &&
      Object.prototype.hasOwnProperty.call(message, 'tabUrl') &&
      typeof message.tabUrl === 'string';

  }

  function exactSiteReplaceRequest(message) {

    return Boolean(message) && typeof message === 'object' &&
      !Array.isArray(message) && message.type === 'firefox.site.replace' &&
      Object.keys(message).length === 5 &&
      Object.prototype.hasOwnProperty.call(message, 'tabUrl') &&
      Object.prototype.hasOwnProperty.call(message, 'expectedRevision') &&
      Object.prototype.hasOwnProperty.call(message, 'mode') &&
      Object.prototype.hasOwnProperty.call(message, 'scope');

  }

  function exactHealthCheckRequest(message) {

    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        message.type !== 'firefox.health.check') {
      return false;
    }
    const keys = Object.keys(message).sort();
    return keys.length === 1 && keys[0] === 'type' ||
      keys.length === 2 && keys[0] === 'tabUrl' && keys[1] === 'type' &&
      typeof message.tabUrl === 'string';

  }

  async function readPrivateWindowAccess() {

    try {
      const allowed = await browser.extension.isAllowedIncognitoAccess();
      return allowed ? 'GRANTED' : 'DENIED';
    } catch (_error) {
      return 'UNKNOWN';
    }

  }

  let rpcControlQueue = Promise.resolve();
  let configurationApplying = false;

  function invalidateOptionsStatus() {

    // A wake-up hint only: consumers must reread authoritative, redacted RPCs.
    // No receiver is normal when Options is closed; UI delivery cannot fail Apply.
    try {
      Promise.resolve(browser.runtime.sendMessage({type: 'firefox.status.changed'}))
          .catch(() => undefined);
    } catch (_error) {
      // Notification delivery is best effort, not part of routing promotion.
    }

  }

  function pendingCredentialEntries(records) {

    const credentialConfig = records[productConfigApi.CREDENTIALS_STORAGE_KEY];
    // The credential record is optional when its descriptor requires no auth
    // refs. Saved writes use the equivalent canonical record with no entries.
    return credentialConfig === undefined ? [] : credentialConfig.entries;

  }

  async function capabilitiesStatus(saved = null) {

    const manifest = browser.runtime.getManifest();
    const activation = activationController.snapshot();
    let manual = saved && saved.settings.source === 'manual';
    if (!saved) {
      const stored = await browser.storage.local.get(productConfigApi.CONFIG_STORAGE_KEY);
      try {
        const verified = await productConfigApi.verifyProductConfig(
            stored[productConfigApi.CONFIG_STORAGE_KEY], sha256,
        );
        manual = verified.config.providerKey === 'manual';
      } catch (_error) {
        // Unproven config never makes a source available.
      }
    }
    return {
      apiVersion: 2,
      browser: 'FIREFOX',
      manifestVersion: manifest.manifest_version,
      runtimeModel: 'BACKGROUND_EVENT_PAGE',
      runtimeState: activation.runtimeState,
      durableIntent: activation.durableIntent,
      recoveryStatus: activation.recoveryStatus,
      recoveryFailureCode: activation.failureCode,
      privateWindowAccess: await readPrivateWindowAccess(),
      routingImplemented: true,
      activationSupported: true,
      providerDatasetImplemented: true,
      providerDatasetAvailable: manual || providerBootstrapState.datasetAvailable === true,
      providerUpdateImplemented: true,
      providerUpdateConfigured: providerUpdateController.updateConfigured(),
    };

  }

  async function configurationStatus(snapshot = null) {

    const saved = snapshot ? snapshot.saved : await settingsController.get();
    const activation = activationController.snapshot();
    const records = snapshot ? snapshot.records :
      await productConfigApi.readEffectiveRecords(browser.storage.local);
    const effective = snapshot ? snapshot.effective :
      records ? await settingsController.getEffective() : null;
    const live = await browser.proxy.settings.get({});
    const privateAccess = await readPrivateWindowAccess();
    const active = activation.active && activation.runtimeState === 'READY' &&
      live.levelOfControl === 'controlled_by_this_extension' && privateAccess === 'GRANTED';
    const blocked = !active && (activation.runtimeState !== 'OFF' ||
      privateAccess !== 'GRANTED' ||
      ['not_controllable', 'controlled_by_other_extensions'].includes(live.levelOfControl));
    const effectiveId = records ? await sha256(new TextEncoder().encode(JSON.stringify(
        {routing: records[productConfigApi.CONFIG_STORAGE_KEY].routingDescriptor,
          dataset: records[productConfigApi.CONFIG_STORAGE_KEY].datasetIdentity},
    ))) : null;
    const pending = Boolean(effective && saved.revision !== effective.revision);
    const categories = [];
    if (pending) {
      if (JSON.stringify(saved.settings.rules) !== JSON.stringify(effective.settings.rules)) categories.push('siteRules');
      if (['ownProxies', 'localTor', 'torBrowser', 'warp'].some((key) =>
        JSON.stringify(saved.settings[key]) !== JSON.stringify(effective.settings[key]))) categories.push('proxyConnections');
      // Password-only revisions have identical redacted settings. Compare private
      // records internally and return only the category, never a credential hash.
      const stored = await browser.storage.local.get(productConfigApi.CREDENTIALS_STORAGE_KEY);
      if (!categories.includes('proxyConnections') &&
          JSON.stringify(pendingCredentialEntries(stored)) !==
          JSON.stringify(pendingCredentialEntries(records))) {
        categories.push('proxyConnections');
      }
      if (!categories.length || saved.settings.source !== effective.settings.source ||
          JSON.stringify(saved.settings.flags) !== JSON.stringify(effective.settings.flags)) {
        categories.push('routingSettings');
      }
    }
    return {savedRevision: saved.revision, effectiveId, active, pending, blocked,
      applying: configurationApplying, pendingCategories: categories,
      reason: blocked ? privateAccess !== 'GRANTED' ? 'PRIVATE_ACCESS_REQUIRED' :
        activation.active && live.levelOfControl !== 'controlled_by_this_extension' ? 'CONTROL_LOSS' :
        activation.failureCode || activation.recoveryStatus : null};

  }

  async function verifiedConfigurationSnapshot() {

    // Reuse only this operation's verified snapshots. A subsequent request
    // rereads and verifies durable state, including its dataset identity.
    const saved = await settingsController.get();
    const records = await productConfigApi.readEffectiveRecords(browser.storage.local);
    const effective = records ? await settingsController.getEffective() : null;
    return {saved, records, effective};

  }

  async function getOptionsState() {

    try {
      const snapshot = await verifiedConfigurationSnapshot();
      const {saved, effective} = snapshot;
      const [capabilities, operational, providerUpdate, configuration] = await Promise.all([
        capabilitiesStatus(saved),
        operationalController.publicStatus(effective || saved),
        providerUpdateController.publicStatus(),
        configurationStatus(snapshot),
      ]);
      // Only existing public projections cross the RPC boundary. In particular,
      // diagnostics describe Effective while the editor displays Saved.
      return {ok: true, result: {capabilities, settings: saved,
        operational, providerUpdate, configuration}};
    } catch (_error) {
      return errorResponse('SETTINGS_STATE_UNAVAILABLE');
    }

  }

  async function getPopupState(message) {

    try {
      const snapshot = await verifiedConfigurationSnapshot();
      const routingSettings = snapshot.effective || snapshot.saved;
      const [capabilities, site, operational, configuration] = await Promise.all([
        capabilitiesStatus(snapshot.saved),
        siteController.get(message.tabUrl, routingSettings),
        operationalController.publicStatus(routingSettings),
        configurationStatus(snapshot),
      ]);
      // Site controls and diagnostics describe Effective. Only the pending
      // summary exposes Saved; no settings, credentials or raw URL are returned.
      return {ok: true, result: {capabilities, site, operational, configuration}};
    } catch (_error) {
      return errorResponse('SETTINGS_STATE_UNAVAILABLE');
    }

  }

  async function applySiteConfiguration(message) {

    const before = await configurationStatus();
    if (message.expectedRevision !== before.savedRevision ||
        message.expectedEffectiveId !== before.effectiveId) {
      return errorResponse('SAVED_REVISION_CHANGED');
    }
    if (before.pending && message.applyAll !== true) return errorResponse('PENDING_CONFIRMATION_REQUIRED');
    configurationApplying = true;
    invalidateOptionsStatus();
    let saved;
    try {
      saved = await savedSiteController.replace(message);
      const applied = await applyPersistedProductConfiguration({expectedRevision: saved.revision});
      const after = await configurationStatus();
      after.applying = false;
      return {ok: true, result: {applied: applied.ok === true, saved: true,
        errorCode: applied.ok ? null : applied.error.code, configuration: after,
        previousActive: before.active && after.active && before.effectiveId === after.effectiveId}};
    } catch (error) {
      return errorResponse(safeSettingsErrorCode(error));
    } finally {
      configurationApplying = false;
      invalidateOptionsStatus();
    }

  }

  function enqueueRpcControlOperation(operation) {

    const result = rpcControlQueue.then(operation, operation);
    rpcControlQueue = result.catch(() => undefined);
    return result;

  }

  async function applyPersistedProductConfiguration(message) {

    const current = activationController.snapshot();
    if (!current.active && (current.durableIntent !== offState.OFF ||
        current.runtimeState !== routing.STATES.OFF)) {
      return errorResponse(activationApi.ERRORS.BOOT_NOT_READY);
    }
    let prepared;
    try {
      if (message.expectedRevision !== undefined) {
        const saved = await settingsController.get();
        if (saved.revision !== message.expectedRevision) {
          return errorResponse('SAVED_REVISION_CHANGED');
        }
      }
      prepared = await activationFactory(message.expectedRevision === undefined ?
        null : message.expectedRevision);
    } catch (error) {
      return errorResponse(safeApplyErrorCode(error));
    }
    let activated;
    try {
      activated = current.active ?
        await activationController.replacePrepared(prepared) :
        await activationController.activatePrepared(prepared);
    } catch (_error) {
      return errorResponse(activationApi.ERRORS.ACTIVATION_FAILED);
    }
    if (!activated || activated.ok !== true) {
      return errorResponse(safeApplyErrorCode(
          activated && activated.error,
      ));
    }
    return {
      ok: true,
      result: {intent: offState.ON, status: activated.status},
    };

  }

  async function clearProductActivation() {

    const cleared = await activationController.clear();
    if (!cleared.ok) {
      return errorResponse(cleared.error.code);
    }
    return {
      ok: true,
      result: {intent: offState.OFF, status: cleared.status},
    };

  }

  async function getProductSettings() {

    try {
      return {ok: true, result: await settingsController.get()};
    } catch (error) {
      return errorResponse(safeSettingsErrorCode(error));
    }

  }

  async function replaceProductSettings(message) {

    try {
      return {
        ok: true,
        result: await settingsController.replace(
            message.expectedRevision,
            message.settings,
        ),
      };
    } catch (error) {
      return errorResponse(safeSettingsErrorCode(error));
    }

  }

  async function getSiteSettings(message) {

    try {
      return {ok: true, result: await siteController.get(message.tabUrl)};
    } catch (error) {
      return errorResponse(safeSettingsErrorCode(error));
    }

  }

  async function replaceSiteSettings(message) {

    try {
      const current = activationController.snapshot();
      if (current.active || current.runtimeState !== routing.STATES.OFF ||
          current.durableIntent !== offState.OFF) {
        return errorResponse(settingsControlApi.ERRORS.SETTINGS_MUTATION_REQUIRES_OFF);
      }
      return {ok: true, result: await siteController.replace(message)};
    } catch (error) {
      return errorResponse(safeSettingsErrorCode(error));
    }

  }

  async function installStagedProviderDataset() {

    if (!providerUpdateController.updateConfigured()) {
      return errorResponse(providerUpdateControlApi.ERRORS.TRUST_NOT_CONFIGURED);
    }
    configurationApplying = true;
    invalidateOptionsStatus();
    try {
      const installed = await datasetPromotionController.install();
      try {
        if (installed.status === 'INSTALLED') await providerUpdateController.markInstalled();
      } catch (_error) {
        // Promotion is authoritative even if optional UI status persistence
        // fails after the crash-safe transaction has committed.
      }
      return {ok: true, result: {status: installed.status}};
    } catch (error) {
      const code = safePromotionErrorCode(error);
      if (code === datasetPromotionApi.ERRORS.RECOVERY_REQUIRED) {
        await activationController.requireRecovery();
      }
      return errorResponse(code);
    } finally {
      configurationApplying = false;
      invalidateOptionsStatus();
      operationalController.refreshToolbar().catch(() => undefined);
    }

  }

  async function checkForProviderUpdate() {

    try {
      return await checkForProviderUpdateNow();
    } finally {
      // Alarm checks must refresh open Options even if installation was deferred.
      invalidateOptionsStatus();
    }

  }

  async function checkForProviderUpdateNow() {

    let checked;
    try {
      checked = await providerUpdateController.check();
    } catch (_error) {
      return errorResponse(providerUpdateControlApi.ERRORS.STATE_UNAVAILABLE);
    }
    if (!checked || checked.ok !== true) {
      return errorResponse(safeProviderUpdateErrorCode(checked));
    }
    let update;
    try {
      update = await providerUpdateController.publicStatus();
    } catch (_error) {
      return errorResponse(providerUpdateControlApi.ERRORS.STATE_UNAVAILABLE);
    }
    // Check and promotion share the RPC control queue with Save/Apply/Clear.
    // A blocked runtime or external owner may retain a candidate for later.
    let resultStatus = checked.status;
    if ((checked.status === 'STAGED' || update.updateAvailable) &&
        providerUpdateController.updateConfigured()) {
      const current = activationController.snapshot();
      const canInstall = current && (
        current.active === true && current.runtimeState === 'READY' && current.durableIntent === 'ON' ||
        current.active === false && current.runtimeState === 'OFF' && current.durableIntent === 'OFF');
      let live;
      try {
        live = await browser.proxy.settings.get({});
      } catch (_error) {
        live = null;
      }
      const allowedLevels = current && current.active ? ['controlled_by_this_extension'] :
        ['controlled_by_this_extension', 'controllable_by_this_extension'];
      if (canInstall && live && allowedLevels.includes(live.levelOfControl)) {
        const installed = await installStagedProviderDataset();
        if (!installed.ok) return installed;
        resultStatus = installed.result.status;
      }
    }
    try {
      return {
        ok: true,
        result: {
          status: resultStatus,
          update: resultStatus === 'INSTALLED' ? await providerUpdateController.publicStatus() : update,
        },
      };
    } catch (_error) {
      return errorResponse(providerUpdateControlApi.ERRORS.STATE_UNAVAILABLE);
    }

  }

  async function runOperationalAction(kind, operation) {

    const token = operationalController.beginOperation(kind);
    try {
      return await operation();
    } finally {
      try {
        await operationalController.endOperation(token);
      } finally {
        invalidateOptionsStatus();
      }
    }

  }

  async function runHealthCheck(message) {

    try {
      return {
        ok: true,
        result: await operationalController.checkHealth(message.tabUrl),
      };
    } catch (_error) {
      return errorResponse('OPERATIONAL_STATE_UNAVAILABLE');
    }

  }

  async function handleMessage(message) {

    await initialization;
    const type = message && typeof message === 'object' ? message.type : null;
    if (['firefox.transfer.export', 'firefox.transfer.preview', 'firefox.transfer.import'].includes(type)) {
      return enqueueRpcControlOperation(async () => {
        try {
          const snapshot = type === 'firefox.transfer.export' && message.support === true ?
            await verifiedConfigurationSnapshot() : null;
          const saved = snapshot ? snapshot.saved : await settingsController.get();
          if (type === 'firefox.transfer.export') {
            const info = await browser.runtime.getBrowserInfo();
            const platform = await browser.runtime.getPlatformInfo();
            const metadata = {exportedAt: new Date().toISOString(),
              browser: {family: 'firefox', version: info.version},
              extensionVersion: browser.runtime.getManifest().version,
              locale: browser.i18n.getUILanguage(), platform: platform.os};
            const status = snapshot ? await configurationStatus(snapshot) : null;
            const sourceSettings = status && status.active && snapshot.effective || saved;
            return {ok: true, result: transfer.create(message.support === true ? null :
              transferAdapter.fromSettings(saved.settings), metadata,
            status ? Object.assign({}, status,
                {sourceAvailable: routingSourceAvailable(sourceSettings.settings.source)}) : null)};
          }
          const parsed = transfer.parse(message.text);
          if (!parsed.configuration) transfer.fail('TRANSFER_NO_CONFIGURATION');
          const candidate = transferAdapter.toSettings(parsed.configuration);
          if (type === 'firefox.transfer.preview') {
            return {ok: true, result: {expectedRevision: saved.revision,
              summary: transfer.preview(transferAdapter.fromSettings(saved.settings),
                  parsed.configuration, candidate.unsupported)}};
          }
          // This uses the existing revision/journal transaction. No activation,
          // provider request or Effective write is part of importing settings.
          const result = await settingsController.replace(
              message.expectedRevision, candidate.settings,
          );
          return {ok: true, result: {savedRevision: result.revision}};
        } catch (error) {
          return errorResponse(['TRANSFER_INVALID', 'TRANSFER_VERSION', 'TRANSFER_LIMIT',
            'TRANSFER_NO_CONFIGURATION'].includes(error.code) ? error.code : safeSettingsErrorCode(error));
        }
      });
    }
    if (type === 'firefox.capabilities.get') {
      return {ok: true, result: await capabilitiesStatus()};
    }
    if (type === 'firefox.options.get') {
      if (!exactRpcRequest(message, type)) return errorResponse('INVALID_RPC_REQUEST');
      return enqueueRpcControlOperation(getOptionsState);
    }
    if (type === 'firefox.popup.get') {
      if (!exactTabStateRequest(message, type)) return errorResponse('INVALID_RPC_REQUEST');
      return enqueueRpcControlOperation(() => getPopupState(message));
    }
    if (type === 'firefox.activation.apply') {
      const revisionRequest = message && Object.keys(message).length === 2 &&
        Number.isSafeInteger(message.expectedRevision) && message.expectedRevision >= 0;
      if (!exactRpcRequest(message, type) && !revisionRequest) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(() => runOperationalAction(
          'APPLY',
          async () => {
            configurationApplying = true;
            invalidateOptionsStatus();
            try {
              const result = await applyPersistedProductConfiguration(message);
              if (result.ok === true) await operationalController.resetHealth();
              return result;
            } finally {
              configurationApplying = false;
            }
          },
      ));
    }
    if (type === 'firefox.configuration.get') {
      if (!exactRpcRequest(message, type)) return errorResponse('INVALID_RPC_REQUEST');
      try {
        return {ok: true, result: await configurationStatus()};
      } catch (_error) {
        return errorResponse('SETTINGS_STATE_UNAVAILABLE');
      }
    }
    if (type === 'firefox.site.apply') {
      if (!message || Object.keys(message).length !== 7 ||
          !Number.isSafeInteger(message.expectedRevision) ||
          !(message.expectedEffectiveId === null || typeof message.expectedEffectiveId === 'string') ||
          typeof message.applyAll !== 'boolean') return errorResponse('INVALID_RPC_REQUEST');
      return enqueueRpcControlOperation(() => runOperationalAction('APPLY', () => applySiteConfiguration(message)));
    }
    if (type === 'firefox.activation.clear') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(() => runOperationalAction(
          'CLEAR',
          async () => {
            const result = await clearProductActivation();
            if (result.ok === true) {
              await operationalController.resetHealth();
            }
            return result;
          },
      ));
    }
    if (type === 'firefox.settings.get') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(getProductSettings);
    }
    if (type === 'firefox.settings.replace') {
      if (!exactSettingsReplaceRequest(message)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(() => replaceProductSettings(message));
    }
    if (type === 'firefox.site.get') {
      if (!exactTabStateRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(() => getSiteSettings(message));
    }
    if (type === 'firefox.site.replace') {
      if (!exactSiteReplaceRequest(message)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(async () => {
        const result = await replaceSiteSettings(message);
        await operationalController.refreshToolbar();
        return result;
      });
    }
    if (type === 'firefox.operational.get') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      try {
        return {ok: true, result: await operationalController.publicStatus()};
      } catch (_error) {
        return errorResponse('OPERATIONAL_STATE_UNAVAILABLE');
      }
    }
    if (type === 'firefox.health.check') {
      if (!exactHealthCheckRequest(message)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(() => runOperationalAction(
          'HEALTH', () => runHealthCheck(message),
      ));
    }
    if (type === 'firefox.provider.update.install') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(installStagedProviderDataset);
    }
    if (type === 'firefox.provider.update.get') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      try {
        return {
          ok: true,
          result: await providerUpdateController.publicStatus(),
        };
      } catch (_error) {
        return errorResponse(providerUpdateControlApi.ERRORS.STATE_UNAVAILABLE);
      }
    }
    if (type === 'firefox.provider.update.check') {
      if (!exactRpcRequest(message, type)) {
        return errorResponse('INVALID_RPC_REQUEST');
      }
      return enqueueRpcControlOperation(checkForProviderUpdate);
    }
    return errorResponse('UNKNOWN_RPC');

  }

  browser.proxy.onRequest.addListener(
      routingAdapter.onProxyRequest,
      {urls: ['<all_urls>']},
  );
  browser.proxy.settings.onChange.addListener((change) => {

    const result = activationController.handleProxySettingsChange(change);
    operationalController.handleControlChange(result);

  });
  browser.webRequest.onBeforeRequest.addListener(
      routingAdapter.onBeforeRequest,
      {urls: ['<all_urls>']},
      ['blocking'],
  );
  browser.webRequest.onAuthRequired.addListener(
      proxyAuth.onAuthRequired,
      {urls: ['<all_urls>']},
      ['blocking'],
  );
  browser.webRequest.onHeadersReceived.addListener(
      routingAdapter.onHeadersReceived,
      {urls: ['<all_urls>']},
      ['blocking', 'responseHeaders'],
  );
  function onRequestTerminal(details) {

    routingAdapter.onRequestTerminal(details);
    proxyAuth.onRequestTerminal(details);

  }
  browser.webRequest.onCompleted.addListener(
      onRequestTerminal,
      {urls: ['<all_urls>']},
  );
  browser.webRequest.onErrorOccurred.addListener(
      onRequestTerminal,
      {urls: ['<all_urls>']},
  );
  browser.runtime.onMessage.addListener(handleMessage);
  if (browser.alarms && browser.alarms.onAlarm) {
    browser.alarms.onAlarm.addListener((alarm) => {

      if (!alarm || alarm.name !== providerUpdateControlApi.ALARM_NAME) return;
      initialization.then(() => enqueueRpcControlOperation(() =>
        providerUpdateController.updateConfigured() ? checkForProviderUpdate() : undefined,
      )).catch(() => undefined);

    });
  }
  if (browser.tabs && browser.tabs.onActivated) {
    browser.tabs.onActivated.addListener((activeInfo) => {

      operationalController.refreshToolbar({tabId: activeInfo.tabId})
          .catch(() => undefined);

    });
  }
  if (browser.tabs && browser.tabs.onUpdated) {
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

      if (!tab || tab.active !== true || !changeInfo ||
          !Object.prototype.hasOwnProperty.call(changeInfo, 'url') &&
          changeInfo.status !== 'complete') {
        return;
      }
      operationalController.refreshToolbar({tabId, tab})
          .catch(() => undefined);

    });
  }
  if (browser.windows && browser.windows.onFocusChanged) {
    browser.windows.onFocusChanged.addListener(() => {

      operationalController.refreshToolbar().catch(() => undefined);

    });
  }
  if (browser.notifications && browser.notifications.onClicked) {
    browser.notifications.onClicked.addListener((notificationId) => {

      operationalController.handleNotificationClicked(notificationId)
          .catch(() => undefined);

    });
  }

  operationalController.showLoading().catch(() => undefined);

  const initialization = (async () => {

    providerBootstrapState = await providerBootstrap.initialize();
    const promotionRecovery = await datasetPromotionController.initialize();
    await settingsController.initialize();
    const activation = promotionRecovery.ok ? await activationController.initializeFromDurable() :
      await activationController.requireRecovery();
    await providerUpdateController.initialize();
    await operationalController.initialize();
    await operationalController.restoreToolbar();
    await operationalController.reconcileStartupAttention();
    return activation;

  })();

  root.rucbFirefoxRuntime = Object.freeze({
    bootId,
    whenReady() {

      return initialization;

    },
  });

})(typeof globalThis === 'object' ? globalThis : this);
