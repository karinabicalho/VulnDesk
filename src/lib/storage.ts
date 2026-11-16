// Evidências em arquivo ficam no bucket privado "evidences" (RNF03).
// Caminho: <finding_id>/<uuid>-<nome>. As políticas de storage liberam leitura
// somente para a equipe técnica e para o cliente dono da empresa do finding.
import { supabase } from "@/integrations/supabase/client";

export const EVIDENCE_BUCKET = "evidences";
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function evidencePath(findingId: string, fileName: string) {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-80);
  return `${findingId}/${crypto.randomUUID()}-${safe || "arquivo"}`;
}

export async function signedEvidenceUrl(path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Remove do storage os arquivos de evidência de um escopo antes de excluir
 * o registro (a cascata do banco remove as linhas; os arquivos são apagados aqui
 * para não ficarem órfãos — RF17/RNF11).
 */
export async function removeEvidenceFiles(scope: { findingIds?: string[]; projectIds?: string[]; companyId?: string }) {
  let findingIds = scope.findingIds ?? [];
  if (scope.companyId || scope.projectIds) {
    let projectIds = scope.projectIds ?? [];
    if (scope.companyId) {
      const { data } = await supabase.from("projects").select("id").eq("company_id", scope.companyId);
      projectIds = (data ?? []).map((p) => p.id);
    }
    if (projectIds.length) {
      const { data } = await supabase.from("findings").select("id").in("project_id", projectIds);
      findingIds = [...findingIds, ...(data ?? []).map((f) => f.id)];
    }
  }
  if (!findingIds.length) return;
  const { data: evidences } = await supabase
    .from("finding_evidences")
    .select("storage_path")
    .in("finding_id", findingIds)
    .not("storage_path", "is", null);
  const paths = (evidences ?? []).map((e) => e.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(EVIDENCE_BUCKET).remove(paths);
}
