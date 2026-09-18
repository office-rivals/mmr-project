import type { QueryClient } from '@tanstack/react-query';
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { ClerkProvider } from '@clerk/tanstack-react-start';
import appCss from '../app.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        {
          name: 'viewport',
          content:
            // viewport-fit=cover is what makes env(safe-area-inset-*) non-zero.
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
        { name: 'msapplication-TileColor', content: '#01182e' },
        { name: 'theme-color', content: '#01182e' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
        { name: 'apple-mobile-web-app-title', content: 'MMR Project' },
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon-32x32.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: '/favicon-16x16.png',
        },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#01182e' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
      ],
    }),
    shellComponent: RootDocument,
  }
);

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // Dark mode is unconditional — there is no theme toggle anywhere in the app.
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider signInUrl="/login" signUpUrl="/sign-up">
          {children}
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
