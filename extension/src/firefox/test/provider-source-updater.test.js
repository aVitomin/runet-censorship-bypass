'use strict';

const Assert = require('node:assert/strict');
const Crypto = require('node:crypto');
const Source = require('../background/anticensority-source');
const Updater = require('../background/provider-source-updater');
const Generator = require('../../tooling/firefox-provider/generate-provider-dataset');

const sha256 = (bytes) => Crypto.createHash('sha256').update(bytes).digest('hex');

function pac(overrides = {}) {

  const inputs = Object.assign({IPS: {}, HOSTNAMES: {12: 'beta.example'},
    MASKED_SUBNETS: []}, overrides.inputs);
  return new TextEncoder().encode([
    '// Updated: 2026-09-08 00:00:00 +0000',
    `const CUSTOM_PROXIES = '${Source.EXPECTED_CUSTOM_PROXIES.join('; ')}';`,
    `const TOR_PROXIES = '${Source.EXPECTED_TOR_PROXIES.join('; ')}';`,
    `const inputs = ${JSON.stringify(inputs)};`,
    'const maskedAddrMaskAddrPairs = inputs.MASKED_SUBNETS;',
    overrides.tail || '',
  ].join('\n'));

}

function response(url, bytes = pac(), options = {}) {

  const chunks = options.chunks || [bytes];
  const headers = new Map(Object.entries(options.headers || {}));
  let offset = 0;
  const value = Object.assign({
    status: 200, redirected: false, url,
    headers: {get: (key) => headers.get(key) || null},
    body: {getReader() {

      return {
        async read() {

          return offset < chunks.length ? {done: false, value: chunks[offset++]} : {done: true};

        },
        async cancel() {
          value.cancelled = true;
        },
        releaseLock() {},
      };

    }},
  }, options);
  value.headers = {get: (key) => headers.get(key) || null};
  return value;

}

function createHarness(fetchImpl, options = {}) {

  const staged = [];
  const calls = [];
  const updater = Updater.createUpdater(Object.assign({
    sha256,
    store: {async stageHttpsCandidate(candidate) {

      staged.push(candidate);
      return {ok: true, status: 'STAGED'};

    }},
    fetchImpl: async (url, settings) => {
      calls.push({url, settings});
      return fetchImpl ? fetchImpl(url, settings) : response(url);
    },
  }, options));
  return {updater, calls, staged};

}

describe('Firefox fixed HTTPS provider source', function() {

  it('generates the same artifact as the pinned offline generator without evaluating PAC', async function() {

    const bytes = pac({tail: 'throw new Error("must never execute");'});
    const candidate = await Updater.createCandidate(bytes, sha256);
    const offline = await Generator.generateFromPacBytes({sourceBytes: bytes,
      sourceSha256: sha256(bytes), sourceRevision: 'a'.repeat(40),
      generatorRevision: 'b'.repeat(40), datasetVersion: 'fixture'});
    Assert.deepEqual(Buffer.from(candidate.artifactBytes), offline.artifactBytes);
    Assert.equal(candidate.envelope.artifactSha256, offline.envelope.artifactSha256);
    Assert.equal(candidate.source.sourceSha256, sha256(bytes));
    Assert.equal(candidate.source.sourceId, 'anticensority-pac');
    Assert.equal(candidate.source.updatedAt, '2026-09-08T00:00:00.000Z');
    Assert.deepEqual(candidate.envelope.sourceRevisions,
        [{sourceId: 'anticensority-pac', revision: `sha256=${sha256(bytes)}`}]);

  });

  it('fetches only the pinned HTTPS source with no ambient credentials or referrer', async function() {

    const h = createHarness();
    Assert.equal((await h.updater.fetchAndStage({url: 'https://untrusted.example/'})).status, 'STAGED');
    Assert.equal(h.staged.length, 1);
    Assert.equal(h.calls.length, 1);
    Assert.equal(h.calls[0].url, Updater.SOURCE_URLS[0]);
    Assert.equal(h.calls[0].settings.credentials, 'omit');
    Assert.equal(h.calls[0].settings.referrerPolicy, 'no-referrer');
    Assert.equal(h.calls[0].settings.redirect, 'manual');
    Assert.equal(h.calls[0].settings.cache, 'no-store');

  });

  it('uses the fixed fallback only after a transport or HTTP failure', async function() {

    for (const transport of [true, false]) {
      const h = createHarness((url) => {
        if (url === Updater.SOURCE_URLS[0]) {
          if (transport) throw new Error('untrusted network detail');
          return response(url, pac(), {status: 503});
        }
        return response(url);
      });
      Assert.equal((await h.updater.fetchAndStage()).status, 'STAGED');
      Assert.deepEqual(h.calls.map((call) => call.url), Updater.SOURCE_URLS);
    }

  });

  it('accepts redirects only between the two pinned addresses and validates the final URL', async function() {

    const redirected = Updater.SOURCE_URLS[1];
    const h = createHarness((url) => url === Updater.SOURCE_URLS[0] ?
      response(url, pac(), {status: 302, headers: {location: redirected}}) : response(url));
    Assert.equal((await h.updater.fetchAndStage()).status, 'STAGED');
    Assert.deepEqual(h.calls.map((call) => call.url), [Updater.SOURCE_URLS[0], redirected]);

  });

  it('rejects unsafe redirects and silently followed/falsified final URLs before staging', async function() {

    for (const target of ['http://anticensority.github.io/pac', 'https://evil.example/pac',
      'https://user:password@anticensority.github.io/pac', '/pac?private=value', '/pac#fragment',
      '/current.pac', 'https://raw.githubusercontent.com/another-owner/other/main/file.pac']) {
      const h = createHarness((url) => response(url, pac(),
          {status: 302, headers: {location: target}}));
      Assert.equal((await h.updater.fetchAndStage()).ok, false);
      Assert.equal(h.staged.length, 0);
      Assert.equal(h.calls.length, 1);
    }
    for (const changes of [{redirected: true}, {url: 'https://evil.example/pac'}, {url: ''},
      {url: 'https://anticensority.github.io/current.pac'}, {url: Updater.SOURCE_URLS[1]}]) {
      const h = createHarness((url) => response(url, pac(), changes));
      Assert.equal((await h.updater.fetchAndStage()).ok, false);
      Assert.equal(h.staged.length, 0);
    }

  });

  it('bounds redirect loops, declared bytes and streamed bytes', async function() {

    const loop = createHarness((url) => response(url, pac(),
        {status: 302, headers: {location: url}}));
    Assert.equal((await loop.updater.fetchAndStage()).code, 'SOURCE_REDIRECT_LIMIT');
    Assert.equal(loop.calls.length, 4);
    for (const length of [String(Source.MAX_SOURCE_BYTES + 1), '-1', 'bogus']) {
      const h = createHarness((url) => response(url, pac(), {headers: {'content-length': length}}));
      Assert.equal((await h.updater.fetchAndStage()).code, 'INVALID_SOURCE_SIZE');
      Assert.equal(h.staged.length, 0);
    }
    let streamed;
    const overflow = createHarness((url) => {
      streamed = response(url, pac(),
          {chunks: [new Uint8Array(Source.MAX_SOURCE_BYTES), new Uint8Array(1)]});
      return streamed;
    });
    Assert.equal((await overflow.updater.fetchAndStage()).code, 'INVALID_SOURCE_SIZE');
    Assert.equal(streamed.cancelled, true);
    Assert.equal(overflow.staged.length, 0);

  });

  it('rejects malformed data and changed policy without falling back or running code', async function() {

    const original = new TextDecoder().decode(pac());
    const invalid = [
      new Uint8Array(), new Uint8Array([0xff]),
      pac({inputs: {IPS: {'127.0.0.1': true}}}),
      pac({inputs: {MASKED_SUBNETS: ['127.0.0.0/8']}}),
      pac({inputs: {HOSTNAMES: {12: 'bad'}}}),
      new TextEncoder().encode(original.replace('SOCKS localhost:18619', 'SOCKS attacker.example:1080')),
      new TextEncoder().encode(original + '\nconst inputs = {};'),
      new TextEncoder().encode(original + '\n// Updated: 2026-09-09 00:00:00 +0000'),
      new TextEncoder().encode(original.replace('"beta.example"', '(globalThis.executed = true)')),
    ];
    for (const bytes of invalid) {
      const h = createHarness((url) => response(url, bytes));
      Assert.equal((await h.updater.fetchAndStage()).ok, false);
      Assert.equal(h.calls.length, 1);
      Assert.equal(h.staged.length, 0);
    }

  });

  it('requires unambiguous real calendar dates and bounds future source timestamps before storage',
      async function() {

        const original = new TextDecoder().decode(pac());
        const withDate = (date) => new TextEncoder().encode(original.replace(
            '2026-09-08 00:00:00 +0000', date));
        for (const date of ['2026-09-08 00:00:00', '2026-02-30 00:00:00 +0000',
          '2026-09-08 24:00:00 +0000', '2026-09-08 00:00:00 +1460',
          '09/08/2026', '2026-09-08T00:00:00Z']) {
          const h = createHarness((url) => response(url, withDate(date)));
          Assert.equal((await h.updater.fetchAndStage()).code, 'PROVIDER_TIMESTAMP_INVALID', date);
          Assert.equal(h.staged.length, 0);
        }
        const shifted = await Updater.createCandidate(withDate('2026-09-08 03:30:00 +0330'), sha256);
        Assert.equal(shifted.source.updatedAt, '2026-09-08T00:00:00.000Z');
        const now = () => Date.parse('2026-09-07T00:00:00.000Z');
        const allowed = createHarness(null, {now});
        Assert.equal((await allowed.updater.fetchAndStage()).status, 'STAGED');
        const future = createHarness((url) => response(url,
            withDate('2026-09-08 00:00:01 +0000')), {now});
        Assert.equal((await future.updater.fetchAndStage()).code, 'PROVIDER_TIMESTAMP_FUTURE');
        Assert.equal(future.staged.length, 0);
        Assert.equal(future.calls.length, 1);

      });

  it('never stages a late fetch after the total deadline', async function() {

    let release;
    const h = createHarness((url) => new Promise((resolve) => {
      release = () => resolve(response(url));
    }), {deadlineMs: 10});
    Assert.equal((await h.updater.fetchAndStage()).code, 'SOURCE_TIMEOUT');
    Assert.equal(h.calls[0].settings.signal.aborted, true);
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    Assert.equal(h.staged.length, 0);

  });

  it('bounds a stalled stream and hides network/storage exception details', async function() {

    const stalled = createHarness((url) => response(url, pac(), {body: {getReader() {

      return {read: () => new Promise(() => undefined), cancel: async () => undefined};

    }}}), {deadlineMs: 10});
    Assert.equal((await stalled.updater.fetchAndStage()).code, 'SOURCE_TIMEOUT');
    Assert.equal(stalled.staged.length, 0);
    const network = createHarness(() => {
      throw new Error('private network detail');
    });
    Assert.deepEqual(await network.updater.fetchAndStage(),
        {ok: false, status: 'REJECTED', code: 'SOURCE_FETCH_FAILED'});
    const storage = createHarness(null, {store: {stageHttpsCandidate() {
      throw new Error('private storage detail');
    }}});
    Assert.deepEqual(await storage.updater.fetchAndStage(),
        {ok: false, status: 'REJECTED', code: 'SOURCE_STORAGE_FAILED'});

  });

});
