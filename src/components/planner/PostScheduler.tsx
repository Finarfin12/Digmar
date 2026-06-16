"use client";
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, Loader2, Save, Sparkles, 
  Image as ImageIcon, UploadCloud, FileVideo, CheckCircle2, Heart, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { createClient } from '@/lib/supabase/client';

export default function PostScheduler({ units, accounts, initialDate, onSuccess }: { units: any[], accounts: any[], initialDate?: Date | null, onSuccess: () => void }) {
  const supabase = createClient();
  // Post Type
  const [postType, setPostType] = useState('single_image');
  
  // Media
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // AI Generation
  const [formUnit, setFormUnit] = useState(units.length > 0 ? units[0].id : '');
  const [formContext, setFormContext] = useState('');
  const [toneVoice, setToneVoice] = useState('profesional');
  const [generating, setGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [selectedCaption, setSelectedCaption] = useState<number>(0); // 1, 2, 3

  // Final Form
  const [finalCaption, setFinalCaption] = useState('');
  const [formAccount, setFormAccount] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(initialDate || new Date());
  const [saving, setSaving] = useState(false);

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);

    // Auto upload to Supabase Storage
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMediaUrl(data.url);
    } catch (err: any) {
      Swal.fire('Error Upload', err.message, 'error');
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

  const loadGallery = async () => {
    setShowGallery(true);
    setLoadingGallery(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.storage.from('digimar-media').list(user.id, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder');
      const filesWithUrls = validFiles.map(f => ({
        ...f,
        url: supabase.storage.from('digimar-media').getPublicUrl(`${user.id}/${f.name}`).data.publicUrl
      }));
      setGalleryFiles(filesWithUrls);
    }
    setLoadingGallery(false);
  };

  const selectFromGallery = (url: string) => {
    setMediaUrl(url);
    setMediaPreview(url);
    setShowGallery(false);
  };

  const generateAI = async () => {
    if (!formUnit || !formContext) {
      return Swal.fire('Oops', 'Pilih Unit Bisnis dan masukkan Konteks Ide Konten!', 'warning');
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: formUnit,
          prompt_context: formContext,
          tone_voice: toneVoice
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate AI');
      
      setAiResults(data);
      // Select option 1 by default
      if (data.pilihan_1) {
        setSelectedCaption(1);
        setFinalCaption(data.pilihan_1.caption + '\n\n' + data.pilihan_1.hashtag);
      }
    } catch (err: any) {
      Swal.fire('Error AI', err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const selectCaption = (num: number, choice: any) => {
    setSelectedCaption(num);
    setFinalCaption(choice.caption + '\n\n' + choice.hashtag);
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
    } catch (err: any) {
      Swal.fire('Error Save', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-2">
      {/* KIRI: Form Input */}
      <div className="space-y-6">
        
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
            <button onClick={loadGallery} className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200">Pilih dari Galeri</button>
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
                {mediaFile?.type.startsWith('video') ? (
                  <video src={mediaPreview} className="h-32 rounded-lg mb-2" controls />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="h-32 object-contain rounded-lg mb-2" />
                )}
                <p className="text-sm text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={16}/> Media Siap ({Math.round(mediaFile!.size/1024)} KB)</p>
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

        {/* AI Caption Generator */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4"><Sparkles size={18}/> AI Caption Generator</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-indigo-800 mb-1">Unit Bisnis (Konteks)</label>
                <select value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium">
                  {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-800 mb-1">Tone & Voice</label>
                <select value={toneVoice} onChange={e => setToneVoice(e.target.value)} className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium">
                  <option value="profesional">Profesional & Informatif</option>
                  <option value="kasual">Kasual & Santai</option>
                  <option value="humoris">Humoris / Lucu</option>
                  <option value="inspiratif">Inspiratif & Motivasi</option>
                  <option value="hard_selling">Hard Selling (Jualan Keras)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">Ide Konten</label>
              <textarea value={formContext} onChange={e => setFormContext(e.target.value)} rows={2} placeholder="Misal: Promo akhir tahun diskon 50% untuk produk X..." className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium" />
            </div>

            <button type="button" onClick={generateAI} disabled={generating || !formContext} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              {generating ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
              {generating ? 'AI Sedang Menulis...' : 'Generate 3 Pilihan Caption'}
            </button>
          </div>
        </div>

        {/* AI Results */}
        {aiResults && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h4 className="font-bold text-slate-800 text-sm border-b pb-2">Pilih Caption Terbaik:</h4>
            
            {[1, 2, 3].map(num => {
              const choice = aiResults[`pilihan_${num}`];
              if (!choice) return null;
              const isSelected = selectedCaption === num;
              
              return (
                <div key={num} onClick={() => selectCaption(num, choice)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Pilihan {num}</span>
                    {isSelected && <CheckCircle2 className="text-indigo-600" size={18} />}
                  </div>
                  <p className="text-sm text-slate-800 line-clamp-3 mb-2">{choice.caption}</p>
                  <p className="text-xs font-bold text-blue-600 truncate">{choice.hashtag}</p>
                </div>
              );
            })}

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
              <span className="text-xs font-extrabold text-amber-800 uppercase mb-1 block">💡 Ide Cerita Musiman</span>
              <p className="text-sm text-amber-900">{aiResults.cerita_musiman}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs font-extrabold text-slate-500 uppercase mb-1 block">🏷️ Keyword Cloud</span>
              <div className="flex flex-wrap gap-1">
                {aiResults.keyword_cloud?.map((kw: string, i: number) => <span key={i} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{kw}</span>)}
              </div>
            </div>
          </div>
        )}

      </div>


      {/* KANAN: Mockup & Schedule Form */}
      <div className="space-y-6">
        
        {/* Instagram Mockup */}
        <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex justify-center sticky top-6">
          <div className="w-[320px] bg-white rounded-[36px] shadow-2xl border-[8px] border-slate-900 overflow-hidden relative">
            {/* Top Bar */}
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

            {/* Media Area */}
            <div className="w-full h-[320px] bg-slate-100 flex items-center justify-center overflow-hidden">
              {mediaPreview ? (
                mediaFile?.type.startsWith('video') ? (
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

            {/* Actions Bar */}
            <div className="p-3 flex gap-4">
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
              <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
            </div>

            {/* Caption Area */}
            <div className="px-4 pb-6 pt-1 max-h-[150px] overflow-y-auto custom-scrollbar">
              <p className="text-xs text-slate-800 whitespace-pre-wrap">
                <span className="font-bold mr-1">{units.find(u => u.id === formUnit)?.brand_name || 'username'}</span>
                {finalCaption || 'Caption postingan akan muncul di sini...'}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
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

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Pilih dari Galeri</h3>
              <button onClick={() => setShowGallery(false)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
              {loadingGallery ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
              ) : galleryFiles.length === 0 ? (
                <div className="text-center p-8 text-slate-500 font-medium">Galeri kosong.</div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {galleryFiles.map(f => (
                    <div key={f.id} onClick={() => selectFromGallery(f.url)} className="aspect-square bg-slate-200 rounded-lg overflow-hidden cursor-pointer hover:ring-4 ring-indigo-500 transition-all">
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
      )}
    </div>
  );
}
