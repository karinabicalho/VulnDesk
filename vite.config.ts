import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Build do servidor via Nitro. Na Vercel o preset "vercel" é definido por
// NITRO_PRESET em scripts/vercel-build.mjs; localmente o padrão é Node.
export default defineConfig({
  server: { host: "::", port: 8080 },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    tailwindcss(),
    nitro(),
  ],
});
