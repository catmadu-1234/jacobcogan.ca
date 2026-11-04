import { describe, expect, it } from "vitest";
import type { Site } from "@senka/core";
import { versionCacheKey, withVersionCache } from "../src/lib/cache";

const site = { id: 4, contentVersion: 7 } as Site;

function fakeCache() {
  const store = new Map<string, Response>();
  const cache = {
    match: async (req: Request) => store.get(req.url)?.clone(),
    put: async (req: Request, res: Response) => void store.set(req.url, res.clone()),
  };
  return { cache: cache as unknown as Cache, store };
}
const ctx = () => {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => void pending.push(p), settle: () => Promise.all(pending) };
};
const page = (body = "<p>hi</p>", init: ResponseInit = {}) => () => Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/html" }, ...init }));

describe("versionCacheKey", () => {
  it("includes the site and its content version so publishing invalidates old pages", () => {
    const a = versionCacheKey(site, new URL("https://x.dev/site-a/work/y?tag=oil"));
    const b = versionCacheKey({ ...site, contentVersion: 8 } as Site, new URL("https://x.dev/site-a/work/y?tag=oil"));
    expect(a).not.toBe(b);
    expect(a).toContain("/4/7/");
    expect(a).toContain("/site-a/work/y?tag=oil");
  });
});

describe("withVersionCache", () => {
  it("renders on a miss, stores the page, and serves it from cache next time", async () => {
    const { cache } = fakeCache();
    const c = ctx();
    let renders = 0;
    const render = () => { renders++; return page()(); };
    const req = new Request("https://x.dev/site-a");
    const first = await withVersionCache(cache, req, site, c, render);
    await c.settle();
    const second = await withVersionCache(cache, req, site, c, render);
    expect(renders).toBe(1);
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.text()).toBe("<p>hi</p>");
  });

  it("makes browsers revalidate and lets the edge keep the page for a day", async () => {
    const { cache, store } = fakeCache();
    const c = ctx();
    const res = await withVersionCache(cache, new Request("https://x.dev/a"), site, c, page());
    await c.settle();
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect([...store.values()][0]!.headers.get("cache-control")).toBe("public, s-maxage=86400");
  });

  it("renders again after the content version changes", async () => {
    const { cache } = fakeCache();
    const c = ctx();
    let renders = 0;
    const render = () => { renders++; return page()(); };
    const req = new Request("https://x.dev/a");
    await withVersionCache(cache, req, site, c, render);
    await c.settle();
    await withVersionCache(cache, req, { ...site, contentVersion: 8 } as Site, c, render);
    expect(renders).toBe(2);
  });

  it("does not cache errors, non-GET requests or responses that set cookies", async () => {
    const { cache, store } = fakeCache();
    const c = ctx();
    await withVersionCache(cache, new Request("https://x.dev/a"), site, c, () => Promise.resolve(new Response("nope", { status: 404 })));
    await withVersionCache(cache, new Request("https://x.dev/b", { method: "POST" }), site, c, page());
    await withVersionCache(cache, new Request("https://x.dev/c"), site, c, page("x", { headers: { "set-cookie": "a=b" } }));
    await c.settle();
    expect(store.size).toBe(0);
  });

  it("works without a cache (for example on workers.dev, where the Cache API does nothing)", async () => {
    const res = await withVersionCache(undefined, new Request("https://x.dev/a"), site, ctx(), page());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<p>hi</p>");
  });
});
