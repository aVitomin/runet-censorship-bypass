'use strict';

// Firefox's Node-only UMD imports are inert in the browser but already shipped.
// Keep those bytes stable during the layout-only move; source tests use shared/.
// This is not a source resolver or a rewrite of browser script references.
function firefoxPackageSource(relativePath, bytes) {

  if (!/^background\/[^/]+\.js$/u.test(relativePath)) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(
      /require\('\.\.\/\.\.\/shared\/(configuration-transfer|provider-dataset(?:-state)?|routing-contract)'\)/gu,
      "require('../../extension-mv3-common/$1')",
  ));

}

module.exports = Object.freeze({firefoxPackageSource});
