const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const npmExec = process.env.npm_execpath;

if (!npmExec) {
  console.error('npm_execpath not set; skipping app-V2 dependency install.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [npmExec, 'install'], {
  cwd: resolve(__dirname, '..', 'app-V2'),
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
