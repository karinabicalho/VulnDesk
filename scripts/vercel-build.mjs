// Build de produção na Vercel:
// 1. mapeia as variáveis criadas pela integração Supabase ↔ Vercel para as
//    variáveis que o front (VITE_*) e o servidor esperam;
// 2. verifica os tipos (TypeScript) e aplica migrações e provisiona as contas (scripts/db-setup.mjs);
// 3. gera o build com o preset "vercel" do Nitro.
import { spawnSync } from "node:child_process";
import { setupDatabase } from "./db-setup.mjs";

const env = process.env;
const first = (...keys) => keys.map((k) => env[k]).find((v) => v && v.length > 0) ?? "";

const url = first("VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const anon = first(
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
);

if (!url || !anon) {
  console.error("[vercel-build] SUPABASE_URL e chave pública do Supabase são obrigatórias.");
  process.exit(1);
}

env.VITE_SUPABASE_URL = url;
env.VITE_SUPABASE_PUBLISHABLE_KEY = anon;
env.SUPABASE_URL ||= url;
env.SUPABASE_PUBLISHABLE_KEY ||= anon;
if (env.VULNDESK_DEMO_PASSWORD) env.VITE_DEMO_PASSWORD = env.VULNDESK_DEMO_PASSWORD;
env.NITRO_PRESET ||= "vercel";

// RNF13: verificação automática de tipos — o deploy falha se houver erro de tipo.
const tsc = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { stdio: "inherit", env });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

await setupDatabase();

const res = spawnSync("npx", ["vite", "build"], { stdio: "inherit", env, shell: false });
process.exit(res.status ?? 1);
