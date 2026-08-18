import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  sourcemap: true,
  clean: true,
  // O SDK do pi é ESM e pesado; empacotamos tudo num único arquivo para o
  // Rust spawnar facilmente: `node dist/index.mjs [--project-dir <dir>] [--mock]`.
  outExtension() {
    return { js: ".mjs" };
  },
});
