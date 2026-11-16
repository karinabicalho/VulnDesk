import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeEvidenceFiles } from "@/lib/storage";
import { useAppAuth } from "@/hooks/use-app-auth";
import { EditDialog, DeleteButton, toOptions } from "@/components/crud-actions";
import { ArrowLeft } from "lucide-react";
import { useCompanies, useFindings, useProjects, useProjectPentesters } from "@/lib/data";
import { MetricCard, EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge, ProjectStatusBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TeamDialog } from "@/components/team-dialog";
import {
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  SEVERITIES,
  severityColorVar,
  severityLabel,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  formatDate,
  projectStatusLabel,
  projectTypeLabel,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do projeto — VulnDesk" },
      { name: "description", content: "Escopo, equipe, horas e findings do projeto de pentest." },
      { property: "og:title", content: "Detalhe do projeto — VulnDesk" },
      {
        property: "og:description",
        content: "Escopo, equipe, horas e findings do projeto de pentest.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { data: projects } = useProjects();
  const { data: findings } = useFindings();
  const { data: team } = useProjectPentesters();

  const project = projects?.find((p) => p.id === id);
  const projectFindings = (findings ?? []).filter((f) => f.project_id === id);
  const members = (team ?? []).filter((t) => t.project_id === id);

  const { data: companies } = useCompanies();
  const { data: auth } = useAppAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!project) return <EmptyState title="Projeto não encontrado" />;
  const isPentester = auth?.role === "pentester";

  async function save(v: Record<string, string>) {
    const contracted = Number((v["contracted_hours"] ?? "") || 0);
    const used = Number((v["used_hours"] ?? "") || 0);
    if (Number.isNaN(contracted) || Number.isNaN(used) || contracted < 0 || used < 0)
      return "Horas inválidas";
    const { error } = await supabase
      .from("projects")
      .update({
        name: (v["name"] ?? "").trim().slice(0, 140),
        company_id: (v["company_id"] ?? ""),
        description: (v["description"] ?? "").trim().slice(0, 800),
        type: (v["type"] ?? "") as ProjectType,
        status: (v["status"] ?? "") as ProjectStatus,
        start_date: (v["start_date"] ?? "") || null,
        end_date: (v["end_date"] ?? "") || null,
        contracted_hours: contracted,
        used_hours: used,
      })
      .eq("id", id);
    if (error) return error.message;
    toast.success("Projeto atualizado");
    void queryClient.invalidateQueries();
    return null;
  }

  async function remove() {
    await removeEvidenceFiles({ projectIds: [id] });
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Projeto excluído");
    await queryClient.invalidateQueries();
    void navigate({ to: "/projects" });
  }

  const openCount = projectFindings.filter((f) => OPEN_STATUSES.includes(f.status)).length;
  const resolvedCount = projectFindings.filter((f) => RESOLVED_STATUSES.includes(f.status)).length;
  const remediationPct = projectFindings.length ? Math.round((resolvedCount / projectFindings.length) * 100) : 0;
  const cvssValues = projectFindings.map((f) => Number(f.cvss));
  const cvssAvg = cvssValues.length ? cvssValues.reduce((a, b) => a + b, 0) / cvssValues.length : 0;
  const cvssMax = cvssValues.length ? Math.max(...cvssValues) : 0;

  const pct = project.contracted_hours
    ? Math.min(100, Math.round((project.used_hours / project.contracted_hours) * 100))
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/projects">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">
            {(project as { companies?: { name: string } }).companies?.name} ·{" "}
            {projectTypeLabel[project.type]} · {formatDate(project.start_date)} —{" "}
            {formatDate(project.end_date)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          {isPentester ? (
            <>
              <TeamDialog projectId={id} current={members.map((m) => m.profile_id)} />
              <EditDialog
                title="Editar projeto"
                initial={project}
                onSave={save}
                fields={[
                  { key: "name", label: "Nome", type: "text", required: true },
                  {
                    key: "company_id",
                    label: "Empresa",
                    type: "select",
                    required: true,
                    options: (companies ?? []).map((c) => ({ value: c.id, label: c.name })),
                  },
                  { key: "description", label: "Descrição / escopo", type: "textarea" },
                  { key: "type", label: "Tipo", type: "select", options: toOptions(PROJECT_TYPES, projectTypeLabel) },
                  { key: "status", label: "Status", type: "select", options: toOptions(PROJECT_STATUSES, projectStatusLabel) },
                  { key: "start_date", label: "Início", type: "date" },
                  { key: "end_date", label: "Fim", type: "date" },
                  { key: "contracted_hours", label: "Horas contratadas", type: "number" },
                  { key: "used_hours", label: "Horas utilizadas", type: "number" },
                ]}
              />
              <DeleteButton
                description="Isso excluirá o projeto e todos os seus findings e evidências."
                onConfirm={remove}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Findings" value={projectFindings.length} />
        <MetricCard
          label="Abertos"
          value={openCount}
          accent="var(--high)"
          hint={projectFindings.length ? `${Math.round((openCount / projectFindings.length) * 100)}% do total` : undefined}
        />
        <MetricCard
          label="Críticos/Altos"
          value={projectFindings.filter((f) => ["critical", "high"].includes(f.severity)).length}
          accent="var(--critical)"
        />
        <MetricCard
          label="CVSS médio / maior"
          value={projectFindings.length ? `${cvssAvg.toFixed(1)} / ${cvssMax.toFixed(1)}` : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Progresso da remediação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{resolvedCount} de {projectFindings.length} findings remediados</span>
              <span className="tabular-nums">{remediationPct}%</span>
            </div>
            <Progress value={remediationPct} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição por severidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {SEVERITIES.map((sev) => {
              const n = projectFindings.filter((f) => f.severity === sev).length;
              const w = projectFindings.length ? (n / projectFindings.length) * 100 : 0;
              return (
                <div key={sev} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted-foreground">{severityLabel[sev]}</span>
                  <div className="h-2 flex-1 rounded bg-muted">
                    <div className="h-2 rounded" style={{ width: `${w}%`, background: severityColorVar[sev] }} />
                  </div>
                  <span className="w-6 text-right tabular-nums">{n}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Escopo e horas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{project.description || "Sem descrição."}</p>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Horas utilizadas</span>
              <span className="tabular-nums">
                {project.used_hours}/{project.contracted_hours}h
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          <p className="pt-1 text-xs font-medium text-muted-foreground">Equipe de pentesters</p>
          {!members.length ? <p className="text-xs text-muted-foreground">Nenhum pentester alocado.</p> : null}
          {members.length ? (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Link
                  key={m.profile_id}
                  to="/pentesters/$id"
                  params={{ id: m.profile_id }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
                >
                  {(m as { profiles?: { full_name: string } }).profiles?.full_name}
                </Link>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Findings do projeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projectFindings.length ? (
            projectFindings.map((f) => (
              <Link
                key={f.id}
                to="/findings/$id"
                params={{ id: f.id }}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent"
              >
                <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                <SeverityBadge severity={f.severity} />
                <StatusBadge status={f.status} />
              </Link>
            ))
          ) : (
            <EmptyState title="Nenhum finding neste projeto" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
