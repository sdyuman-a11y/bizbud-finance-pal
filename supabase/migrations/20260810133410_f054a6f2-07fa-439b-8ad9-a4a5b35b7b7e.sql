CREATE POLICY "Vault users can read own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Vault users can upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Vault users can update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Vault users can delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);