"use client";
import React, { useState } from 'react';
import { X, Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit } from '@/types';

interface AICanvasModalProps {
  unit: BusinessUnit | null;
  onClose: () => void;
  onSuccess: (url: string) => void;
}

export default function AICanvasModal({ unit, onClose, onSuccess }: AICanvasModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [generating, setGenerating] = useState(false);

  // Jika unit tidak ditemukan, pakai default
  const brandColor = unit?.brand_color || '#4f46e5';

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) {
      return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu di form utama', 'error');
    }

    setGenerating(true);
    Swal.fire({
      title: 'Merender Gambar AI...',
      html: 'AI Canvas sedang membuat resolusi tinggi untuk Anda.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await fetch('/api/media/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: unit.id,
          title,
          subtitle,
          brand_color: brandColor,
          logo_url: unit.brand_logo_url
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate gambar');

      Swal.close();
      onSuccess(data.url);
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b" style={{ backgroundColor: brandColor }}>
          <div className="text-white">
            <h3 className="text-xl font-black flex items-center gap-2">
              <Sparkles className="text-yellow-300" /> AI Canvas
            </h3>
            <p className="font-medium text-white/80 text-sm mt-1">Desain Instan berbayut Brand Kit Anda.</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Preview */}
        <div className="p-6 bg-slate-50 flex justify-center border-b">
          <div 
            className="w-48 h-48 rounded-2xl shadow-inner relative overflow-hidden flex flex-col justify-center p-4"
            style={{ backgroundColor: brandColor }}
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)', backgroundSize: '10px 10px' }} />
            <div className="relative z-10 text-white flex flex-col gap-2">
              <div className="font-black text-lg leading-tight line-clamp-3">{title || 'Judul Utama Promo'}</div>
              <div className="font-medium text-[10px] text-white/80 line-clamp-2">{subtitle || 'Sub-judul opsional untuk detail ekstra.'}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Copywriting Utama (Maks 10 kata)</label>
            <textarea 
              required
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              rows={2} 
              className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-black text-slate-800 text-lg"
              placeholder="Contoh: BIG SALE Akhir Tahun!"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Sub-judul / Detail (Opsional)</label>
            <input 
              type="text"
              value={subtitle} 
              onChange={e => setSubtitle(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
              placeholder="Diskon 50% untuk semua item."
            />
          </div>

          <button 
            disabled={generating} 
            type="submit" 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-70 mt-2"
          >
            {generating ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={20} className="text-indigo-400"/>}
            {generating ? 'Mencetak Gambar...' : 'Generate AI Image'}
          </button>
        </form>

      </div>
    </div>
  );
}
