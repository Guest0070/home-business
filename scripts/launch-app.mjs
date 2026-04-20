import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'runtime');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');

const mode = process.argv[2] || 'dev';
const isWindows = process.platform === 'win32';

fs.mkdirSync(runtimeDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writePid(name, pid) {
  fs.writeFileSync(path.join(runtimeDir, `${name}.pid`), String(pid));
}

function removePid(name) {
  const target = path.join(runtimeDir, `${name}.pid`);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
}

function listPidsOnPort(port) {
  try {
    if (isWindows) {
      const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      return Array.from(new Set(
        output
          .split(/\r?\n/)
          .filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'))
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter(Boolean)
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      ));
    }

    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (_error) {
    return [];
  }
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (_error) {
    if (isWindows) {
      try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch (_innerError) {
        return false;
      }
      return true;
    }
    return false;
  }
  return true;
}

function stopPorts(ports) {
  for (const port of ports) {
    for (const pid of listPidsOnPort(port)) {
      killPid(pid);
    }
  }
}

function spawnDetached(name, command, args, cwd, env, outFile, errFile) {
  const stdoutFd = fs.openSync(path.join(runtimeDir, outFile), 'a');
  const stderrFd = fs.openSync(path.join(runtimeDir, errFile), 'a');
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', stdoutFd, stderrFd],
    windowsHide: true
  });
  child.unref();
  writePid(name, child.pid);
  return child.pid;
}

function getNetworkAddress() {
  try {
    if (isWindows) {
      const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^127\\.' -and $_.IPAddress -notmatch '^169\\.254\\.' } | Select-Object -First 1 -ExpandProperty IPAddress)"], { encoding: 'utf8' });
      return output.trim();
    }
  } catch (_error) {
    return '';
  }
  return '';
}

async function main() {
  const frontendHost = mode === 'network' ? '0.0.0.0' : '127.0.0.1';

  stopPorts(mode === 'hosted' ? [4000] : [4000, 5173]);
  removePid('backend');
  removePid('frontend');

  const backendEnv = mode === 'hosted'
    ? { NODE_ENV: 'production', SERVE_FRONTEND: 'true' }
    : {};

  const backendPid = spawnDetached(
    'backend',
    process.execPath,
    ['src/server.js'],
    backendDir,
    backendEnv,
    'backend.out.log',
    'backend.err.log'
  );

  let frontendPid = null;
  if (mode !== 'hosted') {
    frontendPid = spawnDetached(
      'frontend',
      process.execPath,
      [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--host', frontendHost, '--port', '5173'],
      frontendDir,
      {},
      'frontend.out.log',
      'frontend.err.log'
    );
  }

  await sleep(mode === 'hosted' ? 2500 : 4000);

  console.log(JSON.stringify({
    mode,
    backendPid,
    frontendPid,
    local: mode === 'hosted' ? 'http://127.0.0.1:4000' : 'http://127.0.0.1:5173',
    network: getNetworkAddress()
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
