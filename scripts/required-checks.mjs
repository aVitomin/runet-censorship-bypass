#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {TOOLING_ROOT, SOURCES, isWithin} from './repository-paths.mjs';

const PROJECT = `.\\${TOOLING_ROOT.replaceAll('/', '\\')}`;
const npm = (script) => `npm --prefix ${PROJECT} run ${script}`;
const POLICY_TESTS = 'node --test .\\scripts\\*.test.mjs';

function guidance(path) {
  return /(?:^|\/)AGENTS\.md$/u.test(path) ||
    isWithin(path, '.agents') || isWithin(path, '.codex') ||
    isWithin(path, 'docs') ||
    (!path.includes('/src/') && /\.md$/u.test(path));
}

export function planForPaths(inputPaths) {
  const paths = [...new Set(inputPaths.map((value) =>
    String(value).replaceAll('\\', '/').replace(/^\.\//u, ''),
  ).filter(Boolean))].sort();
  const skills = new Set();
  const checks = new Set(['node .\\scripts\\verify-docs.mjs', 'git diff --check']);
  const notes = new Set();
  const sourcePaths = paths.filter((path) => !guidance(path));
  const chromium = sourcePaths.some((path) => isWithin(path, SOURCES.chromium));
  const firefox = sourcePaths.some((path) => isWithin(path, SOURCES.firefox));
  const shared = sourcePaths.some((path) =>
    [SOURCES.shared, SOURCES.sharedAssets, SOURCES.chromiumCompat].some((root) => isWithin(path, root)) ||
    [`${TOOLING_ROOT}/gulpfile.js`, `${TOOLING_ROOT}/build-cleanup.js`,
      `${TOOLING_ROOT}/src/templates-data.js`].includes(path));
  const runtimePaths = sourcePaths.filter((path) => !/\/(?:test|tests)\//u.test(path));
  const security = runtimePaths.some((path) =>
    /\/(?:background|provider)\//u.test(path) || isWithin(path, SOURCES.shared) ||
    /manifest(?:\.tmpl)?\.json$/u.test(path));
  const pac = runtimePaths.some((path) =>
    isWithin(path, `${TOOLING_ROOT}/src`) &&
    /(?:pac-|pac\.|routing-contract|routing-adapter|site-scope|site-control|provider-lookup)/u.test(path));
  const dependencies = paths.some((path) =>
    /(?:^|\/)package(?:-lock)?\.json$/u.test(path) ||
    isWithin(path, '.github/workflows') || /\/vendor\//u.test(path));
  const release = paths.some((path) =>
    /(?:^|\/)(?:RELEASE_PROCESS|FIREFOX_RELEASE_BUILD)\.md$/u.test(path) ||
    /\/scripts\/package-(?:chromium|firefox)-release\.js$/u.test(path));
  const tooling = sourcePaths.some((path) =>
    isWithin(path, `${TOOLING_ROOT}/src/tooling`) || isWithin(path, `${TOOLING_ROOT}/scripts`) ||
    path === `${TOOLING_ROOT}/eslint.config.cjs`);
  const policy = sourcePaths.some((path) => isWithin(path, 'scripts'));
  const unknown = sourcePaths.filter((path) =>
    !Object.values(SOURCES).some((root) => isWithin(path, root)) &&
    !isWithin(path, `${TOOLING_ROOT}/src/tooling`) && !isWithin(path, `${TOOLING_ROOT}/scripts`) &&
    !isWithin(path, 'scripts') && !isWithin(path, '.github') && !isWithin(path, '.vscode') &&
    ![`${TOOLING_ROOT}/gulpfile.js`, `${TOOLING_ROOT}/build-cleanup.js`,
      `${TOOLING_ROOT}/eslint.config.cjs`, `${TOOLING_ROOT}/src/templates-data.js`].includes(path) &&
    !/(?:^|\/)(?:package(?:-lock)?\.json|\.gitignore|\.gitattributes|LICENSE)$/u.test(path));

  // Final gates include their focused suites. Never suggest both for the same work.
  if (shared || dependencies || release || unknown.length) {
    checks.add(npm('verify'));
  } else {
    if (chromium) checks.add(npm('verify:chromium'));
    if (firefox) checks.add(npm('verify:firefox'));
    if (tooling) {
      // Full lint includes tooling lint; retain only the separate tooling tests.
      checks.add(npm(sourcePaths.includes(`${TOOLING_ROOT}/eslint.config.cjs`)
        ? 'test:tooling' : 'verify:tooling'));
    }
  }
  if (shared) notes.add('Compare both built package trees with their baselines.');
  if (unknown.length) notes.add('Unclassified paths: review ownership before any move; aggregate gate selected conservatively.');
  if (security) skills.add('extension-security-review');
  if (pac) skills.add('pac-regression');
  if (dependencies) skills.add('dependency-review');
  if (policy || dependencies) checks.add(POLICY_TESTS);
  if (dependencies || paths.some((path) => /scripts\/(?:verify-supply-chain|repository-paths)/u.test(path))) {
    checks.add('node .\\scripts\\verify-supply-chain.mjs');
  }
  if (sourcePaths.includes(`${TOOLING_ROOT}/eslint.config.cjs`) && !checks.has(npm('verify'))) {
    checks.add(npm('lint'));
  }
  if (release) {
    skills.add('release-candidate');
    checks.add(npm('release:chromium'));
    checks.add(npm('release:firefox'));
  }

  return Object.freeze({
    advisory: true,
    paths: Object.freeze(paths),
    skills: Object.freeze([...skills].sort()),
    checks: Object.freeze([...checks]),
    notes: Object.freeze([...notes]),
  });
}

export function changedPaths(cwd = process.cwd()) {
  const options = {cwd, encoding: 'utf8'};
  // No rename folding: both the old owner and the new owner must be checked.
  // NUL delimiters preserve spaces, Unicode and embedded newlines in Git paths.
  // Inspect index and worktree independently: a worktree edit can undo a staged
  // change in the net diff against HEAD without removing that staged change.
  const tracked = [[], ['--cached', 'HEAD']].map((base) => execFileSync('git', [
    'diff', '--name-only', '-z', '--no-renames', ...base, '--',
  ], options)).join('');
  const untracked = execFileSync('git', [
    'ls-files', '-z', '--others', '--exclude-standard',
  ], options);
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))].sort();
}

function main() {
  const paths = process.argv.slice(2);
  const plan = planForPaths(paths.length > 0 ? paths : changedPaths());
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
