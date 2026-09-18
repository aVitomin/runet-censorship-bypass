#!/usr/bin/env node

import Assert from 'node:assert/strict';
import ChildProcess from 'node:child_process';
import Crypto from 'node:crypto';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Path.join(
    ROOT, 'extensions', 'chromium', 'runet-censorship-bypass',
);
const BUILD = Path.join(PROJECT, 'build');
const CHROMIUM_PACKAGE = Path.join(BUILD, 'extension-chromium-mv3');
const FIREFOX_PACKAGE = Path.join(BUILD, 'extension-firefox-mv3');
const require = createRequire(import.meta.url);
const Puppeteer = require(Path.join(PROJECT, 'node_modules', 'puppeteer-core'));
const FirefoxSmoke = require(Path.join(
    PROJECT,
    'src',
    'extension-firefox-mv3',
    'test',
    'firefox-lifecycle-smoke.js',
));
const FirefoxSettings = require(Path.join(
    PROJECT,
    'src',
    'extension-firefox-mv3',
    'background',
    'settings-control.js',
));

const POPUP_STATES = Object.freeze([
  'off',
  'auto',
  'proxy',
  'direct',
  'pending',
  'active',
  'external',
  'blocked',
  'health-warning',
]);
const LOCALES = Object.freeze(['en', 'ru']);
const SCALES = Object.freeze([1, 1.25, 1.5]);
const OPTIONS = Object.freeze({
  chromium: [
    'overview',
    'routing-sources',
    'site-rules',
    'proxy-methods',
    'maintenance',
    'advanced',
    'about',
  ],
  firefox: [
    'overview',
    'automatic-routing',
    'site-rules',
    'proxy-connections',
    'maintenance',
    'advanced',
    'about',
  ],
});
const QA_TIMEOUT_MS = 30000;

function parseArguments(argv) {

  const result = {
    chromiumBin: String(process.env.CHROMIUM_BIN || '').trim(),
    firefoxBin: String(process.env.FIREFOX_BIN || '').trim(),
    output: Path.join(ROOT, '.local', 'cross-browser-visual-qa'),
    target: 'both',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === '--chromium-bin' || name === '--firefox-bin' ||
        name === '--output' || name === '--target') {
      Assert.ok(value, `${name} requires a value.`);
      result[name.slice(2).replace(/-([a-z])/g, (_match, letter) =>
        letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${name}`);
  }
  result.output = Path.resolve(result.output);
  Assert.ok(['both', 'chromium', 'firefox'].includes(result.target));
  return result;

}

function ensureBuiltPackage(packageRoot, manifestVersion) {

  const manifestPath = Path.join(packageRoot, 'manifest.json');
  Assert.ok(Fs.existsSync(manifestPath), `Build first: ${manifestPath}`);
  const manifest = JSON.parse(Fs.readFileSync(manifestPath, 'utf8'));
  Assert.equal(manifest.manifest_version, manifestVersion);

}

function resetDirectory(directory) {

  const resolved = Path.resolve(directory);
  const localRoot = Path.resolve(ROOT, '.local');
  Assert.ok(
      resolved.startsWith(`${localRoot}${Path.sep}`),
      `QA output must stay under ${localRoot}.`,
  );
  Fs.rmSync(resolved, {force: true, recursive: true});
  Fs.mkdirSync(resolved, {recursive: true});

}

function fixtureSource(target) {

  if (target === 'chromium') {
    return `'use strict';
(function() {
  const original = window.mv3Rpc;
  const query = new URL(location.href).searchParams;
  const name = query.get('qaState') || 'off';
  const language = query.get('qaLocale') === 'ru' ? 'ru' : 'en';
  const now = 1700000000000;
  const state = {
    uiLanguage: language,
    host: 'sub.example.com',
    controllable: true,
    reason: '',
    mode: name === 'proxy' ? 'proxy' : name === 'direct' ? 'direct' : 'auto',
    siteRule: {scope: 'domain', pattern: '*.example.com'},
    sitePatterns: {
      exactPattern: 'sub.example.com', wildcardPattern: '*.example.com',
      wildcardAvailable: true, registrableDomain: 'example.com',
      domainResolution: 'public-suffix-list'
    },
    providers: [{
      key: 'Anticensority', label: 'Anticensority', description: '',
      type: 'builtIn', readOnly: true
    }],
    selectedProvider: 'Anticensority',
    selectedProviderLabel: 'Anticensority',
    pacDownloaded: true,
    pacCooked: true,
    pacStale: false,
    pacStaleReasons: [],
    pacUpdatedAt: now,
    pacCookedAt: now,
    pacDownloadStatus: 'success',
    pacCookStatus: 'success',
    proxyApplied: !['off', 'pending', 'external', 'blocked'].includes(name),
    proxyApplyStatus: name === 'blocked' ? 'error' :
      ['off', 'pending', 'external'].includes(name) ? 'cleared' : 'applied',
    proxyControl: {
      levelOfControl: name === 'external' ?
        'controlled_by_other_extensions' : 'controlled_by_this_extension',
      canControl: name !== 'external',
      controlledByThisExtension: name !== 'external',
      controlsPac: !['off', 'pending', 'external', 'blocked'].includes(name),
      checkedAt: now
    },
    proxyHealth: {
      status: name === 'health-warning' ? 'error' : 'ok',
      lastCheckedAt: now,
      candidateType: 'localTor'
    },
    autoUpdate: {
      enabled: true, intervalHours: 12, lastSuccessfulUpdateAt: now, error: null
    },
    proxyCandidates: {available: true, labels: ['Local Tor']},
    quickProxies: {
      usePacScriptProxies: true,
      ownProxiesOnlyForOwnSites: true,
      localTorEnabled: true,
      torBrowserEnabled: false,
      warpEnabled: false,
      ownProxiesConfigured: false,
      ownProxiesEnabled: false,
      ownProxyCount: 0,
      enabledOwnProxyCount: 0
    },
    warnings: []
  };
  window.mv3Rpc = Object.freeze(Object.assign({}, original, {
    async callBackground(method, params) {
      if (method === 'getPopupState') return state;
      return original.callBackground(method, params);
    }
  }));
})();
`;
  }
  const defaultSettings = JSON.stringify(FirefoxSettings.createDefaultSettings());
  return `'use strict';
(function() {
  const settings = ${defaultSettings};
  function stateFor(sender) {
    const query = new URL(sender && sender.url || 'moz-extension://qa/').searchParams;
    const name = query.get('qaState') || 'off';
    const ready = ['auto', 'proxy', 'direct', 'active', 'health-warning'].includes(name);
    const external = name === 'external';
    const blocked = name === 'blocked';
    const mode = name === 'proxy' || name === 'health-warning' ? 'PROXY' :
      name === 'direct' ? 'DIRECT' : 'AUTO';
    const capabilities = {
      apiVersion: 2,
      browser: 'FIREFOX',
      manifestVersion: 3,
      runtimeModel: 'BACKGROUND_EVENT_PAGE',
      runtimeState: ready ? 'READY' : external || blocked ? 'FAILED' : 'OFF',
      durableIntent: ready || blocked ? 'ON' : 'OFF',
      recoveryStatus: external ? 'BLOCKED_CONTROL_LOSS' :
        blocked ? 'BLOCKED_PRIVATE_ACCESS' : ready ? 'ACTIVE' : 'OFF',
      recoveryFailureCode: external ? 'CONTROL_LOSS' :
        blocked ? 'BLOCKED_PRIVATE_ACCESS' : null,
      privateWindowAccess: blocked ? 'DENIED' : 'GRANTED',
      routingImplemented: true,
      activationSupported: true,
      providerDatasetImplemented: true,
      providerDatasetAvailable: true,
      providerUpdateImplemented: true,
      providerUpdateConfigured: false
    };
    const site = {
      schemaVersion: 1,
      revision: 7,
      target: {controllable: true, host: 'sub.example.com', reasonCode: null},
      route: {mode, scope: 'DOMAIN', pattern: '*.example.com'},
      patterns: {
        exact: 'sub.example.com', wildcard: '*.example.com',
        wildcardAvailable: true
      },
      proxyCandidateAvailable: true
    };
    const operational = {
      schemaVersion: 1,
      health: {
        status: name === 'health-warning' ? 'ERROR' : 'OK',
        code: name === 'health-warning' ? 'HEALTH_CHECK_FAILED' : null,
        checkedAt: 1700000000000,
        candidateType: 'localTor'
      },
      diagnostics: {
        schemaVersion: 1,
        generatedAt: 1700000000000,
        extensionVersion: '0.0.4.0',
        browserName: 'Firefox',
        browserVersion: '154.0.1',
        runtimeState: capabilities.runtimeState,
        durableIntent: capabilities.durableIntent,
        recoveryStatus: capabilities.recoveryStatus,
        recoveryFailureCode: capabilities.recoveryFailureCode,
        controlLevel: external ? 'controlled_by_other_extensions' :
          'controlled_by_this_extension',
        datasetAvailable: true,
        datasetVersion: 'production-v1',
        configuredProxyCount: 4,
        enabledProxyCount: 2,
        proxyTypes: ['HTTPS', 'SOCKS5'],
        privateWindowAccess: capabilities.privateWindowAccess,
        notificationsAvailable: true
      }
    };
    const providerUpdate = {
      schemaVersion: 1,
      trustConfigured: false,
      automaticChecksEnabled: false,
      status: 'NOT_CONFIGURED',
      updateAvailable: false,
      currentDatasetVersion: 'production-v1',
      stagedDatasetVersion: null,
      lastCheckAt: null,
      lastSuccessfulCheckAt: null,
      lastCheckStatus: 'NOT_CONFIGURED',
      errorCategory: 'TRUST_NOT_CONFIGURED'
    };
    return {capabilities, operational, providerUpdate, site};
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    const state = stateFor(sender);
    let result;
    if (message.type === 'firefox.capabilities.get') {
      result = state.capabilities;
    } else if (message.type === 'firefox.site.get') {
      result = state.site;
    } else if (message.type === 'firefox.operational.get') {
      result = state.operational;
    } else if (message.type === 'firefox.settings.get') {
      result = {revision: 7, settings};
    } else if (message.type === 'firefox.provider.update.get') {
      result = state.providerUpdate;
    } else {
      return Promise.resolve({ok: false, error: {code: 'UI_RPC_FAILED'}});
    }
    return Promise.resolve({ok: true, result});
  });
})();
`;

}

function makeInstrumentedCopy(source, target, temporaryRoots) {

  const copy = Fs.mkdtempSync(Path.join(Os.tmpdir(), `rucb-${target}-visual-`));
  temporaryRoots.push(copy);
  Fs.cpSync(source, copy, {recursive: true});
  if (target === 'firefox') {
    Fs.writeFileSync(
        Path.join(copy, 'background', 'event-page.js'),
        fixtureSource(target),
    );
    return copy;
  }
  const popup = Path.join(copy, 'pages', 'popup');
  Fs.writeFileSync(Path.join(popup, 'qa-fixture.js'), fixtureSource(target));
  const htmlPath = Path.join(popup, 'index.html');
  const html = Fs.readFileSync(htmlPath, 'utf8');
  const marker = '<script src="./index.js"></script>';
  const firefoxMarker = '<script src="index.js"></script>';
  const match = html.includes(marker) ? marker : firefoxMarker;
  Assert.ok(html.includes(match), `Popup script marker missing in ${target}.`);
  Fs.writeFileSync(
      htmlPath,
      html.replace(match, `<script src="qa-fixture.js"></script>\n    ${match}`),
  );
  return copy;

}

async function auditPage(page, kind, section = '') {

  const result = await page.evaluate(({kind, section}) => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        rect.width > 0 && rect.height > 0;
    };
    const controls = Array.from(document.querySelectorAll(
        'button,input,select,textarea,a,summary',
    )).filter(visible);
    const clipped = controls.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
    }).map((node) => ({
      tag: node.tagName,
      text: String(node.textContent || node.value || '').trim().slice(0, 80),
    }));
    const unusable = controls.filter((node) => {
      if (node.matches('input[type="radio"],input[type="checkbox"]')) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width < 12 || rect.height < 12;
    }).map((node) => node.tagName);
    const horizontalOverflow = document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2;
    const popupRoot = document.querySelector('#popup-root');
    const optionsRoot = document.querySelector('#app-root,#options-root');
    const sectionNode = section ? document.getElementById(section) : null;
    return {
      clipped,
      controlCount: controls.length,
      horizontalOverflow,
      kind,
      locale: document.documentElement.lang || '',
      mainPresent: Boolean(kind === 'popup' ? popupRoot : optionsRoot),
      optionsNavPresent: kind === 'options' ?
        Boolean(document.querySelector('nav')) : null,
      section,
      sectionPresent: section ? Boolean(sectionNode) : null,
      unusable,
    };
  }, {kind, section});
  Assert.equal(result.mainPresent, true);
  Assert.equal(result.horizontalOverflow, false, 'Horizontal overflow detected.');
  Assert.deepEqual(result.clipped, [], 'Horizontally clipped controls detected.');
  Assert.deepEqual(result.unusable, [], 'Unusable controls detected.');
  if (kind === 'options') {
    Assert.equal(result.optionsNavPresent, true);
    Assert.equal(result.sectionPresent, true);
  }
  return result;

}

function screenshotName(parts) {

  return parts.join('-').replace(/[^a-z0-9.-]+/gi, '-').toLowerCase() + '.png';

}

async function captureChromium(options, report, temporaryRoots) {

  Assert.ok(options.chromiumBin, '--chromium-bin or CHROMIUM_BIN is required.');
  Assert.ok(Fs.existsSync(options.chromiumBin), options.chromiumBin);
  const copy = makeInstrumentedCopy(
      CHROMIUM_PACKAGE, 'chromium', temporaryRoots,
  );
  const profile = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'rucb-chromium-visual-profile-'));
  temporaryRoots.push(profile);
  const browser = await Puppeteer.launch({
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--no-first-run',
    ],
    enableExtensions: true,
    executablePath: options.chromiumBin,
    headless: true,
    userDataDir: profile,
  });
  try {
    const version = await browser.version();
    const extensionId = await browser.installExtension(copy);
    report.browsers.chromium = version;
    for (const scale of SCALES) {
      for (const locale of LOCALES) {
        for (const state of POPUP_STATES) {
          const page = await browser.newPage();
          await page.setViewport({
            deviceScaleFactor: scale,
            height: 900,
            width: state === 'off' && scale === 1.5 ? 300 : 392,
          });
          const url = `chrome-extension://${extensionId}/pages/popup/index.html` +
            `?qaState=${encodeURIComponent(state)}` +
            `&qaLocale=${encodeURIComponent(locale)}`;
          await page.goto(url, {waitUntil: 'domcontentloaded'});
          await page.waitForSelector('#popup-root[aria-busy="false"]', {
            timeout: QA_TIMEOUT_MS,
          });
          if (state === 'pending') {
            await page.click('input[name="site-mode"][value="direct"]');
            await page.waitForSelector('.site-pending');
          }
          const audit = await auditPage(page, 'popup');
          const name = screenshotName([
            'chromium', 'popup', locale, state, `${scale}x`,
          ]);
          await page.screenshot({
            fullPage: true,
            path: Path.join(options.output, name),
          });
          report.captures.push({audit, engine: 'chromium', file: name, locale,
            scale, state, surface: 'popup'});
          await page.close();
        }
        const optionsPage = await browser.newPage();
        await optionsPage.setViewport({
          deviceScaleFactor: scale, height: 900, width: 1280,
        });
        const optionsUrl =
          `chrome-extension://${extensionId}/pages/options/index.html`;
        await optionsPage.goto(optionsUrl, {waitUntil: 'domcontentloaded'});
        await optionsPage.waitForSelector('#app-root:not([aria-busy="true"])', {
          timeout: QA_TIMEOUT_MS,
        });
        await optionsPage.evaluate(async (language) => {
          await window.mv3Rpc.callBackground('setUiLanguage', {language});
        }, locale);
        for (const section of OPTIONS.chromium) {
          await optionsPage.goto(`${optionsUrl}#${section}`, {
            waitUntil: 'domcontentloaded',
          });
          await optionsPage.waitForSelector(
              `[data-options-section="${section}"]:not([hidden])`,
              {timeout: QA_TIMEOUT_MS},
          );
          const audit = await auditPage(optionsPage, 'options', section);
          const name = screenshotName([
            'chromium', 'options', locale, section, `${scale}x`,
          ]);
          await optionsPage.screenshot({
            fullPage: false,
            path: Path.join(options.output, name),
          });
          report.captures.push({audit, engine: 'chromium', file: name, locale,
            scale, section, surface: 'options'});
        }
        await optionsPage.close();
      }
    }
  } finally {
    await browser.close();
  }

}

async function firefoxExecute(client, script, args = []) {

  await client.command('Marionette:SetContext', {value: 'content'});
  return FirefoxSmoke.webdriverValue(await client.command(
      'WebDriver:ExecuteScript',
      {args, newSandbox: false, sandbox: 'default', script},
  ));

}

async function firefoxWait(client, script) {

  const deadline = Date.now() + QA_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await firefoxExecute(client, script)) {
      return;
    }
    await FirefoxSmoke.delay(50);
  }
  throw new Error(`Firefox visual wait timed out: ${script}`);

}

async function firefoxAudit(client, kind, section = '') {

  const result = await firefoxExecute(client, `
    const kind = arguments[0];
    const section = arguments[1];
    const visible = node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        rect.width > 0 && rect.height > 0;
    };
    const controls = Array.from(document.querySelectorAll(
      'button,input,select,textarea,a,summary'
    )).filter(visible);
    const clipped = controls.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right >
        document.documentElement.clientWidth + 1;
    }).map(node => ({
      tag: node.tagName,
      text: String(node.textContent || node.value || '').trim().slice(0, 80)
    }));
    const unusable = controls.filter(node => {
      if (node.matches('input[type="radio"],input[type="checkbox"]')) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width < 12 || rect.height < 12;
    }).map(node => node.tagName);
    return {
      clipped,
      controlCount: controls.length,
      horizontalOverflow: document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
      kind,
      locale: document.documentElement.lang || '',
      mainPresent: Boolean(document.querySelector(
        kind === 'popup' ? '#popup-root' : '#options-root'
      )),
      optionsNavPresent: kind === 'options' ? Boolean(document.querySelector('nav')) : null,
      section,
      sectionPresent: section ? Boolean(document.getElementById(section)) : null,
      unusable
    };
  `, [kind, section]);
  Assert.equal(result.mainPresent, true);
  Assert.equal(result.horizontalOverflow, false);
  Assert.deepEqual(result.clipped, []);
  Assert.deepEqual(result.unusable, []);
  if (kind === 'options') {
    Assert.equal(result.optionsNavPresent, true);
    Assert.equal(result.sectionPresent, true);
  }
  return result;

}

async function firefoxScreenshot(client, destination) {

  const value = FirefoxSmoke.webdriverValue(await client.command(
      'WebDriver:TakeScreenshot', {full: false},
  ));
  Fs.writeFileSync(destination, Buffer.from(value, 'base64'));

}

function firefoxPreferences(port, locale, scale) {

  return [
    'user_pref("app.update.auto", false);',
    'user_pref("app.update.enabled", false);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("extensions.allowPrivateBrowsingByDefault", true);',
    'user_pref("intl.locale.matchOS", false);',
    `user_pref("intl.locale.requested", "${locale === 'ru' ? 'ru' : 'en-US'}");`,
    `user_pref("layout.css.devPixelsPerPx", "${scale}");`,
    'user_pref("marionette.enabled", true);',
    `user_pref("marionette.port", ${port});`,
    'user_pref("network.captive-portal-service.enabled", false);',
    'user_pref("network.connectivity-service.enabled", false);',
    'user_pref("toolkit.telemetry.enabled", false);',
    '',
  ].join(Os.EOL);

}

async function captureFirefoxSession(
    options,
    report,
    copy,
    locale,
    scale,
    temporaryRoots,
) {

  const profile = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'rucb-firefox-visual-profile-'));
  temporaryRoots.push(profile);
  const port = await FirefoxSmoke.unusedPort();
  Fs.writeFileSync(
      Path.join(profile, 'user.js'),
      firefoxPreferences(port, locale, scale),
  );
  const child = ChildProcess.spawn(options.firefoxBin, [
    '-headless',
    '-no-remote',
    '-profile',
    profile,
    '-marionette',
    '-remote-allow-system-access',
    'about:blank',
  ], {
    env: Object.assign({}, process.env, {
      MOZ_CRASHREPORTER_DISABLE: '1',
      MOZ_DISABLE_NONLOCAL_CONNECTIONS: '1',
      MOZ_NO_REMOTE: '1',
    }),
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let client;
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-12000);
  });
  try {
    client = await FirefoxSmoke.connectMarionette(port);
    await client.command('WebDriver:NewSession', {
      capabilities: {alwaysMatch: {pageLoadStrategy: 'normal'}, firstMatch: [{}]},
    });
    await client.command('WebDriver:SetTimeouts', {
      implicit: 0, pageLoad: QA_TIMEOUT_MS, script: QA_TIMEOUT_MS,
    });
    await client.command('WebDriver:SetWindowRect', {
      height: 980,
      width: 1280,
      x: 0,
      y: 0,
    });
    await client.command('Addon:Install', {
      allowPrivateBrowsing: true,
      path: copy,
      temporary: true,
    });
    const origin = await FirefoxSmoke.extensionOrigin(client);
    report.browsers.firefox = FirefoxSmoke.firefoxVersion(options.firefoxBin);
    for (const state of POPUP_STATES) {
      await client.command('WebDriver:SetWindowRect', {
        height: 900,
        width: state === 'off' && scale === 1.5 ? 300 : 420,
        x: 0,
        y: 0,
      });
      await FirefoxSmoke.navigate(
          client,
          `${origin}/pages/popup/index.html?qaState=${state}&qaLocale=${locale}`,
      );
      await firefoxWait(
          client,
          'return document.querySelector("#popup-root[aria-busy=\\"false\\"]") !== null;',
      );
      const ifRendered = await firefoxExecute(
          client, 'return document.querySelector(".site-card") !== null;',
      );
      if (!ifRendered) {
        const body = await firefoxExecute(client, 'return document.body.innerText;');
        throw new Error(`Firefox fixture did not render: ${JSON.stringify({body})}`);
      }
      if (state === 'pending') {
        await firefoxExecute(client, `
          const input = document.querySelector(
            'input[name="site-mode"][value="DIRECT"]'
          );
          input.click();
          return true;
        `);
        await firefoxWait(
            client,
            'return document.querySelector(".site-card .pill.warning") !== null;',
        );
      }
      const audit = await firefoxAudit(client, 'popup');
      const name = screenshotName([
        'firefox', 'popup', locale, state, `${scale}x`,
      ]);
      await firefoxScreenshot(client, Path.join(options.output, name));
      report.captures.push({audit, engine: 'firefox', file: name, locale,
        scale, state, surface: 'popup'});
    }
    await client.command('WebDriver:SetWindowRect', {
      height: 900,
      width: 1280,
      x: 0,
      y: 0,
    });
    const optionsUrl = `${origin}/pages/options/index.html`;
    await FirefoxSmoke.navigate(client, optionsUrl);
    await firefoxWait(
        client,
        'return document.querySelector("#options-root[aria-busy=\\"false\\"]") !== null;',
    );
    for (const section of OPTIONS.firefox) {
      await FirefoxSmoke.navigate(client, `${optionsUrl}#${section}`);
      await firefoxWait(
          client,
          `return document.getElementById(${JSON.stringify(section)}) !== null;`,
      );
      await firefoxExecute(client, `
        document.getElementById(arguments[0]).scrollIntoView({block: 'start'});
        return true;
      `, [section]);
      const audit = await firefoxAudit(client, 'options', section);
      const name = screenshotName([
        'firefox', 'options', locale, section, `${scale}x`,
      ]);
      await firefoxScreenshot(client, Path.join(options.output, name));
      report.captures.push({audit, engine: 'firefox', file: name, locale,
        scale, section, surface: 'options'});
    }
  } catch (error) {
    throw new Error(`${error && error.stack || error}\n${stderr}`);
  } finally {
    if (client) {
      try {
        await client.command('Marionette:Quit', {flags: ['eForceQuit']});
      } catch (_error) {
        // Firefox closes Marionette before replying during a normal quit.
      }
      client.close();
    }
    try {
      await FirefoxSmoke.waitForExit(child, 10000);
    } catch (_error) {
      child.kill();
      await FirefoxSmoke.waitForExit(child, 5000).catch(() => undefined);
    }
  }

}

async function captureFirefox(options, report, temporaryRoots) {

  if (!options.firefoxBin) {
    options.firefoxBin = FirefoxSmoke.resolveFirefox();
  }
  Assert.ok(Fs.existsSync(options.firefoxBin), options.firefoxBin);
  const copy = makeInstrumentedCopy(FIREFOX_PACKAGE, 'firefox', temporaryRoots);
  for (const scale of SCALES) {
    for (const locale of LOCALES) {
      await captureFirefoxSession(
          options, report, copy, locale, scale, temporaryRoots,
      );
    }
  }

}

function summarize(report) {

  const counts = {};
  for (const engine of Object.keys(report.browsers)) {
    const expected =
      POPUP_STATES.length * LOCALES.length * SCALES.length +
      OPTIONS[engine].length * LOCALES.length * SCALES.length;
    counts[engine] = report.captures.filter((item) =>
      item.engine === engine).length;
    Assert.equal(counts[engine], expected);
  }
  report.summary = {
    capturesByEngine: counts,
    clippingFailures: 0,
    missingElements: 0,
    overlapPolicy: 'No horizontal clipping/overflow and minimum 12px controls.',
    pixelEqualityRequired: false,
  };
  report.finishedAt = new Date().toISOString();
  const stable = JSON.stringify(report, null, 2) + '\n';
  Fs.writeFileSync(Path.join(report.output, 'report.json'), stable);
  Fs.writeFileSync(
      Path.join(report.output, 'report.sha256'),
      `${Crypto.createHash('sha256').update(stable).digest('hex')}  report.json\n`,
  );

}

async function main() {

  const options = parseArguments(process.argv.slice(2));
  ensureBuiltPackage(CHROMIUM_PACKAGE, 3);
  ensureBuiltPackage(FIREFOX_PACKAGE, 3);
  resetDirectory(options.output);
  const temporaryRoots = [];
  const report = {
    browsers: {},
    captures: [],
    generatedAt: new Date().toISOString(),
    output: options.output,
    policy: {
      deviceScales: SCALES,
      locales: LOCALES,
      optionsSections: OPTIONS,
      popupStates: POPUP_STATES,
      screenshotsTracked: false,
    },
  };
  try {
    if (options.target === 'both' || options.target === 'chromium') {
      await captureChromium(options, report, temporaryRoots);
    }
    if (options.target === 'both' || options.target === 'firefox') {
      await captureFirefox(options, report, temporaryRoots);
    }
    summarize(report);
    console.log(JSON.stringify(report.summary, null, 2));
  } finally {
    if (process.env.VISUAL_QA_KEEP_TEMP === '1') {
      console.log(JSON.stringify({temporaryRoots}, null, 2));
    } else {
      for (const directory of temporaryRoots.reverse()) {
        Fs.rmSync(directory, {force: true, recursive: true});
      }
    }
  }

}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
