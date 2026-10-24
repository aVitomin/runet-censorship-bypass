'use strict';

const Assert = require('node:assert/strict');
const Store = require('../background/dataset-store');
const Helpers = require('./dataset-test-helpers');

function candidate(host = 'next.example', updatedAt = '2026-09-02T00:00:00.000Z', options = {}) {

  return Helpers.httpsArtifact(Object.assign({}, options, {
    payload: Helpers.payload([{width: host.length, routeRef: 'PROVIDER_PROXY', hosts: host}]),
    envelopeOverrides: Object.assign({generatedAt: updatedAt}, options.envelopeOverrides),
  }));

}

async function fixture(options = {}) {

  const backend = Helpers.memoryBackend();
  const originalCommit = backend.commit;
  backend.commit = async (record, pointers) => {
    if (record && backend.artifacts.has(record.artifactSha256)) {
      Assert.deepEqual(record, backend.artifacts.get(record.artifactSha256),
          'immutable artifact identity must not be rewritten');
    }
    return originalCommit(record, pointers);
  };
  const store = Store.createStore({backend, sha256: options.sha256 || Helpers.sha256});
  const baseline = Helpers.artifact({providerKey: 'anticensority'});
  Assert.equal((await store.commitPackagedBaseline(baseline)).ok, true);
  return {backend, store, baseline};

}

describe('Firefox HTTPS source dataset staging', function() {

  it('retains packaged bytes/trust on a real unchanged download and advances only the source floor', async function() {

    const test = await fixture();
    const original = structuredClone(
        test.backend.artifacts.get(test.baseline.envelope.artifactSha256));
    const same = candidate('beta.example', '2026-09-01T00:00:00.000Z');
    const result = await test.store.stageHttpsCandidate(same);
    Assert.equal(result.status, 'UNCHANGED');
    Assert.equal(result.verification.trust, Helpers.Dataset.TRUST.PACKAGED_TRUSTED);
    Assert.equal(result.sequence, null);
    Assert.equal(test.backend.artifacts.size, 1);
    Assert.deepEqual(test.backend.artifacts.get(test.baseline.envelope.artifactSha256), original);
    const pointers = (await test.store.loadVerifications('anticensority')).pointers;
    Assert.equal(pointers.schemaVersion, 3);
    Assert.equal(pointers.activeArtifactSha256, null);
    Assert.equal(pointers.stagedArtifactSha256, null);
    Assert.equal(pointers.highestAuthenticatedSequence, null);
    const writes = test.backend.commits.length;
    Assert.equal((await test.store.stageHttpsCandidate(same)).status, 'UNCHANGED');
    Assert.equal(test.backend.commits.length, writes);

  });

  it('binds source provenance to an immutable candidate and reloads it after store recreation', async function() {

    const test = await fixture();
    const input = candidate();
    input.trust = Helpers.Dataset.TRUST.REMOTE_AUTHENTICATED;
    const result = await test.store.stageHttpsCandidate(input);
    Assert.equal(result.status, 'STAGED');
    Assert.equal(result.verification.trust, Helpers.Dataset.TRUST.REMOTE_HTTPS_VALIDATED);
    const reloaded = await Store.createStore({backend: test.backend, sha256: Helpers.sha256})
        .loadStaged('anticensority');
    Assert.equal(reloaded.channel, 'HTTPS');
    Assert.equal(reloaded.sequence, 1);
    Assert.deepEqual(reloaded.source, input.source);
    Assert.equal(reloaded.pointers.activeArtifactSha256, null);
    Assert.equal(reloaded.pointers.highestAuthenticatedSequence, null);
    Assert.equal(reloaded.pointers.highestAuthenticatedArtifactSha256, null);

  });

  it('keeps an identical staged payload receipt when comments, source hash and timestamp change', async function() {

    const test = await fixture();
    const first = candidate();
    await test.store.stageHttpsCandidate(first);
    const original = structuredClone(test.backend.artifacts.get(first.envelope.artifactSha256));
    const changed = candidate('next.example', '2026-09-03T00:00:00.000Z', {
      sourceSha256: 'b'.repeat(64), envelopeOverrides: {datasetVersion: 'new-comments'},
    });
    const result = await test.store.stageHttpsCandidate(changed);
    Assert.equal(result.status, 'UNCHANGED');
    Assert.equal(result.sequence, 1);
    Assert.deepEqual(result.source, first.source);
    Assert.deepEqual(test.backend.artifacts.get(first.envelope.artifactSha256), original);
    const loaded = await test.store.loadStaged('anticensority');
    Assert.equal(loaded.ok, true);
    Assert.equal(loaded.pointers.httpsFloor.updatedAt, changed.source.updatedAt);
    Assert.deepEqual(loaded.pointers.httpsState.source, first.source);

  });

  for (const kind of ['rollback', 'same-time']) {
    it(`rejects ${kind} routing changes against the verified packaged baseline`, async function() {

      const test = await fixture();
      const before = structuredClone(test.backend.pointers.get('anticensority'));
      const date = kind === 'rollback' ? '2026-08-31T00:00:00.000Z' : '2026-09-01T00:00:00.000Z';
      Assert.equal((await test.store.stageHttpsCandidate(candidate('next.example', date))).code,
          kind === 'rollback' ? 'HTTPS_SOURCE_ROLLBACK_REJECTED' : 'HTTPS_SOURCE_TIMESTAMP_CONFLICT');
      Assert.deepEqual(test.backend.pointers.get('anticensority'), before);
      Assert.equal(test.backend.artifacts.size, 1);

    });
  }

  it('keeps a newer unchanged observation as a rollback/conflict floor', async function() {

    const test = await fixture();
    await test.store.stageHttpsCandidate(candidate('beta.example', '2026-09-04T00:00:00.000Z'));
    Assert.equal((await test.store.stageHttpsCandidate(candidate('next.example', '2026-09-03T00:00:00.000Z'))).code,
        'HTTPS_SOURCE_ROLLBACK_REJECTED');
    Assert.equal((await test.store.stageHttpsCandidate(candidate('next.example', '2026-09-04T00:00:00.000Z'))).code,
        'HTTPS_SOURCE_TIMESTAMP_CONFLICT');

  });

  it('invalidates an older HTTPS candidate when a newer source again matches the selected baseline', async function() {

    const test = await fixture();
    await test.store.stageHttpsCandidate(candidate());
    Assert.equal((await test.store.stageHttpsCandidate(candidate('beta.example', '2026-09-03T00:00:00.000Z'))).status,
        'UNCHANGED');
    Assert.equal((await test.store.loadStaged('anticensority')).status, 'EMPTY');
    Assert.equal(test.backend.artifacts.size, 2, 'retain old candidate bytes for exact recovery');

  });

  it('rejects a replay of baseline routing when a different dataset is selected', async function() {

    const test = await fixture();
    const next = await test.store.stageHttpsCandidate(candidate());
    Assert.equal((await test.store.promoteStaged('anticensority')).status, 'PROMOTED');
    const before = structuredClone(test.backend.pointers.get('anticensority'));
    const replay = candidate('beta.example', '2026-09-03T00:00:00.000Z');
    Assert.equal((await test.store.stageHttpsCandidate(replay)).code, 'HTTPS_KNOWN_ARTIFACT_REPLAY');
    Assert.deepEqual(test.backend.pointers.get('anticensority'), before);
    const loaded = await test.store.loadVerifications('anticensority');
    Assert.equal(loaded.active.dataset.identity.artifactSha256,
        next.verification.dataset.identity.artifactSha256);
    Assert.equal(test.backend.artifacts.size, 2);

  });

  it('serializes racing source updates against the durable timestamp floor', async function() {

    const test = await fixture();
    const [newer, older] = await Promise.all([
      test.store.stageHttpsCandidate(candidate('newer.example', '2026-09-04T00:00:00.000Z')),
      test.store.stageHttpsCandidate(candidate('older.example', '2026-09-03T00:00:00.000Z')),
    ]);
    Assert.equal(newer.status, 'STAGED');
    Assert.equal(older.code, 'HTTPS_SOURCE_ROLLBACK_REJECTED');
    const current = await test.store.loadStaged('anticensority');
    Assert.equal(current.verification.dataset.identity.artifactSha256,
        newer.verification.dataset.identity.artifactSha256);

  });

  it('copies bytes and provenance before asynchronous verification', async function() {

    let release;
    let entered;
    let pause = false;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const proceed = new Promise((resolve) => {
      release = resolve;
    });
    const test = await fixture({async sha256(bytes) {
      if (pause) {
        entered();
        await proceed;
      }
      return Helpers.sha256(bytes);
    }});
    const input = candidate();
    const originalSource = structuredClone(input.source);
    pause = true;
    const pending = test.store.stageHttpsCandidate(input);
    await ready;
    input.artifactBytes.fill(0);
    input.source.sourceSha256 = 'c'.repeat(64);
    release();
    Assert.equal((await pending).ok, true);
    const loaded = await test.store.loadStaged('anticensority');
    Assert.equal(loaded.ok, true);
    Assert.deepEqual(loaded.source, originalSource);

  });

  it('snapshots queued input before a previous mutation releases the queue', async function() {

    let release;
    let entered;
    let pause = false;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const proceed = new Promise((resolve) => {
      release = resolve;
    });
    const test = await fixture({async sha256(bytes) {
      if (pause) {
        pause = false;
        entered();
        await proceed;
      }
      return Helpers.sha256(bytes);
    }});
    pause = true;
    const first = test.store.stageHttpsCandidate(candidate());
    await ready;
    const input = candidate('queued.example', '2026-09-03T00:00:00.000Z');
    const original = structuredClone(input);
    const queued = test.store.stageHttpsCandidate(input);
    input.artifactBytes.fill(0);
    input.source.sourceSha256 = 'c'.repeat(64);
    input.envelope.generatedAt = '2026-09-01T00:00:00.000Z';
    input.envelope.sourceRevisions[0].revision = 'mutated-after-submission';
    release();
    Assert.equal((await first).status, 'STAGED');
    Assert.equal((await queued).status, 'STAGED');
    const loaded = await test.store.loadStaged('anticensority');
    Assert.deepEqual(loaded.source, original.source);
    Assert.deepEqual(loaded.verification.dataset.envelope, original.envelope);
    Assert.deepEqual(test.backend.artifacts.get(original.envelope.artifactSha256).artifactBytes,
        new Uint8Array(original.artifactBytes));

  });

  for (const damage of ['source', 'provenance', 'channel', 'floor', 'bytes']) {
    it(`rejects ${damage} corruption after recreating the store`, async function() {

      const test = await fixture();
      const input = candidate();
      await test.store.stageHttpsCandidate(input);
      const record = test.backend.artifacts.get(input.envelope.artifactSha256);
      const pointers = test.backend.pointers.get('anticensority');
      if (damage === 'source') record.source.sourceSha256 = 'd'.repeat(64);
      if (damage === 'provenance') {
        record.envelope.sourceRevisions[0].revision = `sha256=${'d'.repeat(64)}`;
      }
      if (damage === 'channel') pointers.stagedChannel = 'SIGNED';
      if (damage === 'floor') pointers.httpsFloor = {updatedAt: 'invalid', artifactSha256: input.envelope.artifactSha256};
      if (damage === 'bytes') record.artifactBytes[0] ^= 1;
      const recreated = Store.createStore({backend: test.backend, sha256: Helpers.sha256});
      Assert.equal((await recreated.loadStaged('anticensority')).ok, false);
      Assert.equal((await recreated.loadVerifications('anticensority')).packagedBaseline.ok, true);

    });
  }

  it('leaves a signed candidate and its authenticated high-water mark intact', async function() {

    const test = await fixture();
    const signed = candidate('signed.example');
    await test.store.stageAuthenticatedCandidate(Object.assign({}, signed, {sequence: 10}));
    const before = structuredClone(test.backend.pointers.get('anticensority'));
    const result = await test.store.stageHttpsCandidate(candidate('https.example', '2026-09-03T00:00:00.000Z'));
    Assert.equal(result.code, 'HTTPS_AUTHENTICATED_CHANNEL_SELECTED');
    Assert.deepEqual(test.backend.pointers.get('anticensority'), before);
    Assert.equal((await test.store.loadStaged('anticensority')).channel, 'SIGNED');

  });

  it('preserves a signed previous-LKG selection when the active artifact is unavailable', async function() {

    const test = await fixture();
    const signed = candidate('signed.example');
    await test.store.stageAuthenticatedCandidate(Object.assign({}, signed, {sequence: 10}));
    await test.store.promoteStaged('anticensority');
    const pointers = test.backend.pointers.get('anticensority');
    pointers.previousLkgArtifactSha256 = pointers.activeArtifactSha256;
    pointers.activeArtifactSha256 = 'f'.repeat(64);
    const before = structuredClone(pointers);
    const result = await test.store.stageHttpsCandidate(
        candidate('https.example', '2026-09-03T00:00:00.000Z'));
    Assert.equal(result.code, 'HTTPS_AUTHENTICATED_CHANNEL_SELECTED');
    Assert.deepEqual(test.backend.pointers.get('anticensority'), before);

  });

  it('lets a signed candidate supersede HTTPS staging without merging the channel histories', async function() {

    const test = await fixture();
    await test.store.stageHttpsCandidate(candidate());
    const sourceState = structuredClone(test.backend.pointers.get('anticensority').httpsState);
    await test.store.stageAuthenticatedCandidate(Object.assign({}, candidate('signed.example'), {sequence: 10}));
    const loaded = await test.store.loadStaged('anticensority');
    Assert.equal(loaded.channel, 'SIGNED');
    Assert.equal(loaded.pointers.highestAuthenticatedSequence, 10);
    Assert.deepEqual(loaded.pointers.httpsState, sourceState);

  });

  it('requires fixed provider/source provenance and matching source timestamp', async function() {

    for (const damage of ['provider', 'sourceId', 'hash', 'timestamp', 'extra']) {
      const test = await fixture();
      const input = candidate();
      if (damage === 'provider') input.envelope.providerKey = 'other-provider';
      if (damage === 'sourceId') input.source.sourceId = 'other-source';
      if (damage === 'hash') input.source.sourceSha256 = 'not-a-sha256';
      if (damage === 'timestamp') input.source.updatedAt = '2026-09-03T00:00:00.000Z';
      if (damage === 'extra') input.source.trust = 'REMOTE_AUTHENTICATED';
      Assert.equal((await test.store.stageHttpsCandidate(input)).ok, false, damage);
      Assert.equal(test.backend.artifacts.size, 1);
    }

  });

  for (const damage of ['source-id', 'source-hash', 'extra-revision']) {
    it(`rejects ${damage} envelope provenance that contradicts the HTTPS receipt`, async function() {

      const test = await fixture();
      const input = candidate();
      if (damage === 'source-id') input.envelope.sourceRevisions[0].sourceId = 'other-source';
      if (damage === 'source-hash') {
        input.envelope.sourceRevisions[0].revision = `sha256=${'d'.repeat(64)}`;
      }
      if (damage === 'extra-revision') {
        input.envelope.sourceRevisions.push({sourceId: 'other-source', revision: 'other'});
      }
      const before = structuredClone(test.backend.pointers.get('anticensority'));
      Assert.equal((await test.store.stageHttpsCandidate(input)).code,
          'HTTPS_SOURCE_IDENTITY_MISMATCH');
      Assert.deepEqual(test.backend.pointers.get('anticensority'), before);
      Assert.equal(test.backend.artifacts.size, 1);

    });
  }

  it('does not advance source state when the artifact transaction aborts', async function() {

    const test = await fixture();
    const before = structuredClone(test.backend.pointers.get('anticensority'));
    test.backend.commit = async () => {
      throw new Error('synthetic transaction abort');
    };
    await Assert.rejects(test.store.stageHttpsCandidate(candidate()), /synthetic transaction abort/);
    Assert.deepEqual(test.backend.pointers.get('anticensority'), before);
    Assert.equal(test.backend.artifacts.size, 1);

  });

});
