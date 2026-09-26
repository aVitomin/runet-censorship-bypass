'use strict';

const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');

const PROJECT_ROOT = Path.resolve(__dirname, '../..');

// Explicit package inputs only. Do not copy the assets/docs directories wholesale.
function distributionNoticeSources(target) {

  Assert.ok(['chromium', 'firefox'].includes(target), 'Unknown browser target');
  const sources = {
    LICENSE: Path.resolve(PROJECT_ROOT, '../LICENSE'),
    'THIRD_PARTY_NOTICES/NOTICE.txt':
      Path.join(PROJECT_ROOT, 'assets/notices', `${target}.txt`),
    'THIRD_PARTY_NOTICES/MPL-2.0.txt':
      Path.join(PROJECT_ROOT, 'assets/licenses/MPL-2.0.txt'),
  };
  if (target === 'chromium') {
    for (const name of ['CHROMIUM-BSD-3-CLAUSE.txt', 'EMOJI-MIT.txt']) {
      sources[`THIRD_PARTY_NOTICES/${name}`] =
        Path.join(PROJECT_ROOT, 'assets/licenses', name);
    }
  }
  return Object.freeze(sources);

}

function verifyDistributionNotices(packageRoot, target) {

  const sources = distributionNoticeSources(target);
  const expectedNames = Object.keys(sources)
      .filter((name) => name.startsWith('THIRD_PARTY_NOTICES/'))
      .map((name) => Path.basename(name)).sort();
  const directory = Path.join(packageRoot, 'THIRD_PARTY_NOTICES');
  Assert.ok(Fs.existsSync(directory), 'Missing distribution notice directory');
  Assert.equal(Fs.lstatSync(directory).isSymbolicLink(), false);
  Assert.deepEqual(Fs.readdirSync(directory).sort(), expectedNames,
      'Unexpected or missing distribution notice');

  // tldts already ships its own license; verify it without duplicating the text.
  const required = Object.assign({}, sources, {
    'background/vendor/tldts/LICENSE':
      Path.join(PROJECT_ROOT, 'node_modules/tldts/LICENSE'),
  });
  for (const [relativePath, source] of Object.entries(required)) {
    const file = Path.join(packageRoot, relativePath);
    Assert.ok(Fs.existsSync(file), `Missing distribution license: ${relativePath}`);
    Assert.equal(Fs.lstatSync(file).isFile(), true,
        `Distribution license must be a regular file: ${relativePath}`);
    const expected = Fs.readFileSync(source);
    Assert.ok(expected.length > 0, `Empty license source: ${relativePath}`);
    Assert.ok(Fs.readFileSync(file).equals(expected),
        `Changed distribution license bytes: ${relativePath}`);
  }
  return Object.keys(required).length;

}

module.exports = Object.freeze({distributionNoticeSources, verifyDistributionNotices});
