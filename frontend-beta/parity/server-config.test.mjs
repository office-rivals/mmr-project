import { afterEach, describe, expect, it } from 'vitest';
import { serve } from 'srvx';
import { parseTrustProxy } from '../server-config.mjs';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close(true)));
});

async function startOriginCheckServer(trustProxy) {
  const server = serve({
    fetch(request) {
      const requestOrigin = new URL(request.url).origin;
      const accepted = request.headers.get('origin') === requestOrigin;
      return new Response(null, {
        status: accepted ? 204 : 403,
        headers: { 'x-request-origin': requestOrigin },
      });
    },
    hostname: '127.0.0.1',
    port: 0,
    silent: true,
    trustProxy,
  });
  servers.push(server);
  await server.ready();
  return server;
}

function forwardedRequest(url, origin) {
  return fetch(`${url}/form`, {
    method: 'POST',
    headers: {
      origin,
      'x-forwarded-for': '203.0.113.8',
      'x-forwarded-host': 'app.example',
      'x-forwarded-proto': 'https',
    },
  });
}

describe('TRUST_PROXY', () => {
  it('parses only srvx-supported trust policies', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('127.0.0.1, ::1')).toEqual(['127.0.0.1', '::1']);
    expect(() => parseTrustProxy('10.0.0.0/8')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('127.0.0.1,')).toThrow(/TRUST_PROXY/);
  });

  it('accepts a same-origin form behind an allowlisted proxy', async () => {
    const server = await startOriginCheckServer(parseTrustProxy('127.0.0.1'));
    const response = await forwardedRequest(server.url, 'https://app.example');

    expect(response.status).toBe(204);
    expect(response.headers.get('x-request-origin')).toBe(
      'https://app.example'
    );
  });

  it('ignores forwarded headers from a peer outside the allowlist', async () => {
    const server = await startOriginCheckServer(parseTrustProxy('192.0.2.10'));
    const response = await forwardedRequest(server.url, 'https://app.example');

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-origin')).toBe(
      new URL(server.url).origin
    );
  });

  it('still rejects a cross-origin form through a trusted proxy', async () => {
    const server = await startOriginCheckServer(parseTrustProxy('loopback'));
    const response = await forwardedRequest(
      server.url,
      'https://attacker.example'
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-origin')).toBe(
      'https://app.example'
    );
  });
});
