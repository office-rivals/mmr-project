// TanStack Start emits a request handler; srvx supplies the Node listener.
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  // Optional: present in local dev, pruned from the production image.
  await import('dotenv/config');
} catch {
  // dotenv is optional; production can use the ambient environment.
}

const handler = (await import('./dist/server/server.js')).default;
const { serve } = await import('srvx');

// Start renders routes but needs a separate static asset handler.
const clientDir = resolve(
  fileURLToPath(new URL('./dist/client', import.meta.url))
);

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
};

async function serveStatic(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const { pathname } = new URL(request.url);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const filePath = resolve(join(clientDir, decoded));
  if (filePath !== clientDir && !filePath.startsWith(clientDir + sep))
    return null;

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    const body = await readFile(filePath);
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'content-length': String(stats.size),
        'cache-control': decoded.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return null;
  }
}

serve({
  async fetch(request) {
    return (await serveStatic(request)) ?? handler.fetch(request);
  },
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? '0.0.0.0',
});
