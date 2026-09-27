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
import { ProjectStatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  formatDate,
  projectStatusLabel,
  projectTypeLabel,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projetos — VulnDesk" },
      { name: "description", content: "Projetos de pentest, escopo, prazos e horas contratadas." },
      { property: "og:title", content: "Projetos — VulnDesk" },
      {
        property: "og:description",
        content: "Projetos de pentest, escopo, prazos e horas contratadas.",
      },
    ],
  }),
  component: ProjectsPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do projeto").max(140),
  company_id: z.string().uuid("Selecione a empresa"),
  description: z.string().trim().max(800).optional(),
  contracted_hours: z.coerce.number().min(0).max(10000),
});

const emptyForm = {
  name: "",
  company_id: "",
  description: "",
  type: "web" as ProjectType,
  status: "planned" as ProjectStatus,
  start_date: "",
  end_date: "",
  contracted_hours: "40",
};

function ProjectsPage() {
  const { data: auth } = useAppAuth();
  const { data: projects } = useProjects();
  const { data: companies } = useCompanies();
  const { data: findings } = useFindings();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const rows = useMemo(
    () =>
      (projects ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) &&
          (statusFilter === "all" || p.status === statusFilter),
      ),
    [projects, q, statusFilter],
  );

  async function create() {
    const parsed = schema.safeParse({
      name: form.name,
      company_id: form.company_id,
      description: form.description,
      contracted_hours: form.contracted_hours,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const { error: insertError } = await supabase.from("projects").insert({
      name: parsed.data.name,
      company_id: parsed.data.company_id,
      description: parsed.data.description ?? "",
      type: form.type,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      contracted_hours: parsed.data.contracted_hours,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success("Projeto criado");
    setOpen(false);
    setForm(emptyForm);
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar projeto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {projectStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {auth?.role === "pentester" ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto gap-2">
                <Plus className="size-4" /> Novo projeto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Nome</Label>
                  <Input
                    id="pname"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Select
                    value={form.company_id}
                    onValueChange={(v) => setForm({ ...form, company_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as ProjectType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {projectTypeLabel[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {projectStatusLabel[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="start">Início</Label>
                    <Input
                      id="start"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end">Término</Label>
                    <Input
                      id="end"
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hours">Horas contratadas</Label>
                  <Input
                    id="hours"
                    type="number"
                    value={form.contracted_hours}
                    onChange={(e) => setForm({ ...form, contracted_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdesc">Escopo</Label>
                  <Textarea
                    id="pdesc"
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
                <TableHead>Projeto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const count = (findings ?? []).filter((f) => f.project_id === p.id).length;
                const pct = p.contracted_hours
                  ? Math.min(100, Math.round((p.used_hours / p.contracted_hours) * 100))
                  : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        to="/projects/$id"
                        params={{ id: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(p as { companies?: { name: string } }).companies?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{projectTypeLabel[p.type]}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(p.start_date)} — {formatDate(p.end_date)}
                    </TableCell>
                    <TableCell className="w-32">
                      <Progress value={pct} className="h-1.5" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.used_hours}/{p.contracted_hours}h
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{count}</TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6">
            <EmptyState title="Nenhum projeto encontrado" />
          </div>
        )}
      </Card>
    </div>
  );
}
