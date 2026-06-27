
CREATE POLICY "Users upload own estimates" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estimates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own estimates" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'estimates' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Users delete own estimates" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'estimates' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
