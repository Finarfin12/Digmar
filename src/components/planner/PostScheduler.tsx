"use client";
import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, Loader2, Save,
  Image as ImageIcon, UploadCloud, FileVideo, CheckCircle2, Heart, Sparkles, Wand2, GripVertical, X, ImagePlus, AlertTriangle, ChevronDown, ChevronUp, Camera, Music, Users, Link, AtSign
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit, SocialAccount } from '@/types';
import MediaGalleryModal from './MediaGalleryModal';
import CaptionGenerator from './CaptionGenerator';
import LibrarySelectorModal from './LibrarySelectorModal';
import AICanvasModal from './AICanvasModal';

const platformIconComponents: Record<string, React.ReactNode> = {
  meta_ig: <Camera size={14} />,
  tiktok: <Music size={14} />,
  facebook: <Users size={14} />,
  threads: <AtSign size={14} />,
  linkedin: <Link size={14} />,
};

const platformNames: Record<string, string> = {
  meta_ig: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
  linkedin: 'LinkedIn',
};

export default function PostScheduler({ units, accounts, initialDate, onSuccess }: { units: BusinessUnit[], accounts: SocialAccount[], initialDate?: Date | null, onSuccess: () => void }) {
  const [mode, setMode] = useState<'manual' | 'autopilot' | 'abtest'>('manual');
  const [autoPilotIdea, setAutoPilotIdea] = useState('');
  const [toneA, setToneA] = useState('Formal/Profesional');
  const [toneB, setToneB] = useState('Humor/Santai');

  // Post Type
  const [postType, setPostType] = useState('single_image');

  // Media Array
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showLibModal, setShowLibModal] = useState<'captions' | 'hashtags' | null>(null);

  // Render Mode: Satori vs AI Image
  const [renderMode, setRenderMode] = useState<'satori' | 'ai_image'>('satori');
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);

  // Multi-Platform Selection (F6)
  const [formUnit, setFormUnit] = useState(units.length > 0 ? units[0].id : '');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [showPerPlatformCaptions, setShowPerPlatformCaptions] = useState(false);
  const [publishMode, setPublishMode] = useState<'cepat' | 'lanjutan'>('cepat');

  // Form states
  const [finalCaption, setFinalCaption] = useState('');
  const [firstComment, setFirstComment] = useState('');
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
    if (selectedAccounts.length === 0 && accounts.length > 0) {
      const defaultAcc = accounts.find(a => a.business_unit_id === formUnit);
      if (defaultAcc) setSelectedAccounts([defaultAcc.id]);
    }
  }, [accounts, formUnit]);

  React.useEffect(() => {
    fetch('/api/configurations?key=publish_mode')
      .then(r => r.json())
      .then(d => { if (d && d.value) setPublishMode(d.value === 'lanjutan' ? 'lanjutan' : 'cepat'); })
      .catch(() => {});
  }, []);

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const hashtagCount = (caption: string) => {
    const matches = caption.match(/#\w+/g);
    return matches ? matches.length : 0;
  };

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
          newUrls = [data.url];
        } else {
          newUrls.push(data.url);
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
    if (selectedAccounts.length === 0 || !scheduledDate || !finalCaption) {
      return Swal.fire('Error', 'Lengkapi formulir (Akun, Tanggal, Caption)', 'error');
    }
    setSaving(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_account_ids: selectedAccounts,
          scheduled_at: scheduledDate.toISOString(),
          caption: finalCaption,
          first_comment: firstComment,
          media_urls: mediaUrls,
          post_type: postType,
          platform_captions: platformCaptions,
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

  const handleAIGenerate = async () => {
    if (selectedAccounts.length === 0 || !autoPilotIdea || mediaUrls.length === 0) {
      return Swal.fire('Error', 'Lengkapi Ide Konten dan Media!', 'error');
    }
    setSaving(true);
    Swal.fire({ title: 'Memproses Otomatis', text: 'AI sedang berpikir...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const body = {
        business_unit_id: formUnit,
        target_account_ids: selectedAccounts,
        media_urls: mediaUrls,
        post_type: postType,
        content_idea: autoPilotIdea,
        tone_voice: 'profesional',
        platform_captions: platformCaptions,
      };

      if (mode === 'autopilot') {
        const res = await fetch('/api/posts/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        Swal.fire({ title: 'Selesai!', text: 'Postingan telah dibuat dan dijadwalkan otomatis oleh AI.', icon: 'success' });
      } else if (mode === 'abtest') {
        const res = await fetch('/api/posts/ab-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_unit_id: formUnit,
            target_account_ids: selectedAccounts,
            media_urls: mediaUrls,
            post_type: postType,
            content_idea: autoPilotIdea,
            tone_a: toneA,
            tone_b: toneB,
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        Swal.fire({ title: 'A/B Test Dibuat!', text: `2 Varian postingan telah dijadwalkan (ID: ${data.ab_test_id}).`, icon: 'success' });
      }
      onSuccess();
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
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
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setFetchingBestTime(false);
    }
  };

  const handleGenerateAIImage = async () => {
    if (!aiImagePrompt.trim()) {
      return Swal.fire('Error', 'Masukkan prompt gambar terlebih dahulu', 'error');
    }
    if (aiImagePrompt.trim().length < 10) {
      return Swal.fire('Error', 'Prompt minimal 10 karakter', 'warning');
    }
    setGeneratingImage(true);
    Swal.fire({ title: 'AI sedang membuat gambar...', text: 'Ini bisa memakan waktu beberapa detik', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/media/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: formUnit,
          prompt: aiImagePrompt,
          size: '1024x1024',
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      selectFromGallery(data.url);
      setAiImagePrompt('');
      Swal.fire({ title: 'Gambar AI Berhasil!', text: 'Gambar fotorealistik siap digunakan.', icon: 'success', timer: 3000, showConfirmButton: false });
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4">
      <div className="space-y-6">

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2 rounded-xl">
          <button onClick={() => setMode('manual')} className={`p-2 rounded-lg font-bold text-sm transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}>Manual</button>
          <button onClick={() => setMode('autopilot')} className={`p-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-1 ${mode === 'autopilot' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-200'}`}><Wand2 size={14}/> Auto-Pilot</button>
          <button onClick={() => setMode('abtest')} className={`p-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-1 ${mode === 'abtest' ? 'bg-fuchsia-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-200'}`}>🔬 A/B Test</button>
        </div>

        {/* Akun & Tipe */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">Unit Bisnis</label>
            <select value={formUnit} onChange={e => { setFormUnit(e.target.value); setSelectedAccounts([]); }} className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 font-bold text-slate-900">
              {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Akun Tujuan (centang semua)</label>
            <div className="grid grid-cols-2 gap-2">
              {filteredAccounts.length === 0 && (
                <p className="col-span-2 text-sm text-slate-400 py-2">Tidak ada akun terhubung. Tambahkan di Pengaturan.</p>
              )}
              {filteredAccounts.map(acc => {
                const isSelected = selectedAccounts.includes(acc.id);
                const IconEl = platformIconComponents[acc.platform] || <Camera size={14} />;
                const name = platformNames[acc.platform] || acc.platform;
                return (
                  <label key={acc.id} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-bold ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleAccount(acc.id)} className="sr-only" />
                    <span className="text-slate-400">{IconEl}</span>
                    <span className="truncate">{name}</span>
                  </label>
                );
              })}
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
                <button key={type.id} onClick={() => { setPostType(type.id); setMediaUrls([]); }} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border-2 font-bold text-sm transition-all ${postType === type.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
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
            <div className="flex gap-2">
              <button onClick={() => { setRenderMode('satori'); setShowCanvas(true); }} className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-md hover:bg-amber-100 flex items-center gap-1 border border-amber-200">
                <Sparkles size={12}/> AI Canvas
              </button>
              <button onClick={() => setShowGallery(true)} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-100 border border-indigo-200">
                Pilih dari Galeri
              </button>
            </div>
          </div>

          <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex gap-2 mb-3">
              <button onClick={() => setRenderMode('satori')} className={`flex-1 p-2 rounded-lg font-bold text-xs transition-all ${renderMode === 'satori' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>
                <Sparkles size={12} className="inline mr-1"/> Tipografi (Satori)
              </button>
              <button onClick={() => setRenderMode('ai_image')} className={`flex-1 p-2 rounded-lg font-bold text-xs transition-all ${renderMode === 'ai_image' ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>
                <ImagePlus size={12} className="inline mr-1"/> Fotorealistik (AI)
              </button>
            </div>
            {renderMode === 'ai_image' && (
              <div className="flex gap-2">
                <input type="text" value={aiImagePrompt} onChange={e => setAiImagePrompt(e.target.value)} placeholder="Prompt: Foto sinematik kopi di pagi hari..." className="flex-1 p-2 text-xs border border-fuchsia-200 rounded-lg focus:ring-2 focus:ring-fuchsia-400 bg-white font-medium text-slate-700" onKeyDown={e => e.key === 'Enter' && handleGenerateAIImage()} />
                <button onClick={handleGenerateAIImage} disabled={generatingImage || !aiImagePrompt.trim()} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                  {generatingImage ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>}
                  {generatingImage ? '...' : 'Generate'}
                </button>
              </div>
            )}
          </div>

          {(mediaUrls.length === 0 || postType === 'carousel') && (
            <div {...getRootProps()} className={`mb-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center text-indigo-600"><Loader2 className="animate-spin mb-1" size={24} /><p className="font-bold text-sm">Mengunggah...</p></div>
              ) : (
                <div className="text-slate-500 text-sm font-medium">Klik atau Drag media ke sini</div>
              )}
            </div>
          )}

          {mediaUrls.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {mediaUrls.map((url, index) => (
                <div key={index} className="flex-shrink-0 relative w-24 h-24 border border-slate-200 rounded-xl overflow-hidden group cursor-move bg-slate-100" draggable={postType === 'carousel'} onDragStart={() => (dragItem.current = index)} onDragEnter={() => (dragOverItem.current = index)} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()}>
                  {postType === 'carousel' && <div className="absolute top-1 left-1 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"><GripVertical size={14}/></div>}
                  {url.includes('.mp4') ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover" alt={`media-${index}`} />}
                  <button onClick={() => removeMedia(index)} className="absolute top-1 right-1 bg-white/90 hover:bg-red-100 text-red-500 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"><X size={14}/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Caption Area */}
        {mode !== 'manual' ? (
          <div className={`p-5 rounded-2xl border shadow-sm ${mode === 'abtest' ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-indigo-50 border-indigo-200'}`}>
            <label className={`block text-sm font-bold mb-2 ${mode === 'abtest' ? 'text-fuchsia-900' : 'text-indigo-900'}`}>Ide Konten / Topik Utama</label>
            <textarea value={autoPilotIdea} onChange={e => setAutoPilotIdea(e.target.value)} rows={3} className={`w-full p-3 border rounded-lg focus:ring-2 bg-white font-medium text-slate-800 ${mode === 'abtest' ? 'border-fuchsia-200 focus:ring-fuchsia-500' : 'border-indigo-200 focus:ring-indigo-500'}`} placeholder="Contoh: Promo kemerdekaan diskon 50%, ajak orang untuk beli hari ini juga!" />
            {mode === 'abtest' && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-fuchsia-900 mb-1">Tone Varian A</label><input type="text" value={toneA} onChange={e => setToneA(e.target.value)} className="w-full p-2 border border-fuchsia-200 rounded text-sm font-medium" /></div>
                <div><label className="block text-xs font-bold text-fuchsia-900 mb-1">Tone Varian B</label><input type="text" value={toneB} onChange={e => setToneB(e.target.value)} className="w-full p-2 border border-fuchsia-200 rounded text-sm font-medium" /></div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <CaptionGenerator units={units} formUnit={formUnit} setFormUnit={setFormUnit} onCaptionSelect={setFinalCaption} />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-slate-800">Caption Final</label>
                <div className="flex gap-2">
                  <button onClick={() => setShowLibModal('captions')} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-bold">Template</button>
                  <button onClick={() => setShowLibModal('hashtags')} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-bold">Hashtag</button>
                </div>
              </div>
              <textarea value={finalCaption} onChange={e => setFinalCaption(e.target.value)} rows={4} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm mb-1" />
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-400">{finalCaption.length}/2200 karakter</span>
                {hashtagCount(finalCaption) > 5 && (
                  <span className="text-xs text-amber-600 flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Instagram rekomendasi maks. 5 hashtag</span>
                )}
              </div>

              {publishMode === 'lanjutan' && selectedAccounts.length > 1 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button onClick={() => setShowPerPlatformCaptions(!showPerPlatformCaptions)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    {showPerPlatformCaptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    Override Caption Per-Platform (opsional)
                  </button>
                  {showPerPlatformCaptions && (
                    <div className="space-y-2 mt-2">
                      {selectedAccounts.map(accId => {
                        const acc = accounts.find(a => a.id === accId);
                        if (!acc) return null;
                        const IconEl = platformIconComponents[acc.platform] || <Camera size={14} />;
                        const name = platformNames[acc.platform] || acc.platform;
                        const maxLen = acc.platform === 'tiktok' ? 150 : 2200;
                        const hCount = hashtagCount(platformCaptions[accId] || '');
                        return (
                          <div key={accId} className="p-2 border border-slate-200 rounded-lg bg-slate-50">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><span className="text-slate-400">{IconEl}</span> {name}</span>
                              <span className="text-[10px] text-slate-400">{(platformCaptions[accId] || '').length}/{maxLen}</span>
                            </div>
                            <textarea value={platformCaptions[accId] || ''} onChange={e => setPlatformCaptions(prev => ({ ...prev, [accId]: e.target.value }))} rows={2} className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700" placeholder={`Caption khusus untuk ${name} (kosongkan = pakai caption utama)`} />
                            {acc.platform === 'meta_ig' && hCount > 5 && (
                              <span className="text-[10px] text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle size={10} /> Instagram maks. 5 hashtag</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <label className="block text-sm font-bold text-slate-800 mb-2 mt-3">First Comment (Opsional)</label>
              <input type="text" value={firstComment} onChange={e => setFirstComment(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm" />
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
                  <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                    {mediaUrls.map((url, i) => (
                      <div key={i} className="min-w-full h-full snap-center relative flex-shrink-0">
                        {url.includes('.mp4') ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover" alt={`post-media-${i}`} />}
                        {mediaUrls.length > 1 && <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full">{i + 1}/{mediaUrls.length}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 flex flex-col items-center"><ImageIcon size={48} className="opacity-50 mb-2"/><span className="text-xs font-medium">Belum ada media</span></div>
                )}
              </div>
              <div className="p-3 flex gap-4">
                <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
                <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
              </div>
              <div className="px-4 pb-6 pt-1 max-h-[150px] overflow-y-auto">
                <p className="text-xs text-slate-800 whitespace-pre-wrap">
                  <span className="font-bold mr-1">{units.find(u => u.id === formUnit)?.brand_name || 'username'}</span>
                  {mode !== 'manual' ? <span className="italic text-slate-400">Caption akan di-generate otomatis oleh AI...</span> : (finalCaption || <span className="italic text-slate-400">Caption postingan...</span>)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            {mode !== 'manual' ? (
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 mb-2">
                  <CalendarIcon size={16} className="inline mr-1"/> {selectedAccounts.length} akun dipilih
                </p>
                <button onClick={handleAIGenerate} disabled={saving} className={`w-full text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-70 text-lg ${mode === 'abtest' ? 'bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 hover:from-fuchsia-600 hover:to-fuchsia-700 shadow-fuchsia-500/30' : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/30'}`}>
                  {saving ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                  {saving ? 'Memproses...' : mode === 'abtest' ? 'Generate 2 Varian A/B' : 'Auto-Generate & Jadwalkan'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-800">Tanggal & Waktu</label>
                  <button onClick={handleBestTime} disabled={fetchingBestTime} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50">
                    {fetchingBestTime ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI Best Time
                  </button>
                </div>
                <input type="datetime-local" value={scheduledDate ? format(scheduledDate as Date, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setScheduledDate(new Date(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium" />
                <button onClick={handleSaveManual} disabled={saving} className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-70 text-lg">
                  {saving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                  {saving ? 'Menyimpan...' : `Simpan ke ${selectedAccounts.length} Akun`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showGallery && <MediaGalleryModal businessUnitId={formUnit} onSelect={selectFromGallery} onClose={() => setShowGallery(false)} />}
      {showCanvas && <AICanvasModal unit={units.find(u => u.id === formUnit) || null} onClose={() => setShowCanvas(false)} onSuccess={(url) => { selectFromGallery(url); setShowCanvas(false); }} />}
      {showLibModal && <LibrarySelectorModal type={showLibModal} businessUnitId={formUnit} onClose={() => setShowLibModal(null)} onSelect={(content) => { if (showLibModal === 'hashtags') { setFinalCaption(prev => prev ? prev + '\n\n' + content : content); setShowLibModal(null); } else { setFinalCaption(prev => prev ? prev + '\n' + content : content); setShowLibModal(null); } }} />}
    </div>
  );
}
