/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types" />

import type { Site } from "@senka/core/types";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      MEDIA: R2Bucket;
      ASSETS: Fetcher;
      /** URL prefix media is served from: "/media" now, an R2 custom domain later. */
      MEDIA_BASE: string;
    }
  }
}

declare global {
  namespace App {
    interface Locals {
      site?: Site;
      /** "" on a site's own hostname, "/<slug>" when served from the shared address. */
      basePath: string;
      /** The full address the visitor requested, from before any internal rewrite. */
      publicUrl?: string;
      /** Set once a request has been rewritten to its internal route (Astro then runs the middleware again). */
      rewritten?: boolean;
    }
  }
}

declare global {
  /** Unique to each build (set in astro.config.mjs); part of the page cache key. */
  const __BUILD_ID__: string;
}

export {};
