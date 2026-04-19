import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    fileParallelism: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
