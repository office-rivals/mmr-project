import { isIP } from 'node:net';

export function parseAppOrigin(value) {
  if (!value?.trim()) return undefined;
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path');
  }
  return url.origin;
}

export function normalizeRequestOrigin(request, appOrigin) {
  const url = new URL(request.url);
  if (appOrigin) {
    const origin = new URL(appOrigin);
    url.protocol = origin.protocol;
    url.host = origin.host;
    url.port = origin.port;
  }
  const normalized = new Request(url, request);
  // Clerk also reads these headers; use only the origin already trusted by srvx.
  normalized.headers.delete('forwarded');
  normalized.headers.delete('x-forwarded-host');
  normalized.headers.delete('x-forwarded-proto');
  normalized.headers.delete('x-forwarded-port');
  normalized.headers.delete('cloudfront-forwarded-proto');
  normalized.headers.set('host', url.host);
  return normalized;
}

export function parseTrustProxy(value) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === '' || normalized === 'false') {
    return false;
  }
  if (normalized === 'true') return true;
  if (normalized === 'loopback') return 'loopback';

  const addresses = normalized.split(',').map((entry) => entry.trim());
  if (addresses.some((address) => address === '' || isIP(address) === 0)) {
    throw new Error(
      'TRUST_PROXY must be false, true, loopback, or a comma-separated list of IP addresses'
    );
  }
  return addresses;
}
