/**
 * The canonical address of a page: the one the visitor used, without query or fragment. It must come from the
 * original request, not from Astro's request object, which is replaced by the internal route after a rewrite.
 */
export function canonicalUrl(publicUrl: string): string {
  const url = new URL(publicUrl);
  return `${url.origin}${url.pathname}`;
}
