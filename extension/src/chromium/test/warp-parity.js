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

describe('Chromium independent WARP scopes', function() {
  it('preserves legacy Proxy defaults while supporting independent replacement scope', async function() {

    const h = await createRuntimeHarness();
    const normalize = h.context.mv3PacMods.normalizePacMods;
    const fresh = normalize({}).warp;
    Assert.equal(fresh.enabled, false);
    Assert.equal(fresh.useForProxyRules, true);
    Assert.equal(fresh.useAsDirectReplacement, false);
    Assert.equal(normalize({warp: {enabled: true}}).warp.useForProxyRules, true);
    Assert.equal(normalize({useWarp: true}).warp.useForProxyRules, true);
    const replacement = normalize({warp: {enabled: true, useForProxyRules: false,
      useAsDirectReplacement: true}});
    Assert.equal(h.context.mv3PacMods.getProxyRuleCandidates(replacement).length, 0);
    Assert.equal(h.context.mv3PacMods.getDirectReplacementCandidates(replacement).length, 2);
    Assert.equal(h.context.mv3ProxyHealth.getCandidateSummary(replacement).type, null);

  });

  it('round-trips every Firefox WARP scope combination without broadening Proxy', async function() {

    const h = await createRuntimeHarness();
    for (const useForProxyRules of [false, true]) {
      for (const useAsDirectReplacement of [false, true]) {
        const settings = FirefoxSettings.createDefaultSettings();
        Object.assign(settings.warp, {useForProxyRules, useAsDirectReplacement});
        const imported = h.context.mv3ConfigurationTransfer.toPatch(Firefox.fromSettings(settings));
        Assert.equal(imported.unsupported.includes('warpScope'), false);
        Assert.equal(imported.patch.pacMods.warp.enabled,
            useForProxyRules || useAsDirectReplacement);
        Assert.equal(imported.patch.pacMods.warp.useForProxyRules, useForProxyRules);
        Assert.equal(imported.patch.pacMods.warp.useAsDirectReplacement, useAsDirectReplacement);
        const exported = h.context.mv3ConfigurationTransfer.fromState(
            Object.assign({}, h.getState(), imported.patch));
        const restored = Firefox.toSettings(exported).settings.warp;
        Assert.equal(restored.useForProxyRules, useForProxyRules);
        Assert.equal(restored.useAsDirectReplacement, useAsDirectReplacement);
        Assert.deepEqual(restored.candidates.map(({type, host, port}) => ({type, host, port})),
            settings.warp.candidates.map(({type, host, port}) => ({type, host, port})));
      }
    }

  });

  it('imports replacement-only WARP into Saved and applies only after explicit Apply', async function() {

    const h = await createRuntimeHarness({pacMods: {}});
    await h.installPacVersion({providerKey: 'Антицензорити'});
    await h.callRpc('clearProxy');
    const settings = FirefoxSettings.createDefaultSettings();
    settings.warp.useForProxyRules = false;
    settings.warp.useAsDirectReplacement = true;
    settings.flags.replaceDirectWithProxy = true;
    const text = JSON.stringify(Format.create(Firefox.fromSettings(settings), {
      exportedAt: '2026-09-20T00:00:00.000Z', browser: {family: 'firefox', version: '154'},
      extensionVersion: '1.0.0', locale: 'en', platform: 'win',
    }));
    const preview = await h.callRpc('previewConfigurationImport', {text});
    const writes = h.counts.proxySettingsWrites;
    await h.callRpc('importConfiguration', {text, expectedRevision: preview.expectedRevision});
    Assert.equal(h.counts.proxySettingsWrites, writes);
    const popup = await h.callRpc('getPopupState', {tabUrl: 'https://example.test/'});
    Assert.equal(popup.quickProxies.warpEnabled, false);
    Assert.equal(popup.proxyCandidates.available, false);
    const status = await h.callRpc('getConfigurationStatus');
    Assert.equal(status.active, false);
    const invalid = await h.callRpc('applyPopupChanges', {operation: 'save',
      expectedRevision: status.savedRevision, tabUrl: 'https://example.test/',
      draft: {siteMode: 'proxy', siteScope: 'host'}});
    Assert.equal(invalid.error.code, 'PROXY_RULE_NO_CANDIDATE');
    const applied = await h.callRpc('applySavedConfiguration', {
      expectedRevision: status.savedRevision, expectedEffectiveId: status.effectiveId,
    });
    Assert.equal(applied.ok, true);
    Assert.equal(activeRoute(h, 'example.test'),
        'SOCKS5 127.0.0.1:40000; HTTPS 127.0.0.1:40000');

  });

  it('quick Proxy changes preserve active replacement and never activate an inactive preset',
      async function() {

        for (const master of [false, true]) {
          const h = await createRuntimeHarness({pacMods: {warp: {enabled: master,
            useForProxyRules: master, useAsDirectReplacement: true}}});
          await h.callRpc('clearProxy');
          const before = await h.callRpc('getConfigurationStatus');
          const writes = h.counts.proxySettingsWrites;
          const result = await h.callRpc('applyPopupChanges', {operation: 'save',
            expectedRevision: before.savedRevision, tabUrl: 'https://example.test/',
            draft: {quickProxies: {warpEnabled: !master}}});
          Assert.equal(result.ok, true);
          const selected = h.getState().pacMods.warp;
          Assert.equal(selected.enabled, true);
          Assert.equal(selected.useForProxyRules, !master);
          Assert.equal(selected.useAsDirectReplacement, master);
          Assert.equal(h.counts.proxySettingsWrites, writes);
          Assert.equal((await h.callRpc('getConfigurationStatus')).active, false);
        }

      });

  it('warns and conservatively preserves only common mixed-entry WARP scopes', async function() {

    const h = await createRuntimeHarness();
    const portable = Firefox.fromSettings(FirefoxSettings.createDefaultSettings());
    const warp = portable.proxies.filter((value) => value.kind === 'warp');
    warp[0].enabled = true;
    warp[1].enabled = false;
    warp.forEach((value) => value.useAsDirectReplacement = true);
    const imported = h.context.mv3ConfigurationTransfer.toPatch(portable);
    const firefox = Firefox.toSettings(portable);
    Assert.equal(imported.unsupported.includes('warpScope'), true);
    Assert.equal(firefox.unsupported.includes('warpScope'), true);
    Assert.equal(imported.patch.pacMods.warp.enabled, true);
    Assert.equal(imported.patch.pacMods.warp.useForProxyRules, false);
    Assert.equal(imported.patch.pacMods.warp.useAsDirectReplacement, true);
    Assert.equal(firefox.settings.warp.useForProxyRules, false);
    Assert.equal(firefox.settings.warp.useAsDirectReplacement, true);

  });
});
