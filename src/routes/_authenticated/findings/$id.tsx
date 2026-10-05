import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { EditDialog, DeleteButton, toOptions } from "@/components/crud-actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppAuth } from "@/hooks/use-app-auth";
import { useFindings, usePentesters, useProjects } from "@/lib/data";
import { EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [caption, setCaption] = useState("");
  const [content, setContent] = useState("");

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

  const { data: evidences } = useQuery({
    queryKey: ["evidences", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finding_evidences")
        .select("*")
        .eq("finding_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
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
    const { error } = await supabase.from("findings").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Finding excluído");
    await queryClient.invalidateQueries();
    void navigate({ to: "/findings" });
  }

  async function saveEvidence(evId: string, v: Record<string, string>) {
    if (!(v["content"] ?? "").trim()) return "Informe o conteúdo";
    const { error } = await supabase
      .from("finding_evidences")
      .update({ caption: (v["caption"] ?? "").slice(0, 200), content: (v["content"] ?? "").slice(0, 4000) })
      .eq("id", evId);
    if (error) return error.message;
    toast.success("Evidência atualizada");
    void queryClient.invalidateQueries({ queryKey: ["evidences", id] });
    return null;
  }

  async function removeEvidence(evId: string) {
    const { error } = await supabase.from("finding_evidences").delete().eq("id", evId);
    if (error) return void toast.error(error.message);
    toast.success("Evidência excluída");
    void queryClient.invalidateQueries({ queryKey: ["evidences", id] });
  }

  async function addEvidence() {
    if (!content.trim()) {
      toast.error("Informe o conteúdo da evidência");
      return;
    }
    const { error } = await supabase.from("finding_evidences").insert({
      finding_id: id,
      caption: caption.slice(0, 200),
      content: content.slice(0, 4000),
      type: "text",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCaption("");
    setContent("");
    toast.success("Evidência adicionada");
    void queryClient.invalidateQueries({ queryKey: ["evidences", id] });
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Paperclip className="size-4" /> Evidências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(evidences ?? []).length ? (
            (evidences ?? []).map((e) => (
              <div key={e.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-1">
                  <p className="flex-1 text-xs font-medium">{e.caption || "Evidência"}</p>
                  {isPentester ? (
                    <>
                      <EditDialog
                        size="icon"
                        title="Editar evidência"
                        initial={e}
                        onSave={(v) => saveEvidence(e.id, v)}
                        fields={[
                          { key: "caption", label: "Legenda", type: "text" },
                          { key: "content", label: "Conteúdo", type: "textarea", required: true },
                        ]}
                      />
                      <DeleteButton
                        size="icon"
                        description="Excluir esta evidência?"
                        onConfirm={() => removeEvidence(e.id)}
                      />
                    </>
                  ) : null}
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {e.content}
                </pre>
              </div>
            ))
          ) : (
            <EmptyState title="Nenhuma evidência anexada" />
          )}

          {isPentester ? (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="cap">Legenda</Label>
                <Input id="cap" value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cont">Conteúdo (log, payload, request)</Label>
                <Textarea
                  id="cont"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Button size="sm" onClick={() => void addEvidence()}>
                Adicionar evidência
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
