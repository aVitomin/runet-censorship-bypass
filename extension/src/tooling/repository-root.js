'use strict';

const ChildProcess = require('node:child_process');
const Path = require('node:path');

function resolveRepositoryRoot(directory) {

  const start = Path.resolve(directory);
  const result = ChildProcess.spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: start,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error('Release tooling requires a Git worktree.');
  }
  const root = Path.resolve(result.stdout.trim());
  const relative = Path.relative(root, start);
  if (relative === '..' || relative.startsWith(`..${Path.sep}`) ||
      Path.isAbsolute(relative)) {
    throw new Error('Release tooling directory is outside its Git worktree.');
  }
  return root;

}

module.exports = Object.freeze({resolveRepositoryRoot});
