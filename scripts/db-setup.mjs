// Prepara o banco do VulnDesk: aplica as migrações versionadas em
// supabase/migrations, provisiona as contas (admin, professor e demonstração)
// e carrega os dados de demonstração na primeira execução.
//
// Roda no build da Vercel (scripts/vercel-build.mjs) ou manualmente:
//   node scripts/db-setup.mjs
//
// Nenhuma senha ou chave fica no código (RNF04): tudo vem de variáveis de ambiente.
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { DEMO_COMPANIES, DEMO_PROJECTS, DEMO_FINDINGS } from "./seed-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;

const RENAMED_MIGRATIONS = {
  "20260810225747_ce6fc804-1b7d-4364-9e60-bb4408a7e290.sql": "20260810225747_esquema_inicial.sql",
  "20260810225957_a9ebb1a3-789b-4b5f-b76d-728a4367037f.sql": "20260810225957_storage_evidencias.sql",
};

const log = (...a) => console.log("[db-setup]", ...a);

export function resolveDbEnv() {
  return {
    dbUrl: env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.DATABASE_URL || "",
    supabaseUrl: (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
  };
}

function connect(url) {
  // Remove parâmetros que o postgres.js repassaria ao servidor (ex.: supa=, sslmode=).
  const clean = url.split("?")[0];
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(clean);
  return postgres(clean, {
    ssl: local ? false : "require",
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
}

async function applyMigrations(sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS vulndesk_meta`;
  await sql`CREATE TABLE IF NOT EXISTS vulndesk_meta.migrations (
    version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS vulndesk_meta.flags (
    key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`REVOKE ALL ON SCHEMA vulndesk_meta FROM PUBLIC`;

  // Migrações renomeadas: atualiza o registro para não reaplicá-las.
  for (const [from, to] of Object.entries(RENAMED_MIGRATIONS)) {
    await sql`UPDATE vulndesk_meta.migrations SET version = ${to}
              WHERE version = ${from}
                AND NOT EXISTS (SELECT 1 FROM vulndesk_meta.migrations WHERE version = ${to})`;
  }

  const dir = join(root, "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await sql`SELECT version FROM vulndesk_meta.migrations`).map((r) => r.version));

  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(join(dir, file), "utf8");
    log("aplicando migração", file);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO vulndesk_meta.migrations (version) VALUES (${file})`;
    });
  }
  // Recarrega o cache de schema do PostgREST após mudanças estruturais.
  await sql`NOTIFY pgrst, 'reload schema'`;
}

async function authAdmin(supabaseUrl, serviceKey, path, init = {}) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      ...(serviceKey.startsWith("sb_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`auth admin ${path}: ${res.status} ${text}`);
  return body;
}

async function ensureAuthUser(ctx, { email, password, fullName }) {
  const existing = ctx.authUsers.get(email);
  if (existing) {
    await authAdmin(ctx.supabaseUrl, ctx.serviceKey, `/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true, user_metadata: { full_name: fullName } }),
    });
    return existing.id;
  }
  const created = await authAdmin(ctx.supabaseUrl, ctx.serviceKey, "/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  ctx.authUsers.set(email, created);
  return created.id;
}

async function ensureAccount(sql, ctx, account) {
  const userId = await ensureAuthUser(ctx, account);
  let companyId = null;
  if (account.company) {
    const [c] = await sql`SELECT id FROM public.companies WHERE name = ${account.company} LIMIT 1`;
    companyId = c?.id ?? null;
  }
  const [profile] = await sql`
    INSERT INTO public.profiles (user_id, email, full_name, company_id)
    VALUES (${userId}, ${account.email}, ${account.fullName}, ${companyId})
    ON CONFLICT (email) DO UPDATE
      SET user_id = EXCLUDED.user_id, full_name = EXCLUDED.full_name, company_id = EXCLUDED.company_id
    RETURNING id`;
  await sql`DELETE FROM public.user_roles WHERE user_id = ${userId} AND NOT (role::text = ANY(${account.roles}))`;
  for (const role of account.roles) {
    await sql`INSERT INTO public.user_roles (user_id, role) VALUES (${userId}, ${role}::public.app_role)
              ON CONFLICT (user_id, role) DO NOTHING`;
  }
  log(`conta pronta: ${account.email} (${account.roles.join("+")})`);
  return profile.id;
}

async function loadAuthUsers(ctx) {
  const map = new Map();
  for (let page = 1; page < 20; page++) {
    const body = await authAdmin(ctx.supabaseUrl, ctx.serviceKey, `/users?page=${page}&per_page=200`);
    const users = body?.users ?? [];
    for (const u of users) if (u.email) map.set(u.email.toLowerCase(), u);
    if (users.length < 200) break;
  }
  return map;
}

function accountsFromEnv() {
  const list = [];
  const demo = env.VULNDESK_DEMO_PASSWORD;
  if (env.VULNDESK_ADMIN_PASSWORD) {
    list.push({
      email: (env.VULNDESK_ADMIN_EMAIL || "admin@vulndesk.app").toLowerCase(),
      password: env.VULNDESK_ADMIN_PASSWORD,
      fullName: "Administrador VulnDesk",
      roles: ["pentester", "admin"],
    });
  } else log("VULNDESK_ADMIN_PASSWORD ausente — conta admin não provisionada");
  if (env.VULNDESK_PROFESSOR_PASSWORD) {
    list.push({
      email: (env.VULNDESK_PROFESSOR_EMAIL || "professor@vulndesk.app").toLowerCase(),
      password: env.VULNDESK_PROFESSOR_PASSWORD,
      fullName: "Professor Avaliador",
      roles: ["pentester"],
    });
  } else log("VULNDESK_PROFESSOR_PASSWORD ausente — conta do professor não provisionada");
  if (demo) {
    list.push(
      { email: "pentester@example.com", password: demo, fullName: "Ana Ribeiro", roles: ["pentester"] },
      { email: "bruno.lima@example.com", password: demo, fullName: "Bruno Lima", roles: ["pentester"] },
      { email: "carla.souza@example.com", password: demo, fullName: "Carla Souza", roles: ["pentester"] },
      { email: "cliente.alpha@example.com", password: demo, fullName: "Cliente Alpha", roles: ["client"], company: "Empresa Alpha" },
      { email: "cliente.beta@example.com", password: demo, fullName: "Cliente Beta", roles: ["client"], company: "Empresa Beta" },
      { email: "cliente.gamma@example.com", password: demo, fullName: "Cliente Gamma", roles: ["client"], company: "Empresa Gamma" },
    );
  } else log("VULNDESK_DEMO_PASSWORD ausente — contas de demonstração não provisionadas");
  return list;
}

async function seedDemoData(sql) {
  const [flag] = await sql`SELECT value FROM vulndesk_meta.flags WHERE key = 'demo_seeded'`;
  if (flag) return false;
  const [pending] = await sql`SELECT 1 FROM vulndesk_meta.flags WHERE key = 'demo_projects'`;
  if (pending) return false;
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM public.companies`;
  if (count > 0) {
    await sql`INSERT INTO vulndesk_meta.flags (key, value) VALUES ('demo_seeded', 'skipped') ON CONFLICT DO NOTHING`;
    return false;
  }
  log("carregando dados de demonstração");
  await sql.begin(async (tx) => {
    const companyIds = {};
    for (const c of DEMO_COMPANIES) {
      const [row] = await tx`INSERT INTO public.companies (name, identifier, description, status)
        VALUES (${c.name}, ${c.identifier}, ${c.description}, ${c.status}) RETURNING id`;
      companyIds[c.name] = row.id;
    }
    const projectIds = {};
    for (const p of DEMO_PROJECTS) {
      const [row] = await tx`INSERT INTO public.projects
        (company_id, name, description, type, start_date, end_date, contracted_hours, used_hours, status)
        VALUES (${companyIds[p.company]}, ${p.name}, ${p.description}, ${p.type}, ${p.start}, ${p.end},
                ${p.contracted}, ${p.used}, ${p.status}) RETURNING id`;
      projectIds[p.name] = row.id;
    }
    await tx`INSERT INTO vulndesk_meta.flags (key, value) VALUES ('demo_projects', ${JSON.stringify(projectIds)})
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  });
  return true;
}

async function seedTeamsAndFindings(sql) {
  const [flag] = await sql`SELECT value FROM vulndesk_meta.flags WHERE key = 'demo_seeded'`;
  if (flag) return;
  const [projFlag] = await sql`SELECT value FROM vulndesk_meta.flags WHERE key = 'demo_projects'`;
  if (!projFlag) return;
  const projectIds = JSON.parse(projFlag.value);
  const pentesters = await sql`SELECT id, email FROM public.profiles
    WHERE email IN ('pentester@example.com','bruno.lima@example.com','carla.souza@example.com')`;
  const byEmail = Object.fromEntries(pentesters.map((p) => [p.email, p.id]));

  await sql.begin(async (tx) => {
    for (const p of DEMO_PROJECTS) {
      for (const email of p.team) {
        if (!byEmail[email] || !projectIds[p.name]) continue;
        await tx`INSERT INTO public.project_pentesters (project_id, profile_id)
                 VALUES (${projectIds[p.name]}, ${byEmail[email]}) ON CONFLICT DO NOTHING`;
      }
    }
    for (const f of DEMO_FINDINGS) {
      const [row] = await tx`INSERT INTO public.findings
        (project_id, title, severity, description, impact, mitigation, cvss, status, discovered_at, resolved_at, pentester_id)
        VALUES (${projectIds[f.project]}, ${f.title}, ${f.severity}, ${f.description}, ${f.impact}, ${f.mitigation},
                ${f.cvss}, ${f.status}, ${f.discovered}, ${f.resolved ?? null}, ${byEmail[f.by] ?? null})
        RETURNING id`;
      for (const e of f.evidences ?? []) {
        await tx`INSERT INTO public.finding_evidences (finding_id, type, caption, content)
                 VALUES (${row.id}, 'text', ${e.caption}, ${e.content})`;
      }
    }
    await tx`INSERT INTO vulndesk_meta.flags (key, value) VALUES ('demo_seeded', 'yes')
             ON CONFLICT (key) DO UPDATE SET value = 'yes'`;
  });
  log(`dados de demonstração carregados: ${DEMO_FINDINGS.length} findings`);
}

export async function setupDatabase() {
  const { dbUrl, supabaseUrl, serviceKey } = resolveDbEnv();
  if (!dbUrl) {
    log("nenhuma URL de banco (POSTGRES_URL_NON_POOLING/POSTGRES_URL) — etapa ignorada");
    return;
  }
  const sql = connect(dbUrl);
  try {
    await sql`SELECT pg_advisory_lock(727001)`;
    await applyMigrations(sql);
    await seedDemoData(sql);

    if (!supabaseUrl || !serviceKey) {
      log("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — contas não provisionadas");
      return;
    }
    const ctx = { supabaseUrl, serviceKey, authUsers: new Map() };
    ctx.authUsers = await loadAuthUsers(ctx);
    for (const account of accountsFromEnv()) await ensureAccount(sql, ctx, account);
    await seedTeamsAndFindings(sql);
  } finally {
    await sql`SELECT pg_advisory_unlock(727001)`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase().catch((err) => {
    console.error("[db-setup] falhou:", err);
    process.exit(1);
  });
}
