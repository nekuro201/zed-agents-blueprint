import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Vite trata vitest:true de acordo; usamos jsdom p/ DOM (React Testing Library).
      environment: "jsdom",
      globals: false, // usamos imports explícitos de "vitest" (DRY/explicit)
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      css: false,
    },
  }),
);
