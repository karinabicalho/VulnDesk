import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Download, Upload, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditDialog, DeleteButton } from "@/components/crud-actions";
import { EmptyState } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EVIDENCE_BUCKET, MAX_EVIDENCE_BYTES, evidencePath, signedEvidenceUrl } from "@/lib/storage";
import { formatDate } from "@/lib/vuln";

type Evidence = {
  id: string;
  type: "text" | "image" | "file";
  caption: string;
  content: string;
  storage_path: string | null;
  created_at: string;
};

function SignedImage({ path, alt }: { path: string; alt: string }) {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ["evidence-url", path],
    queryFn: () => signedEvidenceUrl(path),
    staleTime: 50 * 60_000,
  });
  if (isLoading) return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  if (isError || !url) return <p className="text-xs text-destructive">Não foi possível carregar a imagem.</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener">
      <img src={url} alt={alt} className="mt-2 max-h-96 rounded-md border border-border object-contain" />
    </a>
  );
}

function FileLink({ path, name }: { path: string; name: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const url = await signedEvidenceUrl(path, name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link do arquivo");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => void open()} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {name}
    </Button>
  );
}

const typeIcon = { text: Type, image: ImageIcon, file: FileText } as const;

export function EvidenceSection({ findingId, canEdit }: { findingId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"text" | "image" | "file">("text");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: evidences, isLoading } = useQuery({
    queryKey: ["evidences", findingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finding_evidences")
        .select("*")
        .eq("finding_id", findingId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Evidence[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["evidences", findingId] });

  function reset() {
    setCaption("");
    setContent("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function add() {
    setSaving(true);
    try {
      if (tab === "text") {
        if (!content.trim()) return void toast.error("Informe o conteúdo da evidência");
        const { error } = await supabase.from("finding_evidences").insert({
          finding_id: findingId,
          type: "text",
          caption: caption.trim().slice(0, 200),
          content: content.slice(0, 8000),
        });
        if (error) return void toast.error(error.message);
      } else {
        if (!file) return void toast.error("Selecione um arquivo");
        if (file.size > MAX_EVIDENCE_BYTES) return void toast.error("Arquivo acima de 10 MB");
        if (tab === "image" && !file.type.startsWith("image/"))
          return void toast.error("Selecione um arquivo de imagem (PNG, JPG, GIF, WebP)");
        const path = evidencePath(findingId, file.name);
        const { error: upErr } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) return void toast.error(`Falha no upload: ${upErr.message}`);
        const { error } = await supabase.from("finding_evidences").insert({
          finding_id: findingId,
          type: tab,
          caption: (caption.trim() || file.name).slice(0, 200),
          content: file.name.slice(0, 255),
          storage_path: path,
        });
        if (error) {
          await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
          return void toast.error(error.message);
        }
      }
      toast.success("Evidência adicionada");
      reset();
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function save(ev: Evidence, v: Record<string, string>) {
    if (ev.type === "text" && !(v["content"] ?? "").trim()) return "Informe o conteúdo";
    const { error } = await supabase
      .from("finding_evidences")
      .update({
        caption: (v["caption"] ?? "").slice(0, 200),
        ...(ev.type === "text" ? { content: (v["content"] ?? "").slice(0, 8000) } : {}),
      })
      .eq("id", ev.id);
    if (error) return error.message;
    toast.success("Evidência atualizada");
    void refresh();
    return null;
  }

  async function remove(ev: Evidence) {
    if (ev.storage_path) {
      const { error: stErr } = await supabase.storage.from(EVIDENCE_BUCKET).remove([ev.storage_path]);
      if (stErr) return void toast.error(stErr.message);
    }
    const { error } = await supabase.from("finding_evidences").delete().eq("id", ev.id);
    if (error) return void toast.error(error.message);
    toast.success("Evidência excluída");
    void refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="size-4" /> Evidências
          <span className="text-xs font-normal text-muted-foreground">({evidences?.length ?? 0})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted" />
        ) : (evidences ?? []).length ? (
          (evidences ?? []).map((e) => {
            const Icon = typeIcon[e.type];
            return (
              <div key={e.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <p className="flex-1 text-xs font-medium">{e.caption || "Evidência"}</p>
                  <span className="text-[11px] text-muted-foreground">{formatDate(e.created_at)}</span>
                  {canEdit ? (
                    <>
                      <EditDialog
                        size="icon"
                        title="Editar evidência"
                        initial={e}
                        onSave={(v) => save(e, v)}
                        fields={
                          e.type === "text"
                            ? [
                                { key: "caption", label: "Legenda", type: "text" },
                                { key: "content", label: "Conteúdo", type: "textarea", required: true },
                              ]
                            : [{ key: "caption", label: "Legenda", type: "text" }]
                        }
                      />
                      <DeleteButton size="icon" description="Excluir esta evidência?" onConfirm={() => remove(e)} />
                    </>
                  ) : null}
                </div>
                {e.type === "text" ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                    {e.content}
                  </pre>
                ) : e.storage_path && e.type === "image" ? (
                  <SignedImage path={e.storage_path} alt={e.caption || e.content} />
                ) : e.storage_path ? (
                  <FileLink path={e.storage_path} name={e.content || "arquivo"} />
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState title="Nenhuma evidência anexada" />
        )}

        {canEdit ? (
          <div className="space-y-3 border-t border-border pt-3">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setFile(null); }}>
              <TabsList>
                <TabsTrigger value="text" className="gap-1.5"><Type className="size-3.5" /> Texto</TabsTrigger>
                <TabsTrigger value="image" className="gap-1.5"><ImageIcon className="size-3.5" /> Imagem</TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5"><FileText className="size-3.5" /> Arquivo</TabsTrigger>
              </TabsList>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="ev-caption">Legenda</Label>
                <Input id="ev-caption" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} />
              </div>
              <TabsContent value="text" className="space-y-1.5">
                <Label htmlFor="ev-content">Conteúdo (log, payload, requisição/resposta)</Label>
                <Textarea
                  id="ev-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-28 font-mono text-xs"
                />
              </TabsContent>
              {(["image", "file"] as const).map((t) => (
                <TabsContent key={t} value={t} className="space-y-1.5">
                  <Label htmlFor={`ev-file-${t}`}>
                    {t === "image" ? "Captura de tela (até 10 MB)" : "Arquivo (PDF, TXT, PCAP, ZIP… até 10 MB)"}
                  </Label>
                  <Input
                    id={`ev-file-${t}`}
                    ref={tab === t ? fileInput : undefined}
                    type="file"
                    accept={t === "image" ? "image/*" : undefined}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </TabsContent>
              ))}
            </Tabs>
            <Button size="sm" className="gap-2" onClick={() => void add()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Adicionar evidência
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
