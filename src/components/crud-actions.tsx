import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
};

type Values = Record<string, string>;

export function EditDialog({
  title,
  fields,
  initial,
  onSave,
  size = "sm",
}: {
  title: string;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  onSave: (values: Values) => Promise<string | null>;
  size?: "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openChange(o: boolean) {
    if (o) {
      const v: Values = {};
      for (const f of fields) {
        const raw = initial[f.key];
        v[f.key] = raw === null || raw === undefined ? "" : String(raw).slice(0, f.type === "date" ? 10 : undefined);
      }
      setValues(v);
      setError(null);
    }
    setOpen(o);
  }

  async function save() {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`Informe: ${f.label}`);
        return;
      }
    }
    setSaving(true);
    const err = await onSave(values);
    setSaving(false);
    if (err) setError(err);
    else setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        {size === "icon" ? (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="size-4" /> Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`edit-${f.key}`}>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={`edit-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : f.type === "select" ? (
                <Select
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => setValues({ ...values, [f.key]: v })}
                >
                  <SelectTrigger id={`edit-${f.key}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`edit-${f.key}`}
                  type={f.type}
                  step={f.type === "number" ? "0.1" : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteButton({
  description,
  onConfirm,
  size = "sm",
}: {
  description: string;
  onConfirm: () => Promise<void>;
  size?: "sm" | "icon";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {size === "icon" ? (
          <Button variant="ghost" size="icon" aria-label="Excluir" className="text-destructive">
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 text-destructive">
            <Trash2 className="size-4" /> Excluir
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void onConfirm()}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const toOptions = <T extends string>(list: T[], labels: Record<T, string>) =>
  list.map((v) => ({ value: v, label: labels[v] }));
