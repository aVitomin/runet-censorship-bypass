'use strict';

const Assert = require('node:assert/strict');
const Vm = require('node:vm');
const Format = require('../../shared/configuration-transfer');
const Firefox = require('../../firefox/background/configuration-transfer');
const FirefoxSettings = require('../../firefox/background/settings-control');
const {createRuntimeHarness} = require('./runtime-performance-harness');

function activeRoute(harness, hostname) {

  const context = {};
  Vm.runInNewContext(harness.getProxyDetails().value.pacScript.data, context);
  const findProxyForUrl = context.FindProxyForURL;
  return findProxyForUrl(`https://${hostname}/`, hostname);

}

async function applySaved(harness) {

  const status = await harness.callRpc('getConfigurationStatus');
  const result = await harness.callRpc('applySavedConfiguration', {
    expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
  });
  Assert.equal(result.ok, true, result.error && result.error.code);

}

describe('Chromium independent Tor connections', function() {
  it('matches Firefox fresh Tor scopes and preserves safe routing defaults', async function() {

    const h = await createRuntimeHarness();
    const defaults = h.context.mv3PacMods.normalizePacMods({});
    const firefox = FirefoxSettings.createDefaultSettings();
    for (const kind of ['localTor', 'torBrowser']) {
      Assert.equal(defaults[kind].enabled, true);
      for (const key of ['host', 'port', 'useForProxyRules', 'useForOnion',
        'useAsDirectReplacement']) {
        Assert.equal(defaults[kind][key], firefox[kind][key], `${kind}.${key}`);
      }
    }
    Assert.equal(defaults.usePacScriptProxies, true);
    Assert.equal(defaults.ownProxiesOnlyForOwnSites, true);
    Assert.equal(defaults.replaceDirectWithProxy, false);
    Assert.equal(defaults.noDirect, false);
    Assert.equal(h.context.mv3PacMods.getProxyRuleCandidates(defaults).length, 0);
    const both = h.context.mv3PacMods.normalizePacMods({
      localTor: {enabled: true, useForOnion: false, useAsDirectReplacement: true},
      torBrowser: {enabled: true, useForOnion: true, useAsDirectReplacement: false},
    });
    Assert.equal(both.localTor.enabled, true);
    Assert.equal(both.torBrowser.enabled, true);
    Assert.equal(both.localTor.useForOnion, false);
    Assert.equal(both.localTor.useAsDirectReplacement, true);
    Assert.equal(both.torBrowser.useForOnion, true);
    Assert.equal(both.torBrowser.useAsDirectReplacement, false);

  });

  it('preserves saved disabled scopes, endpoints and legacy Tor controls', async function() {

    const h = await createRuntimeHarness();
    const normalize = h.context.mv3PacMods.normalizePacMods;
    const saved = normalize({
      localTor: {enabled: false, host: '127.0.0.1', port: 29050,
        useForProxyRules: false, useForOnion: false, useAsDirectReplacement: true},
      torBrowser: {enabled: false, host: '127.0.0.1', port: 29150,
        useForProxyRules: true, useForOnion: true, useAsDirectReplacement: false},
    });
    Assert.equal(saved.localTor.enabled, false);
    Assert.equal(saved.localTor.host, '127.0.0.1');
    Assert.equal(saved.localTor.port, 29050);
    Assert.equal(saved.localTor.useForOnion, false);
    Assert.equal(saved.localTor.useAsDirectReplacement, true);
    Assert.equal(saved.torBrowser.enabled, false);
    Assert.equal(saved.torBrowser.port, 29150);
    Assert.equal(saved.torBrowser.useForProxyRules, true);
    Assert.equal(normalize({localTor: {enabled: true}}).localTor.useForProxyRules, true);
    Assert.equal(normalize({localTor: {enabled: true, useForProxyRules: 'false'}})
        .localTor.useForProxyRules, false);
    for (const kind of ['localTor', 'torBrowser']) {
      Assert.equal(normalize({useTor: false})[kind].enabled, false);
    }
    const legacy = normalize({useTor: true});
    Assert.equal(legacy.localTor.enabled, false);
    Assert.equal(legacy.torBrowser.enabled, true);
    Assert.equal(legacy.torBrowser.useForProxyRules, true);
    Assert.equal(legacy.torBrowser.host, '127.0.0.1');

  });

  it('quick-saves only Proxy scope and preserves active onion routing without Clear',
      async function() {

        const h = await createRuntimeHarness({pacMods: {localTor: {enabled: true},
          torBrowser: {enabled: false},
          rules: [{pattern: 'proxy.example', action: 'PROXY', enabled: true}]}});
        Assert.equal((await h.audit.applyCookedPacAndPersist({})).ok, true);
        const before = await h.callRpc('getConfigurationStatus');
        Assert.equal(activeRoute(h, 'service.onion'), 'SOCKS5 localhost:9050');
        const saved = await h.callRpc('applyPopupChanges', {
          operation: 'save', expectedRevision: before.savedRevision,
          tabUrl: 'https://example.test/', draft: {quickProxies: {torBrowserEnabled: true}},
        });
        Assert.equal(saved.ok, true);
        Assert.equal(h.getState().pacMods.localTor.enabled, true);
        Assert.equal(h.getState().pacMods.torBrowser.enabled, true);
        Assert.equal(h.getState().pacMods.torBrowser.useForProxyRules, true);
        Assert.equal(h.getState().pacMods.torBrowser.useForOnion, false);
        const pending = await h.callRpc('getConfigurationStatus');
        Assert.equal(pending.pending, true);
        Assert.equal(pending.effectiveId, before.effectiveId);
        Assert.equal(activeRoute(h, 'service.onion'), 'SOCKS5 localhost:9050');
        await applySaved(h);
        Assert.equal(activeRoute(h, 'service.onion'), 'SOCKS5 localhost:9050');
        Assert.equal(activeRoute(h, 'proxy.example'),
            'SOCKS5 localhost:9050; SOCKS5 localhost:9150');
        const active = await h.callRpc('getConfigurationStatus');
        await h.callRpc('applyPopupChanges', {
          operation: 'save', expectedRevision: active.savedRevision,
          tabUrl: 'https://example.test/', draft: {quickProxies: {localTorEnabled: false}},
        });
        Assert.equal(h.getState().pacMods.localTor.enabled, true);
        Assert.equal(h.getState().pacMods.localTor.useForProxyRules, false);
        Assert.equal(h.getState().pacMods.torBrowser.enabled, true);
        await applySaved(h);
        Assert.equal(activeRoute(h, 'service.onion'), 'SOCKS5 localhost:9050');
        Assert.equal(activeRoute(h, 'proxy.example'), 'SOCKS5 localhost:9150');
        Assert.equal(h.counts.proxySettingsClears, 0);

      });

  it('quick-enables a disabled connection without activating inactive onion or Direct presets',
      async function() {

        for (const kind of ['localTor', 'torBrowser']) {
          const h = await createRuntimeHarness({pacMods: {[kind]: {enabled: false,
            useForOnion: true, useAsDirectReplacement: true}}});
          await h.callRpc('clearProxy');
          const before = await h.callRpc('getConfigurationStatus');
          const writes = h.counts.proxySettingsWrites;
          await h.callRpc('applyPopupChanges', {operation: 'save', expectedRevision: before.savedRevision,
            tabUrl: 'https://example.test/', draft: {quickProxies: {[`${kind}Enabled`]: true}}});
          const selected = h.getState().pacMods[kind];
          Assert.equal(selected.enabled, true);
          Assert.equal(selected.useForProxyRules, true);
          Assert.equal(selected.useForOnion, false);
          Assert.equal(selected.useAsDirectReplacement, false);
          Assert.equal(h.counts.proxySettingsWrites, writes);
          Assert.equal((await h.callRpc('getConfigurationStatus')).active, false);
        }

      });

  it('quick-disables Proxy without disabling existing Direct replacement scope', async function() {

    const h = await createRuntimeHarness({pacMods: {
      localTor: {enabled: true, useForOnion: false, useAsDirectReplacement: true},
      replaceDirectWithProxy: true, noDirect: true,
    }});
    const before = await h.callRpc('getConfigurationStatus');
    await h.callRpc('applyPopupChanges', {operation: 'save', expectedRevision: before.savedRevision,
      tabUrl: 'https://example.test/', draft: {quickProxies: {localTorEnabled: false}}});
    Assert.equal(h.getState().pacMods.localTor.enabled, true);
    Assert.equal(h.getState().pacMods.localTor.useForProxyRules, false);
    Assert.equal(h.getState().pacMods.localTor.useAsDirectReplacement, true);
    await applySaved(h);
    Assert.equal(activeRoute(h, 'example.test'), 'SOCKS5 localhost:9050');

  });

  it('round-trips Firefox onion-only and Direct-only scopes without broadening Proxy rules',
      async function() {

        const settings = FirefoxSettings.createDefaultSettings();
        Object.assign(settings.localTor, {useForProxyRules: false, useForOnion: true,
          useAsDirectReplacement: false});
        Object.assign(settings.torBrowser, {useForProxyRules: false, useForOnion: false,
          useAsDirectReplacement: true});
        const h = await createRuntimeHarness();
        const imported = h.context.mv3ConfigurationTransfer.toPatch(Firefox.fromSettings(settings));
        Assert.equal(imported.unsupported.includes('torScope'), false);
        for (const kind of ['localTor', 'torBrowser']) {
          Assert.equal(imported.patch.pacMods[kind].enabled, true);
          Assert.equal(imported.patch.pacMods[kind].useForProxyRules, false);
        }
        Assert.equal(h.context.mv3PacMods.getProxyRuleCandidates(imported.patch.pacMods).length, 0);
        const exported = h.context.mv3ConfigurationTransfer.fromState(
            Object.assign({}, h.getState(), imported.patch));
        const restored = Firefox.toSettings(exported).settings;
        for (const kind of ['localTor', 'torBrowser']) {
          for (const scope of ['useForProxyRules', 'useForOnion', 'useAsDirectReplacement']) {
            Assert.equal(restored[kind][scope], settings[kind][scope]);
          }
        }
        await h.callRpc('setPacMods', {pacMods: imported.patch.pacMods});
        const before = await h.callRpc('getConfigurationStatus');
        const popup = await h.callRpc('getPopupState', {tabUrl: 'https://example.test/'});
        Assert.equal(popup.quickProxies.localTorEnabled, false);
        Assert.equal(popup.quickProxies.torBrowserEnabled, false);
        Assert.equal(popup.proxyCandidates.available, false);
        Assert.equal(h.context.mv3ProxyHealth.getCandidateSummary(imported.patch.pacMods).type,
            null);
        const result = await h.callRpc('applyPopupChanges', {operation: 'save',
          expectedRevision: before.savedRevision, tabUrl: 'https://example.test/',
          draft: {siteMode: 'proxy', siteScope: 'host'}});
        Assert.equal(result.ok, false);
        Assert.equal(result.error.code, 'PROXY_RULE_NO_CANDIDATE');
        Assert.equal(h.getState().savedRevision, before.savedRevision);

      });

  it('preserves both Tor connections through Firefox import, Saved and Apply', async function() {

    const settings = FirefoxSettings.createDefaultSettings();
    settings.rules.proxy = ['example.test'];
    for (const kind of ['localTor', 'torBrowser']) {
      settings[kind].useForProxyRules = true;
      settings[kind].host = 'localhost';
    }
    const portable = Firefox.fromSettings(settings);
    const h = await createRuntimeHarness();
    await h.installPacVersion({providerKey: 'Антицензорити'});
    const patch = h.context.mv3ConfigurationTransfer.toPatch(portable);
    Assert.equal(patch.patch.pacMods.localTor.enabled, true);
    Assert.equal(patch.patch.pacMods.torBrowser.enabled, true);
    Assert.equal(patch.unsupported.includes('torExclusive'), false);
    await h.callRpc('clearProxy');
    const counts = {writes: h.counts.proxySettingsWrites, downloads: h.counts.pacDownloads};
    const text = JSON.stringify(Format.create(portable, {
      exportedAt: '2026-09-20T00:00:00.000Z', browser: {family: 'firefox', version: '154'},
      extensionVersion: '0.0.4.0', locale: 'en', platform: 'win',
    }));
    const preview = await h.callRpc('previewConfigurationImport', {text});
    await h.callRpc('importConfiguration', {text, expectedRevision: preview.expectedRevision});
    Assert.equal(h.getState().pacMods.localTor.enabled, true);
    Assert.equal(h.getState().pacMods.torBrowser.enabled, true);
    Assert.equal(h.counts.proxySettingsWrites, counts.writes);
    Assert.equal(h.counts.pacDownloads, counts.downloads);
    Assert.equal((await h.callRpc('getConfigurationStatus')).active, false);
    await applySaved(h);
    Assert.equal(activeRoute(h, 'example.test'),
        'SOCKS5 localhost:9050; SOCKS5 localhost:9150');

  });

  it('still rejects explicit Proxy with both Tor connections disabled before saving',
      async function() {

        const h = await createRuntimeHarness({pacMods: {noDirect: true}});
        const before = await h.callRpc('getConfigurationStatus');
        const result = await h.callRpc('applyPopupChanges', {
          operation: 'save', expectedRevision: before.savedRevision,
          tabUrl: 'https://example.test/', draft: {siteMode: 'proxy', siteScope: 'host',
            quickProxies: {localTorEnabled: false, torBrowserEnabled: false}},
        });
        Assert.equal(result.ok, false);
        Assert.equal(result.error.code, 'PROXY_RULE_NO_CANDIDATE');
        Assert.equal(h.getState().savedRevision, before.savedRevision);

      });
});
