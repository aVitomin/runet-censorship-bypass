'use strict';


const Assert = require('assert');
const Fs = require('fs');
const Path = require('path');
const {loadBackgroundModules} = require('./background-modules');

const SHARED_ASSET_ROOT = Path.resolve(__dirname, '..', '..', 'assets');
const PACKAGED_CHROMIUM_ROOT = Path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'build',
    'chromium',
);

function getRuntimeIconData() {

  loadBackgroundModules();
  const actionStatus = global.mv3ActionStatus;
  const active = {
    controllable: true,
    mode: 'auto',
    proxyApplied: true,
    proxyControl: {
      controlsPac: true,
      controlledByThisExtension: true,
      levelOfControl: 'controlled_by_this_extension',
    },
  };
  return {
    paths: actionStatus.getRuntimeIconPaths(),
    variants: {
      active: actionStatus.getIconPath(active),
      off: actionStatus.getIconPath({
        proxyApplied: false,
        proxyControl: {
          controlsPac: false,
          canControl: true,
          levelOfControl: 'controllable_by_this_extension',
        },
      }),
      external: actionStatus.getIconPath({
        proxyApplied: false,
        proxyControl: {
          controlsPac: false,
          canControl: false,
          levelOfControl: 'controlled_by_other_extensions',
        },
      }),
      busy: actionStatus.getIconPath(Object.assign({}, active, {
        operation: 'apply',
      })),
      warning: actionStatus.getIconPath(Object.assign({}, active, {
        pacStale: true,
      })),
      loading: actionStatus.getIconPath({loading: true}),
    },
  };

}

function resolveExactCase(root, resourcePath) {

  let current = root;
  for (const segment of resourcePath.split('/')) {
    Assert.ok(Fs.existsSync(current), `Missing icon parent: ${current}`);
    const entries = Fs.readdirSync(current);
    Assert.ok(
        entries.includes(segment),
        `Missing or case-mismatched runtime icon: ${resourcePath}`,
    );
    current = Path.join(current, segment);
  }
  return current;

}

function assertExtensionRelativePath(resourcePath) {

  Assert.strictEqual(typeof resourcePath, 'string');
  Assert.ok(resourcePath.length > 0, 'Runtime icon paths must not be empty.');
  Assert.ok(!Path.posix.isAbsolute(resourcePath), resourcePath);
  Assert.ok(!Path.win32.isAbsolute(resourcePath), resourcePath);
  Assert.ok(!resourcePath.includes('\\'), resourcePath);
  Assert.ok(!/^file:/i.test(resourcePath), resourcePath);
  Assert.strictEqual(Path.posix.normalize(resourcePath), resourcePath);

}

function readPngSize(filePath) {

  const data = Fs.readFileSync(filePath);
  Assert.ok(
      data.length >= 24 &&
      data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      `Runtime icon is not a valid PNG: ${filePath}`,
  );
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };

}

function verifyRuntimeIcons(root) {

  const iconData = getRuntimeIconData();
  const manifestPath = root === SHARED_ASSET_ROOT ?
    Path.resolve(__dirname, '..', 'manifest.tmpl.json') :
    Path.join(root, 'manifest.json');
  const manifest = JSON.parse(Fs.readFileSync(manifestPath, 'utf8'));
  const iconMaps = [
    ...Object.values(iconData.variants),
    manifest.icons,
    manifest.action.default_icon,
  ];
  const referencedPaths = [...new Set([
    ...iconData.paths,
    ...iconMaps.flatMap((paths) => Object.values(paths)),
  ])];
  const resolvedByPath = new Map();
  for (const resourcePath of referencedPaths) {
    assertExtensionRelativePath(resourcePath);
    const resolved = resolveExactCase(root, resourcePath);
    Assert.ok(Fs.statSync(resolved).isFile(), `Runtime icon is not a file: ${resolved}`);
    resolvedByPath.set(resourcePath, resolved);
  }
  for (const paths of iconMaps) {
    for (const [declaredSize, resourcePath] of Object.entries(paths)) {
      const size = readPngSize(resolvedByPath.get(resourcePath));
      Assert.deepStrictEqual(
          size,
          {width: Number(declaredSize), height: Number(declaredSize)},
          `Runtime icon size does not match its setIcon map: ${resourcePath}`,
      );
    }
  }
  const packagedIcons = Fs.readdirSync(Path.join(root, 'icons'))
      .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
      .sort();
  const referencedIcons = referencedPaths
      .map((resourcePath) => Path.posix.basename(resourcePath))
      .sort();
  Assert.deepStrictEqual(
      packagedIcons,
      referencedIcons,
      'The icon directory must contain only runtime or manifest icon assets.',
  );
  return referencedPaths;

}

if (require.main === module) {
  const sourcePaths = verifyRuntimeIcons(SHARED_ASSET_ROOT);
  const packagedPaths = verifyRuntimeIcons(PACKAGED_CHROMIUM_ROOT);
  Assert.deepStrictEqual(packagedPaths, sourcePaths);
  for (const resourcePath of packagedPaths) {
    Assert.deepStrictEqual(
        Fs.readFileSync(Path.join(PACKAGED_CHROMIUM_ROOT, resourcePath)),
        Fs.readFileSync(Path.join(SHARED_ASSET_ROOT, resourcePath)),
        `Packaged icon differs from shared source: ${resourcePath}`,
    );
    console.log(`Verified packaged runtime icon: ${resourcePath}`);
  }
}

module.exports = {
  PACKAGED_CHROMIUM_ROOT,
  SHARED_ASSET_ROOT,
  getRuntimeIconData,
  verifyRuntimeIcons,
};
