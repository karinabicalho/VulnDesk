import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Bug,
  Users,
  ShieldAlert,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { AppAuth } from "@/hooks/use-app-auth";

const pentesterItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Empresas", url: "/companies", icon: Building2 },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Findings", url: "/findings", icon: Bug },
  { title: "Pentesters", url: "/pentesters", icon: Users },
] as const;

const clientItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Findings", url: "/findings", icon: Bug },
] as const;

export function AppSidebar({ auth }: { auth: AppAuth }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = auth.role === "pentester" ? pentesterItems : clientItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ShieldAlert className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">VulnDesk</p>
            <p className="truncate text-xs text-muted-foreground">Gestão de vulnerabilidades</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={
                      item.url === "/dashboard"
                        ? pathname === item.url
                        : pathname.startsWith(item.url)
                    }
                  >
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function UserMenu({ auth }: { auth: AppAuth }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = auth.fullName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-medium leading-tight">{auth.fullName}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {auth.role === "pentester" ? "Pentester" : "Cliente"}
            </span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm">{auth.fullName}</p>
          <p className="text-xs font-normal text-muted-foreground">{auth.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="mr-2 size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
