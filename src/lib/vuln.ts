export type Severity = "critical" | "high" | "medium" | "low" | "informational";
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "accepted_risk"
  | "false_positive"
  | "closed";
export type ProjectType = "web" | "api" | "mobile" | "infra" | "redteam" | "va" | "other";
export type ProjectStatus = "planned" | "in_progress" | "finished" | "archived";
export type CompanyStatus = "active" | "inactive";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "informational"];
export const FINDING_STATUSES: FindingStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "accepted_risk",
  "false_positive",
  "closed",
];
export const PROJECT_TYPES: ProjectType[] = [
  "web",
  "api",
  "mobile",
  "infra",
  "redteam",
  "va",
  "other",
];
export const PROJECT_STATUSES: ProjectStatus[] = [
  "planned",
  "in_progress",
  "finished",
  "archived",
];

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export const statusLabel: Record<FindingStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  accepted_risk: "Accepted Risk",
  false_positive: "False Positive",
  closed: "Closed",
};

export const projectTypeLabel: Record<ProjectType, string> = {
  web: "Pentest Web",
  api: "Pentest API",
  mobile: "Pentest Mobile",
  infra: "Pentest Infraestrutura",
  redteam: "Red Team",
  va: "Vulnerability Assessment",
  other: "Outros",
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  finished: "Finalizado",
  archived: "Arquivado",
};

export const severityColorVar: Record<Severity, string> = {
  critical: "var(--critical)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
  informational: "var(--info)",
};

export const severityOrder: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export const OPEN_STATUSES: FindingStatus[] = ["open", "in_progress"];
export const RESOLVED_STATUSES: FindingStatus[] = ["resolved", "closed"];

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function severityFromCvss(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "informational";
}
