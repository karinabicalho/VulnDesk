import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppAuth = {
  userId: string;
  email: string;
  fullName: string;
  /** Perfil funcional (RF02): pentester tem visão global; cliente só a própria empresa. */
  role: "pentester" | "client";
  /** Administrador: pentester com permissão extra de gerenciar contas. */
  isAdmin: boolean;
  companyId: string | null;
  companyName: string | null;
  profileId: string | null;
};

export async function fetchAppAuth(): Promise<AppAuth | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  await supabase.rpc("bootstrap_current_user");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, company_id, companies(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roleList = (roles ?? []).map((r) => r.role as string);
  const isAdmin = roleList.includes("admin");
  const role = isAdmin || roleList.includes("pentester") ? "pentester" : "client";

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name || (user.email ?? "").split("@")[0] || "Usuário",
    role,
    isAdmin,
    companyId: profile?.company_id ?? null,
    companyName: (profile as { companies?: { name: string } | null } | null)?.companies?.name ?? null,
    profileId: profile?.id ?? null,
  };
}

export function useAppAuth() {
  return useQuery({
    queryKey: ["app-auth"],
    queryFn: fetchAppAuth,
    staleTime: 5 * 60_000,
  });
}
