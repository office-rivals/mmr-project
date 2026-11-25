import { afterEach, describe, expect, it } from 'vitest';
import { serve } from 'srvx';
import { createClerkRequest } from '@clerk/backend/internal';
import {
  normalizeRequestOrigin,
  parseAppOrigin,
  parseTrustProxy,
} from '../server-config.mjs';
import { parseNativeFormData } from '../src/lib/server/action-result';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close(true)));
});

describe('canonical production origin', () => {
  it('requires an origin without credentials, paths or query parameters', () => {
    expect(parseAppOrigin(undefined)).toBeUndefined();
    expect(parseAppOrigin('https://beta.example.com/')).toBe(
      'https://beta.example.com'
    );
    for (const value of [
      'ftp://example.com',
      'https://user@example.com',
      'https://example.com/login',
      'https://example.com/?x=1',
      'https://example.com/#x',
    ]) {
      expect(() => parseAppOrigin(value)).toThrow();
    }
  });

  it('preserves the POST body while rejecting a forged forwarded origin', async () => {
    const request = new Request('http://container:3000/settings?x=1', {
      method: 'POST',
      headers: {
        origin: 'https://beta.example.com',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'http',
        'cloudfront-forwarded-proto': 'http',
      },
      body: new URLSearchParams({ name: 'Example' }),
    });
    const normalized = normalizeRequestOrigin(
      request,
      'https://beta.example.com'
    );
    expect(normalized.url).toBe('https://beta.example.com/settings?x=1');
    expect(normalized.headers.get('host')).toBe('beta.example.com');
    expect(normalized.headers.has('x-forwarded-host')).toBe(false);
    expect(normalized.headers.has('x-forwarded-proto')).toBe(false);
    expect(normalized.headers.has('cloudfront-forwarded-proto')).toBe(false);
    expect(createClerkRequest(normalized).clerkUrl.href).toBe(
      'https://beta.example.com/settings?x=1'
    );
    expect((await parseNativeFormData(normalized)).get('name')).toBe('Example');

    const forged = normalizeRequestOrigin(
      new Request('http://container:3000/settings', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          'x-forwarded-host': 'attacker.example',
        },
        body: new URLSearchParams({ name: 'Example' }),
      }),
      'https://beta.example.com'
    );
    expect(() => parseNativeFormData(forged)).toThrow();
  });

  it('does not let Clerk override an untrusted srvx origin', () => {
    const normalized = normalizeRequestOrigin(
      new Request('http://localhost:3000/login', {
        headers: {
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'https',
        },
      })
    );
    expect(normalized.url).toBe('http://localhost:3000/login');
    expect(normalized.headers.get('host')).toBe('localhost:3000');
    expect(normalized.headers.has('x-forwarded-host')).toBe(false);
  });
});

async function startOriginCheckServer(trustProxy) {
  const server = serve({
    async fetch(request) {
      const requestOrigin = new URL(request.url).origin;
      try {
        await parseNativeFormData(request);
        return new Response(null, {
          status: 204,
          headers: { 'x-request-origin': requestOrigin },
        });
      } catch (error) {
        if (!(error instanceof Response)) throw error;
        return new Response(null, {
          status: error.status,
          headers: { 'x-request-origin': requestOrigin },
        });
      }
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
    body: new URLSearchParams({ action: 'test' }),
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
