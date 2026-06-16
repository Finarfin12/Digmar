"use client";
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, Loader2, Save,
  Image as ImageIcon, UploadCloud, FileVideo, CheckCircle2, Heart
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit, SocialAccount } from '@/types';
import MediaGalleryModal from './MediaGalleryModal';
import CaptionGenerator from './CaptionGenerator';

export default function PostScheduler({ units, accounts, initialDate, onSuccess }: { units: BusinessUnit[], accounts: SocialAccount[], initialDate?: Date | null, onSuccess: () => void }) {
  // Post Type
  const [postType, setPostType] = useState('single_image');
  
  // Media
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  // Form states
  const [formUnit, setFormUnit] = useState(units.length > 0 ? units[0].id : '');
  const [finalCaption, setFinalCaption] = useState('');
  const [formAccount, setFormAccount] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(initialDate || new Date());
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!formUnit && units.length > 0) setFormUnit(units[0].id);
  }, [units, formUnit]);

  React.useEffect(() => {
    if (!formAccount && accounts.length > 0) setFormAccount(accounts[0].id);
  }, [accounts, formAccount]);

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMediaUrl(data.url);
    } catch (err: unknown) {
      Swal.fire('Error Upload', (err as Error).message, 'error');
      setMediaFile(null);
      setMediaPreview('');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'video/*': ['.mp4'] },
    maxFiles: 1
  });

  const selectFromGallery = (url: string) => {
    setMediaUrl(url);
    setMediaPreview(url);
    setShowGallery(false);
  };

  const handleSave = async () => {
    if (!formAccount || !scheduledDate || !finalCaption) {
      return Swal.fire('Error', 'Lengkapi formulir (Akun, Tanggal, Caption)', 'error');
    }
    if (!mediaUrl && postType !== 'single_image') {
      return Swal.fire('Error', 'Media wajib diunggah untuk post ini.', 'warning');
    }

    setSaving(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_account_ids: [formAccount],
          scheduled_at: scheduledDate.toISOString(),
          caption: finalCaption,
          media_urls: mediaUrl ? [mediaUrl] : [],
          post_type: postType
        })
      });
      if (!res.ok) throw new Error('Gagal menjadwalkan post');
      Swal.fire({ title: 'Berhasil', text: 'Post terjadwal!', icon: 'success', timer: 1500, showConfirmButton: false });
      onSuccess();
    } catch (err: unknown) {
      Swal.fire('Error Save', (err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-2">
      {/* KIRI: Form Input */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Post Type Selector */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-800 mb-3">Tipe Postingan</label>
          <div className="flex gap-3">
            {[
              { id: 'single_image', label: 'Single Image', icon: ImageIcon },
              { id: 'carousel', label: 'Carousel', icon: UploadCloud },
              { id: 'reels', label: 'Reels (Video)', icon: FileVideo }
            ].map(type => {
              const Icon = type.icon;
              const active = postType === type.id;
              return (
                <button key={type.id} onClick={() => setPostType(type.id)} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent bg-white text-slate-500 hover:bg-slate-100 shadow-sm'}`}>
                  <Icon size={24} className="mb-2" />
                  <span className="text-sm font-bold">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Media Dropzone */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold text-slate-800">Unggah Media (Asset)</label>
            <button onClick={() => setShowGallery(true)} className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200">Pilih dari Galeri</button>
          </div>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center text-indigo-600">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p className="font-bold">Mengunggah ke Supabase Storage...</p>
              </div>
            ) : mediaPreview ? (
              <div className="flex flex-col items-center">
                {mediaFile?.type.startsWith('video') || mediaPreview.includes('.mp4') ? (
                  <video src={mediaPreview} className="h-32 rounded-lg mb-2" controls />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="h-32 object-contain rounded-lg mb-2" />
                )}
                <p className="text-sm text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={16}/> Media Siap</p>
                <p className="text-xs text-slate-500 mt-1">Klik atau drag lagi untuk mengganti.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-500">
                <UploadCloud size={48} className="mb-3 text-slate-400" />
                <p className="font-bold text-slate-700">Drag & drop media di sini, atau klik untuk memilih</p>
                <p className="text-xs mt-1">Mendukung Image (JPG, PNG) & Video (MP4)</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Caption Generator Extracted */}
        <CaptionGenerator 
          units={units} 
          formUnit={formUnit} 
          setFormUnit={setFormUnit} 
          onCaptionSelect={setFinalCaption} 
        />

      </div>

      {/* TENGAH: Mockup */}
      <div className="lg:col-span-4 bg-slate-100 p-6 rounded-2xl border border-slate-200 flex justify-center sticky top-6 self-start">
        <div className="w-[320px] max-w-full bg-white rounded-[36px] shadow-2xl border-[8px] border-slate-900 overflow-hidden relative">
            <div className="h-12 border-b flex items-center px-4 justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                  <div className="w-full h-full bg-white rounded-full border border-white overflow-hidden">
                    <img src="https://ui-avatars.com/api/?name=Brand&background=random" alt="Avatar" className="w-full h-full object-cover"/>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900">{units.find(u => u.id === formUnit)?.brand_name || 'username'}</span>
              </div>
              <Heart size={18} className="text-slate-600"/>
            </div>

            <div className="w-full h-[320px] bg-slate-100 flex items-center justify-center overflow-hidden">
              {mediaPreview ? (
                mediaFile?.type.startsWith('video') || mediaPreview.includes('.mp4') ? (
                  <video src={mediaPreview} className="w-full h-full object-cover" />
                ) : (
                  <img src={mediaPreview} className="w-full h-full object-cover" alt="Post media" />
                )
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <ImageIcon size={48} className="opacity-50 mb-2"/>
                  <span className="text-xs font-medium">Belum ada media</span>
                </div>
              )}
            </div>

            <div className="p-3 flex gap-4">
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
            </div>

            <div className="px-4 pb-6 pt-1 max-h-[150px] overflow-y-auto custom-scrollbar">
              <p className="text-xs text-slate-800 whitespace-pre-wrap">
                <span className="font-bold mr-1">{units.find(u => u.id === formUnit)?.brand_name || 'username'}</span>
                {finalCaption || 'Caption postingan akan muncul di sini...'}
              </p>
            </div>
          </div>
        </div>

      {/* KANAN: Schedule Form */}
      <div className="lg:col-span-3 sticky top-6 self-start">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full">
          <h4 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2"><CalendarIcon size={18}/> Detail Penjadwalan</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Akun Tujuan</label>
              <select value={formAccount} onChange={e => setFormAccount(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium">
                {filteredAccounts.length === 0 && <option value="" disabled>-- Tidak ada akun terhubung untuk unit ini --</option>}
                {filteredAccounts.map(a => <option key={a.id} value={a.id} className="text-slate-900 capitalize">{a.platform} - {a.ig_user_id}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Tanggal & Waktu</label>
              <input type="datetime-local" value={scheduledDate ? format(scheduledDate, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setScheduledDate(new Date(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium" />
            </div>

            <button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-70">
              {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
              {saving ? 'Menyimpan...' : 'Simpan & Jadwalkan Post'}
            </button>
          </div>
        </div>

      </div>

      {showGallery && <MediaGalleryModal onSelect={selectFromGallery} onClose={() => setShowGallery(false)} />}
    </div>
  );
}
