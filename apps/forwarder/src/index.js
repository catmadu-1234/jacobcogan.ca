/**
 * Passes every request to the portfolio Worker and returns its answer. The portfolio decides which site to show
 * from the address the visitor used, so that address travels along in `x-forwarded-host`.
 *
 * @param {Request} request
 * @param {{ ORIGIN: string }} env
 */
export async function forward(request, env) {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.ORIGIN);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", incoming.hostname);
  // Redirects (such as www to the bare domain) go back to the visitor untouched.
  return fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: "manual" }));
}

export default { fetch: forward };
