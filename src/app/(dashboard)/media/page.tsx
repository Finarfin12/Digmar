"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { Image as ImageIcon, Loader2, Copy, Trash2, UploadCloud, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MediaGallery() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchFiles = useCallback(async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase.storage.from('digimar-media').list(uid, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      // Filter out the empty folder placeholder if any (.emptyFolderPlaceholder)
      const validFiles = data?.filter(f => f.name !== '.emptyFolderPlaceholder') || [];
      
      // Get public URLs
      const filesWithUrls = validFiles.map(f => {
        const path = `${uid}/${f.name}`;
        const { data: urlData } = supabase.storage.from('digimar-media').getPublicUrl(path);
        return {
          ...f,
          path,
          publicUrl: urlData.publicUrl
        };
      });
      setFiles(filesWithUrls);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchFiles(user.id);
      }
    });
  }, [fetchFiles, supabase]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!userId) return;
    setUploading(true);
    let successCount = 0;

    for (const file of acceptedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('digimar-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      
      if (!error) successCount++;
    }

    setUploading(false);
    if (successCount > 0) {
      fetchFiles(userId);
      Swal.fire('Berhasil', `${successCount} media berhasil diunggah!`, 'success');
    }
  }, [userId, supabase, fetchFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'video/*': ['.mp4'] }
  });

  const handleDelete = async (path: string) => {
    const res = await Swal.fire({
      title: 'Hapus Media?',
      text: 'File ini akan dihapus secara permanen dari Storage.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (res.isConfirmed) {
      const { error } = await supabase.storage.from('digimar-media').remove([path]);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('Terhapus', 'Media berhasil dihapus.', 'success');
        if (userId) fetchFiles(userId);
      }
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    Swal.fire({ title: 'Tersalin!', text: 'URL Media disalin ke clipboard.', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center gap-3">
        <div className="bg-indigo-100 p-3 rounded-xl shadow-sm">
          <ImageIcon className="text-indigo-600" size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Galeri Media</h2>
          <p className="text-slate-600 mt-1 font-medium">Kelola aset gambar dan video Anda untuk keperluan pembuatan postingan.</p>
        </div>
      </header>

      {/* Dropzone */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center text-indigo-600">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-bold text-lg">Sedang mengunggah media...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-500">
              <UploadCloud size={64} className="mb-4 text-slate-400" />
              <p className="font-bold text-slate-700 text-lg">Drag & drop beberapa file ke sini, atau klik untuk memilih</p>
              <p className="text-sm mt-2">Mendukung Image (JPG, PNG) & Video (MP4). Bisa langsung banyak file sekaligus.</p>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Aset Tersimpan ({files.length})</h3>
        
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>
        ) : files.length === 0 ? (
          <div className="text-center p-12 text-slate-500 font-medium">Belum ada media di galeri Anda.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map(file => {
              const isVideo = file.metadata?.mimetype?.startsWith('video');
              return (
                <div key={file.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  {isVideo ? (
                    <video src={file.publicUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={file.publicUrl} alt={file.name} className="w-full h-full object-cover" />
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-3">
                    <button onClick={() => copyUrl(file.publicUrl)} className="bg-white text-slate-900 p-2 rounded-full hover:bg-indigo-100 transition-colors" title="Salin URL">
                      <Copy size={20}/>
                    </button>
                    <button onClick={() => handleDelete(file.path)} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors" title="Hapus Media">
                      <Trash2 size={20}/>
                    </button>
                  </div>

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3">
                    <p className="text-white text-xs truncate" title={file.name}>{file.name}</p>
                    <p className="text-slate-300 text-[10px]">{(file.metadata?.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
