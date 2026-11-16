import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePentesters } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Associa pentesters a um projeto (tabela project_pentesters). */
export function TeamDialog({ projectId, current }: { projectId: string; current: string[] }) {
  const queryClient = useQueryClient();
  const { data: pentesters } = usePentesters();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function onOpenChange(o: boolean) {
    if (o) setSelected(new Set(current));
    setOpen(o);
  }

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function save() {
    setSaving(true);
    const toAdd = [...selected].filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !selected.has(id));
    const results = await Promise.all([
      toAdd.length
        ? supabase.from("project_pentesters").insert(toAdd.map((profile_id) => ({ project_id: projectId, profile_id })))
        : Promise.resolve({ error: null }),
      toRemove.length
        ? supabase.from("project_pentesters").delete().eq("project_id", projectId).in("profile_id", toRemove)
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return void toast.error(err.message);
    toast.success("Equipe do projeto atualizada");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["project-pentesters"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="size-4" /> Equipe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Equipe do projeto</DialogTitle>
          <DialogDescription>Selecione os pentesters alocados neste projeto.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {(pentesters ?? []).map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
            >
              <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
              <span className="flex-1 text-sm">{p.full_name}</span>
              <span className="text-xs text-muted-foreground">{p.email}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar equipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
