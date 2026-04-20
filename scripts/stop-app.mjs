import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'runtime');
const isWindows = process.platform === 'win32';

function pidFile(name) {
  return path.join(runtimeDir, `${name}.pid`);
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
  if (!pid) return false;
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

function killFromFile(name) {
  const target = pidFile(name);
  if (!fs.existsSync(target)) return;
  const pid = Number(fs.readFileSync(target, 'utf8').trim());
  killPid(pid);
  fs.rmSync(target, { force: true });
}

function stopPorts(ports) {
  for (const port of ports) {
    for (const pid of listPidsOnPort(port)) {
      killPid(pid);
    }
  }
}

killFromFile('backend');
killFromFile('frontend');
stopPorts([4000, 5173]);

console.log('app processes stopped');
