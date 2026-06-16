"use client";
import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ImageEditor from './ImageEditor';
import { v4 as uuidv4 } from 'uuid';

export default function MediaGalleryModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const supabase = createClient();
  const [galleryFiles, setGalleryFiles] = useState<{ id: string | null; url: string; metadata?: Record<string, unknown> | null | any }[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    setLoadingGallery(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.storage.from('digimar-media').list(user.id, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder');
      const filesWithUrls = validFiles.map(f => ({
        id: f.id,
        metadata: f.metadata,
        url: supabase.storage.from('digimar-media').getPublicUrl(`${user.id}/${f.name}`).data.publicUrl
      }));
      setGalleryFiles(filesWithUrls);
    }
    setLoadingGallery(false);
  };

  const handleSaveEdit = async (base64Data: string) => {
    setSavingEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const res = await fetch(base64Data);
      const blob = await res.blob();
      const filename = `edited_${uuidv4()}.jpg`;

      const { data, error } = await supabase.storage.from('digimar-media').upload(`${user.id}/${filename}`, blob, { contentType: 'image/jpeg' });
      
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('digimar-media').getPublicUrl(`${user.id}/${filename}`);
      
      setEditingImage(null);
      onSelect(publicUrl); // Directly select the newly edited image
    } catch (err) {
      console.error('Error saving edit:', err);
      alert('Gagal menyimpan gambar edit.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">Pilih dari Galeri</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar">
          {loadingGallery ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
          ) : galleryFiles.length === 0 ? (
            <div className="text-center p-8 text-slate-500 font-medium">Galeri kosong.</div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {galleryFiles.map(f => (
                <div key={f.id} className="relative group aspect-square bg-slate-200 rounded-lg overflow-hidden hover:ring-4 ring-indigo-500 transition-all">
                  {f.metadata?.mimetype?.startsWith('video') ? (
                    <>
                      <video src={f.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <button onClick={() => onSelect(f.url)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">Gunakan</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <img src={f.url} className="w-full h-full object-cover" alt="gallery" />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3 transition-opacity">
                         <button onClick={() => onSelect(f.url)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md w-28">Gunakan</button>
                         <button onClick={() => setEditingImage(f.url)} className="bg-white hover:bg-slate-100 text-indigo-900 px-6 py-2 rounded-lg font-bold text-sm shadow-md w-28">Edit</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {editingImage && (
        <ImageEditor 
          imageUrl={editingImage}
          onSave={handleSaveEdit}
          onCancel={() => setEditingImage(null)}
        />
      )}
      
      {savingEdit && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40}/>
            <p className="font-bold text-slate-800">Menyimpan gambar hasil edit...</p>
          </div>
        </div>
      )}
    </div>
  );
}
