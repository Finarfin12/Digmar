"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Loader2, Copy, Trash2, UploadCloud, FileText, Hash, Plus, Folder } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ContentLibrary() {
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'media' | 'captions' | 'hashtags'>('media');
  
  // Data states
  const [media, setMedia] = useState<any[]>([]);
  const [captions, setCaptions] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Forms
  const [showCaptionForm, setShowCaptionForm] = useState(false);
  const [newCaption, setNewCaption] = useState({ title: '', content: '' });
  
  const [showHashtagForm, setShowHashtagForm] = useState(false);
  const [newHashtag, setNewHashtag] = useState({ title: '', tags: '' });

  // Fetch Business Units
  useEffect(() => {
    fetch('/api/units').then(res => res.json()).then(data => {
      setUnits(data || []);
      if (data && data.length > 0) setSelectedUnit(data[0].id);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedUnit) return;
    setLoading(true);
    
    const [mediaRes, capRes, hashRes] = await Promise.all([
      fetch(`/api/library/media?business_unit_id=${selectedUnit}`),
      fetch(`/api/library/captions?business_unit_id=${selectedUnit}`),
      fetch(`/api/library/hashtags?business_unit_id=${selectedUnit}`)
    ]);

    setMedia(await mediaRes.json().catch(() => []));
    setCaptions(await capRes.json().catch(() => []));
    setHashtags(await hashRes.json().catch(() => []));
    
    setLoading(false);
  }, [selectedUnit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Media Upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedUnit) return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu!', 'error');
    setUploading(true);
    let successCount = 0;

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('business_unit_id', selectedUnit);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) successCount++;
    }

    setUploading(false);
    if (successCount > 0) {
      fetchData();
      Swal.fire('Berhasil', `${successCount} media berhasil diunggah!`, 'success');
    }
  }, [selectedUnit, fetchData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'video/*': ['.mp4'] }
  });

  const handleDelete = async (type: 'media' | 'captions' | 'hashtags', id: string) => {
    const res = await Swal.fire({
      title: 'Hapus Item?',
      text: 'Item ini akan dihapus secara permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (res.isConfirmed) {
      const endpoint = `/api/library/${type}?id=${id}`;
      const delRes = await fetch(endpoint, { method: 'DELETE' });
      if (delRes.ok) {
        Swal.fire('Terhapus', 'Item berhasil dihapus.', 'success');
        fetchData();
      }
    }
  };

  const handleSaveCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/library/captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_unit_id: selectedUnit, ...newCaption })
    });
    if (res.ok) {
      setShowCaptionForm(false);
      setNewCaption({ title: '', content: '' });
      fetchData();
    }
  };

  const handleSaveHashtag = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = newHashtag.tags.split(' ').map(t => t.trim()).filter(t => t.startsWith('#'));
    const res = await fetch('/api/library/hashtags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_unit_id: selectedUnit, title: newHashtag.title, hashtags: tagsArray })
    });
    if (res.ok) {
      setShowHashtagForm(false);
      setNewHashtag({ title: '', tags: '' });
      fetchData();
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ title: 'Tersalin!', icon: 'success', timer: 1000, showConfirmButton: false });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-3 rounded-xl shadow-sm">
            <Folder className="text-indigo-600" size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Content Library</h2>
            <p className="text-slate-600 mt-1 font-medium">Manajemen aset media, template caption, dan bank hashtag per bisnis.</p>
          </div>
        </div>

        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center min-w-[250px]">
          <select 
            value={selectedUnit} 
            onChange={e => setSelectedUnit(e.target.value)}
            className="w-full bg-transparent font-bold text-slate-800 focus:outline-none"
          >
            {units.length === 0 && <option value="">Tidak ada Unit Bisnis</option>}
            {units.map(u => (
              <option key={u.id} value={u.id}>📁 {u.brand_name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-200/50 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('media')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'media' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ImageIcon size={18}/> Media
        </button>
        <button onClick={() => setActiveTab('captions')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'captions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText size={18}/> Captions
        </button>
        <button onClick={() => setActiveTab('hashtags')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'hashtags' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Hash size={18}/> Hashtags
        </button>
      </div>

      {!selectedUnit ? (
        <div className="text-center p-12 bg-white rounded-2xl border-2 border-dashed">Pilih atau buat Unit Bisnis terlebih dahulu.</div>
      ) : loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>
      ) : (
        <>
          {/* MEDIA TAB */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors bg-white ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="flex flex-col items-center text-indigo-600"><Loader2 className="animate-spin mb-4" size={48} /><p className="font-bold">Mengunggah media...</p></div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <UploadCloud size={64} className="mb-4 text-slate-400" />
                    <p className="font-bold text-slate-700 text-lg">Drag & drop aset ke Folder {units.find(u=>u.id===selectedUnit)?.brand_name}</p>
                    <p className="text-sm mt-2">Mendukung JPG, PNG, MP4.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {media.map(file => (
                  <div key={file.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    {file.mime_type?.startsWith('video') ? (
                      <video src={file.public_url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={file.public_url} alt={file.file_name} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-3">
                      <button onClick={() => copyText(file.public_url)} className="bg-white text-slate-900 p-2 rounded-full"><Copy size={20}/></button>
                      <button onClick={() => handleDelete('media', file.id)} className="bg-red-500 text-white p-2 rounded-full"><Trash2 size={20}/></button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3">
                      <p className="text-white text-xs truncate">{file.file_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAPTIONS TAB */}
          {activeTab === 'captions' && (
            <div className="space-y-6">
              {!showCaptionForm ? (
                <button onClick={() => setShowCaptionForm(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={20}/> Tambah Template Caption
                </button>
              ) : (
                <form onSubmit={handleSaveCaption} className="bg-white p-6 rounded-2xl border shadow-sm">
                  <h3 className="font-bold mb-4">Template Baru</h3>
                  <input required value={newCaption.title} onChange={e => setNewCaption({...newCaption, title: e.target.value})} placeholder="Judul (Misal: Promo Akhir Tahun)" className="w-full p-3 border rounded-lg mb-4" />
                  <textarea required value={newCaption.content} onChange={e => setNewCaption({...newCaption, content: e.target.value})} rows={4} placeholder="Isi Caption..." className="w-full p-3 border rounded-lg mb-4" />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold">Simpan</button>
                    <button type="button" onClick={() => setShowCaptionForm(false)} className="bg-slate-200 text-slate-700 px-5 py-2 rounded-lg font-bold">Batal</button>
                  </div>
                </form>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {captions.map(c => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group">
                    <button onClick={() => handleDelete('captions', c.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                    <h4 className="font-bold text-slate-900 mb-2">{c.title}</h4>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg italic line-clamp-3 mb-3">{c.content}</p>
                    <button onClick={() => copyText(c.content)} className="text-indigo-600 text-sm font-bold flex items-center gap-1"><Copy size={14}/> Salin Teks</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HASHTAGS TAB */}
          {activeTab === 'hashtags' && (
            <div className="space-y-6">
              {!showHashtagForm ? (
                <button onClick={() => setShowHashtagForm(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={20}/> Tambah Bank Hashtag
                </button>
              ) : (
                <form onSubmit={handleSaveHashtag} className="bg-white p-6 rounded-2xl border shadow-sm">
                  <h3 className="font-bold mb-4">Grup Hashtag Baru</h3>
                  <input required value={newHashtag.title} onChange={e => setNewHashtag({...newHashtag, title: e.target.value})} placeholder="Nama Grup (Misal: Kumpulan Hashtag Fashion)" className="w-full p-3 border rounded-lg mb-4" />
                  <input required value={newHashtag.tags} onChange={e => setNewHashtag({...newHashtag, tags: e.target.value})} placeholder="#OOTD #FashionPria #BajuMurah (Pisahkan dengan spasi)" className="w-full p-3 border rounded-lg mb-4" />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold">Simpan</button>
                    <button type="button" onClick={() => setShowHashtagForm(false)} className="bg-slate-200 text-slate-700 px-5 py-2 rounded-lg font-bold">Batal</button>
                  </div>
                </form>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                {hashtags.map(h => (
                  <div key={h.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group">
                    <button onClick={() => handleDelete('hashtags', h.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                    <h4 className="font-bold text-slate-900 mb-3">{h.title}</h4>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {h.hashtags.map((tag: string, i: number) => (
                        <span key={i} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">{tag}</span>
                      ))}
                    </div>
                    <button onClick={() => copyText(h.hashtags.join(' '))} className="text-indigo-600 text-sm font-bold flex items-center gap-1"><Copy size={14}/> Salin Semua</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
