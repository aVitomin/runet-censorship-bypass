'use strict';

const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');
const {ESLint} = require('eslint');
const packageJson = require('../../../package.json');

describe('Lint source coverage', function() {

  const project = Path.resolve(__dirname, '../../..');
  const eslint = new ESLint({cwd: project});
  const shared = 'src/shared';

  it('includes shared files in aggregate and both target commands exactly once', function() {

    for (const command of ['lint', 'lint:chromium', 'lint:firefox']) {
      const args = packageJson.scripts[command].split(/\s+/);
      Assert.equal(args.filter((arg) => arg === './' + shared + '/**/*.js').length, 1);
    }
    Assert.ok(packageJson.scripts['lint:chromium'].includes('./src/chromium/**/*.js'));
    Assert.ok(packageJson.scripts['lint:firefox'].includes('./src/firefox/**/*.js'));

  });

  it('applies actual correctness rules to every shared module', async function() {

    const modules = Fs.readdirSync(Path.join(project, shared), {recursive: true})
        .filter((name) => name.endsWith('.js'));
    Assert.ok(modules.length > 0);
    for (const filename of modules) {
      const filePath = Path.join(project, shared, filename);
      Assert.equal(await eslint.isPathIgnored(filePath), false, filename);
      const config = await eslint.calculateConfigForFile(filePath);
      Assert.equal(config.rules['no-undef'][0], 2, filename);
      const [result] = await eslint.lintText(
          "'use strict';\nunknownSharedBinding();\n", {filePath},
      );
      Assert.ok(result.messages.some((message) => message.ruleId === 'no-undef'), filename);
    }

  });

  it('preserves browser runtime and test rule coverage', async function() {

    for (const relative of [
      'src/chromium/background/service-worker.js',
      'src/firefox/background/event-page.js',
      'src/chromium/test/saved-effective.js',
      'src/firefox/test/saved-effective.test.js',
    ]) {
      const config = await eslint.calculateConfigForFile(Path.join(project, relative));
      Assert.equal(config.rules['no-undef'][0], 2, relative);
      Assert.equal(config.rules.strict[0], 2, relative);
      Assert.equal(config.rules['max-len'][0], 2, relative);
    }

  });

});
