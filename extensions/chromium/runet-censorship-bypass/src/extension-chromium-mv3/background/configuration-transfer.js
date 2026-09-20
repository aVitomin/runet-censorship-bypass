'use strict';

(function(root, factory) {

  root.mv3ConfigurationTransfer = factory(root.rucbConfigurationTransfer, root.mv3PacMods);

})(self, function(Format, Mods) {

  const PROVIDERS = {anticensority: 'Антицензорити', antizapret: 'Антизапрет', manual: 'onlyOwnSites'};
  const type = (value) => value === 'PROXY' ? 'HTTP' : value;
  const chromiumType = (value) => value === 'HTTP' ? 'PROXY' : value;

  function fromState(state) {

    const mods = Mods.normalizePacMods(state.pacMods);
    const profile = (value, kind, index) => ({name: `${kind}-${index + 1}`, kind,
      type: type(value.type), host: value.host, port: value.port, enabled: value.enabled !== false,
      useForOnion: kind === 'localTor' || kind === 'torBrowser' ?
        value.enabled && value.useForOnion : false,
      useAsDirectReplacement: value.enabled !== false && value.useAsDirectReplacement === true,
      proxyDNS: null, timeoutSeconds: null,
      credentialsRequired: Boolean(value.username || value.password || value.credentialsRequired)});
    const proxies = mods.ownProxies.map((value, index) => profile(value, 'own', index));
    for (const kind of ['localTor', 'torBrowser']) proxies.push(profile(mods[kind], kind, 0));
    const warpProxies = Mods.normalizePacMods({ownProxies: mods.warp.proxyString}).ownProxies;
    warpProxies.forEach((value, index) => {
      proxies.push(profile(Object.assign({}, value, {enabled: mods.warp.enabled,
        useAsDirectReplacement: mods.warp.useAsDirectReplacement}), 'warp', index));
    });
    const selected = Object.keys(PROVIDERS).find((key) =>
      PROVIDERS[key] === state.currentPacProviderKey);
    // Custom PAC addresses may carry access tokens even in their path. Do not
    // export them or arbitrary labels/notes; the receiver explicitly chooses a source.
    const source = selected ? {kind: 'builtin', id: selected} :
      {kind: state.currentPacProviderKey ? 'omitted' : 'none'};
    const routes = mods.exceptions.map((rule) =>
      Format.fromPattern(rule.pattern, rule.action.toLowerCase(), rule.enabled));
    routes.push(...mods.rules.map((rule) =>
      Format.fromPattern(rule.pattern, rule.action.toLowerCase(), rule.enabled)));
    return Format.configuration({routes,
      allowlist: mods.whitelist.map((rule) => Format.fromPattern(rule.pattern, null, rule.enabled)),
      proxies, routing: {providerProxies: mods.usePacScriptProxies,
        proxyAuthentication: !state.proxyAuth || state.proxyAuth.enabled !== false,
        ownProxiesOnlyForOwnSites: mods.ownProxiesOnlyForOwnSites,
        replaceDirectWithProxy: mods.replaceDirectWithProxy, noDirect: mods.noDirect},
      source, ui: {language: ['ru', 'en'].includes(state.uiLanguage) ? state.uiLanguage : 'auto'}});

  }

  function toPatch(configuration) {

    const config = Format.configuration(configuration);
    const unsupported = [];
    const mods = Mods.normalizePacMods({});
    const endpoint = (value) => ({type: chromiumType(value.type),
      host: value.host, port: value.port});
    mods.ownProxies = config.proxies.filter((value) => value.kind === 'own').map((value) =>
      Object.assign(endpoint(value), {enabled: value.enabled, username: '', password: '',
        credentialsRequired: value.credentialsRequired,
        useAsDirectReplacement: value.useAsDirectReplacement}));
    for (const kind of ['localTor', 'torBrowser']) {
      const value = config.proxies.find((entry) => entry.kind === kind);
      mods[kind] = value ? Object.assign(endpoint(value), {enabled: value.enabled,
        useForOnion: value.useForOnion, useAsDirectReplacement: value.useAsDirectReplacement}) :
        Object.assign({}, mods[kind], {enabled: false});
      if (value && !value.enabled && (value.useForOnion || value.useAsDirectReplacement)) {
        unsupported.push('torScope');
      }
    }
    if (mods.localTor.enabled && mods.torBrowser.enabled) {
      // This target supports one enabled Tor mode. Require a user choice later.
      mods.localTor.enabled = false;
      mods.torBrowser.enabled = false;
      unsupported.push('torExclusive');
    }
    const warp = config.proxies.filter((value) => value.kind === 'warp');
    if (warp.length) {
      mods.warp = {enabled: warp.every((value) => value.enabled),
        useAsDirectReplacement: warp.every((value) => value.useAsDirectReplacement),
        proxyString: warp.map((value) => `${chromiumType(value.type)} ${value.host.includes(':') ?
          `[${value.host}]` : value.host}:${value.port}`).join('; ')};
      if (warp.some((value) => value.enabled !== mods.warp.enabled ||
          value.useAsDirectReplacement !== mods.warp.useAsDirectReplacement)) unsupported.push('warpScope');
    } else mods.warp.enabled = false;
    if (config.proxies.some((value) => value.proxyDNS !== null || value.timeoutSeconds !== null)) {
      unsupported.push('proxyOptions');
    }
    mods.rules = config.routes.filter((rule) => rule.mode !== 'auto').map((rule) =>
      ({pattern: Format.pattern(rule), action: rule.mode.toUpperCase(), enabled: rule.enabled}));
    mods.exceptions = [];
    mods.whitelist = config.allowlist.map((rule) =>
      ({pattern: Format.pattern(rule), enabled: rule.enabled}));
    Object.assign(mods, {usePacScriptProxies: config.routing.providerProxies,
      ownProxiesOnlyForOwnSites: config.routing.ownProxiesOnlyForOwnSites,
      replaceDirectWithProxy: config.routing.replaceDirectWithProxy,
      noDirect: config.routing.noDirect});
    let currentPacProviderKey = null;
    const customPacProviders = [];
    if (config.source.kind === 'builtin') currentPacProviderKey = PROVIDERS[config.source.id];
    else if (config.source.kind === 'custom') {
      currentPacProviderKey = 'custom:imported-source';
      customPacProviders.push({key: currentPacProviderKey, label: 'Imported source', description: '',
        urls: config.source.urls, order: 100, enabled: true});
    } else if (config.source.kind === 'omitted') unsupported.push('source');
    return {patch: Object.assign({pacMods: Mods.normalizePacMods(mods), currentPacProviderKey,
      proxyAuth: {enabled: config.routing.proxyAuthentication},
      customPacProviders}, config.ui ? {uiLanguage: config.ui.language} : {}), unsupported};

  }

  return Object.freeze({fromState, toPatch});

});
