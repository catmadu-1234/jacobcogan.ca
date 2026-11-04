import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handlePublicWorks } from "../../../../lib/publicApi";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => handlePublicWorks(env, params.site ?? "", new URL(request.url));
