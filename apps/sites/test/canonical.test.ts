import { describe, expect, it } from "vitest";
import { canonicalUrl } from "../src/lib/canonical";
import { rewritePath } from "../src/lib/site";

describe("canonicalUrl", () => {
  it("is the address the visitor actually used, without the query or fragment", () => {
    expect(canonicalUrl("https://herdomain.com/work/blue-hour?utm=x#top")).toBe("https://herdomain.com/work/blue-hour");
    expect(canonicalUrl("https://x.workers.dev/site-a/work/y")).toBe("https://x.workers.dev/site-a/work/y");
    expect(canonicalUrl("https://herdomain.com/")).toBe("https://herdomain.com/");
  });

  it("never exposes the internal route a site's own domain is rewritten to", () => {
    // On herdomain.com a request for /work/blue-hour is served from /site-b/work/blue-hour internally;
    // the canonical address must stay the public one, because /site-b/... is a 404 on that domain.
    const publicUrl = "https://herdomain.com/work/blue-hour";
    const internal = rewritePath(new URL(publicUrl).pathname, "site-b", "");
    expect(internal).toBe("/site-b/work/blue-hour");
    expect(canonicalUrl(publicUrl)).not.toContain("/site-b");
    expect(canonicalUrl(`https://herdomain.com${internal}`)).toContain("/site-b"); // what the layout used to emit
  });
});
