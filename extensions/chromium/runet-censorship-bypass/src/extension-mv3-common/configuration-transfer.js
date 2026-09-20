'use strict';

(function(root, factory) {

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.rucbConfigurationTransfer = api;

})(typeof globalThis === 'object' ? globalThis : this, function() {

  const MAX_BYTES = 1024 * 1024;
  const MAX_RULES = 5000;
  const MAX_PROXIES = 64;
  const CATEGORIES = ['siteRules', 'proxyConnections', 'routingSettings'];
  const fail = (code = 'TRANSFER_INVALID') => {
    const error = new TypeError(code);
    error.code = code;
    throw error;
  };
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, required, optional = []) => {
    if (!object(value) || required.some((key) => !Object.hasOwn(value, key)) ||
        Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) fail();
  };
  const string = (value, max = 256) => {
    if (typeof value !== 'string' || !value.length || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail();
    return value;
  };
  const choice = (value, values) => { if (!values.includes(value)) fail(); return value; };
  const bool = (value) => { if (typeof value !== 'boolean') fail(); return value; };
  const array = (value, max) => { if (!Array.isArray(value) || value.length > max) fail(); return value; };

  function inspectTree(root) {

    const stack = [[root, 0]];
    let count = 0;
    while (stack.length) {
      const [value, depth] = stack.pop();
      if (++count > 80000 || depth > 12) fail('TRANSFER_LIMIT');
      if (typeof value === 'string' && value.length > 4096) fail('TRANSFER_LIMIT');
      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
          if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
          stack.push([value[key], depth + 1]);
        }
      }
    }

  }

  function host(value) {

    const text = string(value, 253).trim().toLowerCase().replace(/\.$/, '');
    if (!text || /[\s/@?#\\%]/.test(text)) fail();
    try {
      if (text.includes(':')) {
        const parsed = new URL(`http://[${text.replace(/^\[|\]$/g, '')}]/`);
        return parsed.hostname.replace(/^\[|\]$/g, '');
      }
      const normalized = new URL(`http://${text}/`).hostname;
      if (!normalized || normalized.split('.').some((label) =>
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) fail();
      return normalized;
    } catch (_error) {
      return fail();
    }

  }

  function target(value, route = false) {

    keys(value, route ? ['host', 'scope', 'mode', 'enabled'] : ['host', 'scope', 'enabled']);
    const scope = choice(value.scope, ['host', 'domain', 'pattern']);
    let name;
    if (scope === 'pattern') {
      const raw = string(value.host, 255);
      if (raw === '*') name = '*';
      else if (raw.startsWith('*') && !raw.slice(1).includes('*')) {
        name = `*${host(raw.slice(1))}`;
      } else fail();
    } else {
      name = host(value.host);
      if (scope === 'domain' && name.includes(':')) fail();
    }
    return Object.assign({host: name, scope, enabled: bool(value.enabled)},
        route ? {mode: choice(value.mode, ['auto', 'proxy', 'direct'])} : {});

  }

  function proxy(value) {

    keys(value, ['name', 'kind', 'type', 'host', 'port', 'enabled', 'useForOnion',
      'useAsDirectReplacement', 'proxyDNS', 'timeoutSeconds', 'credentialsRequired']);
    if (!Number.isSafeInteger(value.port) || value.port < 1 || value.port > 65535 ||
        (value.proxyDNS !== null && typeof value.proxyDNS !== 'boolean') ||
        (value.timeoutSeconds !== null && (!Number.isSafeInteger(value.timeoutSeconds) ||
          value.timeoutSeconds < 1 || value.timeoutSeconds > 3600))) fail();
    const kind = choice(value.kind, ['own', 'localTor', 'torBrowser', 'warp']);
    if (kind !== 'own' && value.credentialsRequired) fail();
    if (['own', 'warp'].includes(kind) && value.useForOnion) fail();
    return {name: string(value.name, 80), kind,
      type: choice(value.type, ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5']),
      host: host(value.host), port: value.port, enabled: bool(value.enabled),
      useForOnion: bool(value.useForOnion), useAsDirectReplacement: bool(value.useAsDirectReplacement),
      proxyDNS: value.proxyDNS, timeoutSeconds: value.timeoutSeconds,
      credentialsRequired: bool(value.credentialsRequired)};

  }

  function source(value) {

    if (!object(value)) fail();
    if (value.kind === 'builtin') {
      keys(value, ['kind', 'id']);
      return {kind: 'builtin', id: choice(value.id, ['anticensority', 'antizapret', 'manual'])};
    }
    if (value.kind === 'custom') {
      keys(value, ['kind', 'urls']);
      const urls = array(value.urls, 10).map((text) => {
        string(text, 2048);
        let url;
        try { url = new URL(text); } catch (_error) { fail(); }
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (!(url.protocol === 'https:' || url.protocol === 'http:' && loopback) ||
            url.username || url.password || url.search || url.hash) fail();
        return url.href;
      });
      if (!urls.length) fail();
      return {kind: 'custom', urls};
    }
    keys(value, ['kind']);
    return {kind: choice(value.kind, ['none', 'omitted'])};

  }

  function configuration(value) {

    keys(value, ['routes', 'allowlist', 'proxies', 'routing', 'source'], ['ui']);
    const routes = array(value.routes, MAX_RULES).map((entry) => target(entry, true));
    const allowlist = array(value.allowlist, MAX_RULES).map((entry) => target(entry));
    const proxies = array(value.proxies, MAX_PROXIES).map(proxy);
    if (new Set(proxies.map((entry) => entry.name)).size !== proxies.length ||
        ['localTor', 'torBrowser'].some((kind) => proxies.filter((entry) => entry.kind === kind).length > 1)) fail();
    keys(value.routing, ['providerProxies', 'ownProxiesOnlyForOwnSites', 'replaceDirectWithProxy',
      'noDirect', 'proxyAuthentication']);
    const routing = Object.fromEntries(Object.keys(value.routing).map((key) => [key, bool(value.routing[key])]));
    let ui;
    if (value.ui !== undefined) {
      keys(value.ui, ['language']);
      ui = {language: choice(value.ui.language, ['auto', 'ru', 'en'])};
    }
    return Object.assign({routes, allowlist, proxies, routing, source: source(value.source)}, ui ? {ui} : {});

  }

  function validate(value) {

    inspectTree(value);
    if (!object(value) || !Number.isSafeInteger(value.schemaVersion)) fail();
    if (value.schemaVersion !== 1) fail('TRANSFER_VERSION');
    keys(value, ['schemaVersion', 'metadata', 'configuration', 'credentials', 'diagnostics']);
    keys(value.metadata, ['exportedAt', 'browser', 'extensionVersion', 'locale', 'platform']);
    keys(value.metadata.browser, ['family', 'version']);
    choice(value.metadata.browser.family, ['chromium', 'firefox']);
    for (const item of [value.metadata.exportedAt, value.metadata.browser.version,
      value.metadata.extensionVersion, value.metadata.locale, value.metadata.platform]) string(item, 80);
    if (!Number.isFinite(Date.parse(value.metadata.exportedAt))) fail();
    const config = value.configuration === null ? null : configuration(value.configuration);
    keys(value.credentials, ['included', 'missing']);
    if (value.credentials.included !== false) fail();
    array(value.credentials.missing, MAX_PROXIES).forEach((item) => string(item, 80));
    const missing = config ? config.proxies.filter((entry) => entry.credentialsRequired).map((entry) => entry.name) : [];
    if (JSON.stringify(value.credentials.missing) !== JSON.stringify(missing)) fail();
    // Diagnostics are schema-checked but NEVER consulted when building settings.
    if (value.diagnostics !== null) {
      keys(value.diagnostics, ['active', 'pending', 'pendingCategories', 'sourceAvailable']);
      bool(value.diagnostics.active); bool(value.diagnostics.pending); bool(value.diagnostics.sourceAvailable);
      array(value.diagnostics.pendingCategories, 3).forEach((item) => choice(item, CATEGORIES));
    }
    return {schemaVersion: 1, metadata: value.metadata, configuration: config,
      credentials: {included: false, missing}, diagnostics: value.diagnostics};

  }

  function parse(text) {

    if (typeof text !== 'string') fail();
    if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) fail('TRANSFER_LIMIT');
    let parsed;
    try { parsed = JSON.parse(text); } catch (_error) { fail(); }
    return validate(parsed);

  }

  function create(config, metadata, status = null) {

    const diagnostics = status ? {active: status.active === true, pending: status.pending === true,
      pendingCategories: (status.pendingCategories || []).filter((item) => CATEGORIES.includes(item)),
      sourceAvailable: status.sourceAvailable === true} : null;
    const result = validate({schemaVersion: 1, metadata, configuration: config,
      credentials: {included: false,
        missing: config ? config.proxies.filter((entry) => entry.credentialsRequired).map((entry) => entry.name) : []},
      diagnostics});
    if (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > MAX_BYTES) fail('TRANSFER_LIMIT');
    return result;

  }

  function preview(before, after, unsupported = []) {

    const changed = (left, right) => JSON.stringify(left) !== JSON.stringify(right);
    const oldRules = [...before.routes, ...before.allowlist.map((rule) => ({...rule, mode: 'allowlist'}))];
    const newRules = [...after.routes, ...after.allowlist.map((rule) => ({...rule, mode: 'allowlist'}))];
    const counts = new Map();
    for (const rule of oldRules) {
      const key = JSON.stringify(rule);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let added = 0;
    for (const rule of newRules) {
      const key = JSON.stringify(rule);
      if (counts.get(key)) counts.set(key, counts.get(key) - 1);
      else added++;
    }
    return {rules: newRules.length,
      rulesChanged: added + [...counts.values()].reduce((sum, value) => sum + value, 0),
      proxies: after.proxies.length, proxiesChanged: changed(before.proxies, after.proxies),
      routingChanged: changed([before.routing, before.source], [after.routing, after.source]),
      missing: after.proxies.filter((entry) => entry.credentialsRequired).length,
      unsupported: [...new Set(unsupported)]};

  }

  function pattern(entry) {

    return entry.scope === 'domain' ? `*.${entry.host}` : entry.host;

  }

  function fromPattern(value, mode, enabled = true) {

    return Object.assign({host: value.startsWith('*.') ? value.slice(2) : value,
      scope: value.startsWith('*.') ? 'domain' : value.includes('*') ? 'pattern' : 'host', enabled},
        mode ? {mode} : {});

  }

  return Object.freeze({MAX_BYTES, MAX_RULES, MAX_PROXIES, parse, validate, create,
    configuration, preview, pattern, fromPattern, fail});

});
