/**
 * Prefixes root-absolute links in Markdown with the site's base path, so pages
 * can link to `/quick-start/` wherever the site is hosted.
 *
 * @param {{ base: string }} options
 */
export default function rehypeBaseLinks({ base }) {
  const prefix = base.replace(/\/$/, '');

  /** @param {any} node */
  const visit = (node) => {
    if (node.type === 'element' && node.tagName === 'a') {
      const href = node.properties?.href;
      if (
        typeof href === 'string' &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        href !== prefix &&
        !href.startsWith(`${prefix}/`)
      ) {
        node.properties.href = prefix + href;
      }
    }
    node.children?.forEach(visit);
  };

  return (/** @type {any} */ tree) => visit(tree);
}
