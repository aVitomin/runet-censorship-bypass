'use strict';
/* global require */

(function publishAnticensoritySource(root, factory) {

  const dataset = typeof module === 'object' && module.exports ?
    require('../../shared/provider-dataset') : root.mv3ProviderDataset;
  const api = factory(dataset);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.rucbFirefoxAnticensoritySource = api;

})(typeof globalThis === 'object' ? globalThis : this, function(Dataset) {

  const MAX_SOURCE_BYTES = Dataset.LIMITS.MAX_ARTIFACT_BYTES;
  const EXPECTED_INPUT_FIELDS = Object.freeze([
    'HOSTNAMES',
    'IPS',
    'MASKED_SUBNETS',
  ]);
  const INPUT_PREFIX = 'const inputs = ';
  const INPUT_SUFFIX = ';\nconst maskedAddrMaskAddrPairs';
  const CRLF_INPUT_SUFFIX = ';\r\nconst maskedAddrMaskAddrPairs';
  const EXPECTED_CUSTOM_PROXIES = Object.freeze([
    'HTTPS localhost:18611',
    'PROXY localhost:18613',
    'SOCKS5 localhost:18615',
    'SOCKS4 localhost:18617',
    'SOCKS localhost:18619',
  ]);
  const EXPECTED_TOR_PROXIES = Object.freeze([
    'SOCKS5 localhost:9150',
    'SOCKS5 localhost:9050',
  ]);

  function toolingError(code) {

    const error = new TypeError(code);
    error.code = code;
    return error;

  }

  function strictUtf8(bytes) {

    try {
      return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    } catch (_error) {
      throw toolingError('INVALID_SOURCE_UTF8');
    }

  }

  function exactKeys(value, keys) {

    return Boolean(value) && typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype &&
      !Array.isArray(value) && Object.keys(value).length === keys.length &&
      Object.keys(value).every((key) => keys.includes(key));

  }

  function isPlainObject(value) {

    return Boolean(value) && typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype;

  }

  function extractQuotedProxyList(source, constantName) {

    const prefix = `const ${constantName} = '`;
    const start = source.indexOf(prefix);
    if (start < 0 || source.indexOf(prefix, start + prefix.length) >= 0) {
      throw toolingError('PROVIDER_PROXY_POLICY_MISSING');
    }
    const end = source.indexOf('\';', start + prefix.length);
    if (end < 0) {
      throw toolingError('PROVIDER_PROXY_POLICY_MALFORMED');
    }
    return source.slice(start + prefix.length, end).split('; ');

  }

  function extractPacData(sourceBytes) {

    if (!(sourceBytes instanceof Uint8Array) || !sourceBytes.byteLength ||
        sourceBytes.byteLength > MAX_SOURCE_BYTES) {
      throw toolingError('INVALID_SOURCE_SIZE');
    }
    const source = strictUtf8(sourceBytes);
    const start = source.indexOf(INPUT_PREFIX);
    if (start < 0 || source.indexOf(INPUT_PREFIX, start + INPUT_PREFIX.length) >= 0) {
      throw toolingError('PROVIDER_INPUTS_MISSING');
    }
    const jsonStart = start + INPUT_PREFIX.length;
    let end = source.indexOf(INPUT_SUFFIX, jsonStart);
    if (end < 0) {
      end = source.indexOf(CRLF_INPUT_SUFFIX, jsonStart);
    }
    if (end < 0) {
      throw toolingError('PROVIDER_INPUTS_MALFORMED');
    }
    let inputs;
    try {
      inputs = JSON.parse(source.slice(jsonStart, end));
    } catch (_error) {
      throw toolingError('PROVIDER_INPUTS_MALFORMED');
    }
    if (!exactKeys(inputs, EXPECTED_INPUT_FIELDS) ||
        !isPlainObject(inputs.HOSTNAMES) ||
        !isPlainObject(inputs.IPS) ||
        !Array.isArray(inputs.MASKED_SUBNETS)) {
      throw toolingError('PROVIDER_INPUTS_MALFORMED');
    }
    if (Object.keys(inputs.IPS).length || inputs.MASKED_SUBNETS.length) {
      throw toolingError('UNSUPPORTED_NON_HOST_RULES');
    }
    const customProxies = extractQuotedProxyList(source, 'CUSTOM_PROXIES');
    const torProxies = extractQuotedProxyList(source, 'TOR_PROXIES');
    if (JSON.stringify(customProxies) !==
          JSON.stringify(EXPECTED_CUSTOM_PROXIES) ||
        JSON.stringify(torProxies) !== JSON.stringify(EXPECTED_TOR_PROXIES)) {
      throw toolingError('PROVIDER_PROXY_POLICY_CHANGED');
    }
    const updates = [...source.matchAll(/^\/\/ Updated: (.+)$/gm)];
    const updated = updates[0];
    if (updates.length !== 1) {
      throw toolingError('PROVIDER_TIMESTAMP_MISSING');
    }
    return Object.freeze({
      inputs,
      policy: Object.freeze({customProxies, torProxies}),
      updatedAt: parseSourceTimestamp(updated[1]),
    });

  }

  function parseSourceTimestamp(value) {

    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})\r?$/.exec(value);
    if (!match || Number(match[4]) > 14 || Number(match[5]) > 59 ||
        Number(match[4]) === 14 && Number(match[5]) !== 0) {
      throw toolingError('PROVIDER_TIMESTAMP_INVALID');
    }
    const local = `${match[1]}T${match[2]}.000Z`;
    const localTime = Date.parse(local);
    // Date.parse normalizes invalid dates such as February 30 and 24:00:00.
    if (!Number.isFinite(localTime) || new Date(localTime).toISOString() !== local) {
      throw toolingError('PROVIDER_TIMESTAMP_INVALID');
    }
    const offset = (Number(match[4]) * 60 + Number(match[5])) * 60000;
    const timestamp = localTime - (match[3] === '+' ? offset : -offset);
    if (timestamp <= 0) throw toolingError('PROVIDER_TIMESTAMP_INVALID');
    return new Date(timestamp).toISOString();

  }

  function createPayload(inputs) {

    const widths = Object.keys(inputs.HOSTNAMES).map(Number);
    if (!widths.length || widths.some((width) =>
      !Number.isSafeInteger(width) || width < 1)) {
      throw toolingError('PROVIDER_HOST_BUCKETS_MALFORMED');
    }
    widths.sort((left, right) => left - right);
    return {
      format: Dataset.PAYLOAD_FORMAT,
      buckets: widths.map((width) => ({
        width,
        routeRef: 'PROVIDER_PROXY',
        hosts: inputs.HOSTNAMES[String(width)],
      })),
    };

  }

  function countRules(payload) {

    return payload.buckets.reduce((count, bucket) => {
      if (typeof bucket.hosts !== 'string' ||
          bucket.hosts.length % bucket.width !== 0) {
        throw toolingError('PROVIDER_HOST_BUCKETS_MALFORMED');
      }
      return count + bucket.hosts.length / bucket.width;
    }, 0);

  }

  return Object.freeze({
    EXPECTED_CUSTOM_PROXIES, EXPECTED_TOR_PROXIES, MAX_SOURCE_BYTES,
    countRules, createPayload, extractPacData,
  });

});
