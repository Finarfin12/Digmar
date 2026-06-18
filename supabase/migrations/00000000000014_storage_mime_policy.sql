-- M2, L7: Storage Policy untuk MIME Type Validation
-- Menghapus policy lama yang mungkin terlalu permisif
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Semua orang bisa melihat media" ON storage.objects;
DROP POLICY IF EXISTS "User login bisa mengunggah" ON storage.objects;
DROP POLICY IF EXISTS "User bisa menghapus medianya sendiri" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload valid media" ON storage.objects;
DROP POLICY IF EXISTS "Public media access" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;

-- Membuat policy baru yang memeriksa tipe MIME (hanya mengizinkan gambar dan video)
CREATE POLICY "Users can upload valid media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  (
    storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov')
  )
);

-- Policy untuk membaca (public)
CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'digimar-media' );

-- Policy untuk menghapus (Hanya pemilik)
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy untuk mengupdate (Hanya pemilik) - H7 Fix
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
