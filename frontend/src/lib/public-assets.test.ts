import { describe, expect, it } from 'vitest';
import { isPublicAssetPath } from './public-assets';

describe('public assets', () => {
  it('allows shipped assets and bundled files', () => {
    expect(isPublicAssetPath('/favicon.ico')).toBe(true);
    expect(isPublicAssetPath('/assets/app.abc123.js')).toBe(true);
  });
  it('keeps dotted organization, invite and API paths authenticated', () => {
    for (const pathname of ['/my.org', '/join/code.txt', '/api/private.json', '/admin/my.org']) {
      expect(isPublicAssetPath(pathname)).toBe(false);
    }
  });
});
