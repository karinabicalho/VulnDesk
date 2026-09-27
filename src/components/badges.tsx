import { cn } from "@/lib/utils";
import {
  severityLabel,
  statusLabel,
  projectStatusLabel,
  type Severity,
  type FindingStatus,
  type ProjectStatus,
} from "@/lib/vuln";

const severityClasses: Record<Severity, string> = {
  critical: "border-[var(--critical)]/40 bg-[var(--critical)]/15 text-[var(--critical)]",
  high: "border-[var(--high)]/40 bg-[var(--high)]/15 text-[var(--high)]",
  medium: "border-[var(--medium)]/40 bg-[var(--medium)]/15 text-[var(--medium)]",
  low: "border-[var(--low)]/40 bg-[var(--low)]/15 text-[var(--low)]",
  informational: "border-border bg-muted text-muted-foreground",
};

const statusClasses: Record<FindingStatus, string> = {
  open: "border-[var(--critical)]/40 bg-[var(--critical)]/12 text-[var(--critical)]",
  in_progress: "border-[var(--medium)]/40 bg-[var(--medium)]/12 text-[var(--medium)]",
  resolved: "border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]",
  accepted_risk: "border-[var(--low)]/40 bg-[var(--low)]/12 text-[var(--low)]",
  false_positive: "border-border bg-muted text-muted-foreground",
  closed: "border-border bg-muted text-muted-foreground",
};

const base =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span className={cn(base, severityClasses[severity], className)}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(--${severity === "informational" ? "info" : severity})` }}
      />
      {severityLabel[severity]}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: FindingStatus;
  className?: string;
}) {
  return <span className={cn(base, statusClasses[status], className)}>{statusLabel[status]}</span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, string> = {
    planned: "border-border bg-muted text-muted-foreground",
    in_progress: "border-primary/40 bg-primary/12 text-primary",
    finished: "border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]",
    archived: "border-border bg-muted text-muted-foreground",
  };
  return <span className={cn(base, map[status])}>{projectStatusLabel[status]}</span>;
}

export function CompanyStatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={cn(
        base,
        status === "active"
          ? "border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {status === "active" ? "Ativa" : "Inativa"}
    </span>
  );
}
