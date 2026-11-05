import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handleMediaRequest } from "../../lib/mediaRoute";

export const prerender = false;

export const GET: APIRoute = ({ request, params }) => // Locally the demo seed swaps pictures under the same ids, so the browser must recheck instead of caching for a year.
  handleMediaRequest(env, request, params.key ?? "", import.meta.env.DEV ? "no-cache" : undefined);
