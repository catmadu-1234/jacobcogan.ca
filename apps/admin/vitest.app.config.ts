import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Browser-side tests (React components and client logic) run in jsdom, separate from the Workers-runtime tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["test/app/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/app/setup.ts"],
  },
});
