const publicFiles = new Set([
  '/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png',
  '/android-chrome-192x192.png', '/android-chrome-384x384.png',
  '/android-chrome-512x512.png', '/apple-touch-icon.png',
  '/safari-pinned-tab.svg', '/site.webmanifest', '/mstile-150x150.png',
  '/browserconfig.xml', '/sounds/match-found.mp3',
]);

export function isPublicAssetPath(pathname: string): boolean {
  return publicFiles.has(pathname) || pathname.startsWith('/assets/') ||
    (import.meta.env.DEV && (
      pathname.startsWith('/@') || pathname.startsWith('/node_modules/') ||
      pathname.startsWith('/src/')
    ));
}
