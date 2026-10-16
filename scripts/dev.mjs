import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frontend = join(root, 'frontend');
const backend = join(root, 'backend');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpmInstall(dir, label, requiredPackage) {
  const nodeModules = join(dir, 'node_modules');
  const requiredModule = join(nodeModules, requiredPackage);
  if (existsSync(requiredModule)) return;

  console.log(`\\n[EventSphere] Repairing ${label} dependencies...`);
  execFileSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
    cwd: dir,
    stdio: 'inherit'
  });
}

function ensureEnv() {
  const env = join(backend, '.env');
  const example = join(backend, '.env.example');
  if (!existsSync(env) && existsSync(example)) {
    copyFileSync(example, env);
    console.log('[EventSphere] Created backend/.env from .env.example');
  }
}

if (!existsSync(frontend) || !existsSync(backend)) {
  console.error('[EventSphere] Invalid project structure: frontend/backend folders are missing.');
  process.exit(1);
}

ensureEnv();
runNpmInstall(backend, 'backend', 'express');
runNpmInstall(frontend, 'frontend', 'vite');

console.log('\\n[EventSphere] Starting backend and frontend...');
console.log('[EventSphere] Backend:  http://localhost:5000');
console.log('[EventSphere] Frontend: http://localhost:5173');
console.log('[EventSphere] Press Ctrl+C to stop both.\\n');

const children = [
  spawn(process.execPath, ['server.js'], { cwd: backend, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [join(frontend, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: frontend, stdio: 'inherit', env: process.env })
];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
children.forEach(child => child.on('exit', code => {
  if (code && code !== 0) shutdown(code);
}));
