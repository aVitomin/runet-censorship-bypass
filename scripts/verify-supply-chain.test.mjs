import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

import {
  AUTHORITATIVE_PACKAGE,
  MIN_VERSION_AGE_MS,
  SupplyChainVerificationError,
  changedDirectSelections,
  inspectRepository,
  readBasePackage,
  resolveBasePackageRoot,
  verifyPublicationAges,
} from './verify-supply-chain.mjs';

const integrity = `sha512-${Buffer.from('fixture-integrity').toString('base64')}`;
const retiredOptionsPackage =
  'extensions/chromium/runet-censorship-bypass/src/extension-common/pages/options';

function packageDocuments({
  directSpecifier = '1.2.3',
  selectedVersion = '1.2.3',
  resolved = 'https://registry.npmjs.org/safe-package/-/safe-package-1.2.3.tgz',
  selectedIntegrity = integrity,
  extraPackages = {},
} = {}) {
  return {
    manifest: {
      name: 'fixture',
      version: '1.0.0',
      private: true,
      dependencies: {
        'safe-package': directSpecifier,
      },
    },
    lockfile: {
      name: 'fixture',
      version: '1.0.0',
      lockfileVersion: 2,
      requires: true,
      packages: {
        '': {
          name: 'fixture',
          version: '1.0.0',
          dependencies: {
            'safe-package': directSpecifier,
          },
        },
        'node_modules/safe-package': {
          version: selectedVersion,
          resolved,
          integrity: selectedIntegrity,
        },
        'node_modules/fsevents': {
          version: '2.3.3',
          resolved: 'https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz',
          integrity,
          hasInstallScript: true,
          optional: true,
        },
        ...extraPackages,
      },
    },
  };
}

function writeJson(root, relativePath, value) {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixtureRepository(authoritative = packageDocuments(), configure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rucb-supply-chain-'));
  writeJson(root, `${AUTHORITATIVE_PACKAGE}/package.json`, authoritative.manifest);
  writeJson(root, `${AUTHORITATIVE_PACKAGE}/package-lock.json`, authoritative.lockfile);
  configure?.(root);
  return root;
}

function withFixture(authoritative, assertion, configure) {
  const root = fixtureRepository(authoritative, configure);
  try {
    assertion(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertSupplyChainFailure(callback, pattern) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof SupplyChainVerificationError);
    assert.match(error.message, pattern);
    return true;
  });
}

test('accepts only the authoritative package and its reviewed lifecycle baseline', () => {
  withFixture(packageDocuments(), (root) => {
    const summary = inspectRepository(root);
    assert.equal(summary.packageCount, 2);
    assert.deepEqual(summary.lifecyclePackages, ['fsevents@2.3.3']);
    assert.deepEqual(summary.inventory, [AUTHORITATIVE_PACKAGE]);
  });
});

test('an unchanged direct selection does not require an age lookup', () => {
  const current = packageDocuments();
  const base = structuredClone(current);
  base.manifest.dependencies['safe-package'] = '^1.2.3';
  base.lockfile.packages[''].dependencies['safe-package'] = '^1.2.3';
  assert.deepEqual(
    changedDirectSelections(current.manifest, current.lockfile, base.manifest, base.lockfile),
    [],
  );
});

for (const [label, resolved] of [
  ['git dependency', 'git+https://github.com/example/safe-package.git'],
  ['file dependency', 'file:../safe-package'],
  ['arbitrary tarball source', 'https://example.test/safe-package-1.2.3.tgz'],
]) {
  test(`rejects a ${label}`, () => {
    withFixture(packageDocuments({ resolved }), (root) => {
      assertSupplyChainFailure(() => inspectRepository(root), /registry source/u);
    });
  });
}

test('rejects missing integrity metadata', () => {
  withFixture(packageDocuments({ selectedIntegrity: null }), (root) => {
    assertSupplyChainFailure(() => inspectRepository(root), /valid integrity/u);
  });
});

test('rejects newly introduced lifecycle-install metadata', () => {
  withFixture(packageDocuments({
    extraPackages: {
      'node_modules/new-installer': {
        version: '4.5.6',
        resolved: 'https://registry.npmjs.org/new-installer/-/new-installer-4.5.6.tgz',
        integrity,
        hasInstallScript: true,
      },
    },
  }), (root) => {
    assertSupplyChainFailure(() => inspectRepository(root), /unexpected lifecycle-install metadata/u);
  });
});

test('rejects an unexpected package manifest and lockfile', () => {
  withFixture(packageDocuments(), (root) => {
    writeJson(root, 'unexpected/package.json', { name: 'unexpected', version: '1.0.0' });
    writeJson(root, 'unexpected/package-lock.json', {
      name: 'unexpected',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {},
    });
    assertSupplyChainFailure(
      () => inspectRepository(root),
      /unexpected package manifest or lockfile/u,
    );
  });
});

test('rejects reintroducing the retired legacy Options compiler package', () => {
  withFixture(packageDocuments(), (root) => {
    writeJson(root, `${retiredOptionsPackage}/package.json`, {
      name: 'retired-options-compiler',
      version: '1.0.0',
    });
    writeJson(root, `${retiredOptionsPackage}/package-lock.json`, {
      name: 'retired-options-compiler',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {},
    });
    assertSupplyChainFailure(() => inspectRepository(root), /unexpected package manifest or lockfile/u);
  });
});

test('accepts a selected version exactly 168 hours old', async () => {
  const reviewTime = new Date('2026-08-26T12:00:00Z');
  const publicationTime = new Date(reviewTime.getTime() - MIN_VERSION_AGE_MS).toISOString();
  const result = await verifyPublicationAges(
    [{ name: 'safe-package', version: '1.2.3', section: 'dependencies' }],
    { reviewTime, getPublicationTime: async () => publicationTime },
  );
  assert.equal(result[0].ageHours, 168);
});

test('rejects a selected version 167h59m59s old', async () => {
  const reviewTime = new Date('2026-08-26T12:00:00Z');
  const publicationTime = new Date(reviewTime.getTime() - MIN_VERSION_AGE_MS + 1_000).toISOString();
  await assert.rejects(
    verifyPublicationAges(
      [{ name: 'safe-package', version: '1.2.3', section: 'dependencies' }],
      { reviewTime, getPublicationTime: async () => publicationTime },
    ),
    (error) => {
      assert.ok(error instanceof SupplyChainVerificationError);
      assert.match(error.message, /168 full hours are required/u);
      return true;
    },
  );
});

test('fails closed on malformed publication metadata', async () => {
  await assert.rejects(
    verifyPublicationAges(
      [{ name: 'safe-package', version: '1.2.3', section: 'devDependencies' }],
      { reviewTime: new Date('2026-08-26T12:00:00Z'), getPublicationTime: async () => 'not-a-date' },
    ),
    (error) => {
      assert.ok(error instanceof SupplyChainVerificationError);
      assert.match(error.message, /publication timestamp is missing or malformed/u);
      return true;
    },
  );
});

test('reports a moved current root explicitly without adopting it', () => {
  withFixture(packageDocuments(), (root) => {
    const moved = path.join(root, 'future-tooling');
    fs.renameSync(path.join(root, AUTHORITATIVE_PACKAGE), moved);
    assertSupplyChainFailure(() => inspectRepository(root), /discovered roots: future-tooling.*automatic root adoption is forbidden/u);
  });
});

test('reports a partial manifest/lock pair without confusing JSON read errors', () => {
  withFixture(packageDocuments(), (root) => {
    fs.unlinkSync(path.join(root, AUTHORITATIVE_PACKAGE, 'package-lock.json'));
    assertSupplyChainFailure(() => inspectRepository(root), /must both be present/u);
  });
});

test('uses explicit paired rename evidence for a relocated PR base package', () => {
  const names = ['package.json', 'package-lock.json'];
  const baseFiles = names.map((name) => `old-tooling/${name}`);
  const changes = names.map((name) => `R100\0old-tooling/${name}\0${AUTHORITATIVE_PACKAGE}/${name}\0`).join('');
  assert.equal(resolveBasePackageRoot(AUTHORITATIVE_PACKAGE, baseFiles, changes), 'old-tooling');
  assert.equal(resolveBasePackageRoot(AUTHORITATIVE_PACKAGE,
    names.map((name) => `${AUTHORITATIVE_PACKAGE}/${name}`), ''), AUTHORITATIVE_PACKAGE);
});

for (const [label, changes] of [
  ['missing history', ''],
  ['copy, not rename', `C100\0old/package.json\0${AUTHORITATIVE_PACKAGE}/package.json\0C100\0old/package-lock.json\0${AUTHORITATIVE_PACKAGE}/package-lock.json\0`],
  ['partial move', `R100\0old/package.json\0${AUTHORITATIVE_PACKAGE}/package.json\0`],
  ['split origins', `R100\0old/package.json\0${AUTHORITATIVE_PACKAGE}/package.json\0R100\0other/package-lock.json\0${AUTHORITATIVE_PACKAGE}/package-lock.json\0`],
]) {
  test(`rejects ambiguous base path selection: ${label}`, () => {
    assertSupplyChainFailure(() => resolveBasePackageRoot(AUTHORITATIVE_PACKAGE,
      ['old/package.json', 'old/package-lock.json', 'other/package-lock.json'], changes),
    /paired.*Git rename.*cannot skip dependency age review/u);
  });
}

test('compares actual Git-renamed base documents and still detects newly selected versions', () => {
  withFixture(packageDocuments(), (root) => {
    const git = (...args) => execFileSync('git', [
      '-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(root, '.no-hooks')}`, ...args,
    ], {cwd: root, encoding: 'utf8'}).trim();
    git('init', '--quiet'); git('add', '--', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture');
    const baseSha = git('rev-parse', 'HEAD');
    git('mv', '--', AUTHORITATIVE_PACKAGE, 'future-tooling');
    const current = packageDocuments({directSpecifier: '1.2.4', selectedVersion: '1.2.4',
      resolved: 'https://registry.npmjs.org/safe-package/-/safe-package-1.2.4.tgz'});
    writeJson(root, 'future-tooling/package.json', current.manifest);
    writeJson(root, 'future-tooling/package-lock.json', current.lockfile);
    const base = readBasePackage(baseSha, current.manifest, root, 'future-tooling');
    assert.equal(base.directory, AUTHORITATIVE_PACKAGE);
    assert.deepEqual(changedDirectSelections(current.manifest, current.lockfile, base.manifest, base.lockfile), [
      {name: 'safe-package', version: '1.2.4', section: 'dependencies'},
    ]);
    assertSupplyChainFailure(() => readBasePackage(baseSha, {...current.manifest, name: 'impostor'},
      root, 'future-tooling'), /package identity does not match/u);
    assertSupplyChainFailure(() => readBasePackage('f'.repeat(40), current.manifest,
      root, 'future-tooling'), /fetch the base commit/u);
  });
});
