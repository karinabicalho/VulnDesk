import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAppAuth } from "@/hooks/use-app-auth";
import { useCompanies, useFindings, useProjects } from "@/lib/data";
import { EmptyState } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/companies/")({
  head: () => ({
    meta: [
      { title: "Empresas — VulnDesk" },
      { name: "description", content: "Cadastro e gestão das empresas clientes atendidas." },
      { property: "og:title", content: "Empresas — VulnDesk" },
      { property: "og:description", content: "Cadastro e gestão das empresas clientes atendidas." },
    ],
  }),
  component: CompaniesPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  identifier: z.string().trim().max(40).optional(),
  description: z.string().trim().max(600).optional(),
});

function CompaniesPage() {
  const { data: auth } = useAppAuth();
  const { data: companies } = useCompanies();
  const { data: projects } = useProjects();
  const { data: findings } = useFindings();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", identifier: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const rows = useMemo(
    () =>
      (companies ?? []).filter((c) =>
        `${c.name} ${c.identifier}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [companies, q],
  );

  async function create() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const { error: insertError } = await supabase.from("companies").insert({
      name: parsed.data.name,
      identifier: parsed.data.identifier ?? "",
      description: parsed.data.description ?? "",
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success("Empresa criada");
    setOpen(false);
    setForm({ name: "", identifier: "", description: "" });
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["companies"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar empresa"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {auth?.role === "pentester" ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto gap-2">
                <Plus className="size-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">Identificador</Label>
                  <Input
                    id="identifier"
                    placeholder="CNPJ ou código interno"
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button onClick={() => void create()}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Card className="p-0">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Projetos</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const companyProjects = (projects ?? []).filter((p) => p.company_id === c.id);
                const ids = new Set(companyProjects.map((p) => p.id));
                const count = (findings ?? []).filter((f) => ids.has(f.project_id)).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to="/companies/$id"
                        params={{ id: c.id }}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{c.description}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.identifier || "—"}</TableCell>
                    <TableCell>{companyProjects.length}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>
                        {c.status === "active" ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6">
            <EmptyState title="Nenhuma empresa encontrada" />
          </div>
        )}
      </Card>
    </div>
  );
}
