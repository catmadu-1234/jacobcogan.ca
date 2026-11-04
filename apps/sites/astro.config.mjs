import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  // Images are resized in the browser when they are uploaded, so Astro's own image handling (and the Cloudflare
  // Images binding it would otherwise add) is switched off.
  adapter: cloudflare({ imageService: "passthrough", persistState: { path: "../../.wrangler/state" } }),
  integrations: [react()],
  build: { inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
