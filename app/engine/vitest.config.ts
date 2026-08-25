import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";

/**
 * O código-fonte do engine importa os próprios módulos com extensão `.js`
 * (convenção Node ESM, resolvida pelo `tsc`/`tsup`). O Vitest resolve fonte
 * TypeScript por extensão, então mapeamos `x.js` -> `x.ts` para os testes
 * rodarem sobre o código `.ts` diretamente — sem tocar no bundle.
 */
function resolveJsToTs() {
  return {
    name: "resolve-js-to-ts",
    enforce: "pre" as const,
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(".js") || source.startsWith("node:")) return null;
      const base = source.slice(0, -3);
      const dir = importer ? path.dirname(importer) : process.cwd();
      const abs = path.resolve(dir, base);
      for (const ext of [".ts", ".mts", ".tsx"]) {
        if (fs.existsSync(abs + ext)) return abs + ext;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    // Motor = Node puro (sem DOM); o frontend usa jsdom num config separado.
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // T0 ainda não tem arquivos de teste: sem isso, `vitest run` sai com código 1
    // ("No test files found") — o que quebraria o setup antes da primeira suite.
    passWithNoTests: true,
  },
});
