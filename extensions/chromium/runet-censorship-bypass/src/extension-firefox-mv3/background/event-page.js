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
  const siteControlApi = root.rucbFirefoxSiteControl;
  const operationalStatusApi = root.rucbFirefoxOperationalStatus;
  let activationController = null;
  let settingsController = null;
  let siteController = null;
  let operationalController = null;
  let productionDatasetStore = null;
  let datasetPromotionController = null;
  let providerUpdateController = null;
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
      const backend = datasetStoreApi.createIndexedDbBackend(root.indexedDB);
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
    async datasetIdentityAvailable(identity) {

      const stored = await createProductionDatasetStore().loadVerifications(
          identity.providerKey,
      );
      return [stored.active, stored.previousLkg, stored.packagedBaseline]
          .some((verification) => verification && verification.ok === true &&
            verification.dataset.identity.providerKey === identity.providerKey &&
            verification.dataset.identity.datasetVersion ===
              identity.datasetVersion &&
            verification.dataset.identity.artifactSha256 ===
              identity.artifactSha256);

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
    getDatasetInfo: () => ({
      available: providerBootstrapState.datasetAvailable === true,
      version: productionProviderApi.DATASET_VERSION,
    }),
  });
  datasetPromotionController = datasetPromotionApi.createController({
    storageArea: browser.storage.local,
    datasetStore: createProductionDatasetStore(),
    sha256,
    activationSnapshot: () => activationController.snapshot(),
    providerKey: productionProviderApi.PROVIDER_KEY,
    replacePrepared: (prepared) => activationController.replacePrepared(prepared),
  });
  async function readCurrentDatasetIdentity() {

    const effective = await productConfigApi.readEffectiveRecords(browser.storage.local);
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
    readCurrentDatasetIdentity,
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

  function exactSiteGetRequest(message) {

    return Boolean(message) && typeof message === 'object' &&
      !Array.isArray(message) && message.type === 'firefox.site.get' &&
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

  async function configurationStatus() {

    const saved = await settingsController.get();
    const activation = activationController.snapshot();
    const records = await productConfigApi.readEffectiveRecords(browser.storage.local);
    const effective = records ? await settingsController.getEffective() : null;
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
          JSON.stringify((stored[productConfigApi.CREDENTIALS_STORAGE_KEY] || {}).entries) !==
          JSON.stringify((records[productConfigApi.CREDENTIALS_STORAGE_KEY] || {}).entries)) {
        categories.push('proxyConnections');
      }
      if (!categories.length ||
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

  async function applySiteConfiguration(message) {

    const before = await configurationStatus();
    if (message.expectedRevision !== before.savedRevision ||
        message.expectedEffectiveId !== before.effectiveId) {
      return errorResponse('SAVED_REVISION_CHANGED');
    }
    if (before.pending && message.applyAll !== true) return errorResponse('PENDING_CONFIRMATION_REQUIRED');
    configurationApplying = true;
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

    if (!providerUpdateController.trustConfigured()) {
      return errorResponse(providerUpdateControlApi.ERRORS.TRUST_NOT_CONFIGURED);
    }
    try {
      const installed = await datasetPromotionController.install();
      try {
        await providerUpdateController.markInstalled();
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
    }

  }

  async function checkForProviderUpdate() {

    let checked;
    try {
      checked = await providerUpdateController.check();
    } catch (_error) {
      return errorResponse(providerUpdateControlApi.ERRORS.STATE_UNAVAILABLE);
    }
    if (!checked || checked.ok !== true) {
      return errorResponse(safeProviderUpdateErrorCode(checked));
    }
    try {
      return {
        ok: true,
        result: {
          status: checked.status,
          update: await providerUpdateController.publicStatus(),
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
      await operationalController.endOperation(token);
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
    if (type === 'firefox.capabilities.get') {
      const manifest = browser.runtime.getManifest();
      const activation = activationController.snapshot();
      return {
        ok: true,
        result: {
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
          providerDatasetAvailable:
            providerBootstrapState.datasetAvailable === true,
          providerUpdateImplemented: true,
          providerUpdateConfigured:
            providerUpdateController.trustConfigured(),
        },
      };
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
      if (!exactSiteGetRequest(message)) {
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

      initialization.then(() => enqueueRpcControlOperation(() =>
        providerUpdateController.handleAlarm(alarm),
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
