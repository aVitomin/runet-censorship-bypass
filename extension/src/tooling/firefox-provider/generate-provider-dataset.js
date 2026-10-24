'use strict';

const Crypto = require('node:crypto');
const Fs = require('node:fs/promises');
const Path = require('node:path');
const Dataset = require('../../shared/provider-dataset');
const ProviderUpdater = require(
    '../../firefox/background/provider-updater');

const {
  EXPECTED_CUSTOM_PROXIES, EXPECTED_TOR_PROXIES, MAX_SOURCE_BYTES,
  countRules, createPayload, extractPacData,
} = require('../../firefox/background/anticensority-source');
const MAX_REDIRECTS = 3;

function toolingError(code) {

  const error = new TypeError(code);
  error.code = code;
  return error;

}

function sha256(bytes) {

  return Crypto.createHash('sha256').update(bytes).digest('hex');

}

async function generateFromPacBytes(options = {}) {

  const sourceBytes = options.sourceBytes instanceof Uint8Array ?
    new Uint8Array(options.sourceBytes) : null;
  if (!sourceBytes) {
    throw toolingError('SOURCE_BYTES_REQUIRED');
  }
  const actualSourceSha256 = sha256(sourceBytes);
  if (!/^[a-f0-9]{64}$/.test(options.sourceSha256) ||
      actualSourceSha256 !== options.sourceSha256) {
    throw toolingError('SOURCE_SHA256_MISMATCH');
  }
  if (!/^[a-f0-9]{40}$/.test(options.sourceRevision) ||
      !/^[a-f0-9]{40}$/.test(options.generatorRevision)) {
    throw toolingError('SOURCE_REVISION_INVALID');
  }
  if (typeof options.datasetVersion !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(
          options.datasetVersion)) {
    throw toolingError('DATASET_VERSION_INVALID');
  }
  const extracted = extractPacData(sourceBytes);
  const generatedAt = options.generatedAt || extracted.updatedAt;
  if (new Date(Date.parse(generatedAt)).toISOString() !== generatedAt) {
    throw toolingError('GENERATED_TIMESTAMP_INVALID');
  }
  const payload = createPayload(extracted.inputs);
  const artifactBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const envelope = {
    schemaVersion: Dataset.SCHEMA_VERSION,
    providerKey: 'anticensority',
    datasetVersion: options.datasetVersion,
    generatedAt,
    sourceRevisions: [{
      sourceId: 'anticensority-generated-pac',
      revision: `${options.sourceRevision};sha256=${actualSourceSha256}`,
    }, {
      sourceId: 'anticensority-pac-generator',
      revision: options.generatorRevision,
    }],
    ruleCount: countRules(payload),
    artifactByteCount: artifactBytes.byteLength,
    artifactSha256: sha256(artifactBytes),
    routeTableVersion: Dataset.ROUTE_TABLE_VERSION,
  };
  const verification = await Dataset.verifyProviderDataset({
    envelope,
    artifactBytes,
    sha256: async (bytes) => sha256(bytes),
    trust: Dataset.TRUST.PACKAGED_TRUSTED,
  });
  if (!verification.ok) {
    throw toolingError(verification.code);
  }
  return Object.freeze({
    artifactBytes,
    envelope: Object.freeze(envelope),
    policy: extracted.policy,
    sourceByteCount: sourceBytes.byteLength,
    sourceSha256: actualSourceSha256,
  });

}

function validateSourceUrl(value) {

  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw toolingError('SOURCE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash) {
    throw toolingError('SOURCE_URL_INVALID');
  }
  return url;

}

async function readResponseBytes(response) {

  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_SOURCE_BYTES) {
    throw toolingError('INVALID_SOURCE_SIZE');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw toolingError('SOURCE_RESPONSE_REJECTED');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let byteCount = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    if (!(result.value instanceof Uint8Array)) {
      throw toolingError('SOURCE_RESPONSE_REJECTED');
    }
    byteCount += result.value.byteLength;
    if (byteCount > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw toolingError('INVALID_SOURCE_SIZE');
    }
    chunks.push(result.value);
  }
  if (!byteCount) {
    throw toolingError('INVALID_SOURCE_SIZE');
  }
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;

}

async function downloadSource(sourceUrl, fetchImpl = globalThis.fetch) {

  if (typeof fetchImpl !== 'function') {
    throw toolingError('FETCH_UNAVAILABLE');
  }
  const initial = validateSourceUrl(sourceUrl);
  let current = initial;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(current.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_REDIRECTS) {
        throw toolingError('SOURCE_REDIRECT_LIMIT');
      }
      const location = response.headers.get('location');
      if (!location) {
        throw toolingError('SOURCE_RESPONSE_REJECTED');
      }
      const next = validateSourceUrl(new URL(location, current).href);
      if (next.origin !== initial.origin) {
        throw toolingError('SOURCE_REDIRECT_ORIGIN_CHANGED');
      }
      current = next;
      continue;
    }
    if (response.status !== 200 || response.redirected === true ||
        validateSourceUrl(response.url).href !== current.href) {
      throw toolingError('SOURCE_RESPONSE_REJECTED');
    }
    return readResponseBytes(response);
  }
  throw toolingError('SOURCE_REDIRECT_LIMIT');

}

function signManifestBytes(manifestBytes, privateKeyPem) {

  const key = Crypto.createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') {
    throw toolingError('ED25519_PRIVATE_KEY_REQUIRED');
  }
  return Crypto.sign(null, manifestBytes, key);

}

function createUpdateManifest(options = {}) {

  const manifest = {
    schemaVersion: 1,
    providerKey: options.envelope && options.envelope.providerKey,
    sequence: Number(options.sequence),
    keyId: options.keyId,
    artifactPath: options.artifactPath,
    envelope: options.envelope,
  };
  ProviderUpdater.validateManifest(manifest, manifest.providerKey);
  return Object.freeze({
    manifest: Object.freeze(manifest),
    manifestBytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  });

}

function parseArguments(argv) {

  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name || !name.startsWith('--') || value === undefined) {
      throw toolingError('INVALID_ARGUMENTS');
    }
    options[name.slice(2)] = value;
  }
  return options;

}

async function runCli(argv) {

  const options = parseArguments(argv);
  const required = [
    'source-url',
    'source-sha256',
    'source-revision',
    'generator-revision',
    'dataset-version',
    'output-directory',
  ];
  if (required.some((field) => !options[field])) {
    throw toolingError('INVALID_ARGUMENTS');
  }
  const sourceBytes = await downloadSource(options['source-url']);
  const generated = await generateFromPacBytes({
    sourceBytes,
    sourceSha256: options['source-sha256'],
    sourceRevision: options['source-revision'],
    generatorRevision: options['generator-revision'],
    datasetVersion: options['dataset-version'],
    generatedAt: options['generated-at'],
  });
  const outputDirectory = Path.resolve(options['output-directory']);
  await Fs.mkdir(outputDirectory, {recursive: true});
  const artifactName = 'anticensority-hosts-v1.data';
  await Fs.writeFile(Path.join(outputDirectory, artifactName),
      generated.artifactBytes);
  await Fs.writeFile(
      Path.join(outputDirectory, 'anticensority-hosts-v1.envelope.json'),
      `${JSON.stringify(generated.envelope, null, 2)}\n`,
      'utf8');
  const manifestOutputDirectory = Path.resolve(
      options['manifest-output-directory'] || outputDirectory,
  );
  await Fs.mkdir(manifestOutputDirectory, {recursive: true});
  if (options['private-key'] &&
      (!options.sequence || !options['key-id'])) {
    throw toolingError('SIGNED_UPDATE_METADATA_REQUIRED');
  }
  const updateManifest = createUpdateManifest({
    envelope: generated.envelope,
    sequence: options.sequence || 1,
    keyId: options['key-id'] || 'development-key',
    artifactPath: artifactName,
  });
  const manifestBytes = updateManifest.manifestBytes;
  await Fs.writeFile(
      Path.join(
          manifestOutputDirectory,
          'anticensority-hosts-v1.manifest.json',
      ),
      manifestBytes);
  if (options['private-key']) {
    const privateKey = await Fs.readFile(options['private-key']);
    await Fs.writeFile(
        Path.join(
            manifestOutputDirectory,
            'anticensority-hosts-v1.manifest.json.sig',
        ),
        signManifestBytes(manifestBytes, privateKey));
  }
  return generated;

}

if (require.main === module) {
  runCli(process.argv.slice(2)).then((generated) => {
    console.log(JSON.stringify({
      artifactByteCount: generated.envelope.artifactByteCount,
      artifactSha256: generated.envelope.artifactSha256,
      bucketCount: JSON.parse(generated.artifactBytes).buckets.length,
      ruleCount: generated.envelope.ruleCount,
      sourceByteCount: generated.sourceByteCount,
      sourceSha256: generated.sourceSha256,
    }, null, 2));
  }).catch((error) => {
    console.error(error && error.code || 'PROVIDER_GENERATION_FAILED');
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  EXPECTED_CUSTOM_PROXIES,
  EXPECTED_TOR_PROXIES,
  MAX_SOURCE_BYTES,
  createPayload,
  createUpdateManifest,
  downloadSource,
  extractPacData,
  generateFromPacBytes,
  sha256,
  signManifestBytes,
});
