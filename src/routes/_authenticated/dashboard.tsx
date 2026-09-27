import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bug, ShieldAlert, FolderKanban, CheckCircle2, Building2 } from "lucide-react";
import { useAppAuth } from "@/hooks/use-app-auth";
import { useCompanies, useFindings, useProjects } from "@/lib/data";
import { MetricCard, EmptyState } from "@/components/metric-card";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SEVERITIES,
  FINDING_STATUSES,
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  severityColorVar,
  severityLabel,
  statusLabel,
  formatDate,
} from "@/lib/vuln";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — VulnDesk" },
      {
        name: "description",
        content: "Visão consolidada de vulnerabilidades, severidades e status de remediação.",
      },
      { property: "og:title", content: "Dashboard — VulnDesk" },
      {
        property: "og:description",
        content: "Métricas de risco, findings por severidade e evolução da remediação.",
      },
    ],
  }),
  component: DashboardPage,
});

const chartAxis = { stroke: "var(--muted-foreground)", fontSize: 11 };

function DashboardPage() {
  const { data: auth } = useAppAuth();
  const { data: findings, isLoading } = useFindings();
  const { data: projects } = useProjects();
  const { data: companies } = useCompanies();

  if (isLoading || !findings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const isPentester = auth?.role === "pentester";
  const open = findings.filter((f) => OPEN_STATUSES.includes(f.status));
  const resolved = findings.filter((f) => RESOLVED_STATUSES.includes(f.status));
  const criticalOpen = open.filter((f) => f.severity === "critical" || f.severity === "high");

  const bySeverity = SEVERITIES.map((s) => ({
    name: severityLabel[s],
    value: findings.filter((f) => f.severity === s).length,
    color: severityColorVar[s],
  }));

  const byStatus = FINDING_STATUSES.map((s) => ({
    name: statusLabel[s],
    value: findings.filter((f) => f.status === s).length,
  }));

  const byProject = Object.values(
    findings.reduce<Record<string, { name: string; total: number; abertos: number }>>((acc, f) => {
      const key = f.project_id;
      const name = f.projects?.name ?? "—";
      acc[key] ??= { name, total: 0, abertos: 0 };
      acc[key].total += 1;
      if (OPEN_STATUSES.includes(f.status)) acc[key].abertos += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });
  const evolution = months.map((d) => {
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    return {
      name: d.toLocaleDateString("pt-BR", { month: "short" }),
      Identificados: findings.filter((f) => new Date(f.discovered_at) <= end).length,
      Remediados: findings.filter((f) => f.resolved_at && new Date(f.resolved_at) <= end).length,
    };
  });

  const recent = [...findings].slice(0, 6);
  const avgCvss = findings.length
    ? (findings.reduce((s, f) => s + Number(f.cvss), 0) / findings.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {isPentester ? (
          <MetricCard label="Empresas" value={companies?.length ?? 0} icon={Building2} />
        ) : null}
        <MetricCard label="Projetos" value={projects?.length ?? 0} icon={FolderKanban} />
        <MetricCard label="Findings" value={findings.length} icon={Bug} hint={`CVSS médio ${avgCvss}`} />
        <MetricCard
          label="Críticos/Altos abertos"
          value={criticalOpen.length}
          icon={ShieldAlert}
          accent="var(--critical)"
        />
        <MetricCard
          label="Remediados"
          value={resolved.length}
          icon={CheckCircle2}
          accent="var(--low)"
          hint={`${findings.length ? Math.round((resolved.length / findings.length) * 100) : 0}% do total`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Findings por severidade</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySeverity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" name="Findings" radius={[4, 4, 0, 0]}>
                  {bySeverity.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Findings por status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} {...chartAxis} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" name="Findings" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vulnerabilidades por projeto</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {byProject.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProject} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} {...chartAxis} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="abertos" name="Abertos" fill="var(--high)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="Sem dados de projetos" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Evolução da remediação (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...chartAxis} tickLine={false} axisLine={false} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="Identificados" stroke="var(--high)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Remediados" stroke="var(--low)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Findings recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length ? (
            recent.map((f) => (
              <Link
                key={f.id}
                to="/findings/$id"
                params={{ id: f.id }}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 transition-colors hover:bg-accent"
              >
                <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                <span className="text-xs text-muted-foreground">{f.projects?.name}</span>
                <SeverityBadge severity={f.severity} />
                <StatusBadge status={f.status} />
                <span className="text-xs text-muted-foreground">{formatDate(f.discovered_at)}</span>
              </Link>
            ))
          ) : (
            <EmptyState title="Nenhum finding registrado" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
