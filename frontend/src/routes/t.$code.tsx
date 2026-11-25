import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { HttpError } from '@/lib/http-error';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';

// Random codes are 10 Crockford base32 characters (case-insensitive); an
// admin can also pick a readable one for a table (`table1`, `[a-z0-9-]`).
const CODE = /^[0-9A-Za-z-]{3,32}$/;

/**
 * Where a table, match or badge short code points, null for an unknown code,
 * or 'expired' for a badge code past its 10 minutes.
 */
const resolveShortLinkFn = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(async ({ data: code }): Promise<string | null | 'expired'> => {
    if (!CODE.test(code)) return null;
    const { foosballApi } = await requireApiClientV3();
    try {
      const { path } = await foosballApi.resolveShortLink(code);
      const safe = safeRedirectPath(path);
      return safe === '/' ? null : safe;
    } catch (err) {
      const status = (err as { response?: Response }).response?.status;
      if (status === 404) return null;
      if (status === 410) return 'expired';
      throw err;
    }
  });

// Short link printed as the scoreboard's QR code (a match, or a badge to
// link) and written to the table's NFC sticker. Signed-out phones go through
// /login and come back here.
export const Route = createFileRoute('/t/$code')({
  loader: async ({ params }) => {
    const path = await resolveShortLinkFn({ data: params.code });
    if (path === 'expired')
      throw new HttpError(
        410,
        'This badge link has expired. Tap the badge on the scoreboard again.'
      );
    if (!path) throw new HttpError(404, 'This link is not valid');
    throw redirect({ href: path });
  },
  errorComponent: HttpErrorView,
});
