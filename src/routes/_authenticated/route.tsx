import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, UserMenu } from "@/components/app-sidebar";
import { useAppAuth } from "@/hooks/use-app-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobalSearch } from "@/components/global-search";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Empresas",
  "/projects": "Projetos",
  "/findings": "Findings",
  "/pentesters": "Pentesters",
};

function AuthenticatedLayout() {
  const { data: auth, isLoading } = useAppAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const title =
    Object.entries(titles).find(([path]) => pathname.startsWith(path))?.[1] ?? "VulnDesk";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar auth={auth} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch role={auth.role} />
              <UserMenu auth={auth} />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
