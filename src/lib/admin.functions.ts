// Gestão de contas (somente administradores).
// Executa no servidor: valida o token do chamador, confirma o papel "admin"
// no banco (RNF01) e só então usa a chave de serviço, que nunca chega ao
// navegador (RNF04).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "is_admin") => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("is_admin");
  if (error || data !== true) throw new Error("Acesso negado: apenas administradores podem gerenciar contas.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const roleSchema = z.enum(["pentester", "client", "admin"]);

export type ManagedUser = {
  profileId: string;
  userId: string | null;
  email: string;
  fullName: string;
  companyId: string | null;
  companyName: string | null;
  roles: string[];
  lastSignInAt: string | null;
  createdAt: string;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as unknown as Ctx);
    const db = await admin();
    const [{ data: profiles, error }, { data: roles }, authList] = await Promise.all([
      db.from("profiles").select("id, user_id, email, full_name, company_id, created_at, companies(name)").order("full_name"),
      db.from("user_roles").select("user_id, role"),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (error) throw new Error(error.message);
    const lastSeen = new Map((authList.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
    return (profiles ?? []).map((p) => ({
      profileId: p.id,
      userId: p.user_id,
      email: p.email,
      fullName: p.full_name,
      companyId: p.company_id,
      companyName: (p as { companies?: { name: string } | null }).companies?.name ?? null,
      roles: (roles ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.role as string),
      lastSignInAt: p.user_id ? (lastSeen.get(p.user_id) ?? null) : null,
      createdAt: p.created_at,
    }));
  });

const createSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe o nome").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
    role: roleSchema,
    companyId: z.string().uuid().nullable(),
  })
  .refine((v) => v.role !== "client" || !!v.companyId, {
    message: "Selecione a empresa do cliente",
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      throw new Error(
        error?.message?.includes("already") ? "Já existe uma conta com este e-mail." : (error?.message ?? "Falha ao criar conta"),
      );
    }
    const userId = created.user.id;
    const companyId = data.role === "client" ? data.companyId : null;
    const { error: profileError } = await db
      .from("profiles")
      .upsert({ user_id: userId, email: data.email, full_name: data.fullName, company_id: companyId }, { onConflict: "email" });
    const roles = data.role === "admin" ? (["pentester", "admin"] as const) : ([data.role] as const);
    const { error: roleError } = await db
      .from("user_roles")
      .insert(roles.map((role) => ({ user_id: userId, role })));
    if (profileError || roleError) {
      await db.auth.admin.deleteUser(userId);
      throw new Error((profileError ?? roleError)?.message ?? "Falha ao registrar perfil");
    }
    return { ok: true as const };
  });

const updateSchema = z
  .object({
    profileId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(120),
    role: roleSchema,
    companyId: z.string().uuid().nullable(),
    password: z.string().max(72).optional(),
  })
  .refine((v) => v.role !== "client" || !!v.companyId, { message: "Selecione a empresa do cliente" })
  .refine((v) => !v.password || v.password.length >= 8, { message: "A nova senha deve ter ao menos 8 caracteres" });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const { data: profile } = await db.from("profiles").select("user_id").eq("id", data.profileId).maybeSingle();
    if (!profile?.user_id) throw new Error("Conta não encontrada");
    if (profile.user_id === ctx.userId && data.role !== "admin") {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }
    const { error } = await db
      .from("profiles")
      .update({ full_name: data.fullName, company_id: data.role === "client" ? data.companyId : null })
      .eq("id", data.profileId);
    if (error) throw new Error(error.message);
    await db.from("user_roles").delete().eq("user_id", profile.user_id);
    const roles = data.role === "admin" ? (["pentester", "admin"] as const) : ([data.role] as const);
    const { error: roleError } = await db.from("user_roles").insert(roles.map((role) => ({ user_id: profile.user_id!, role })));
    if (roleError) throw new Error(roleError.message);
    if (data.password) {
      const { error: pwError } = await db.auth.admin.updateUserById(profile.user_id, { password: data.password });
      if (pwError) throw new Error(pwError.message);
    }
    return { ok: true as const };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ profileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const { data: profile } = await db.from("profiles").select("user_id").eq("id", data.profileId).maybeSingle();
    if (profile?.user_id === ctx.userId) throw new Error("Você não pode excluir a sua própria conta.");
    if (profile?.user_id) {
      await db.from("user_roles").delete().eq("user_id", profile.user_id);
      const { error } = await db.auth.admin.deleteUser(profile.user_id);
      if (error) throw new Error(error.message);
    }
    // Findings reportados mantêm o registro; o vínculo com o pentester vira nulo (ON DELETE SET NULL).
    const { error } = await db.from("profiles").delete().eq("id", data.profileId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
