'use strict';

const gulp = require('gulp');
const buildCleanup = require('./build-cleanup');
const {Transform} = require('node:stream');
const {firefoxPackageSource} = require('./src/tooling/package-source');

function renderTemplate(source, context) {

  if (typeof source !== 'string' || !context || typeof context !== 'object') {
    throw new TypeError('Template source and context are required.');
  }
  const rendered = source.replace(/\r\n/gu, '\n')
      .replace(/\$\{([A-Za-z][A-Za-z0-9]*)\}/gu,
      (token, key) => {
        if (!Object.prototype.hasOwnProperty.call(context, key)) {
          throw new Error(`Unknown template value: ${key}`);
        }
        const value = context[key];
        if (typeof value !== 'string' && typeof value !== 'number') {
          throw new TypeError(`Template value must be scalar: ${key}`);
        }
        return String(value);
      });
  if (rendered.includes('${')) {
    throw new Error('Malformed or unsupported template expression.');
  }
  return rendered;

}

const templatePlugin = (context) => new Transform({
  objectMode: true,
  transform(file, encoding, cb) {

  const suffixes = ['.tmpl.json', '.tmpl.js'];
  if ( suffixes.some( (suff) => file.path.endsWith(suff) ) ) {

    const originalPath = file.path;
    file.path = file.path.replace(/\.tmpl(?=\.[^.]+$)/u, '');

    if (file.isStream()) {
      return cb(new Error('Template streams are not supported.'));
    } else if (file.isBuffer()) {
      try {
        file.contents = Buffer.from(renderTemplate(String(file.contents), context));
      } catch(e) {
        e.message += '\nIN FILE: ' + originalPath;
        return cb(e);
      }
    }

  }
  cb(null, file);

  },
});


const contexts = require('./src/templates-data').contexts;
const chromiumDst = './build/chromium';
const firefoxDst = './build/firefox';
const chromiumRuntimeSrc = [
  './src/chromium/**/*',
  '!./src/chromium/test',
  '!./src/chromium/test/',
  '!./src/chromium/test/**/*',
  '!./src/chromium/**/AGENTS.md',
];
const chromiumCommonSrc = './src/chromium-compat/pages/lib/**/*';
const firefoxRuntimeSrc = [
  './src/firefox/manifest.json',
  './src/firefox/background/off-state.js',
  './src/firefox/background/proxy-control.js',
  './src/firefox/background/dataset-store.js',
  './src/firefox/background/provider-updater.js',
  './src/firefox/background/provider-update-control.js',
  './src/firefox/background/dataset-promotion.js',
  './src/firefox/background/provider-lookup.js',
  './src/firefox/background/dataset-runtime.js',
  './src/firefox/background/routing-adapter.js',
  './src/firefox/background/proxy-auth.js',
  './src/firefox/background/product-config.js',
  './src/firefox/background/production-provider.js',
  './src/firefox/background/settings-control.js',
  './src/firefox/background/configuration-transfer.js',
  './src/firefox/background/site-control.js',
  './src/firefox/background/activation-controller.js',
  './src/firefox/background/operational-status.js',
  './src/firefox/background/event-page.js',
  './src/firefox/pages/shared/ui-runtime.js',
  './src/firefox/pages/shared/ui-tokens.css',
  './src/firefox/pages/popup/index.html',
  './src/firefox/pages/popup/index.js',
  './src/firefox/pages/popup/popup.css',
  './src/firefox/pages/options/index.html',
  './src/firefox/pages/options/index.js',
  './src/firefox/pages/options/options.css',
  './src/firefox/_locales/en/messages.json',
  './src/firefox/_locales/ru/messages.json',
  './src/firefox/provider/anticensority-hosts-v1.data',
  './src/firefox/provider/anticensority-hosts-v1.envelope.json',
];
const firefoxCommonSrc = [
  './src/shared/configuration-transfer.js',
  './src/shared/configuration-transfer-ui.js',
  './src/shared/routing-contract.js',
  './src/shared/provider-dataset.js',
  './src/shared/provider-dataset-state.js',
];
const chromiumTldtsSrc = [
  './node_modules/tldts/dist/index.umd.min.js',
  './node_modules/tldts/LICENSE',
];
const firefoxTldtsSrc = chromiumTldtsSrc;
const firefoxIconSrc = [
  'active',
  'busy',
  'external',
  'loading',
  'off',
  'warning',
].flatMap((state) => [16, 19, 20, 32, 38].map((size) =>
  `./src/chromium/icons/action-${state}-${size}.png`,
)).concat([
  './src/chromium/icons/action-active-48.png',
  './src/chromium/icons/action-active-128.png',
]);

const cleanChromium = function(cb) {

  buildCleanup.cleanChromium();
  return cb();

};

const copyChromium = function(cb) {

  gulp.src(
      chromiumRuntimeSrc,
      {encoding: false},
  )
    .pipe(templatePlugin(contexts.chromium))
    .pipe(gulp.dest(chromiumDst))
    .on('end', cb);

};

const copyChromiumCommon = function(cb) {

  gulp.src(
      chromiumCommonSrc,
      {base: './src/chromium-compat', encoding: false},
  )
    .pipe(gulp.dest(chromiumDst))
    .on('end', cb);

};

const copyChromiumTransfer = function(cb) {

  gulp.src([
    './src/shared/configuration-transfer.js',
    './src/shared/configuration-transfer-ui.js',
  ], {base: './src/shared', encoding: false})
    .pipe(gulp.dest(`${chromiumDst}/background/common`))
    .on('end', cb);

};

const copyChromiumTldts = function(cb) {

  gulp.src(chromiumTldtsSrc, {
    base: './node_modules/tldts',
    encoding: false,
  })
    .pipe(gulp.dest(`${chromiumDst}/background/vendor/tldts`))
    .on('end', cb);

};

const cleanFirefox = function(cb) {

  buildCleanup.cleanFirefox();
  return cb();

};

const copyFirefox = function(cb) {

  gulp.src(firefoxRuntimeSrc, {
    base: './src/firefox',
    encoding: false,
  })
    .pipe(new Transform({
      objectMode: true,
      transform(file, encoding, cb) {

        if (!file.isBuffer()) return cb(new Error('Expected Firefox source bytes.'));
        file.contents = firefoxPackageSource(
            file.relative.replace(/\\/gu, '/'), file.contents,
        );
        cb(null, file);

      },
    }))
    .pipe(gulp.dest(firefoxDst))
    .on('end', cb);

};

const copyFirefoxCommon = function(cb) {

  gulp.src(firefoxCommonSrc, {
    base: './src/shared',
    encoding: false,
  })
    .pipe(gulp.dest(`${firefoxDst}/background/common`))
    .on('end', cb);

};

const copyFirefoxTldts = function(cb) {

  gulp.src(firefoxTldtsSrc, {
    base: './node_modules/tldts',
    encoding: false,
  })
    .pipe(gulp.dest(`${firefoxDst}/background/vendor/tldts`))
    .on('end', cb);

};

const copyFirefoxIcons = function(cb) {

  gulp.src(firefoxIconSrc, {
    base: './src/chromium',
    encoding: false,
  })
    .pipe(gulp.dest(firefoxDst))
    .on('end', cb);

};

const buildChromium = gulp.series(
    cleanChromium,
    gulp.parallel(
        copyChromium,
        copyChromiumCommon,
        copyChromiumTransfer,
        copyChromiumTldts,
    ),
);
const buildFirefox = gulp.series(
    cleanFirefox,
    gulp.parallel(
        copyFirefox,
        copyFirefoxCommon,
        copyFirefoxIcons,
        copyFirefoxTldts,
    ),
);

module.exports = {
  buildChromium,
  buildFirefox,
  renderTemplate,
};
