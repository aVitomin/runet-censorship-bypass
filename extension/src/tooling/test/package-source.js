'use strict';

const Assert = require('node:assert/strict');
const {firefoxPackageSource} = require('../package-source');

describe('Layout-only Firefox package compatibility', function() {

  it('preserves the historical Node-only import spelling in shipped bytes', function() {

    const source = Buffer.from(
        "require('../../shared/provider-dataset');\r\nroot.mv3ProviderDataset;",
    );
    Assert.equal(firefoxPackageSource('background/dataset-store.js', source)
        .toString(), "require('../../extension-mv3-common/provider-dataset');" +
        '\r\nroot.mv3ProviderDataset;');
    Assert.equal(source.toString().includes('../../shared/'), true);

  });

  it('does not rewrite UI, shared files or unknown imports', function() {

    const bytes = Buffer.from("require('../../shared/provider-dataset');");
    for (const path of ['pages/options/index.js', 'background/common/file.js']) {
      Assert.equal(firefoxPackageSource(path, bytes), bytes);
    }
    const unknown = Buffer.from("require('../../shared/other');");
    Assert.deepEqual(firefoxPackageSource('background/other.js', unknown), unknown);

  });

});
