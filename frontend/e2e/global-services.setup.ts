// Boots the e2e Postgres (separate container, separate port from local dev)
// before Playwright spins up its webServer processes. We can't use Playwright's
// webServer.url probe for Postgres because that's HTTP-only — we need TCP
// readiness against the postgres port.
//
// The e2e stack uses local-development/docker-compose.e2e.yml, which exposes
// Postgres on port 5433 with its own named volume. Local dev's stack on 5432
// is untouched.

import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const composeDir = path.join(repoRoot, 'local-development');
const composeFile = 'docker-compose.e2e.yml';

const DB_HOST = process.env.E2E_DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.E2E_DB_PORT ?? '5433');
const READY_TIMEOUT_MS = 60_000;

async function waitForPort(host: string, port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reachable = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port, timeout: 1_000 }, () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (reachable) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `e2e Postgres not reachable on ${host}:${port} after ${timeoutMs}ms — ` +
      `is docker-compose -f ${composeFile} running, or is another service squatting the port?`
  );
}

export default async function globalSetup() {
  // Pick up docker compose v2 (built-in) or fall back to docker-compose v1.
  let composeCmd = 'docker compose';
  try {
    execSync('docker compose version', { stdio: 'ignore' });
  } catch {
    composeCmd = 'docker-compose';
  }

  // Bring the e2e Postgres up if it isn't already. `up -d` is idempotent —
  // already-running containers stay running.
  try {
    execSync(`${composeCmd} -f ${composeFile} up -d`, {
      cwd: composeDir,
      stdio: 'inherit',
    });
  } catch (error) {
    throw new Error(
      `Failed to start e2e docker-compose stack in ${composeDir}: ${
        (error as Error).message
      }`
    );
  }

  await waitForPort(DB_HOST, DB_PORT, READY_TIMEOUT_MS);
}
