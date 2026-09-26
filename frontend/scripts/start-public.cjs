'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const frontendPort = Number(process.env.PORT || 4200);
const backendPort = Number(process.env.BACKEND_PORT || 8080);
const akinatorPort = Number(process.env.AKINATOR_PORT || 4201);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const serverScript = path.join(frontendRoot, '.hallmark', 'serve-built.cjs');
const akinatorScript = path.join(frontendRoot, 'scripts', 'akinator-gateway.cjs');

let frontendProcess;
let akinatorProcess;
let tunnelProcess;
let stopping = false;

function findCloudflared() {
  const candidates = [
    process.env.CLOUDFLARED_PATH,
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['cloudflared'], {
    encoding: 'utf8',
    windowsHide: true
  });
  return lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/)[0] : null;
}

async function isFrontendReady() {
  try {
    const response = await fetch(`${frontendUrl}/login`);
    return response.ok;
  } catch {
    return false;
  }
}

async function isAkinatorReady() {
  try {
    await fetch(`http://127.0.0.1:${akinatorPort}/api/akinator`);
    return true;
  } catch {
    return false;
  }
}

async function waitForFrontend(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isFrontendReady()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Frontend did not become ready on port ${frontendPort}.`);
}

function relayCloudflaredOutput(chunk) {
  const text = String(chunk);
  process.stdout.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match) {
    process.stdout.write(`\nPublic test URL: ${match[0]}/login\n`);
    process.stdout.write('This URL is temporary and exposes the login page publicly. Press Ctrl+C to stop it.\n\n');
  }
}

async function waitForAkinator(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAkinatorReady()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Akinator gateway did not become ready on port ${akinatorPort}.`);
}

async function stop() {
  if (stopping) return;
  stopping = true;
  if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill();
  if (frontendProcess && !frontendProcess.killed) frontendProcess.kill();
  if (akinatorProcess && !akinatorProcess.killed) akinatorProcess.kill();
}

async function main() {
  const cloudflared = findCloudflared();
  if (!cloudflared) {
    throw new Error('cloudflared was not found. Install it or set CLOUDFLARED_PATH to its executable.');
  }

  if (!fs.existsSync(serverScript)) {
    throw new Error(`Frontend server script not found: ${serverScript}`);
  }

  if (!fs.existsSync(akinatorScript)) {
    throw new Error(`Akinator gateway script not found: ${akinatorScript}`);
  }

  if (!(await isAkinatorReady())) {
    akinatorProcess = spawn(process.execPath, [akinatorScript], {
      cwd: frontendRoot,
      env: { ...process.env, AKINATOR_PORT: String(akinatorPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    akinatorProcess.on('error', error => {
      process.stderr.write(`Unable to start the Akinator gateway: ${error.message}\n`);
      void stop();
    });
    akinatorProcess.stdout.on('data', chunk => process.stdout.write(`[akinator] ${chunk}`));
    akinatorProcess.stderr.on('data', chunk => process.stderr.write(`[akinator] ${chunk}`));
    await waitForAkinator();
  } else {
    process.stdout.write(`Using the existing Akinator gateway on http://127.0.0.1:${akinatorPort}.\n`);
  }

  if (!(await isFrontendReady())) {
    frontendProcess = spawn(process.execPath, [serverScript], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        PORT: String(frontendPort),
        BACKEND_PORT: String(backendPort),
        AKINATOR_PORT: String(akinatorPort)
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    frontendProcess.on('error', error => {
      process.stderr.write(`Unable to start the frontend server: ${error.message}\n`);
      void stop();
    });
    frontendProcess.stdout.on('data', chunk => process.stdout.write(`[frontend] ${chunk}`));
    frontendProcess.stderr.on('data', chunk => process.stderr.write(`[frontend] ${chunk}`));
    await waitForFrontend();
  } else {
    process.stdout.write(`Using the existing frontend on ${frontendUrl}.\n`);
  }

  process.stdout.write(`Backend remains private behind the frontend proxy at 127.0.0.1:${backendPort}.\n`);
  tunnelProcess = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', frontendUrl], {
    cwd: frontendRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  tunnelProcess.on('error', error => {
    process.stderr.write(`Unable to start cloudflared: ${error.message}\n`);
    void stop();
  });
  tunnelProcess.stdout.on('data', relayCloudflaredOutput);
  tunnelProcess.stderr.on('data', relayCloudflaredOutput);
  tunnelProcess.on('exit', code => {
    if (!stopping && code !== 0) process.stderr.write(`Public tunnel stopped with code ${code}.\n`);
    void stop();
  });
}

process.on('SIGINT', () => void stop().finally(() => process.exit(0)));
process.on('SIGTERM', () => void stop().finally(() => process.exit(0)));

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  void stop().finally(() => process.exit(1));
});
