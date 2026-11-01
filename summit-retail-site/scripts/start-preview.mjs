import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Wrangler resolves environment files from the generated config directory.
// An absolute path also survives its Node CLI restart on portable hosts.
const environmentFile = resolve('.dev.vars');
if (!existsSync(environmentFile)) {
  console.error('Copy .env.example to .dev.vars and configure the local preview first.');
  process.exit(1);
}

const child = spawn(process.execPath, [
  '--import', './scripts/sites-env.mjs',
  './node_modules/wrangler/bin/wrangler.js', 'dev',
  '--config', 'dist/server/wrangler.json', '--local',
  '--persist-to', '.wrangler/state', '--ip', '127.0.0.1',
  '--inspector-port', '0', '--env-file', environmentFile,
  ...process.argv.slice(2),
], { stdio: 'inherit', env: process.env });

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Could not start the local Worker preview.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
