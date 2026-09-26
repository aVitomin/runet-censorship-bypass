'use strict';


const Assert = require('assert');
const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const {distributionNoticeSources, verifyDistributionNotices} =
  require('../../tooling/distribution-notices');

const PACKAGED_CHROMIUM_ROOT = Path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'build',
    'chromium',
);

const CHROMIUM_SOURCE_ROOT = Path.resolve(__dirname, '..');
const CHROMIUM_LOCALES = Object.freeze(['en', 'ru']);
const EXPECTED_CHROMIUM_VERSION = '0.0.4.0';
const EXPECTED_CHROMIUM_VERSION_NAME = '0.0.4.00';

const ALLOWED_RUNTIME_DIRECTORIES = new Set([
  'background/vendor/tldts/dist',
]);

const FORBIDDEN_DIRECTORIES = new Set([
  '.git',
  '.github',
  '.idea',
  '.tmp',
  '.vscode',
  '__tests__',
  'browser-profile',
  'browser-profiles',
  'build',
  'coverage',
  'dist',
  'fixture',
  'fixtures',
  'log',
  'logs',
  'netlog',
  'netlogs',
  'node_modules',
  'profile',
  'profiles',
  'temp',
  'test',
  'tests',
  'tmp',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.bak',
  '.crx',
  '.key',
  '.log',
  '.map',
  '.markdown',
  '.md',
  '.orig',
  '.p12',
  '.pem',
  '.pfx',
  '.rej',
  '.swo',
  '.swp',
  '.temp',
  '.tmp',
  '.xpi',
  '.zip',
]);

const FORBIDDEN_FILES = new Set([
  '.ds_store',
  '.editorconfig',
  '.env',
  '.gitattributes',
  '.gitignore',
  'desktop.ini',
  'thumbs.db',
]);

function isLicenseFile(fileName) {

  return /^(?:copying|licen[cs]e|notice)(?:[._-].*)?$/i.test(fileName);

}

function getForbiddenDirectoryReason(relativePath) {

  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (ALLOWED_RUNTIME_DIRECTORIES.has(normalized)) {
    return null;
  }
  const directoryName = normalized.split('/').filter(Boolean).pop() || '';
  if (FORBIDDEN_DIRECTORIES.has(directoryName)) {
    return `repository-only directory: ${directoryName}`;
  }
  return null;

}

function getForbiddenReason(relativePath) {

  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';
  const lowerFileName = fileName.toLowerCase();

  for (let index = 0; index < parts.length - 1; index += 1) {
    const directoryPath = parts.slice(0, index + 1).join('/');
    const reason = getForbiddenDirectoryReason(directoryPath);
    if (reason) {
      return reason;
    }
  }

  if (isLicenseFile(fileName)) {
    return null;
  }
  if (FORBIDDEN_FILES.has(lowerFileName) || lowerFileName.startsWith('.git')) {
    return `repository or editor metadata: ${fileName}`;
  }
  if (/^net-?log(?:\.|-|_|$)/i.test(fileName)) {
    return `network log: ${fileName}`;
  }
  if (fileName.endsWith('~')) {
    return `temporary editor file: ${fileName}`;
  }

  const extension = Path.extname(lowerFileName);
  if (FORBIDDEN_EXTENSIONS.has(extension)) {
    return `repository-only file type: ${extension}`;
  }
  return null;

}

function listPackageEntries(root) {

  const entries = [];

  function visit(directory, relativeDirectory = '') {

    const children = Fs.readdirSync(directory, {withFileTypes: true})
        .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const child of children) {
      const relativePath = relativeDirectory ?
        `${relativeDirectory}/${child.name}` : child.name;
      const absolutePath = Path.join(directory, child.name);
      if (child.isSymbolicLink()) {
        entries.push({path: relativePath, reason: 'symbolic link'});
      } else if (child.isDirectory()) {
        const reason = getForbiddenDirectoryReason(relativePath);
        if (reason) {
          entries.push({path: relativePath, reason});
        } else {
          visit(absolutePath, relativePath);
        }
      } else if (child.isFile()) {
        entries.push({path: relativePath, reason: getForbiddenReason(relativePath)});
      } else {
        entries.push({path: relativePath, reason: 'unsupported filesystem entry'});
      }
    }

  }

  visit(root);
  return entries;

}

function verifyPackageIntegrity(root) {

  Assert.ok(Fs.existsSync(root), `Missing Chromium package directory: ${root}`);
  Assert.ok(Fs.statSync(root).isDirectory(), `Not a directory: ${root}`);
  const entries = listPackageEntries(root);
  const forbidden = entries.filter(({reason}) => reason);
  if (forbidden.length > 0) {
    const details = forbidden
        .map(({path, reason}) => `- ${path} (${reason})`)
        .join('\n');
    throw new Error(`Forbidden Chromium package entries:\n${details}`);
  }
  verifyDistributionNotices(root, 'chromium');
  return entries.length;

}

function verifyPackagedLocalesMatchSources(
    root,
    sourceRoot = CHROMIUM_SOURCE_ROOT,
) {

  for (const locale of CHROMIUM_LOCALES) {
    const relativePath = `_locales/${locale}/messages.json`;
    const sourcePath = Path.join(sourceRoot, ...relativePath.split('/'));
    const packagedPath = Path.join(root, ...relativePath.split('/'));
    Assert.ok(Fs.existsSync(sourcePath), `Missing Chromium locale source: ${sourcePath}`);
    Assert.ok(
        Fs.existsSync(packagedPath),
        `Missing packaged Chromium locale: ${packagedPath}`,
    );
    Assert.ok(
        Fs.readFileSync(packagedPath).equals(Fs.readFileSync(sourcePath)),
        `Packaged Chromium locale does not match its Chromium source: ${relativePath}`,
    );
  }
  return CHROMIUM_LOCALES.length;

}

function verifyPackagedManifestIdentity(root) {

  const manifestPath = Path.join(root, 'manifest.json');
  Assert.ok(
      Fs.existsSync(manifestPath),
      `Missing Chromium manifest: ${manifestPath}`,
  );
  const manifest = JSON.parse(Fs.readFileSync(manifestPath, 'utf8'));
  Assert.strictEqual(manifest.version, EXPECTED_CHROMIUM_VERSION);
  Assert.strictEqual(manifest.version_name, EXPECTED_CHROMIUM_VERSION_NAME);
  return {
    version: manifest.version,
    versionName: manifest.version_name,
  };

}

if (typeof describe === 'function') {
  describe('Chromium package integrity', function() {

    it('rejects repository-only QA and audit documents', function() {

      const paths = [
        'ACTION_STATUS_BROWSER_QA.md',
        'PAC_FAILURE_BROWSER_QA.md',
        'PERFORMANCE_AUDIT.md',
        'docs/architecture-audit.markdown',
      ];
      for (const relativePath of paths) {
        Assert.ok(getForbiddenReason(relativePath), relativePath);
      }

    });

    it('rejects tests, logs, profiles, source maps, and metadata', function() {

      const paths = [
        'test/pac-fixture.js',
        'fixtures/provider.pac',
        'logs/browser.log',
        'browser-profile/Default/Preferences',
        'pages/popup/index.js.map',
        'pages/dist/runtime.js',
        '.git/config',
        '.vscode/settings.json',
        'NetLog.json',
        'temporary.tmp',
      ];
      for (const relativePath of paths) {
        Assert.ok(getForbiddenReason(relativePath), relativePath);
      }

    });

    it('allows the required tldts runtime distribution', function() {

      Assert.strictEqual(
          getForbiddenReason('background/vendor/tldts/dist/index.umd.min.js'),
          null,
      );

    });

    it('allows required license files', function() {

      Assert.strictEqual(getForbiddenReason('vendor/LICENSE'), null);
      Assert.strictEqual(getForbiddenReason('vendor/LICENSE.md'), null);
      Assert.strictEqual(getForbiddenReason('NOTICE.txt'), null);

    });

    it('requires complete distribution notices in the package gate', function() {

      const packageRoot = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'chromium-notices-'));
      try {
        const sources = Object.assign({}, distributionNoticeSources('chromium'), {
          'background/vendor/tldts/LICENSE':
            Path.resolve(__dirname, '../../../node_modules/tldts/LICENSE'),
        });
        for (const [name, source] of Object.entries(sources)) {
          const destination = Path.join(packageRoot, name);
          Fs.mkdirSync(Path.dirname(destination), {recursive: true});
          Fs.copyFileSync(source, destination);
        }
        Assert.strictEqual(verifyPackageIntegrity(packageRoot), 6);
        Fs.unlinkSync(Path.join(packageRoot, 'THIRD_PARTY_NOTICES/EMOJI-MIT.txt'));
        Assert.throws(() => verifyPackageIntegrity(packageRoot));
      } finally {
        Fs.rmSync(packageRoot, {recursive: true, force: true});
      }

    });

    it('requires packaged locales to match the Chromium sources', function() {

      const packageRoot = Fs.mkdtempSync(
          Path.join(Os.tmpdir(), 'runet-chromium-locales-'),
      );
      try {
        for (const locale of CHROMIUM_LOCALES) {
          const relativePath = `_locales/${locale}/messages.json`;
          const sourcePath = Path.join(
              CHROMIUM_SOURCE_ROOT,
              ...relativePath.split('/'),
          );
          const packagedPath = Path.join(
              packageRoot,
              ...relativePath.split('/'),
          );
          Fs.mkdirSync(Path.dirname(packagedPath), {recursive: true});
          Fs.copyFileSync(sourcePath, packagedPath);
        }

        Assert.strictEqual(
            verifyPackagedLocalesMatchSources(packageRoot),
            CHROMIUM_LOCALES.length,
        );

        Fs.appendFileSync(
            Path.join(packageRoot, '_locales', 'en', 'messages.json'),
            '\n',
        );
        Assert.throws(
            () => verifyPackagedLocalesMatchSources(packageRoot),
            /does not match its Chromium source/,
        );
      } finally {
        Fs.rmSync(packageRoot, {recursive: true, force: true});
      }

    });

  });
}

if (require.main === module) {
  const fileCount = verifyPackageIntegrity(PACKAGED_CHROMIUM_ROOT);
  const manifestIdentity = verifyPackagedManifestIdentity(PACKAGED_CHROMIUM_ROOT);
  const localeCount = verifyPackagedLocalesMatchSources(PACKAGED_CHROMIUM_ROOT);
  console.log(`Verified Chromium package integrity: ${fileCount} files.`);
  console.log(
      'Verified packaged Chromium version: ' +
      `${manifestIdentity.version} (${manifestIdentity.versionName}).`,
  );
  console.log(
      `Verified packaged Chromium locales: ${localeCount} source-identical files.`,
  );
}

module.exports = {
  getForbiddenDirectoryReason,
  getForbiddenReason,
  listPackageEntries,
  PACKAGED_CHROMIUM_ROOT,
  verifyPackageIntegrity,
  verifyPackagedManifestIdentity,
  verifyPackagedLocalesMatchSources,
};
