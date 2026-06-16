-- Membuat bucket public bernama digimar-media
insert into storage.buckets (id, name, public)
values ('digimar-media', 'digimar-media', true)
on conflict (id) do nothing;


-- Policy 1: Izinkan siapa saja membaca (karena Meta perlu mengunduh gambar)
create policy "Semua orang bisa melihat media"
on storage.objects for select
using ( bucket_id = 'digimar-media' );

-- Policy 2: Izinkan user yang login untuk mengunggah
create policy "User login bisa mengunggah"
on storage.objects for insert
with check ( bucket_id = 'digimar-media' and auth.role() = 'authenticated' );

-- Policy 3: Izinkan user menghapus media mereka sendiri
create policy "User bisa menghapus medianya sendiri"
on storage.objects for delete
using ( bucket_id = 'digimar-media' and auth.uid() = owner );
