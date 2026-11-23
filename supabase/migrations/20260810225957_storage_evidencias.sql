
CREATE POLICY "evidence_files_pentester_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'evidences' AND public.is_pentester())
WITH CHECK (bucket_id = 'evidences' AND public.is_pentester());

CREATE POLICY "evidence_files_client_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidences' AND EXISTS (
    SELECT 1 FROM public.findings f
    JOIN public.projects p ON p.id = f.project_id
    WHERE f.id::text = split_part(storage.objects.name, '/', 1)
      AND p.company_id = public.current_company_id()
  )
);
