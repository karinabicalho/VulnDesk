import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, FolderKanban, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function GlobalSearch({ role }: { role: "pentester" | "client" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data } = useQuery({
    queryKey: ["global-search"],
    enabled: open,
    queryFn: async () => {
      const [companies, projects, findings] = await Promise.all([
        supabase.from("companies").select("id, name").limit(20),
        supabase.from("projects").select("id, name").limit(30),
        supabase.from("findings").select("id, code, title").limit(50),
      ]);
      return {
        companies: companies.data ?? [],
        projects: projects.data ?? [],
        findings: findings.data ?? [],
      };
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Buscar…</span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar empresas, projetos e findings…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {role === "pentester" && (data?.companies.length ?? 0) > 0 ? (
            <CommandGroup heading="Empresas">
              {data?.companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`empresa ${c.name}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/companies/$id", params: { id: c.id } });
                  }}
                >
                  <Building2 className="mr-2 size-4" />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {(data?.projects.length ?? 0) > 0 ? (
            <CommandGroup heading="Projetos">
              {data?.projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`projeto ${p.name}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/projects/$id", params: { id: p.id } });
                  }}
                >
                  <FolderKanban className="mr-2 size-4" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {(data?.findings.length ?? 0) > 0 ? (
            <CommandGroup heading="Findings">
              {data?.findings.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.code} ${f.title}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/findings/$id", params: { id: f.id } });
                  }}
                >
                  <Bug className="mr-2 size-4" />
                  <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                  <span className="ml-2 truncate">{f.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
