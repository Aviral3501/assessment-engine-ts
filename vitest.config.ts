import { defineConfig } from "vitest/config";
import path from "node:path";


path.resolve(__dirname, "./src");
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
  },
});
