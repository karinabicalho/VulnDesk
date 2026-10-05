import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppAuth } from "@/hooks/use-app-auth";
import { EditDialog, DeleteButton } from "@/components/crud-actions";
import { ArrowLeft } from "lucide-react";
import { useCompanies, useFindings, useProjects } from "@/lib/data";
import { MetricCard, EmptyState } from "@/components/metric-card";
import { SeverityBadge, ProjectStatusBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OPEN_STATUSES, SEVERITIES, formatDate, projectTypeLabel, severityLabel } from "@/lib/vuln";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da empresa — VulnDesk" },
      { name: "description", content: "Projetos, findings e postura de risco da empresa cliente." },
      { property: "og:title", content: "Detalhe da empresa — VulnDesk" },
      {
        property: "og:description",
        content: "Projetos, findings e postura de risco da empresa cliente.",
      },
    ],
  }),
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const { data: companies } = useCompanies();
  const { data: projects } = useProjects();
  const { data: findings } = useFindings();

  const company = companies?.find((c) => c.id === id);
  const companyProjects = (projects ?? []).filter((p) => p.company_id === id);
  const projectIds = new Set(companyProjects.map((p) => p.id));
  const companyFindings = (findings ?? []).filter((f) => projectIds.has(f.project_id));

  const { data: auth } = useAppAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!company) return <EmptyState title="Empresa não encontrada" />;
  const isPentester = auth?.role === "pentester";

  async function save(v: Record<string, string>) {
    const { error } = await supabase
      .from("companies")
      .update({
        name: (v["name"] ?? "").trim().slice(0, 120),
        identifier: (v["identifier"] ?? "").trim().slice(0, 40),
        description: (v["description"] ?? "").trim().slice(0, 600),
        status: (v["status"] ?? "") as "active" | "inactive",
      })
      .eq("id", id);
    if (error) return error.message;
    toast.success("Empresa atualizada");
    void queryClient.invalidateQueries();
    return null;
  }

  async function remove() {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Empresa excluída");
    await queryClient.invalidateQueries();
    void navigate({ to: "/companies" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/companies">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{company.name}</h2>
          <p className="text-sm text-muted-foreground">
            {company.identifier || "sem identificador"} · {company.description}
          </p>
        </div>
        {isPentester ? (
          <div className="ml-auto flex gap-2">
            <EditDialog
              title="Editar empresa"
              initial={company}
              onSave={save}
              fields={[
                { key: "name", label: "Nome", type: "text", required: true },
                { key: "identifier", label: "Identificador", type: "text" },
                { key: "description", label: "Descrição", type: "textarea" },
                {
                  key: "status",
                  label: "Status",
                  type: "select",
                  options: [
                    { value: "active", label: "Ativa" },
                    { value: "inactive", label: "Inativa" },
                  ],
                },
              ]}
            />
            <DeleteButton
              description="Isso excluirá a empresa e todos os seus projetos, findings e evidências."
              onConfirm={remove}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Projetos" value={companyProjects.length} />
        <MetricCard label="Findings" value={companyFindings.length} />
        <MetricCard
          label="Abertos"
          value={companyFindings.filter((f) => OPEN_STATUSES.includes(f.status)).length}
          accent="var(--high)"
        />
        <MetricCard
          label="Críticos"
          value={companyFindings.filter((f) => f.severity === "critical").length}
          accent="var(--critical)"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Distribuição por severidade</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {SEVERITIES.map((s) => (
            <div key={s} className="min-w-24">
              <p className="text-xs text-muted-foreground">{severityLabel[s]}</p>
              <p className="text-xl font-semibold tabular-nums">
                {companyFindings.filter((f) => f.severity === s).length}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-sm">Projetos</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {companyProjects.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyProjects.map((p) => (
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
                      {projectTypeLabel[p.type]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.start_date)} — {formatDate(p.end_date)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.used_hours}/{p.contracted_hours}h
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6">
              <EmptyState title="Nenhum projeto cadastrado" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="pt-4">
          <CardTitle className="text-sm">Findings da empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {companyFindings.slice(0, 10).map((f) => (
            <Link
              key={f.id}
              to="/findings/$id"
              params={{ id: f.id }}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent"
            >
              <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
              <SeverityBadge severity={f.severity} />
            </Link>
          ))}
          {companyFindings.length === 0 ? <EmptyState title="Nenhum finding" /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
