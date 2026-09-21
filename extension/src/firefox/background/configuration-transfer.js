'use strict';
/* global require */

(function(root, factory) {

  const api = typeof module === 'object' && module.exports ?
    factory(require('../../shared/configuration-transfer'), require('./settings-control')) :
    factory(root.rucbConfigurationTransfer, root.rucbFirefoxSettingsControl);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.rucbFirefoxConfigurationTransfer = api;

})(typeof globalThis === 'object' ? globalThis : this, function(Format, Settings) {

  function fromSettings(settings) {

    const profile = (value, kind, index) => ({name: `${kind}-${index + 1}`, kind,
      type: value.type, host: value.host, port: value.port,
      enabled: kind === 'own' ? value.enabled : value.useForProxyRules,
      useForOnion: value.useForOnion === true, useAsDirectReplacement: value.useAsDirectReplacement,
      proxyDNS: value.proxyDNS, timeoutSeconds: value.failoverTimeoutSeconds,
      credentialsRequired: Boolean(value.credentials && value.credentials.mode !== 'NONE')});
    const proxies = settings.ownProxies.map((value, index) => profile(value, 'own', index));
    for (const kind of ['localTor', 'torBrowser']) proxies.push(profile(settings[kind], kind, 0));
    settings.warp.candidates.forEach((value, index) => proxies.push(profile(
        Object.assign({}, value, {useForProxyRules: settings.warp.useForProxyRules,
          useAsDirectReplacement: settings.warp.useAsDirectReplacement}), 'warp', index)));
    const routes = settings.rules.direct.map((rule) => Format.fromPattern(rule, 'direct'));
    routes.push(...settings.rules.proxy.map((rule) => Format.fromPattern(rule, 'proxy')));
    return Format.configuration({routes,
      allowlist: settings.rules.whitelist.map((rule) => Format.fromPattern(rule)), proxies,
      routing: {providerProxies: settings.flags.useProviderProxies, proxyAuthentication: true,
        ownProxiesOnlyForOwnSites: settings.flags.ownProxiesOnlyForOwnSites,
        replaceDirectWithProxy: settings.flags.replaceDirectWithProxy,
        noDirect: settings.flags.noDirect},
      source: {kind: 'builtin', id: 'anticensority'}});

  }

  function toSettings(configuration) {

    const config = Format.configuration(configuration);
    const settings = Settings.createDefaultSettings();
    const unsupported = [];
    const endpoint = (value) => ({type: value.type, host: value.host, port: value.port,
      proxyDNS: value.proxyDNS === null ? value.type === 'SOCKS5' : value.proxyDNS,
      failoverTimeoutSeconds: value.timeoutSeconds});
    settings.ownProxies = config.proxies.filter((value) => value.kind === 'own').map((value, index) =>
      Object.assign(endpoint(value), {id: `import-own-${index + 1}`, enabled: value.enabled,
        useAsDirectReplacement: value.useAsDirectReplacement,
        credentials: {mode: value.credentialsRequired ? 'MISSING' : 'NONE'}}));
    for (const kind of ['localTor', 'torBrowser']) {
      const value = config.proxies.find((entry) => entry.kind === kind);
      settings[kind] = value ? Object.assign(endpoint(value), {useForProxyRules: value.enabled,
        useForOnion: value.useForOnion, useAsDirectReplacement: value.useAsDirectReplacement}) :
        Object.assign({}, settings[kind], {useForProxyRules: false, useForOnion: false,
          useAsDirectReplacement: false});
    }
    const warp = config.proxies.filter((value) => value.kind === 'warp');
    settings.warp = {candidates: warp.map((value, index) =>
      Object.assign({id: `import-warp-${index + 1}`}, endpoint(value))),
    useForProxyRules: warp.length > 0 && warp.every((value) => value.enabled),
    useAsDirectReplacement: warp.length > 0 && warp.every((value) => value.useAsDirectReplacement)};
    if (warp.some((value) => value.enabled !== settings.warp.useForProxyRules ||
        value.useAsDirectReplacement !== settings.warp.useAsDirectReplacement)) unsupported.push('warpScope');
    settings.rules = {direct: [], proxy: [], whitelist: []};
    for (const rule of config.routes) {
      if (!rule.enabled) unsupported.push('disabledRules');
      else if (rule.mode !== 'auto') settings.rules[rule.mode].push(Format.pattern(rule));
    }
    for (const rule of config.allowlist) {
      if (!rule.enabled) unsupported.push('disabledRules');
      else settings.rules.whitelist.push(Format.pattern(rule));
    }
    settings.flags = {useProviderProxies: config.routing.providerProxies,
      ownProxiesOnlyForOwnSites: config.routing.ownProxiesOnlyForOwnSites,
      replaceDirectWithProxy: config.routing.replaceDirectWithProxy,
      noDirect: config.routing.noDirect};
    if (config.source.kind !== 'builtin' || config.source.id !== 'anticensority') {
      unsupported.push('source');
    }
    if (config.ui) unsupported.push('language');
    if (!config.routing.proxyAuthentication) unsupported.push('authentication');
    return {settings: Settings.canonicalSettings(settings), unsupported};

  }

  return Object.freeze({fromSettings, toSettings});

});
