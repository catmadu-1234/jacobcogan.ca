import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { forward } from "../src/index.js";

const real = globalThis.fetch;
afterEach(() => (globalThis.fetch = real));
const env = { ORIGIN: "https://origin.example.workers.dev" };

test("sends the request to the origin with the path, query and the visitor's domain", async () => {
  let seen;
  globalThis.fetch = async (req) => ((seen = req), new Response("ok"));
  const res = await forward(new Request("https://senkas.studio/work/blue-hour?x=1", { headers: { range: "bytes=0-9" } }), env);
  assert.equal(await res.text(), "ok");
  assert.equal(seen.url, "https://origin.example.workers.dev/work/blue-hour?x=1");
  assert.equal(seen.headers.get("x-forwarded-host"), "senkas.studio");
  assert.equal(seen.headers.get("range"), "bytes=0-9");
});

test("returns the origin's redirect as it is, instead of following it", async () => {
  let redirect;
  globalThis.fetch = async (req) => ((redirect = req.redirect), new Response(null, { status: 301, headers: { location: "https://senkas.studio/" } }));
  const res = await forward(new Request("https://www.senkas.studio/"), env);
  assert.equal(redirect, "manual");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://senkas.studio/");
});

test("a visitor cannot choose the forwarded domain themselves", async () => {
  let seen;
  globalThis.fetch = async (req) => ((seen = req), new Response("ok"));
  await forward(new Request("https://senkas.studio/", { headers: { "x-forwarded-host": "jacobcogan.ca" } }), env);
  assert.equal(seen.headers.get("x-forwarded-host"), "senkas.studio");
});
