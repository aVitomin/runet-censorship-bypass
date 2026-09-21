'use strict';


const Chai = require('chai');
const Mocha = require('mocha');
const Fs = require('fs');
const Path = require('path');
const Zlib = require('zlib');
const {
  BRAND_ICON_PATH,
  getExpectedActionIcons,
  renderActionIcon,
} = require('./generate-action-icons');
const {
  SHARED_ASSET_ROOT,
  getRuntimeIconData,
  verifyRuntimeIcons,
} = require('./verify-runtime-icons');

function getPngChunkTypes(data) {

  const types = [];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    types.push(type);
    offset += length + 12;
  }
  Chai.expect(offset).to.equal(data.length);
  return types;

}

Mocha.describe('Chromium runtime action icons', function() {

  Mocha.it('enumerates extension-relative runtime icons present in source',
      function() {

        Chai.expect(verifyRuntimeIcons(SHARED_ASSET_ROOT).sort()).to.deep.equal(
            getExpectedActionIcons().map(({fileName}) => `icons/${fileName}`).sort(),
        );
        Chai.expect(getExpectedActionIcons()).to.have.length(33);

      });

  Mocha.it('selects the expected size map for every icon state',
      function() {

        const iconData = getRuntimeIconData();
        Chai.expect(Object.keys(iconData.variants)).to.deep.equal([
          'active',
          'off',
          'external',
          'busy',
          'warning',
          'loading',
        ]);
        Chai.expect(iconData.variants.active).to.include({
          16: 'icons/action-active-16.png',
          128: 'icons/action-active-128.png',
        });
        Chai.expect(iconData.variants.off).to.include({
          16: 'icons/action-off-16.png',
          38: 'icons/action-off-38.png',
        });
        Chai.expect(Object.keys(iconData.variants.loading).map(Number))
            .to.deep.equal([16, 19, 20, 32, 38]);
        Chai.expect(Object.keys(iconData.variants.active).map(Number))
            .to.deep.equal([16, 19, 20, 32, 38, 48, 128]);

      });

  Mocha.it('keeps every checked-in PNG equal to deterministic generation',
      function() {

        for (const icon of getExpectedActionIcons()) {
          const stored = Fs.readFileSync(
              Path.join(SHARED_ASSET_ROOT, 'icons', icon.fileName),
          );
          Chai.expect(stored.equals(renderActionIcon(
              icon.variant,
              icon.size,
          )), icon.fileName).to.equal(true);
        }

      });

  Mocha.it('decodes metadata-free RGBA icons with exact sizes and transparency',
      function() {

        for (const icon of getExpectedActionIcons().concat([
          {fileName: '../brand/icon-512.png', size: 512},
        ])) {
          const stored = Fs.readFileSync(
              Path.join(SHARED_ASSET_ROOT, 'icons', icon.fileName),
          );
          Chai.expect(stored[24], `${icon.fileName} bit depth`).to.equal(8);
          Chai.expect(stored[25], `${icon.fileName} color type`).to.equal(6);
          Chai.expect(
              getPngChunkTypes(stored),
              `${icon.fileName} chunks`,
          ).to.deep.equal(['IHDR', 'IDAT', 'IEND']);
          Chai.expect(stored.subarray(0, 8).toString('hex'))
              .to.equal('89504e470d0a1a0a');
          Chai.expect(stored.readUInt32BE(16), icon.fileName).to.equal(icon.size);
          Chai.expect(stored.readUInt32BE(20), icon.fileName).to.equal(icon.size);
          Chai.expect([...stored.subarray(26, 29)]).to.deep.equal([0, 0, 0]);
          // The authoritative encoder emits one unfiltered RGBA IDAT stream.
          const bytes = Zlib.inflateSync(stored.subarray(
              41, 41 + stored.readUInt32BE(33),
          ));
          const stride = icon.size * 4 + 1;
          Chai.expect(bytes.length).to.equal(stride * icon.size);
          const alphas = new Set();
          for (let y = 0; y < icon.size; y += 1) {
            Chai.expect(bytes[y * stride]).to.equal(0);
            for (let x = 0; x < icon.size; x += 1) {
              alphas.add(bytes[y * stride + 1 + x * 4 + 3]);
            }
          }
          Chai.expect(alphas.has(0), `${icon.fileName} transparent`).to.equal(true);
          Chai.expect([...alphas].some((alpha) => alpha > 0),
              `${icon.fileName} visible artwork`).to.equal(true);
        }

      });

  Mocha.it('derives the unbundled 512px branding export from the same generator',
      function() {

        Chai.expect(Fs.readFileSync(BRAND_ICON_PATH).equals(
            renderActionIcon('active', 512),
        )).to.equal(true);
        Chai.expect(Fs.readdirSync(Path.dirname(BRAND_ICON_PATH)))
            .to.deep.equal(['icon-512.png']);
        const firefox = JSON.parse(Fs.readFileSync(Path.resolve(
            SHARED_ASSET_ROOT, '..', 'firefox', 'manifest.json',
        ), 'utf8'));
        Chai.expect(firefox.icons).to.deep.equal({
          32: 'icons/action-active-32.png',
          48: 'icons/action-active-48.png',
          64: 'icons/action-active-64.png',
          128: 'icons/action-active-128.png',
        });

      }).timeout(10000);

});
