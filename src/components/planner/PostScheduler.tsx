"use client";
import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, Loader2, Save,
  Image as ImageIcon, UploadCloud, FileVideo, CheckCircle2, Heart, Sparkles, Wand2, GripVertical, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit, SocialAccount } from '@/types';
import MediaGalleryModal from './MediaGalleryModal';
import CaptionGenerator from './CaptionGenerator';
import LibrarySelectorModal from './LibrarySelectorModal';

export default function PostScheduler({ units, accounts, initialDate, onSuccess }: { units: BusinessUnit[], accounts: SocialAccount[], initialDate?: Date | null, onSuccess: () => void }) {
  // Mode Auto-Pilot
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [autoPilotIdea, setAutoPilotIdea] = useState('');

  // Post Type
  const [postType, setPostType] = useState('single_image');
  
  // Media Array
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showLibModal, setShowLibModal] = useState<'captions' | 'hashtags' | null>(null);

  // Form states
  const [formUnit, setFormUnit] = useState(units.length > 0 ? units[0].id : '');
  const [finalCaption, setFinalCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [formAccount, setFormAccount] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(initialDate || new Date());
  
  const [saving, setSaving] = useState(false);
  const [fetchingBestTime, setFetchingBestTime] = useState(false);

  // Drag logic
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  React.useEffect(() => {
    if (!formUnit && units.length > 0) setFormUnit(units[0].id);
  }, [units, formUnit]);

  React.useEffect(() => {
    if (!formAccount && accounts.length > 0) setFormAccount(accounts[0].id);
  }, [accounts, formAccount]);

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    let newUrls = [...mediaUrls];

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        if (postType === 'single_image' || postType === 'reels') {
          newUrls = [data.url]; // Replace
        } else {
          newUrls.push(data.url); // Append
        }
      } catch (err: unknown) {
        Swal.fire('Error Upload', (err as Error).message, 'error');
      }
    }
    
    setMediaUrls(newUrls);
    setUploading(false);
  }, [mediaUrls, postType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'video/*': ['.mp4'] },
    maxFiles: postType === 'carousel' ? 10 : 1,
    multiple: postType === 'carousel'
  });

  const selectFromGallery = (url: string) => {
    if (postType === 'single_image' || postType === 'reels') {
      setMediaUrls([url]);
    } else {
      setMediaUrls([...mediaUrls, url]);
    }
    setShowGallery(false);
  };

  const removeMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _mediaUrls = [...mediaUrls];
    const draggedItemContent = _mediaUrls.splice(dragItem.current, 1)[0];
    _mediaUrls.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setMediaUrls(_mediaUrls);
  };

  const handleSaveManual = async () => {
    if (!formAccount || !scheduledDate || !finalCaption) {
      return Swal.fire('Error', 'Lengkapi formulir (Akun, Tanggal, Caption)', 'error');
    }
    if (mediaUrls.length === 0 && postType !== 'single_image') {
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
          first_comment: firstComment,
          media_urls: mediaUrls,
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

  const handleAutoPilot = async () => {
    if (!formAccount || !autoPilotIdea || mediaUrls.length === 0) {
      return Swal.fire('Error', 'Lengkapi Ide Konten dan Media!', 'error');
    }
    setSaving(true);
    Swal.fire({ title: 'Memproses Otomatis', text: 'AI sedang berpikir...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/posts/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: formUnit,
          target_account_ids: [formAccount],
          media_urls: mediaUrls,
          post_type: postType,
          content_idea: autoPilotIdea,
          tone_voice: 'profesional',
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      Swal.fire({ title: 'Selesai!', text: 'Postingan telah dibuat dan dijadwalkan otomatis oleh AI.', icon: 'success' });
      onSuccess();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBestTime = async () => {
    if (!formUnit) return Swal.fire('Error', 'Pilih unit bisnis terlebih dahulu', 'error');
    setFetchingBestTime(true);
    try {
      const res = await fetch('/api/ai/best-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: formUnit })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setScheduledDate(new Date(data.scheduled_at));
      Swal.fire({
        title: 'Waktu Optimal (AI)',
        text: data.reasoning,
        icon: 'info',
        confirmButtonText: 'Terapkan'
      });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setFetchingBestTime(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4">
      {/* KIRI: Form Input */}
      <div className="space-y-6">
        
        {/* Toggle Mode */}
        <div className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between ${isAutoPilot ? 'bg-indigo-900 border-indigo-700 text-white' : 'bg-white border-slate-200'}`}>
          <div>
            <h3 className={`font-black text-lg flex items-center gap-2 ${isAutoPilot ? 'text-white' : 'text-slate-900'}`}>
              <Wand2 size={24} className={isAutoPilot ? 'text-amber-400' : 'text-indigo-600'}/> 
              1-Click Auto-Pilot
            </h3>
            <p className={`text-sm font-medium mt-1 ${isAutoPilot ? 'text-indigo-200' : 'text-slate-600'}`}>
              Biarkan AI menulis caption dan menjadwalkan otomatis
            </p>
          </div>
          <button 
            onClick={() => setIsAutoPilot(!isAutoPilot)} 
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAutoPilot ? 'bg-amber-400' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutoPilot ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Akun & Tipe */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">Unit & Akun Tujuan</label>
            <div className="flex gap-2">
              <select value={formUnit} onChange={e => {setFormUnit(e.target.value); setFormAccount('');}} className="flex-1 p-3 border border-slate-300 rounded-lg bg-slate-50 font-bold">
                {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
              </select>
              <select value={formAccount} onChange={e => setFormAccount(e.target.value)} className="flex-1 p-3 border border-slate-300 rounded-lg bg-slate-50 font-bold">
                <option value="">-- Pilih Akun --</option>
                {filteredAccounts.map(a => <option key={a.id} value={a.id} className="capitalize">{a.platform}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Tipe Postingan</label>
            <div className="flex gap-2">
              {[
                { id: 'single_image', label: 'Single', icon: ImageIcon },
                { id: 'carousel', label: 'Carousel', icon: UploadCloud },
                { id: 'reels', label: 'Video', icon: FileVideo }
              ].map(type => (
                <button key={type.id} onClick={() => {setPostType(type.id); setMediaUrls([]);}} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border-2 font-bold text-sm transition-all ${postType === type.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                  <type.icon size={16} /> {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Media Uploader */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-bold text-slate-800 flex items-center gap-2"><ImageIcon size={16}/> Media ({mediaUrls.length}{postType === 'carousel' ? '/10' : '/1'})</label>
            <button onClick={() => setShowGallery(true)} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-100">Pilih dari Galeri</button>
          </div>
          
          {(mediaUrls.length === 0 || postType === 'carousel') && (
            <div {...getRootProps()} className={`mb-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center text-indigo-600">
                  <Loader2 className="animate-spin mb-1" size={24} />
                  <p className="font-bold text-sm">Mengunggah...</p>
                </div>
              ) : (
                <div className="text-slate-500 text-sm font-medium">Klik atau Drag media ke sini</div>
              )}
            </div>
          )}

          {/* Media List / Preview */}
          {mediaUrls.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar">
              {mediaUrls.map((url, index) => (
                <div 
                  key={index} 
                  className="flex-shrink-0 relative w-24 h-24 border border-slate-200 rounded-xl overflow-hidden group cursor-move bg-slate-100"
                  draggable={postType === 'carousel'}
                  onDragStart={() => (dragItem.current = index)}
                  onDragEnter={() => (dragOverItem.current = index)}
                  onDragEnd={handleSort}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {postType === 'carousel' && (
                    <div className="absolute top-1 left-1 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <GripVertical size={14}/>
                    </div>
                  )}
                  {url.includes('.mp4') ? (
                    <video src={url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={url} className="w-full h-full object-cover" alt={`media-${index}`} />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                    <span className="text-[10px] text-white font-bold">{index + 1}</span>
                  </div>
                  <button onClick={() => removeMedia(index)} className="absolute top-1 right-1 bg-white/90 hover:bg-red-100 text-red-500 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm">
                    <X size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Caption Area (Dependent on Mode) */}
        {isAutoPilot ? (
          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200 shadow-sm animate-in slide-in-from-bottom-4">
            <label className="block text-sm font-bold text-indigo-900 mb-2">Ide Konten / Topik</label>
            <textarea 
              value={autoPilotIdea} 
              onChange={e => setAutoPilotIdea(e.target.value)} 
              rows={3} 
              className="w-full p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
              placeholder="Contoh: Promo kemerdekaan diskon 50%, ajak orang untuk beli hari ini juga!"
            />
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <CaptionGenerator 
              units={units} 
              formUnit={formUnit} 
              setFormUnit={setFormUnit} 
              onCaptionSelect={setFinalCaption} 
            />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-slate-800">Caption Final</label>
                <div className="flex gap-2">
                  <button onClick={() => setShowLibModal('captions')} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-bold transition-colors">Template</button>
                  <button onClick={() => setShowLibModal('hashtags')} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-bold transition-colors">Hashtag</button>
                </div>
              </div>
              <textarea 
                value={finalCaption} 
                onChange={e => setFinalCaption(e.target.value)} 
                rows={4} 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm mb-3"
              />
              <label className="block text-sm font-bold text-slate-800 mb-2">First Comment (Opsional)</label>
              <input 
                type="text"
                value={firstComment} 
                onChange={e => setFirstComment(e.target.value)} 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm"
              />
            </div>
          </div>
        )}

      </div>

      {/* KANAN: Preview & Action */}
      <div className="space-y-6 relative">
        <div className="sticky top-6 space-y-6">
          
          {/* Mockup */}
          <div className="bg-slate-100/50 p-6 rounded-3xl border border-slate-200 flex justify-center items-start">
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

              <div className="w-full h-[320px] bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {mediaUrls.length > 0 ? (
                  <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
                    {mediaUrls.map((url, i) => (
                      <div key={i} className="min-w-full h-full snap-center relative flex-shrink-0">
                        {url.includes('.mp4') ? (
                          <video src={url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} className="w-full h-full object-cover" alt={`post-media-${i}`} />
                        )}
                        {mediaUrls.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            {i + 1}/{mediaUrls.length}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                  {isAutoPilot 
                    ? <span className="italic text-slate-400">Caption akan di-generate otomatis oleh AI...</span> 
                    : (finalCaption || <span className="italic text-slate-400">Caption postingan...</span>)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            {isAutoPilot ? (
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 mb-4 flex items-center justify-center gap-2">
                  <CalendarIcon size={16}/> Jadwal & Waktu Tayang akan ditentukan AI
                </p>
                <button onClick={handleAutoPilot} disabled={saving} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all disabled:opacity-70 text-lg">
                  {saving ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                  {saving ? 'Memproses...' : 'Auto-Generate & Jadwalkan'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-800">Tanggal & Waktu</label>
                  <button onClick={handleBestTime} disabled={fetchingBestTime} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50">
                    {fetchingBestTime ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                    AI Best Time
                  </button>
                </div>
                <input type="datetime-local" value={scheduledDate ? format(scheduledDate as Date, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setScheduledDate(new Date(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium" />
                
                <button onClick={handleSaveManual} disabled={saving} className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-70 text-lg">
                  {saving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                  {saving ? 'Menyimpan...' : 'Simpan Manual'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modals */}
      {showGallery && <MediaGalleryModal businessUnitId={formUnit} onSelect={selectFromGallery} onClose={() => setShowGallery(false)} />}
      
      {showLibModal && (
        <LibrarySelectorModal 
          type={showLibModal} 
          businessUnitId={formUnit} 
          onClose={() => setShowLibModal(null)} 
          onSelect={(content) => {
            if (showLibModal === 'hashtags') {
              setFinalCaption(prev => prev ? prev + '\n\n' + content : content);
              setShowLibModal(null);
            } else {
              setFinalCaption(prev => prev ? prev + '\n' + content : content);
              setShowLibModal(null);
            }
          }} 
        />
      )}
    </div>
  );
}
