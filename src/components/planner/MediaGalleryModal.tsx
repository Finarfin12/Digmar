"use client";
import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function MediaGalleryModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const supabase = createClient();
  const [galleryFiles, setGalleryFiles] = useState<{ id: string; url: string; metadata?: Record<string, unknown> }[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

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
                <div key={f.id} onClick={() => onSelect(f.url)} className="aspect-square bg-slate-200 rounded-lg overflow-hidden cursor-pointer hover:ring-4 ring-indigo-500 transition-all">
                  {f.metadata?.mimetype?.startsWith('video') ? (
                    <video src={f.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={f.url} className="w-full h-full object-cover" alt="gallery" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
