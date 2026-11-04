import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handleMediaRequest } from "../../lib/mediaRoute";

export const prerender = false;

export const GET: APIRoute = ({ request, params }) => handleMediaRequest(env, request, params.key ?? "");
