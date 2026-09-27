import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Severity, FindingStatus } from "@/lib/vuln";

export type FindingRow = {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  cvss: number;
  discovered_at: string;
  resolved_at: string | null;
  project_id: string;
  pentester_id: string | null;
  projects: { id: string; name: string; company_id: string; companies: { name: string } | null } | null;
  profiles: { id: string; full_name: string } | null;
};

const findingSelect =
  "id, code, title, severity, status, cvss, discovered_at, resolved_at, project_id, pentester_id, projects!findings_project_id_fkey(id, name, company_id, companies(name)), profiles!findings_pentester_id_fkey(id, full_name)";

export function useFindings() {
  return useQuery({
    queryKey: ["findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select(findingSelect)
        .order("discovered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FindingRow[];
    },
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, companies(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePentesters() {
  return useQuery({
    queryKey: ["pentesters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, company_id")
        .is("company_id", null)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectPentesters() {
  return useQuery({
    queryKey: ["project-pentesters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pentesters")
        .select("project_id, profile_id, profiles(id, full_name, email)");
      if (error) throw error;
      return data ?? [];
    },
  });
}
