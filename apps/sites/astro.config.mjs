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
  // A fresh id for every build, so pages cached by an earlier deploy are never served by a newer one.
  vite: {
    define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
    // Local tools refuse host names they don't know. Allowing the reserved example.com lets a site's own domain be
    // tried on this computer (send a Host header such as art.example.com). It has no effect on the deployed site.
    server: { allowedHosts: [".example.com"] },
    preview: { allowedHosts: [".example.com"] },
  },
  server: { allowedHosts: [".example.com"] },
  devToolbar: { enabled: false },
});
