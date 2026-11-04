import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handlePublicWork } from "../../../../../lib/publicApi";

export const prerender = false;

export const GET: APIRoute = ({ params }) => handlePublicWork(env, params.site ?? "", params.slug ?? "");
