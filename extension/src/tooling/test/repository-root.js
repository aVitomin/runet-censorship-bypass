'use strict';

const Assert = require('node:assert/strict');
const ChildProcess = require('node:child_process');
const Fs = require('node:fs');
const Os = require('node:os');
const Path = require('node:path');
const {resolveRepositoryRoot} = require('../repository-root');
const Release = require('../../../scripts/package-firefox-release');

describe('Repository layout and reviewer sources', function() {

  it('resolves the Git root independently of tooling depth or repository name', function() {

    const temporary = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'layout-root-'));
    try {
      const nested = Path.join(temporary, 'unrelated-name', 'nested', 'tooling');
      Fs.mkdirSync(nested, {recursive: true});
      ChildProcess.execFileSync('git', ['init', '--quiet', temporary]);
      Assert.equal(resolveRepositoryRoot(nested), temporary);
    } finally {
      Fs.rmSync(temporary, {recursive: true, force: true});
    }

  });

  it('rejects release work outside a Git worktree', function() {

    const temporary = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'layout-no-git-'));
    try {
      Assert.throws(() => resolveRepositoryRoot(temporary), /Git worktree/);
    } finally {
      Fs.rmSync(temporary, {recursive: true, force: true});
    }

  });

  it('collects every tracked source at its repository path reproducibly', function() {

    const root = resolveRepositoryRoot(__dirname);
    const tracked = ChildProcess.execFileSync('git', ['ls-files', '-z'], {
      cwd: root, encoding: 'utf8',
    }).split('\0').filter(Boolean).sort();
    const entries = Release.listTrackedSourceEntries('source');
    Assert.deepEqual(entries.map((entry) => entry.name).sort(),
        tracked.map((name) => `source/${name}`));
    for (const entry of entries) {
      Assert.deepEqual(entry.data,
          Fs.readFileSync(Path.join(root, entry.name.slice('source/'.length))));
      Assert.ok(!/\/(?:node_modules|\.local|build|dist)\//u.test(entry.name));
    }
    Assert.deepEqual(Release.createDeterministicZip(entries),
        Release.createDeterministicZip([...entries].reverse()));

  });

});
