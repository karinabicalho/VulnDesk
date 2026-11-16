import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { deleteUser, listUsers } from "@/lib/admin.functions";
import { useAppAuth } from "@/hooks/use-app-auth";
import { UserFormDialog, primaryRole, roleOptions } from "@/components/user-form-dialog";
import { DeleteButton } from "@/components/crud-actions";
import { EmptyState } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Usuários — VulnDesk" },
      { name: "description", content: "Gestão de contas e perfis de acesso do VulnDesk." },
    ],
  }),
  component: UsersPage,
});

const roleBadge: Record<string, string> = {
  admin: "border-primary/40 bg-primary/10 text-primary",
  pentester: "border-[color:var(--info)]/40 bg-[color:var(--info)]/10 text-[color:var(--info)]",
  client: "border-border bg-muted text-muted-foreground",
};

function UsersPage() {
  const { data: auth } = useAppAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: !!auth?.isAdmin,
  });

  const filtered = useMemo(
    () =>
      (users ?? []).filter((u) => {
        const term = q.trim().toLowerCase();
        const matches = !term || u.fullName.toLowerCase().includes(term) || u.email.includes(term);
        return matches && (roleFilter === "all" || primaryRole(u.roles) === roleFilter);
      }),
    [users, q, roleFilter],
  );

  if (auth && !auth.isAdmin) {
    return <EmptyState title="Acesso restrito" description="Somente administradores gerenciam contas." />;
  }

  async function remove(profileId: string) {
    try {
      await deleteUser({ data: { profileId } });
      toast.success("Conta excluída");
      void queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {roleOptions.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <UserFormDialog />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <EmptyState title="Não foi possível carregar as contas" description={(error as Error).message} />
      ) : !filtered.length ? (
        <EmptyState title="Nenhuma conta encontrada" />
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const role = primaryRole(u.roles);
                const isSelf = u.userId === auth?.userId;
                return (
                  <TableRow key={u.profileId}>
                    <TableCell className="font-medium">
                      {u.fullName}
                      {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(você)</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${roleBadge[role]}`}>
                        {role === "admin" ? <ShieldCheck className="size-3" /> : null}
                        {roleOptions.find((r) => r.value === role)?.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.companyName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.lastSignInAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <UserFormDialog user={u} />
                        {!isSelf ? (
                          <DeleteButton
                            size="icon"
                            description={`Excluir a conta de ${u.fullName}? Os findings reportados por ela serão mantidos sem responsável.`}
                            onConfirm={() => remove(u.profileId)}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
