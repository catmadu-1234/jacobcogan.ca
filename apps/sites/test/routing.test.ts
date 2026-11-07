import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { routePage, type RoutingLocals } from "../src/lib/routing";
import { seedSites } from "./fixtures";

/** Behaves like Astro: a rewrite runs the whole middleware again, on the new URL, with the same `locals`. */
function harness() {
  const calls = { rewrites: [] as string[], nexts: 0 };
  const locals: RoutingLocals = { basePath: "" };
  const store = new Map<string, Response>();
  const puts: string[] = [];
  const cache = {
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => void (puts.push(r.url), store.set(r.url, res.clone())),
  } as unknown as Cache;
  const pending: Promise<unknown>[] = [];

  async function run(url: string, opts: { withCache?: boolean; localsOverride?: RoutingLocals; headers?: Record<string, string> } = {}): Promise<Response> {
    return routePage({
      request: new Request(url, { headers: opts.headers }),
      locals: opts.localsOverride ?? locals,
      env,
      cache: opts.withCache ? cache : undefined,
      ctx: { waitUntil: (p) => void pending.push(p) },
      buildId: "t",
      next: async () => (calls.nexts++, new Response("page")),
      rewrite: async (path) => {
        calls.rewrites.push(path);
        if (calls.rewrites.length > 3) throw new Error("rewrite loop");
        return run(`${new URL(url).origin}${path}`, opts);
      },
    });
  }
  return { run, calls, locals, puts, settle: () => Promise.all(pending) };
}

describe("routePage behind a forwarder", () => {
  const via = (host: string) => ({ headers: { "x-forwarded-host": host } });

  it("serves the site that owns the forwarded domain, keeping the visitor's address", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://senka-sites.example.workers.dev/work/blue-hour?x=1", via("art.example.com"));
    expect(h.calls.rewrites).toEqual(["/site-b/work/blue-hour?x=1"]);
    expect(h.locals.site!.slug).toBe("site-b");
    expect(h.locals.basePath).toBe("");
    expect(h.locals.publicUrl).toBe("https://art.example.com/work/blue-hour?x=1");
  });

  it("redirects the forwarded www. address to the bare domain", async () => {
    await seedSites();
    const res = await harness().run("https://senka-sites.example.workers.dev/studio", via("www.art.example.com"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://art.example.com/studio");
  });

  it("caches pages under the visitor's address, not the forwarder's", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://senka-sites.example.workers.dev/", { ...via("art.example.com"), withCache: true });
    await h.settle();
    expect(h.puts.length).toBeGreaterThan(0);
    expect(h.puts.every((u) => u.includes("/art.example.com/"))).toBe(true);
  });

  it("ignores a forwarded value that is not a plain hostname", async () => {
    await seedSites();
    for (const bad of ["art.example.com/evil", "art example.com", "-x.com"]) {
      const h = harness();
      await h.run("https://senka-sites.example.workers.dev/site-a", via(bad));
      expect(h.locals.site!.slug, bad).toBe("site-a");
      expect(h.locals.basePath, bad).toBe("/site-a");
    }
  });
});

describe("routePage on www", () => {
  it("redirects www. of a site's domain to the bare domain, keeping path and query", async () => {
    await seedSites();
    const res = await harness().run("https://www.art.example.com/work/blue-hour?x=1");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://art.example.com/work/blue-hour?x=1");
  });

  it("leaves www. alone when no site owns the bare domain", async () => {
    await seedSites();
    const res = await harness().run("https://www.nobody.example.com/");
    expect(res.status).toBe(200);
  });
});

describe("routePage on a site's own hostname", () => {
  it("rewrites once to the site's internal route and then renders it, without looping", async () => {
    await seedSites();
    const h = harness();
    const res = await h.run("https://art.example.com/work/blue-hour?x=1");
    expect(await res.text()).toBe("page");
    expect(h.calls.rewrites).toEqual(["/site-b/work/blue-hour?x=1"]);
    expect(h.calls.nexts).toBe(1);
  });

  it("maps the home page, and keeps the visitor's address for the canonical link", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://art.example.com/");
    expect(h.calls.rewrites).toEqual(["/site-b"]);
    expect(h.locals.publicUrl).toBe("https://art.example.com/");
    expect(h.locals.site!.slug).toBe("site-b");
    expect(h.locals.basePath).toBe("");
  });

  it("does not let another site's path through on a custom domain", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://art.example.com/site-b/work/x");
    expect(h.calls.rewrites).toEqual(["/site-b/site-b/work/x"]); // an internal route that does not exist: a 404, not a loop
    expect(h.calls.nexts).toBe(1);
  });
});

describe("routePage on the shared address", () => {
  it("serves a site by its path prefix with no rewrite", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://x.workers.dev/site-a/work/y");
    expect(h.calls.rewrites).toEqual([]);
    expect(h.calls.nexts).toBe(1);
    expect(h.locals.basePath).toBe("/site-a");
    expect(h.locals.publicUrl).toBe("https://x.workers.dev/site-a/work/y");
  });

  it("passes shared routes straight through with no site", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://x.workers.dev/media/1/2/w480");
    expect(h.calls.nexts).toBe(1);
    expect(h.locals.site).toBeUndefined();
  });
});

describe("routePage caching", () => {
  it("renders a page once, then serves it from the cache, also through the rewrite", async () => {
    await seedSites();
    const h = harness();
    await h.run("https://art.example.com/work/y", { withCache: true });
    await h.settle();
    expect(h.puts).toHaveLength(1);
    const fresh = harness();
    const again = await h.run("https://art.example.com/work/y", { withCache: true, localsOverride: { basePath: "" } });
    await h.settle();
    expect(again.headers.get("x-cache")).toBe("HIT");
    expect(h.calls.nexts).toBe(1);
    expect(fresh.calls.nexts).toBe(0);
  });
});
