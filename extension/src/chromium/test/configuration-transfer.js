'use strict';

const Assert = require('node:assert/strict');
const Format = require('../../extension-mv3-common/configuration-transfer');
const Ui = require('../../extension-mv3-common/configuration-transfer-ui');
const Firefox = require('../../extension-firefox-mv3/background/configuration-transfer');
const FirefoxSettings = require('../../extension-firefox-mv3/background/settings-control');
const {createRuntimeHarness} = require('./runtime-performance-harness');

const metadata = {exportedAt: '2026-09-20T00:00:00.000Z', browser: {family: 'firefox', version: '154'},
  extensionVersion: '0.0.4.0', locale: 'en', platform: 'win'};
const portable = () => Firefox.fromSettings(FirefoxSettings.createDefaultSettings());
const file = (config = portable()) => Format.create(config, metadata);
const copy = (value) => JSON.parse(JSON.stringify(value));

describe('Portable configuration boundary', function() {
  it('exports a browser-neutral versioned schema with explicit scopes and no storage identities', function() {
    const config = portable();
    config.routes = [{host: 'example.com', scope: 'host', mode: 'proxy', enabled: true},
      {host: 'example.org', scope: 'domain', mode: 'direct', enabled: true}];
    const value = Format.parse(JSON.stringify(file(config)));
    Assert.equal(value.schemaVersion, 1);
    Assert.equal(value.credentials.included, false);
    Assert.equal(Format.pattern(value.configuration.routes[1]), '*.example.org');
    Assert.doesNotMatch(JSON.stringify(value), /savedRevision|effectiveId|journal|authRef|password/);
  });

  it('omits usernames, passwords, notes, endpoints and identities from support files', function() {
    const value = Format.create(null, metadata, {active: true, pending: true,
      pendingCategories: ['proxyConnections', 'secret'], sourceAvailable: true,
      effectiveId: 'private-id', password: 'not-exportable', host: 'private.example'});
    Assert.equal(value.configuration, null);
    Assert.deepEqual(value.diagnostics.pendingCategories, ['proxyConnections']);
    Assert.doesNotMatch(JSON.stringify(value), /private|password|not-exportable|secret/);
  });

  it('rejects unsupported versions, oversize input and excessive nesting', function() {
    Assert.throws(() => Format.parse(JSON.stringify(Object.assign(file(), {schemaVersion: 2}))),
        {code: 'TRANSFER_VERSION'});
    Assert.throws(() => Format.parse(' '.repeat(Format.MAX_BYTES + 1)), {code: 'TRANSFER_LIMIT'});
    let nested = {};
    for (let i = 0; i < 14; i++) nested = {nested};
    Assert.throws(() => Format.validate(nested), {code: 'TRANSFER_LIMIT'});
  });

  it('rejects injected properties, HTML domains, credentials, unsafe URLs, arrays and types', function() {
    for (const mutate of [
      (value) => {
        value.configuration.password = 'secret';
      },
      (value) => {
        value.credentials.included = true;
      },
      (value) => {
        value.configuration.routing.noDirect = 'false';
      },
      (value) => {
        value.configuration.routes = [{host: '<script>', scope: 'host', mode: 'direct', enabled: true}];
      },
      (value) => {
        value.configuration.source = {kind: 'custom', urls: ['http://remote.example/']};
      },
      (value) => {
        value.configuration.source = {kind: 'custom', urls: ['https://user:pass@example.com/']};
      },
      (value) => {
        value.configuration.source = {kind: 'custom', urls: ['https://example.com/?token=secret']};
      },
      (value) => {
        value.configuration.routes = Array(5001).fill({});
      },
      (value) => {
        value.diagnostics = {cookies: 'secret'};
      },
    ]) {
      const value = file();
      mutate(value);
      Assert.throws(() => Format.parse(JSON.stringify(value)));
    }
    Assert.throws(() => Format.parse('{"__proto__":{}}'), {code: 'TRANSFER_INVALID'});
  });

  it('preserves exact/domain routing and ordered own proxies across adapters', async function() {
    const settings = FirefoxSettings.createDefaultSettings();
    settings.rules.direct = ['exact.example'];
    settings.rules.proxy = ['*.domain.example'];
    settings.ownProxies = ['first.example', 'second.example'].map((host, index) => ({
      id: `profile-${index}`, enabled: true, type: 'HTTP', host, port: 8080,
      proxyDNS: false, failoverTimeoutSeconds: null, useAsDirectReplacement: false,
      credentials: {mode: 'KEEP', username: 'private-account'},
    }));
    const exported = Firefox.fromSettings(settings);
    Assert.doesNotMatch(JSON.stringify(exported), /private-account|username|password/);
    Assert.deepEqual(Format.create(exported, metadata).credentials.missing, ['own-1', 'own-2']);
    const h = await createRuntimeHarness();
    const patch = h.context.mv3ConfigurationTransfer.toPatch(exported).patch;
    Assert.deepEqual(Array.from(patch.pacMods.rules, (rule) => rule.pattern), ['exact.example', '*.domain.example']);
    const reexport = h.context.mv3ConfigurationTransfer.fromState(
        Object.assign({}, h.getState(), patch),
    );
    const imported = Firefox.toSettings(reexport).settings;
    Assert.deepEqual(imported.rules, settings.rules);
    Assert.deepEqual(imported.ownProxies.map((value) => value.host), ['first.example', 'second.example']);
    Assert.ok(imported.ownProxies.every((value) => value.credentials.mode === 'MISSING'));
  });

  it('reports unsupported source/language/disabled rules instead of pretending source parity', function() {
    const config = portable();
    config.source = {kind: 'builtin', id: 'manual'};
    config.ui = {language: 'ru'};
    config.routes.push({host: 'example.com', scope: 'host', mode: 'proxy', enabled: false});
    const result = Firefox.toSettings(config);
    Assert.deepEqual(result.unsupported, ['disabledRules', 'source', 'language']);
    Assert.deepEqual(result.settings.rules.proxy, []);
  });
});

describe('Chromium configuration transfer RPC', function() {
  it('imports inactive into a new Saved revision without downloads, Apply or credentials restoration', async function() {
    const h = await createRuntimeHarness();
    await h.callRpc('clearProxy');
    const exported = await h.callRpc('exportConfiguration');
    const before = h.getState().savedRevision;
    const counts = copy(h.counts);
    const preview = await h.callRpc('previewConfigurationImport', {text: JSON.stringify(exported)});
    const result = await h.callRpc('importConfiguration', {text: JSON.stringify(exported),
      expectedRevision: preview.expectedRevision});
    Assert.equal(result.savedRevision, before + 1);
    Assert.equal(h.counts.proxySettingsWrites, counts.proxySettingsWrites);
    Assert.equal(h.counts.pacDownloads, counts.pacDownloads);
    Assert.equal(await h.context.mv3Effective.current(), null);
  });

  it('keeps active Effective and authentication intact on credential-free import, guards Apply', async function() {
    const h = await createRuntimeHarness({pacMods: {ownProxies: [{enabled: true, type: 'HTTPS',
      host: 'proxy.example', port: 8443, username: 'old-user', password: 'old-secret'}]}});
    Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
    const before = await h.callRpc('getConfigurationStatus');
    const exported = await h.callRpc('exportConfiguration');
    Assert.doesNotMatch(JSON.stringify(exported), /old-user|old-secret|password/);
    const counts = copy(h.counts);
    await h.callRpc('importConfiguration', {text: JSON.stringify(exported), expectedRevision: before.savedRevision});
    const status = await h.callRpc('getConfigurationStatus');
    Assert.equal(status.effectiveId, before.effectiveId);
    Assert.equal(status.pending, true);
    Assert.equal(h.counts.pacDownloads, counts.pacDownloads);
    Assert.equal(h.counts.proxySettingsWrites, counts.proxySettingsWrites);
    Assert.equal(h.getState().pacMods.ownProxies[0].password, '');
    Assert.equal(h.getState().pacMods.ownProxies[0].credentialsRequired, true);
    h.events.webBeforeRequest.dispatch({requestId: 'transfer-request', url: 'https://synthetic.example/'});
    const auth = await new Promise((resolve) => h.events.webAuth.dispatch({requestId: 'transfer-request',
      isProxy: true, challenger: {host: 'proxy.example', port: 8443}}, resolve));
    Assert.equal(auth.authCredentials.password, 'old-secret');
    const failed = await h.audit.applyCookedPacAndPersist({expectedRevision: status.savedRevision});
    Assert.equal(failed.error.code, 'CREDENTIALS_REQUIRED');
    Assert.equal((await h.context.mv3Effective.current()).id, before.effectiveId);
    const support = await h.callRpc('exportConfiguration', {support: true});
    Assert.doesNotMatch(JSON.stringify(support), /proxy.example|old-user|old-secret|effectiveId|savedRevision/);
    const saved = await h.callRpc('getPacMods');
    Assert.equal(saved.ownProxies[0].credentialsRequired, true);
    await h.callRpc('setPacMods', {pacMods: saved});
    Assert.equal(h.getState().pacMods.ownProxies[0].credentialsRequired, true);
  });

  it('imports over pending Saved, ignores diagnostics and applies only on explicit exact Apply', async function() {
    const h = await createRuntimeHarness();
    Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
    const before = await h.callRpc('getConfigurationStatus');
    const exported = await h.callRpc('exportConfiguration');
    exported.configuration.routes.push({host: 'portable.example', scope: 'host', mode: 'direct', enabled: true});
    exported.diagnostics = {active: false, pending: false,
      pendingCategories: [], sourceAvailable: false};
    let expectedRevision = before.savedRevision;
    for (let i = 0; i < 2; i++) {
      const result = await h.callRpc('importConfiguration', {text: JSON.stringify(exported), expectedRevision});
      expectedRevision = result.savedRevision;
      Assert.equal((await h.callRpc('getConfigurationStatus')).effectiveId, before.effectiveId);
    }
    const applied = await h.callRpc('applySavedConfiguration', {expectedRevision, expectedEffectiveId: before.effectiveId});
    Assert.equal(applied.ok, true);
    Assert.equal((await h.callRpc('getConfigurationStatus')).pending, false);
    Assert.equal((await h.context.mv3Effective.current()).savedRevision, expectedRevision);
  });

  it('rejects stale/missing revisions and support-only files without writing Saved', async function() {
    const h = await createRuntimeHarness();
    const exported = await h.callRpc('exportConfiguration');
    const before = h.getState().savedRevision;
    for (const expectedRevision of [undefined, before + 1]) {
      const result = await h.callRpcRaw('importConfiguration', {text: JSON.stringify(exported), expectedRevision});
      Assert.equal(result.error.code, 'SAVED_REVISION_CHANGED');
    }
    const support = await h.callRpc('exportConfiguration', {support: true});
    const result = await h.callRpcRaw('importConfiguration', {text: JSON.stringify(support), expectedRevision: before});
    Assert.equal(result.error.code, 'TRANSFER_NO_CONFIGURATION');
    Assert.equal(h.getState().savedRevision, before);
  });
});

describe('Shared Options transfer controller', function() {
  it('preserves Draft and refuses preview or confirmation until edits are reviewed', async function() {
    let dirty = true;
    const calls = [];
    const model = Ui.createController({hasDraft: () => dirty, onImported() {},
      call: async (action, params) => {
        calls.push({action, params}); return {expectedRevision: 7};
      }});
    const input = {size: 2, text: async () => '{}'};
    await model.preview(input);
    Assert.equal(model.state.error, 'TRANSFER_DRAFT');
    Assert.equal(calls.length, 0);
    dirty = false;
    await model.preview(input);
    dirty = true;
    await model.confirm();
    Assert.equal(model.state.error, 'TRANSFER_DRAFT');
    Assert.equal(calls.length, 1);
    dirty = false;
    await model.confirm();
    Assert.equal(calls[1].params.expectedRevision, 7);
    Assert.equal(model.state.message, 'transferImported');
  });

  it('uses the preview revision, retains preview on conflicts and never calls Apply', async function() {
    const calls = [];
    const model = Ui.createController({hasDraft: () => false, onImported() {},
      call: async (action, params) => {
        calls.push({action, params});
        if (action === 'import') throw Object.assign(new Error(), {code: 'SAVED_REVISION_CHANGED'});
        return {expectedRevision: 3};
      }});
    await model.preview({size: 2, text: async () => '{}'});
    await model.confirm();
    Assert.equal(model.state.error, 'SAVED_REVISION_CHANGED');
    Assert.equal(model.state.preview.expectedRevision, 3);
    Assert.deepEqual(calls.map((value) => value.action), ['preview', 'import']);
  });

  it('checks file size before reading and drops file contents on cancel', async function() {
    const model = Ui.createController({hasDraft: () => false, onImported() {},
      call: async () => ({expectedRevision: 1})});
    await model.preview({size: Format.MAX_BYTES + 1, text() {
      throw new Error('must not read');
    }});
    Assert.equal(model.state.error, 'TRANSFER_LIMIT');
    await model.preview({size: 2, text: async () => '{}'});
    model.cancel();
    Assert.equal(model.state.text, null);
    Assert.equal(model.state.preview, null);
  });
});
