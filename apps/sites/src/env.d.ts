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
    }
  }
}

export {};
