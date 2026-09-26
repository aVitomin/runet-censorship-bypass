'use strict';

const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Os = require('node:os');
const Path = require('node:path');
const {distributionNoticeSources, verifyDistributionNotices} =
  require('../distribution-notices');
const {createDeterministicZip, listDirectoryEntries} =
  require('../../../scripts/package-firefox-release');

describe('Distribution license notices', function() {

  let root;

  function fixture(target) {

    root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'runet-license-notices-'));
    const sources = Object.assign({}, distributionNoticeSources(target), {
      'background/vendor/tldts/LICENSE':
        Path.resolve(__dirname, '../../../node_modules/tldts/LICENSE'),
    });
    for (const [name, source] of Object.entries(sources)) {
      const destination = Path.join(root, name);
      Fs.mkdirSync(Path.dirname(destination), {recursive: true});
      Fs.copyFileSync(source, destination);
    }
    return sources;

  }

  afterEach(function() {

    if (root) {
      Fs.rmSync(root, {recursive: true, force: true});
      root = null;
    }

  });

  it('rejects an unknown browser target', function() {

    Assert.throws(() => distributionNoticeSources('other'), /Unknown browser/);

  });

  it('keeps Chromium-only licenses out of the Firefox allowlist', function() {

    const chromium = distributionNoticeSources('chromium');
    const firefox = distributionNoticeSources('firefox');
    Assert.equal(Object.keys(chromium).length, 5);
    Assert.equal(Object.keys(firefox).length, 3);
    Assert.equal(firefox['THIRD_PARTY_NOTICES/EMOJI-MIT.txt'], undefined);
    Assert.equal(firefox['THIRD_PARTY_NOTICES/CHROMIUM-BSD-3-CLAUSE.txt'], undefined);
    Assert.notEqual(chromium['THIRD_PARTY_NOTICES/NOTICE.txt'],
        firefox['THIRD_PARTY_NOTICES/NOTICE.txt']);

  });

  for (const target of ['chromium', 'firefox']) {
    it(`${target}: preserves every required notice in the archive`, function() {

      const sources = fixture(target);
      Assert.equal(verifyDistributionNotices(root, target), Object.keys(sources).length);
      const archive = createDeterministicZip(listDirectoryEntries(root));
      for (const [name, source] of Object.entries(sources)) {
        // The release writer uses stored ZIP entries, so full bytes must survive.
        Assert.ok(archive.includes(Buffer.from(name)), name);
        Assert.ok(archive.includes(Fs.readFileSync(source)), name);
      }

    });

    it(`${target}: rejects each missing notice or license`, function() {

      const sources = fixture(target);
      for (const [name, source] of Object.entries(sources)) {
        const destination = Path.join(root, name);
        Fs.unlinkSync(destination);
        Assert.throws(() => verifyDistributionNotices(root, target));
        Fs.copyFileSync(source, destination);
      }

    });

    it(`${target}: rejects empty, truncated and substituted license text`, function() {

      const sources = fixture(target);
      for (const [name, source] of Object.entries(sources)) {
        const destination = Path.join(root, name);
        for (const bytes of [Buffer.alloc(0), Fs.readFileSync(source).subarray(0, 30),
          Buffer.from('License')]) {
          Fs.writeFileSync(destination, bytes);
          Assert.throws(() => verifyDistributionNotices(root, target),
              /Changed distribution license bytes/);
        }
        Fs.copyFileSync(source, destination);
      }

    });

    it(`${target}: rejects unrelated files in the notice directory`, function() {

      fixture(target);
      Fs.writeFileSync(Path.join(root, 'THIRD_PARTY_NOTICES/qa-evidence.txt'), 'fixture');
      Assert.throws(() => verifyDistributionNotices(root, target),
          /Unexpected or missing distribution notice/);

    });
  }

});
