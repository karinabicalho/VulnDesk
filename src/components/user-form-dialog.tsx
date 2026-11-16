import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createUser, updateUser, type ManagedUser } from "@/lib/admin.functions";
import { useCompanies } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "pentester" | "client" | "admin";

export const roleOptions: { value: Role; label: string }[] = [
  { value: "pentester", label: "Pentester" },
  { value: "client", label: "Cliente" },
  { value: "admin", label: "Administrador" },
];

export function primaryRole(roles: string[]): Role {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("pentester")) return "pentester";
  return "client";
}

function errorMessage(e: unknown) {
  if (e instanceof Error) {
    try {
      const parsed = JSON.parse(e.message) as { message?: string }[];
      if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
    } catch {
      /* mensagem simples */
    }
    return e.message;
  }
  return "Falha na operação";
}

export function UserFormDialog({
  user,
  fixedRole,
  triggerLabel,
}: {
  user?: ManagedUser;
  fixedRole?: Role;
  triggerLabel?: string;
}) {
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const editing = !!user;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: (fixedRole ?? "pentester") as Role,
    companyId: "",
  });

  function onOpenChange(o: boolean) {
    if (o) {
      setForm({
        fullName: user?.fullName ?? "",
        email: user?.email ?? "",
        password: "",
        role: user ? primaryRole(user.roles) : (fixedRole ?? "pentester"),
        companyId: user?.companyId ?? "",
      });
      setError(null);
    }
    setOpen(o);
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const companyId = form.role === "client" ? form.companyId || null : null;
      if (editing && user) {
        await updateUser({
          data: {
            profileId: user.profileId,
            fullName: form.fullName,
            role: form.role,
            companyId,
            password: form.password || undefined,
          },
        });
        toast.success("Conta atualizada");
      } else {
        await createUser({
          data: { fullName: form.fullName, email: form.email, password: form.password, role: form.role, companyId },
        });
        toast.success("Conta criada — o usuário já pode entrar");
      }
      setOpen(false);
      void queryClient.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon" aria-label="Editar conta">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" className="gap-2">
            <UserPlus className="size-4" /> {triggerLabel ?? "Nova conta"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar conta" : (triggerLabel ?? "Nova conta")}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Altere nome, perfil de acesso ou defina uma nova senha."
              : "A conta é criada já confirmada; informe a senha inicial ao usuário."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Nome completo</Label>
            <Input id="u-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">E-mail</Label>
            <Input
              id="u-email"
              type="email"
              value={form.email}
              disabled={editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-pass">{editing ? "Nova senha (opcional)" : "Senha inicial"}</Label>
            <Input
              id="u-pass"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="mínimo 8 caracteres"
            />
          </div>
          {!fixedRole ? (
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {form.role === "client" ? (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
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
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {editing ? "Salvar alterações" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
