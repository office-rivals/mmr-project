// Recognises TanStack Start server-function requests by function name, for the
// specs that watch or stall a specific mutation or loader on the network.
import { readFileSync } from 'node:fs';

// Production RPC IDs are hashes; resolve them from the build being exercised.
const productionFunctions =
  process.env.E2E_BETA_PRODUCTION === 'true'
    ? new Map(
        [
          ...readFileSync(
            new URL('../dist/server/server.js', import.meta.url),
            'utf8'
          ).matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g),
        ].map((match) => [match[1], match[2]])
      )
    : undefined;

if (productionFunctions?.size === 0) {
  throw new Error(
    'No production server functions found; build frontend-beta before testing'
  );
}

// In dev, a server function is identified by a base64url-encoded JSON blob as
// the final path segment, e.g.
//   /_serverFn/__data.json/<base64url {"file":"…","export":"editMatchFn_…"}>
// so the function name never appears literally in the URL.
function serverFnExport(pathname: string): string {
  const id = pathname.split('/').pop() ?? '';
  if (productionFunctions) return productionFunctions.get(id) ?? '';
  try {
    const decoded = JSON.parse(
      Buffer.from(id, 'base64url').toString('utf8')
    ) as { export?: string };
    return decoded.export ?? '';
  } catch {
    return '';
  }
}

/** Whether `url` calls the server function named `fnName`. */
export function isServerFn(url: string | URL, fnName: string): boolean {
  const { pathname } = typeof url === 'string' ? new URL(url) : url;
  return serverFnExport(pathname).startsWith(fnName);
}
