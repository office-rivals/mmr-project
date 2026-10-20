const BASE = 'http://same-origin.invalid';
const AUTH_PATHS = ['/login', '/sign-up'];

/**
 * The post-sign-in target from `?redirect_url=`, reduced to a same-origin
 * path. Anything else (absolute URLs, `//host`, `/\host`, control-character
 * tricks, the auth pages themselves) becomes '/'. Parsing with the URL
 * constructor normalises it the way a browser would, so the origin check sees
 * what the browser will follow.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return '/';
  }
  if (url.origin !== BASE) return '/';
  if (AUTH_PATHS.some((p) => url.pathname.startsWith(p))) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
