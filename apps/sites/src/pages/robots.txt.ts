import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
