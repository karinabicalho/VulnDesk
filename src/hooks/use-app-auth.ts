import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppAuth = {
  userId: string;
  email: string;
  fullName: string;
  role: "pentester" | "client";
  companyId: string | null;
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
      .select("id, email, full_name, company_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const role = roles?.some((r) => r.role === "pentester") ? "pentester" : "client";

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name || (user.email ?? "").split("@")[0] || "Usuário",
    role,
    companyId: profile?.company_id ?? null,
    profileId: profile?.id ?? null,
  };
}

export function useAppAuth() {
  return useQuery({
    queryKey: ["app-auth"],
    queryFn: fetchAppAuth,
    staleTime: 60_000,
  });
}
