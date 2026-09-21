'use strict';

const Assert = require('node:assert');
const Control = require('../background/provider-update-control');

const PROVIDER_KEY = 'anticensority';
const MANIFEST_URL =
  'https://updates.example/provider/anticensority.manifest.json';
const KEY_A = '11'.repeat(32);
const KEY_B = '22'.repeat(32);

function identity(version, hashCharacter) {

  return Object.freeze({
    providerKey: PROVIDER_KEY,
    datasetVersion: version,
    artifactSha256: hashCharacter.repeat(64),
  });

}

function trust(overrides = {}) {

  return Object.assign({
    enabled: true,
    manifestUrl: MANIFEST_URL,
    providerKey: PROVIDER_KEY,
    trustedPublicKeys: {'release-2026': KEY_A},
  }, overrides);

}

function storage(initial = {}) {

  const values = Object.assign({}, initial);
  const writes = [];
  return {
    values,
    writes,
    area: {
      async get(key) {

        return Object.prototype.hasOwnProperty.call(values, key) ?
          {[key]: values[key]} : {};

      },
      async set(update) {

        writes.push(update);
        Object.assign(values, update);

      },
    },
  };

}

function deferred() {

  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};

}

function fixture(options = {}) {

  const persisted = storage(options.storage);
  let current = options.current || identity('v1', 'a');
  let staged = options.staged || null;
  const updaterInputs = [];
  let fetches = 0;
  const alarmValues = new Map(options.alarm ? [
    [Control.ALARM_NAME, options.alarm],
  ] : []);
  const alarmCalls = [];
  const updateResult = options.updateResult || {ok: true, status: 'STAGED'};
  const controller = Control.createController({
    storageArea: persisted.area,
    datasetStore: {
      async loadStaged() {

        if (!staged) {
          return {ok: true, status: 'EMPTY', verification: null};
        }
        return {
          ok: true,
          status: 'STAGED',
          verification: {ok: true, dataset: {identity: staged}},
        };

      },
      async stageAuthenticatedCandidate() {

        throw new Error('TEST_UPDATER_OWNS_STAGING');

      },
    },
    alarmsApi: {
      async clear(name) {

        alarmCalls.push({kind: 'clear', name});
        return alarmValues.delete(name);

      },
      async create(name, details) {

        alarmCalls.push({details, kind: 'create', name});
        alarmValues.set(name, Object.assign({name}, details));

      },
      async get(name) {

        return alarmValues.get(name) || null;

      },
    },
    AbortController,
    cryptoSubtle: {},
    fetchImpl() {},
    now: options.now || (() => 1000),
    providerKey: PROVIDER_KEY,
    readCurrentDatasetIdentity: async () => current,
    sha256: async () => '0'.repeat(64),
    trustConfiguration: options.trust || trust(),
    createUpdater(input) {

      updaterInputs.push(input);
      return {
        async fetchAndStage(request) {

          fetches += 1;
          if (options.updateGate) {
            await options.updateGate;
          }
          if (updateResult.ok === true && updateResult.status === 'STAGED') {
            staged = options.next || identity('v2', 'b');
          }
          return Object.assign({}, updateResult, {request});

        },
      };

    },
  });
  return {
    alarmCalls,
    alarmValues,
    controller,
    persisted,
    setCurrent(value) {

      current = value;

    },
    setStaged(value) {

      staged = value;

    },
    updaterInputs,
    get fetches() {

      return fetches;

    },
  };

}

describe('Firefox production provider update control', function() {

  it('accepts only fixed HTTPS trust tables with exact raw Ed25519 keys',
      function() {

        const inspected = Control.inspectTrustConfiguration(trust({
          trustedPublicKeys: {
            'release-2026': KEY_A,
            'release-rotation': KEY_B,
          },
        }), PROVIDER_KEY);
        Assert.strictEqual(inspected.configured, true);
        Assert.strictEqual(inspected.manifestUrl, MANIFEST_URL);
        Assert.deepStrictEqual(
            [...inspected.trustedPublicKeys.keys()],
            ['release-2026', 'release-rotation'],
        );
        Assert.strictEqual(
            inspected.trustedPublicKeys.get('release-2026').byteLength,
            32,
        );

        for (const invalid of [
          trust({manifestUrl: 'http://updates.example/manifest.json'}),
          trust({manifestUrl: `${MANIFEST_URL}?key=remote`}),
          trust({providerKey: 'other'}),
          trust({trustedPublicKeys: {'release-2026': '11'}}),
          Object.assign(trust(), {remoteKey: KEY_B}),
        ]) {
          Assert.strictEqual(
              Control.inspectTrustConfiguration(invalid, PROVIDER_KEY)
                  .configured,
              false,
          );
        }

      });

  it('keeps missing production trust inert and performs no fetch',
      async function() {

        const test = fixture({
          alarm: {name: Control.ALARM_NAME, periodInMinutes: 1},
          trust: {
            enabled: false,
            manifestUrl: null,
            providerKey: PROVIDER_KEY,
            trustedPublicKeys: {},
          },
        });
        const initialized = await test.controller.initialize();
        Assert.strictEqual(initialized.status, 'NOT_CONFIGURED');
        Assert.strictEqual(initialized.automaticChecksEnabled, false);
        Assert.strictEqual(test.alarmValues.has(Control.ALARM_NAME), false);
        Assert.deepStrictEqual(await test.controller.check(), {
          ok: false, code: Control.ERRORS.TRUST_NOT_CONFIGURED,
        });
        Assert.strictEqual(test.fetches, 0);

      });

  it('schedules authenticated staging every twelve hours', async function() {

    const test = fixture();
    await test.controller.initialize();
    Assert.deepStrictEqual(test.alarmCalls, [{
      kind: 'create',
      name: Control.ALARM_NAME,
      details: {
        delayInMinutes: Control.STARTUP_DELAY_MINUTES,
        periodInMinutes: 12 * 60,
      },
    }]);
    Assert.strictEqual(
        test.updaterInputs.length,
        0,
        'initialization must schedule without fetching',
    );

  });

  it('stages a newer candidate without changing the current dataset',
      async function() {

        const test = fixture();
        await test.controller.initialize();
        Assert.deepStrictEqual(await test.controller.check(), {
          ok: true, status: 'STAGED',
        });
        const status = await test.controller.publicStatus();
        Assert.strictEqual(status.status, 'UPDATE_AVAILABLE');
        Assert.strictEqual(status.currentDatasetVersion, 'v1');
        Assert.strictEqual(status.stagedDatasetVersion, 'v2');
        Assert.strictEqual(status.updateAvailable, true);
        Assert.strictEqual(test.fetches, 1);
        Assert.strictEqual(test.updaterInputs[0].trustedPublicKeys.size, 1);
        Assert.strictEqual(
            JSON.stringify(status).includes('updates.example'),
            false,
        );
        Assert.strictEqual(JSON.stringify(status).includes('bbbb'), false);

      });

  it('treats same-sequence replay as unchanged', async function() {

    const test = fixture({updateResult: {ok: true, status: 'UNCHANGED'}});
    await test.controller.initialize();
    Assert.deepStrictEqual(await test.controller.check(), {
      ok: true, status: 'UNCHANGED',
    });
    const status = await test.controller.publicStatus();
    Assert.strictEqual(status.status, 'UP_TO_DATE');
    Assert.strictEqual(status.updateAvailable, false);

  });

  it('maps updater failures to fixed non-secret categories', async function() {

    const cases = [
      ['INVALID_UPDATE_SIGNATURE', 'AUTHENTICATION_FAILED'],
      ['UPDATE_TIMEOUT', 'NETWORK_FAILED'],
      ['ARTIFACT_SHA256_MISMATCH', 'DATASET_REJECTED'],
      ['ROLLBACK_REJECTED', 'ROLLBACK_REJECTED'],
      ['SEQUENCE_CONFLICT', 'SEQUENCE_CONFLICT'],
      ['STAGED_POINTER_CORRUPT', 'STORAGE_FAILED'],
      ['unknown secret-bearing failure', 'UPDATE_REJECTED'],
    ];
    for (const [code, category] of cases) {
      const test = fixture({updateResult: {ok: false, code}});
      await test.controller.initialize();
      Assert.deepStrictEqual(await test.controller.check(), {
        ok: false, code: Control.ERRORS.UPDATE_FAILED,
      });
      const status = await test.controller.publicStatus();
      Assert.strictEqual(status.status, 'CHECK_FAILED');
      Assert.strictEqual(status.errorCategory, category);
      if (code !== category) {
        Assert.strictEqual(JSON.stringify(status).includes(code), false);
      }
    }

  });

  it('coalesces duplicate checks into one authenticated fetch', async function() {

    const gate = deferred();
    const test = fixture({updateGate: gate.promise});
    await test.controller.initialize();
    const first = test.controller.check();
    const second = test.controller.check();
    await new Promise((resolve) => setImmediate(resolve));
    Assert.strictEqual(test.fetches, 1);
    gate.resolve();
    Assert.deepStrictEqual(await first, {ok: true, status: 'STAGED'});
    Assert.deepStrictEqual(await second, {ok: true, status: 'STAGED'});
    Assert.strictEqual(test.fetches, 1);

  });

  it('runs only its exact alarm and never promotes a candidate', async function() {

    const test = fixture();
    await test.controller.initialize();
    Assert.deepStrictEqual(await test.controller.handleAlarm({name: 'other'}), {
      ok: true, status: 'IGNORED',
    });
    Assert.strictEqual(test.fetches, 0);
    Assert.deepStrictEqual(await test.controller.handleAlarm({
      name: Control.ALARM_NAME,
    }), {ok: true, status: 'STAGED'});
    Assert.strictEqual(test.fetches, 1);

  });

  it('recovers an interrupted event-page check as a sanitized failure',
      async function() {

        const test = fixture({storage: {
          [Control.STORAGE_KEY]: {
            schemaVersion: 1,
            lastCheckStatus: 'CHECKING',
            lastCheckAt: 900,
            lastSuccessfulCheckAt: 800,
            lastErrorCategory: null,
          },
        }});
        const status = await test.controller.initialize();
        Assert.strictEqual(status.status, 'CHECK_FAILED');
        Assert.strictEqual(status.errorCategory, 'UPDATE_INTERRUPTED');

      });

  it('marks a completed promotion without retaining staged identity',
      async function() {

        const test = fixture({current: identity('v1', 'a')});
        await test.controller.initialize();
        await test.controller.check();
        test.setCurrent(identity('v2', 'b'));
        test.setStaged(null);
        const status = await test.controller.markInstalled();
        Assert.strictEqual(status.status, 'UPDATED');
        Assert.strictEqual(status.currentDatasetVersion, 'v2');
        Assert.strictEqual(status.stagedDatasetVersion, null);

      });

  it('normalizes malformed and future status without trusting remote fields',
      function() {

        const expected = Control.normalizeState(undefined);
        for (const value of [
          null,
          {schemaVersion: 2},
          Object.assign({}, expected, {manifestUrl: MANIFEST_URL}),
          Object.assign({}, expected, {lastErrorCategory: 'raw secret'}),
        ]) {
          Assert.deepStrictEqual(Control.normalizeState(value), expected);
        }

      });

});
