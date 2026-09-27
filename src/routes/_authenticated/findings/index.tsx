import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAppAuth } from "@/hooks/use-app-auth";
import { useFindings, useProjects } from "@/lib/data";
import { EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
  FINDING_STATUSES,
  SEVERITIES,
  formatDate,
  severityLabel,
  severityOrder,
  statusLabel,
  type FindingStatus,
  type Severity,
} from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/findings/")({
  head: () => ({
    meta: [
      { title: "Findings — VulnDesk" },
      { name: "description", content: "Lista de vulnerabilidades com filtros por severidade, status e projeto." },
      { property: "og:title", content: "Findings — VulnDesk" },
      {
        property: "og:description",
        content: "Lista de vulnerabilidades com filtros por severidade, status e projeto.",
      },
    ],
  }),
  component: FindingsPage,
});

const schema = z.object({
  title: z.string().trim().min(3, "Informe o título").max(200),
  project_id: z.string().uuid("Selecione o projeto"),
  cvss: z.coerce.number().min(0).max(10),
  description: z.string().trim().max(4000).optional(),
  impact: z.string().trim().max(2000).optional(),
  mitigation: z.string().trim().max(2000).optional(),
});

const emptyForm = {
  title: "",
  project_id: "",
  severity: "medium" as Severity,
  status: "open" as FindingStatus,
  cvss: "5.0",
  description: "",
  impact: "",
  mitigation: "",
};

function FindingsPage() {
  const { data: auth } = useAppAuth();
  const { data: findings } = useFindings();
  const { data: projects } = useProjects();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      (findings ?? [])
        .filter(
          (f) =>
            `${f.code} ${f.title}`.toLowerCase().includes(q.toLowerCase()) &&
            (sev === "all" || f.severity === sev) &&
            (status === "all" || f.status === status) &&
            (project === "all" || f.project_id === project),
        )
        .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]),
    [findings, q, sev, status, project],
  );

  async function create() {
    const parsed = schema.safeParse({
      title: form.title,
      project_id: form.project_id,
      cvss: form.cvss,
      description: form.description,
      impact: form.impact,
      mitigation: form.mitigation,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const { error: insertError } = await supabase.from("findings").insert({
      title: parsed.data.title,
      project_id: parsed.data.project_id,
      cvss: parsed.data.cvss,
      severity: form.severity,
      status: form.status,
      description: parsed.data.description ?? "",
      impact: parsed.data.impact ?? "",
      mitigation: parsed.data.mitigation ?? "",
      pentester_id: auth?.profileId ?? null,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success("Finding registrado");
    setOpen(false);
    setForm(emptyForm);
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["findings"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por código ou título"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {severityLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {FINDING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {auth?.role === "pentester" ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Novo finding
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo finding</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ftitle">Título</Label>
                  <Input
                    id="ftitle"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Projeto</Label>
                  <Select
                    value={form.project_id}
                    onValueChange={(v) => setForm({ ...form, project_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(projects ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Severidade</Label>
                    <Select
                      value={form.severity}
                      onValueChange={(v) => setForm({ ...form, severity: v as Severity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {severityLabel[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as FindingStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINDING_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cvss">CVSS</Label>
                    <Input
                      id="cvss"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={form.cvss}
                      onChange={(e) => setForm({ ...form, cvss: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fdesc">Descrição técnica</Label>
                  <Textarea
                    id="fdesc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fimp">Impacto</Label>
                  <Textarea
                    id="fimp"
                    value={form.impact}
                    onChange={(e) => setForm({ ...form, impact: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fmit">Recomendação de mitigação</Label>
                  <Textarea
                    id="fmit"
                    value={form.mitigation}
                    onChange={(e) => setForm({ ...form, mitigation: e.target.value })}
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
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>CVSS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Identificado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.code}</TableCell>
                  <TableCell>
                    <Link to="/findings/$id" params={{ id: f.id }} className="font-medium hover:underline">
                      {f.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.projects?.name ?? "—"}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={f.severity} />
                  </TableCell>
                  <TableCell className="tabular-nums">{Number(f.cvss).toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(f.discovered_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6">
            <EmptyState title="Nenhum finding encontrado" description="Ajuste os filtros de busca." />
          </div>
        )}
      </Card>
    </div>
  );
}
