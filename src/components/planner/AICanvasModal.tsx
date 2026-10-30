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
  const [templateId, setTemplateId] = useState<'centered' | 'split' | 'minimal'>('centered');
  const [resolution, setResolution] = useState<'1080x1080' | '1080x1350'>('1080x1080');
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
          logo_url: unit.brand_logo_url,
          template_id: templateId,
          resolution
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate gambar');

      Swal.close();
      onSuccess(data.url);
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
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
          {templateId === 'centered' && (
            <div 
              className={`rounded-2xl shadow-inner relative overflow-hidden flex flex-col justify-center p-4 transition-all ${resolution === '1080x1080' ? 'w-48 h-48' : 'w-48 h-60'}`}
              style={{ backgroundColor: brandColor }}
            >
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)', backgroundSize: '10px 10px' }} />
              <div className="relative z-10 text-white flex flex-col gap-2">
                <div className="font-black text-lg leading-tight line-clamp-3">{title || 'Judul Utama Promo'}</div>
                <div className="font-medium text-[10px] text-white/80 line-clamp-2">{subtitle || 'Sub-judul opsional untuk detail ekstra.'}</div>
              </div>
            </div>
          )}

          {templateId === 'split' && (
            <div className={`rounded-2xl shadow-inner relative overflow-hidden flex transition-all bg-white border border-slate-200 ${resolution === '1080x1080' ? 'w-48 h-48' : 'w-48 h-60'}`}>
              <div className="w-2/5 h-full relative flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)', backgroundSize: '6px 6px' }} />
              </div>
              <div className="w-3/5 h-full p-3 flex flex-col justify-center">
                <div className="font-black text-[14px] text-slate-800 leading-tight line-clamp-3 mb-1">{title || 'Judul Utama Promo'}</div>
                <div className="font-medium text-[8px] text-slate-500 line-clamp-2" style={{ borderLeft: `2px solid ${brandColor}`, paddingLeft: '4px' }}>
                  {subtitle || 'Sub-judul opsional.'}
                </div>
              </div>
            </div>
          )}

          {templateId === 'minimal' && (
            <div className={`rounded-2xl shadow-inner relative overflow-hidden flex flex-col justify-end p-4 transition-all bg-slate-50 ${resolution === '1080x1080' ? 'w-48 h-48' : 'w-48 h-60'}`} style={{ border: `4px solid ${brandColor}` }}>
              <div className="font-black text-xl leading-tight line-clamp-2 uppercase" style={{ color: brandColor }}>{title || 'JUDUL PROMO'}</div>
              <div className="font-bold text-[10px] text-slate-700 line-clamp-2 mt-1">{subtitle || 'Sub-judul opsional untuk detail ekstra.'}</div>
            </div>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Pilih Template</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                type="button" 
                onClick={() => setTemplateId('centered')}
                className={`p-2 rounded-xl text-xs font-bold border-2 transition-colors ${templateId === 'centered' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                Centered
              </button>
              <button 
                type="button" 
                onClick={() => setTemplateId('split')}
                className={`p-2 rounded-xl text-xs font-bold border-2 transition-colors ${templateId === 'split' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                Split Content
              </button>
              <button 
                type="button" 
                onClick={() => setTemplateId('minimal')}
                className={`p-2 rounded-xl text-xs font-bold border-2 transition-colors ${templateId === 'minimal' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                Minimalist
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Ukuran Kanvas</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                type="button" 
                onClick={() => setResolution('1080x1080')}
                className={`flex-1 p-2 text-xs font-bold rounded-lg transition-all ${resolution === '1080x1080' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                1080 x 1080 (Square)
              </button>
              <button 
                type="button" 
                onClick={() => setResolution('1080x1350')}
                className={`flex-1 p-2 text-xs font-bold rounded-lg transition-all ${resolution === '1080x1350' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                1080 x 1350 (Portrait)
              </button>
            </div>
          </div>

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
