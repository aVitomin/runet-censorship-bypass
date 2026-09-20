import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {changedPaths, planForPaths} from './required-checks.mjs';
import {TOOLING_ROOT, SOURCES, SCOPED_GUIDANCE} from './repository-paths.mjs';

const project = '.\\extensions\\chromium\\runet-censorship-bypass';

test('keeps documentation-only work focused', () => {
  const plan = planForPaths([
    'docs/development/TESTING.md',
    '.agents/skills/pac-regression/SKILL.md',
  ]);
  assert.deepEqual(plan.skills, []);
  assert.deepEqual(plan.checks, [
    'node .\\scripts\\verify-docs.mjs',
    'git diff --check',
  ]);
});

test('selects Firefox security checks without Chromium checks', () => {
  const plan = planForPaths([
    'extensions/chromium/runet-censorship-bypass/' +
      'src/extension-firefox-mv3/background/event-page.js',
  ]);
  assert.deepEqual(plan.skills, ['mv3-security-review']);
  assert.ok(plan.checks.includes(`npm --prefix ${project} run verify:firefox`));
  assert.ok(!plan.checks.includes(`npm --prefix ${project} run verify:mv3`));
});

test('selects both targets for shared routing', () => {
  const plan = planForPaths([
    'extensions/chromium/runet-censorship-bypass/' +
      'src/extension-mv3-common/routing-contract.js',
  ]);
  assert.deepEqual(plan.skills, ['mv3-security-review', 'pac-regression']);
  assert.ok(plan.checks.includes(`npm --prefix ${project} run verify`));
  assert.ok(!plan.checks.some((check) => /run (?:test:|verify:)/u.test(check)));
});

test('selects supply-chain review for dependency and workflow changes', () => {
  const plan = planForPaths([
    '.github/workflows/mv3.yml',
    'extensions/chromium/runet-censorship-bypass/package-lock.json',
  ]);
  assert.deepEqual(plan.skills, ['dependency-review']);
  assert.ok(plan.checks.includes('node .\\scripts\\verify-supply-chain.mjs'));
});

test('selects dual-browser release checks', () => {
  const plan = planForPaths(['docs/development/RELEASE_PROCESS.md']);
  assert.deepEqual(plan.skills, ['release-candidate']);
  assert.ok(plan.checks.includes(`npm --prefix ${project} run release:chromium`));
  assert.ok(plan.checks.includes(`npm --prefix ${project} run release:firefox`));
});

test('Chromium PAC selects one final gate, not included focused suites', () => {
  const plan = planForPaths([`${SOURCES.chromium}/background/pac-cook.js`]);
  assert.deepEqual(plan.skills, ['mv3-security-review', 'pac-regression']);
  assert.deepEqual(plan.checks.filter((check) => check.startsWith('npm ')), [
    `npm --prefix ${project} run verify:mv3`,
  ]);
});

for (const [browser, file] of [
  ['chromium', 'background/service-worker.js'],
  ['chromium', 'manifest.tmpl.json'],
  ['firefox', 'background/event-page.js'],
  ['firefox', 'background/proxy-control.js'],
  ['firefox', 'manifest.json'],
]) {
  test(`keeps ${browser}/${file} within its browser gate`, () => {
    const plan = planForPaths([`${SOURCES[browser]}/${file}`]);
    assert.deepEqual(plan.checks.filter((check) => check.startsWith('npm ')), [
      `npm --prefix ${project} run verify:${browser === 'chromium' ? 'mv3' : 'firefox'}`,
    ]);
    assert.ok(plan.skills.includes('mv3-security-review'));
  });
}

test('shared assets select aggregate once even with per-browser or tooling edits', () => {
  for (const shared of [SOURCES.sharedIcons, SOURCES.shared, SOURCES.commonAssets]) {
    const plan = planForPaths([
      `${shared}/example.js`, `${SOURCES.firefox}/pages/options/index.js`,
      `${SOURCES.chromium}/background/service-worker.js`, `${TOOLING_ROOT}/src/tooling/test/example.js`,
    ]);
    assert.deepEqual(plan.checks.filter((check) => check.startsWith('npm ')), [
      `npm --prefix ${project} run verify`,
    ]);
    assert.ok(plan.notes.some((note) => note.includes('package trees')));
  }
});

test('scoped instructions do not trigger runtime/security gates', () => {
  const plan = planForPaths(SCOPED_GUIDANCE);
  assert.deepEqual(plan.skills, []);
  assert.ok(!plan.checks.some((check) => check.startsWith('npm ')));
});

test('normalizes explicit Windows paths and uses conservative gates for unknown moved sources', () => {
  assert.deepEqual(planForPaths([`${SOURCES.firefox}/pages/options/index.js`]),
    planForPaths([`.\\${SOURCES.firefox.replaceAll('/', '\\')}\\pages\\options\\index.js`]));
  const plan = planForPaths(['extensions/new-layout/background.js']);
  assert.ok(plan.checks.includes(`npm --prefix ${project} run verify`));
  assert.ok(plan.notes.some((note) => note.startsWith('Unclassified paths')));
});

test('lint configuration changes keep all lint and tooling tests without duplicate lint', () => {
  const plan = planForPaths([`${TOOLING_ROOT}/eslint.config.cjs`]);
  assert.ok(plan.checks.includes(`npm --prefix ${project} run lint`));
  assert.ok(plan.checks.includes(`npm --prefix ${project} run test:tooling`));
  assert.ok(!plan.checks.includes(`npm --prefix ${project} run verify:tooling`));
});

test('detects staged/unstaged changes, deletions, untracked files and both rename owners', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rucb-check-paths-'));
  const git = (...args) => execFileSync('git', [
    '-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(root, '.no-hooks')}`, ...args,
  ], {cwd: root, encoding: 'utf8'});
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    fs.writeFileSync(path.join(root, name), content);
  };
  try {
    git('init', '--quiet');
    const removed = `${SOURCES.firefox}/background/event-page.js`;
    const renamed = `${SOURCES.chromium}/icons/action-active-16.png`;
    for (const name of [removed, renamed, 'staged-delete.txt', 'staged.txt', 'unstaged.txt', 'net-unchanged.txt', '.gitignore']) write(name, name);
    write('.gitignore', '.local/\n');
    git('add', '--', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture');
    fs.unlinkSync(path.join(root, removed));
    git('rm', '--quiet', '--', 'staged-delete.txt');
    const destination = 'assets/перенесённая иконка.png';
    fs.mkdirSync(path.join(root, 'assets'));
    git('mv', '--', renamed, destination);
    write('staged.txt', 'changed'); git('add', '--', 'staged.txt');
    write('net-unchanged.txt', 'staged version'); git('add', '--', 'net-unchanged.txt');
    write('net-unchanged.txt', 'net-unchanged.txt');
    write('unstaged.txt', 'changed');
    write('new file.txt', 'new'); write('.local/ignored.txt', 'ignored');
    const paths = changedPaths(root);
    assert.deepEqual(paths, [removed, renamed, destination, 'staged-delete.txt', 'staged.txt', 'unstaged.txt', 'net-unchanged.txt', 'new file.txt'].sort());
    assert.ok(planForPaths([removed]).checks.includes(`npm --prefix ${project} run verify:firefox`));
    assert.ok(planForPaths(paths).checks.includes(`npm --prefix ${project} run verify`));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('current manifests, shared icon ownership and scoped instructions match the path map', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  const chromium = JSON.parse(read(`${SOURCES.chromium}/manifest.tmpl.json`));
  const firefox = JSON.parse(read(`${SOURCES.firefox}/manifest.json`));
  assert.equal(chromium.manifest_version, 3);
  assert.equal(firefox.manifest_version, 3);
  assert.equal(chromium.background.service_worker, 'background/service-worker.js');
  assert.equal(chromium.background.scripts, undefined);
  assert.equal(firefox.background.service_worker, undefined);
  assert.equal(firefox.background.persistent, false);
  assert.ok(firefox.background.scripts.includes('background/event-page.js'));
  for (const [browser, manifest] of [['chromium', chromium], ['firefox', firefox]]) {
    for (const ui of [manifest.action.default_popup, manifest.options_ui.page]) {
      assert.ok(fs.existsSync(path.join(root, SOURCES[browser], ui)), ui);
    }
    for (const icon of Object.values({...manifest.icons, ...manifest.action.default_icon})) {
      assert.ok(fs.existsSync(path.join(root, SOURCES.chromium, icon)), icon);
      assert.ok(planForPaths([`${SOURCES.chromium}/${icon}`]).checks.includes(`npm --prefix ${project} run verify`));
    }
  }
  for (const scope of SCOPED_GUIDANCE) assert.ok(read(scope).trim(), `Missing scoped instructions: ${scope}`);
  // Static tripwire, not a replacement for comparing packages after build changes.
  const gulp = read(`${TOOLING_ROOT}/gulpfile.js`);
  assert.ok(gulp.includes('./src/extension-chromium-mv3/icons/action-${state}-${size}.png'));
  assert.ok(gulp.includes('gulp.src(firefoxMv3IconSrc'));
});
