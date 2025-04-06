export function withSeasonParam(path: string, seasonId?: number): string {
  if (!seasonId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}season=${seasonId}`;
}
