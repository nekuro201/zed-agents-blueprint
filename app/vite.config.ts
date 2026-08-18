import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Ajustes para o ambiente Tauri (WebView):
// - fixa a base para caminhos relativos
// - roda na porta 1420 e expõe apenas para o localhost (padrão Tauri)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Webviews de sistemas modernos (WebView2/WebKit/WKWebView) suportam ES2022.
    // O target do template Tauri (safari13) não é suportado pelo esbuild para o
    // bundle do zod v4 (desestruturação avançada), por isso usamos es2022.
    target: "es2022",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
