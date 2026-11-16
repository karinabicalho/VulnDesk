import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { EditDialog, DeleteButton, toOptions } from "@/components/crud-actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { EvidenceSection } from "@/components/evidence-section";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeEvidenceFiles } from "@/lib/storage";
import { useAppAuth } from "@/hooks/use-app-auth";
import { useFindings, usePentesters, useProjects } from "@/lib/data";
import { EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINDING_STATUSES,
  RESOLVED_STATUSES,
  SEVERITIES,
  formatDate,
  severityLabel,
  statusLabel,
  type FindingStatus,
  type Severity,
} from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/findings/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do finding — VulnDesk" },
      { name: "description", content: "Descrição técnica, impacto, mitigação e evidências da vulnerabilidade." },
      { property: "og:title", content: "Detalhe do finding — VulnDesk" },
      {
        property: "og:description",
        content: "Descrição técnica, impacto, mitigação e evidências da vulnerabilidade.",
      },
    ],
  }),
  component: FindingDetail,
});

function FindingDetail() {
  const { id } = Route.useParams();
  const { data: auth } = useAppAuth();
  const { data: findings } = useFindings();
  const queryClient = useQueryClient();

  const summary = findings?.find((f) => f.id === id);

  const { data: detail } = useQuery({
    queryKey: ["finding", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useProjects();
  const { data: pentesters } = usePentesters();
  const navigate = useNavigate();

  if (!detail || !summary) return <EmptyState title="Finding não encontrado" />;

  const isPentester = auth?.role === "pentester";

  async function changeStatus(next: FindingStatus) {
    const { error } = await supabase
      .from("findings")
      .update({
        status: next,
        resolved_at: RESOLVED_STATUSES.includes(next) ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status atualizado");
    void queryClient.invalidateQueries({ queryKey: ["findings"] });
    void queryClient.invalidateQueries({ queryKey: ["finding", id] });
  }

  async function saveFinding(v: Record<string, string>) {
    const cvss = Number((v["cvss"] ?? "") || 0);
    if (Number.isNaN(cvss) || cvss < 0 || cvss > 10) return "CVSS deve estar entre 0 e 10";
    const { error } = await supabase
      .from("findings")
      .update({
        title: (v["title"] ?? "").trim().slice(0, 200),
        project_id: (v["project_id"] ?? ""),
        severity: (v["severity"] ?? "") as Severity,
        status: (v["status"] ?? "") as FindingStatus,
        cvss,
        description: (v["description"] ?? "").slice(0, 8000),
        impact: (v["impact"] ?? "").slice(0, 4000),
        mitigation: (v["mitigation"] ?? "").slice(0, 4000),
        ...(v["discovered_at"] ? { discovered_at: v["discovered_at"] } : {}),
        resolved_at: (v["resolved_at"] ?? "") || null,
        pentester_id: (v["pentester_id"] ?? "") || null,
      })
      .eq("id", id);
    if (error) return error.message;
    toast.success("Finding atualizado");
    void queryClient.invalidateQueries();
    return null;
  }

  async function removeFinding() {
    await removeEvidenceFiles({ findingIds: [id] });
    const { error } = await supabase.from("findings").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Finding excluído");
    await queryClient.invalidateQueries();
    void navigate({ to: "/findings" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/findings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{detail.code}</p>
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">
            {summary.projects?.name} · {summary.projects?.companies?.name} · reportado por{" "}
            {summary.profiles?.full_name ?? "—"} · {formatDate(detail.discovered_at)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SeverityBadge severity={detail.severity} />
          <StatusBadge status={detail.status} />
          <span className="rounded-md border border-border px-2 py-1 text-xs tabular-nums">
            CVSS {Number(detail.cvss).toFixed(1)}
          </span>
          {isPentester ? (
            <>
              <EditDialog
                title="Editar finding"
                initial={detail}
                onSave={saveFinding}
                fields={[
                  { key: "title", label: "Título", type: "text", required: true },
                  {
                    key: "project_id",
                    label: "Projeto",
                    type: "select",
                    required: true,
                    options: (projects ?? []).map((p) => ({ value: p.id, label: p.name })),
                  },
                  { key: "severity", label: "Severidade", type: "select", options: toOptions(SEVERITIES, severityLabel) },
                  { key: "status", label: "Status", type: "select", options: toOptions(FINDING_STATUSES, statusLabel) },
                  { key: "cvss", label: "CVSS (0–10)", type: "number" },
                  {
                    key: "pentester_id",
                    label: "Pentester responsável",
                    type: "select",
                    options: (pentesters ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email })),
                  },
                  { key: "discovered_at", label: "Descoberto em", type: "date" },
                  { key: "resolved_at", label: "Remediado em", type: "date" },
                  { key: "description", label: "Descrição técnica", type: "textarea" },
                  { key: "impact", label: "Impacto", type: "textarea" },
                  { key: "mitigation", label: "Mitigação", type: "textarea" },
                ]}
              />
              <DeleteButton
                description="Isso excluirá o finding e todas as suas evidências."
                onConfirm={removeFinding}
              />
            </>
          ) : null}
        </div>
      </div>

      {isPentester ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1.5">
              <Label>Alterar status</Label>
              <Select value={detail.status} onValueChange={(v) => void changeStatus(v as FindingStatus)}>
                <SelectTrigger className="w-56">
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
            <p className="text-xs text-muted-foreground">
              Remediado em: {formatDate(detail.resolved_at)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Descrição técnica</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.description || "Sem descrição."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Impacto</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.impact || "—"}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Recomendação de mitigação</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.mitigation || "—"}
          </CardContent>
        </Card>
      </div>

      <EvidenceSection findingId={id} canEdit={isPentester} />
    </div>
  );
}
