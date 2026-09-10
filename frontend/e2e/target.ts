// Which app the suite is driving. The specs are shared: `frontend` (SvelteKit)
// is the default, `frontend-beta` (React/TanStack Start) is selected with
// E2E_FRONTEND_DIR, matching playwright.config.ts.
//
// Almost every assertion is framework-agnostic — same URLs, same strings, same
// testids. The exceptions are the admin tests that watch the network to prove a
// save raced correctly, because "the mutation POST" and "the data reload" have
// no shared shape: SvelteKit posts to the form action `?/edit` and reloads via
// `__data.json`, while TanStack Start routes both through its server-fn RPC
// endpoint. These helpers keep that difference in one place.
export const IS_BETA = process.env.E2E_FRONTEND_DIR === 'frontend-beta';

// TanStack Start identifies a server function with a base64url-encoded JSON
// blob as the final path segment, e.g.
//   /_serverFn/__data.json/<base64url {"file":"…","export":"editMatchFn_…"}>
// so the function name never appears literally in the URL.
function serverFnExport(pathname: string): string {
  const id = pathname.split('/').pop() ?? '';
  try {
    const decoded = JSON.parse(
      Buffer.from(id, 'base64url').toString('utf8')
    ) as { export?: string };
    return decoded.export ?? '';
  } catch {
    return '';
  }
}

const isServerFn = (pathname: string, fnName: string) =>
  serverFnExport(pathname).startsWith(fnName);

// The match-edit mutation.
export const isEditPostUrl = (url: string) =>
  IS_BETA
    ? isServerFn(new URL(url).pathname, 'editMatchFn')
    : url.includes('?/edit');

export const isEditPostRoute = (url: URL) =>
  IS_BETA
    ? isServerFn(url.pathname, 'editMatchFn')
    : url.pathname.endsWith('/matches') && url.search.includes('/edit');

// The post-save data reload: SvelteKit's `__data.json` fetch, and the loader's
// server function on the beta. Deliberately NOT every beta RPC — the edit POST
// shares that prefix, and stalling it too would close the window these tests
// need to observe.
export const isDataReloadRoute = (url: URL) =>
  IS_BETA
    ? isServerFn(url.pathname, 'loadMatchesFn')
    : url.pathname.includes('__data.json');

// The row's delete form, scripted directly when a modal covers the button.
export const DELETE_FORM_SELECTOR = IS_BETA
  ? 'form[data-delete-match]'
  : 'form[action="?/delete"]';
