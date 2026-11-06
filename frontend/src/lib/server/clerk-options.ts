export function clerkAuthorizedParties(
  value: string | undefined
): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value.split(',').map((entry) => {
    const url = new URL(entry.trim());
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'CLERK_AUTHORIZED_PARTIES must contain comma-separated HTTP(S) origins'
      );
    }
    return url.origin;
  });
}
