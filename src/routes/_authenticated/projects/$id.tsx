import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppAuth } from "@/hooks/use-app-auth";
import { EditDialog, DeleteButton, toOptions } from "@/components/crud-actions";
import { ArrowLeft } from "lucide-react";
import { useCompanies, useFindings, useProjects, useProjectPentesters } from "@/lib/data";
import { MetricCard, EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge, ProjectStatusBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  OPEN_STATUSES,
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
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Projeto excluído");
    await queryClient.invalidateQueries();
    void navigate({ to: "/projects" });
  }

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
          value={projectFindings.filter((f) => OPEN_STATUSES.includes(f.status)).length}
          accent="var(--high)"
        />
        <MetricCard
          label="Críticos/Altos"
          value={projectFindings.filter((f) => ["critical", "high"].includes(f.severity)).length}
          accent="var(--critical)"
        />
        <MetricCard label="Equipe" value={members.length} />
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
          {members.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {members.map((m) => (
                <span
                  key={m.profile_id}
                  className="rounded-full border border-border px-2.5 py-1 text-xs"
                >
                  {(m as { profiles?: { full_name: string } }).profiles?.full_name}
                </span>
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
