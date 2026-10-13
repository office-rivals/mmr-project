// Fails when a built page links to a page, file or heading that doesn't exist.
// Usage: node scripts/check-links.mjs dist
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = '/mmr-project';

const htmlFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.html')) htmlFiles.push(path);
  }
};
walk(dist);

const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
};

// Maps a URL path to the file GitHub Pages would serve for it.
const resolveFile = (pathname) => {
  if (!pathname.startsWith(`${base}/`) && pathname !== base) return null;
  const local = join(dist, decodeURIComponent(pathname.slice(base.length)));
  if (pathname.endsWith('/')) return join(local, 'index.html');
  if (existsSync(local) && statSync(local).isFile()) return local;
  return null;
};

const problems = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const pagePath = `${base}/${relative(dist, file).replace(/index\.html$/, '')}`;
  for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    if (/^(https?:|mailto:|data:|javascript:)/.test(raw) || raw.startsWith('//')) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), `https://site${pagePath}`);
    const target = resolveFile(url.pathname);
    const where = `${relative(dist, file)}: ${attr}="${raw}"`;
    if (!target || !existsSync(target)) {
      problems.push(`${where} → missing page or file`);
      continue;
    }
    const fragment = decodeURIComponent(url.hash.slice(1));
    if (fragment && target.endsWith('.html') && !idsOf(target).has(fragment)) {
      problems.push(`${where} → missing #${fragment}`);
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} broken link(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} pages: no broken links.`);
