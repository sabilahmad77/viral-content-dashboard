import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, 'apps/api');
const tsx = join(__dirname, 'node_modules/.pnpm/node_modules/.bin/tsx');

const proc = spawn(process.execPath, [tsx, join(apiDir, 'src/index.ts')], {
  cwd: apiDir,
  env: { ...process.env, PATH: process.env.PATH },
  stdio: 'inherit',
});

proc.on('exit', (code) => process.exit(code ?? 0));
