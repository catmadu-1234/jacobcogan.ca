import { Hono } from "hono";
import { listFacetValues } from "@senka/core";
import type { AppEnv } from "../env";

export const facetRoutes = new Hono<AppEnv>();

/** The values this site's works already carry for each facet, for suggestions while editing. */
facetRoutes.get("/", async (c) => c.json(await listFacetValues(c.env.DB, c.get("siteId"))));
