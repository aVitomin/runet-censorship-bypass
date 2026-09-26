import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (name) => fs.readFileSync(path.join(root, name));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('docs/assets/store/provenance.json'));
const evidence = JSON.parse(read('docs/assets/store/regression-results.json'));
const assetRoots = ['docs/assets/store/', 'docs/assets/workflows-1.0/'];
const files = (directory) => fs.readdirSync(directory, {withFileTypes: true})
  .flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]);
const relative = (name) => path.relative(root, name).replaceAll('\\', '/');

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.assets.length, 14);
assert.equal(new Set(manifest.assets.map((asset) => asset.path)).size, 14);
assert.equal(manifest.privacyReview.everyImageInspected, true);
assert.equal(manifest.privacyReview.sensitiveMaterialFound, false);
assert.equal(manifest.firefoxNativePopupStatus, 'manual pre-release capture required');
assert.equal(evidence.sourceCommit, manifest.sourceCommit);
assert.equal(evidence.result, 'PASS');
assert.equal(evidence.screenshotsCreatedBeforeGatePassed, 0);
assert.equal(evidence.scenarios.filter((scenario) => scenario.scenario === 'A').length, 2);
for (const scenario of evidence.scenarios.filter((item) => item.scenario === 'A')) {
  for (const field of ['applyOk', 'active', 'savedUnchanged', 'sameForm', 'sameInputs', 'fieldsUnchanged', 'saveEnabled']) {
    assert.equal(scenario[field], true, field);
  }
  assert.equal(scenario.applying, false);
  assert.equal(scenario.unsaved, scenario.dirty);
  assert.equal(scenario.applyEnabled, !scenario.dirty);
}
const layouts = evidence.scenarios.filter((scenario) => scenario.scenario === 'B');
assert.deepEqual(layouts.map((item) => `${item.locale}/${item.width}`).sort(),
  ['en-US/1280', 'en-US/700', 'ru/1280', 'ru/700']);
for (const layout of layouts) {
  assert.equal(layout.scrollWidth, layout.width);
  assert.equal(layout.groups.length, 3);
  assert.equal(layout.groups.reduce((total, group) => total + group.pairsChecked, 0), 16);
  for (const group of layout.groups) {
    assert.equal(group.allGroupedAndOrdered, true);
    assert.equal(group.overflow, false);
    assert.equal(group.clipping, false);
  }
}
assert.deepEqual(evidence.scenarios.find((item) => item.scenario === 'C1').categories, ['siteRules']);
assert.deepEqual(evidence.scenarios.find((item) => item.scenario === 'C2').categories,
  ['siteRules', 'proxyConnections']);

const screenshotCounts = {chromium: 0, firefox: 0};
let popupCount = 0;
let promotionCount = 0;
for (const asset of manifest.assets) {
  assert.ok(assetRoots.some((prefix) => asset.path.startsWith(prefix)));
  assert.ok(!asset.path.includes('..') && !asset.path.includes('\\'));
  assert.equal(asset.privacyReviewed, true);
  assert.equal(asset.dpr, 1);
  assert.ok(asset.browser && asset.state && asset.capturedAt && Array.isArray(asset.syntheticInputs));
  const bytes = read(asset.path);
  assert.equal(hash(bytes), asset.sha256, asset.path);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.path);
  const dimensions = {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
  assert.deepEqual(dimensions, asset.dimensions, asset.path);
  assert.deepEqual(dimensions, asset.viewport, asset.path);
  let offset = 8;
  const chunks = [];
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, asset.path);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    assert.ok(['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM', 'pHYs'].includes(type),
      `${asset.path}: unexpected metadata chunk ${type}`);
    chunks.push(type);
    offset += length + 12;
    assert.ok(offset <= bytes.length, asset.path);
  }
  assert.equal(chunks[0], 'IHDR');
  assert.equal(chunks.at(-1), 'IEND');
  assert.ok(chunks.includes('IDAT'));
  if (asset.usage === 'store-screenshot') {
    assert.deepEqual(dimensions, {width: 1280, height: 800});
    assert.equal(asset.classification, 'installed-extension-options');
    assert.equal(asset.nativePopup, false);
    assert.ok(asset.locale);
    const browser = asset.path.includes('/chromium/') ? 'chromium' : 'firefox';
    screenshotCounts[browser]++;
  } else if (asset.usage === 'documentation-workflow') {
    assert.equal(asset.classification, 'native-browser-action-popup');
    assert.equal(asset.nativePopup, true);
    assert.equal(asset.nativeEvidence.tab, null);
    assert.equal(asset.nativeEvidence.standalone, false);
    assert.ok(asset.path.includes('/chromium/'));
    assert.equal(dimensions.width, 392);
    popupCount++;
  } else {
    assert.equal(asset.usage, 'promotion');
    assert.equal(asset.classification, 'promotional-artwork');
    assert.equal(asset.nativePopup, false);
    assert.deepEqual(dimensions, {width: 440, height: 280});
    promotionCount++;
  }
}
assert.deepEqual(screenshotCounts, {chromium: 5, firefox: 5});
assert.equal(popupCount, 3);
assert.equal(promotionCount, 1);
assert.deepEqual(assetRoots.flatMap((prefix) => files(path.join(root, prefix)))
  .filter((name) => name.endsWith('.png')).map(relative).sort(),
manifest.assets.map((asset) => asset.path).sort());
assert.equal(hash(read(manifest.sourceArtwork.path)), manifest.sourceArtwork.sha256);
const svg = read(manifest.sourceArtwork.vector).toString('utf8');
assert.match(svg, /viewBox="0 0 440 280"/u);
assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)="(?:https?:|\/\/)|[A-Z]:[\\/]/u);
assert.match(svg, /href="\.\.\/\.\.\/\.\.\/\.\.\/extension\/src\/assets\/brand\/icon-512\.png"/u);
for (const name of ['provenance.json', 'regression-results.json']) {
  assert.doesNotMatch(read(`docs/assets/store/${name}`).toString('utf8'),
    /[A-Z]:[\\/]|\\\\|\/Users\/|\/home\/|file:\/\//u, name);
}
console.log('PASS: 14 reviewed PNGs; 10 store screenshots at 1280x800, 3 native popup viewports, 440x280 artwork; hashes, metadata and regression evidence.');

if (process.argv.includes('--packages')) {
  const assetHashes = new Set(manifest.assets.map((asset) => asset.sha256));
  for (const browser of ['chromium', 'firefox']) {
    const directory = path.join(root, 'extension/build', browser);
    assert.ok(fs.existsSync(directory), `Production build missing: ${browser}`);
    const packaged = files(directory);
    for (const name of packaged) {
      assert.ok(!assetHashes.has(hash(fs.readFileSync(name))), `Documentation image packaged: ${relative(name)}`);
      assert.doesNotMatch(relative(name), /\/docs\/|\/store\/|\/workflows-1\.0\//u);
    }
    console.log(`PASS: ${browser} package excludes visual assets (${packaged.length} files inspected).`);
  }
}
