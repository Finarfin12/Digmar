"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Save, Calendar, Copy, RefreshCw, ChevronDown, ChevronUp, Clock, History, Loader2, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';

export default function ContentGenerator() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  
  // Input State
  const [prompt, setPrompt] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Instagram']);
  const [tone, setTone] = useState('Profesional & Informatif');
  const [showPlatforms, setShowPlatforms] = useState(false);
  
  // Brand Voice State
  const [showBrandVoice, setShowBrandVoice] = useState(false);
  const [brandVoice, setBrandVoice] = useState({ tone_guidelines: '', dos: [''], donts: [''] });
  const [savingBrandVoice, setSavingBrandVoice] = useState(false);

  // Output State
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState({ caption: '', hashtags: '', thread: '' });
  const [activeTab, setActiveTab] = useState<'caption' | 'hashtags' | 'thread'>('caption');

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const availablePlatforms = ['Instagram', 'Threads', 'Facebook', 'TikTok'];
  const tones = ['Profesional & Informatif', 'Humor & Santai', 'Inspiratif & Memotivasi', 'Persuasif (Jualan)', 'Edukasi & Tips'];

  useEffect(() => {
    fetch('/api/units').then(res => res.json()).then(data => {
      setUnits(data || []);
      if (data && data.length > 0) setSelectedUnit(data[0].id);
    });
  }, []);

  const loadBrandVoice = useCallback(async () => {
    if (!selectedUnit) return;
    try {
      const res = await fetch(`/api/ai/brand-voice?business_unit_id=${selectedUnit}`);
      if (res.ok) {
        const data = await res.json();
        setBrandVoice({
          tone_guidelines: data.tone_guidelines || '',
          dos: data.dos && data.dos.length > 0 ? data.dos : [''],
          donts: data.donts && data.donts.length > 0 ? data.donts : ['']
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, [selectedUnit]);

  const loadHistory = useCallback(async () => {
    if (!selectedUnit) return;
    try {
      const res = await fetch(`/api/ai/history?business_unit_id=${selectedUnit}`);
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedUnit) {
      loadBrandVoice();
      loadHistory();
    }
  }, [selectedUnit, loadBrandVoice, loadHistory]);

  const handleSaveBrandVoice = async () => {
    setSavingBrandVoice(true);
    try {
      const filteredDos = brandVoice.dos.filter(d => d.trim() !== '');
      const filteredDonts = brandVoice.donts.filter(d => d.trim() !== '');
      const res = await fetch('/api/ai/brand-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: selectedUnit,
          tone_guidelines: brandVoice.tone_guidelines,
          dos: filteredDos,
          donts: filteredDonts
        })
      });
      if (res.ok) {
        Swal.fire({ title: 'Tersimpan', text: 'Brand Voice berhasil diperbarui', icon: 'success', timer: 1500, showConfirmButton: false });
        setShowBrandVoice(false);
      } else {
        throw new Error(await res.text());
      }
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setSavingBrandVoice(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return Swal.fire('Error', 'Content brief tidak boleh kosong', 'warning');
    if (platforms.length === 0) return Swal.fire('Error', 'Pilih minimal 1 platform', 'warning');

    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: selectedUnit,
          prompt,
          platforms,
          tone
        })
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Gagal generate konten');
      
      const data = await res.json();
      setOutput({
        caption: data.caption || '',
        hashtags: data.hashtags || '',
        thread: data.thread || ''
      });
      
      // Select appropriate tab
      if (platforms.includes('Threads') && data.thread) setActiveTab('thread');
      else setActiveTab('caption');

      loadHistory();
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ title: 'Tersalin!', icon: 'success', timer: 1000, showConfirmButton: false });
  };

  const handleSchedule = () => {
    const draftText = `${output.caption}\n\n${output.hashtags}`.trim();
    if (!draftText) return Swal.fire('Error', 'Tidak ada konten untuk dijadwalkan', 'warning');
    
    // Redirect to planner with idea and manual mode
    router.push(`/planner?idea=${encodeURIComponent(draftText)}&mode=manual`);
  };

  const handleSaveToLibrary = async () => {
    if (!output.caption) return;
    try {
      const res = await fetch('/api/library/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_unit_id: selectedUnit, 
          title: prompt.substring(0, 30) + '...',
          content: `${output.caption}\n\n${output.hashtags}`
        })
      });
      if (res.ok) {
        Swal.fire('Berhasil', 'Disimpan ke Content Library', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadFromHistory = (item: any) => {
    setPrompt(item.prompt);
    setTone(item.tone || 'Profesional & Informatif');
    setPlatforms(item.platform ? item.platform.split(', ') : ['Instagram']);
    setOutput({
      caption: item.output_caption || '',
      hashtags: item.output_hashtags || '',
      thread: item.output_thread || ''
    });
    setShowHistory(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-3.5 rounded-2xl">
            <Sparkles className="text-indigo-600" size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Content Generator</h2>
            <p className="text-slate-500 font-medium mt-1">Brainstorming, draft, dan review konten media sosial dengan AI.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            <History size={18}/> Riwayat AI
          </button>
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <select 
              value={selectedUnit} 
              onChange={e => setSelectedUnit(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none pl-2 pr-4 py-1"
            >
              {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT PANEL - INPUT */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">1. Content Brief</h3>
            <textarea
              className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 placeholder:text-slate-400 font-medium"
              placeholder="Jelaskan apa yang ingin Anda buat. Contoh: Buatkan postingan Instagram tentang fitur baru DigiMar yaitu Auto-Queue. Target audiens adalah Social Media Manager..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tone & Voice</label>
                <select value={tone} onChange={e=>setTone(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-900">
                  {tones.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Platform</label>
                <div className="relative">
                  <button type="button" onClick={() => setShowPlatforms(!showPlatforms)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-left flex justify-between items-center group text-slate-900">
                    <span className="truncate">{platforms.join(', ') || 'Pilih...'}</span>
                    <ChevronDown size={16} className="text-slate-400"/>
                  </button>
                  {showPlatforms && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-xl p-2 z-10">
                    {availablePlatforms.map(p => (
                      <label key={p} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={platforms.includes(p)} onChange={(e) => {
                          if (e.target.checked) setPlatforms([...platforms, p]);
                          else setPlatforms(platforms.filter(x => x !== p));
                        }} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                        <span className="text-sm font-medium text-slate-900">{p}</span>
                      </label>
                    ))}
                  </div>
                  )}
                </div>
              </div>
            </div>

            {/* Brand Voice Toggle */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button 
                onClick={() => setShowBrandVoice(!showBrandVoice)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500"/> Brand Voice Settings
                </span>
                {showBrandVoice ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
              </button>
              
              {showBrandVoice && (
                <div className="mt-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="text-xs font-bold text-amber-800 mb-1 block">Tone Guidelines (Opsional)</label>
                    <textarea 
                      value={brandVoice.tone_guidelines} onChange={e=>setBrandVoice({...brandVoice, tone_guidelines: e.target.value})}
                      className="w-full p-2.5 bg-white border border-amber-200 rounded-xl text-sm outline-none focus:border-amber-400 text-slate-900"
                      placeholder="Kami berbicara seperti seorang pakar namun tetap ramah dan suportif..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-emerald-700 mb-1 block">DO&apos;s (Harus Dilakukan)</label>
                      {brandVoice.dos.map((item, i) => (
                        <input key={i} value={item} onChange={e => {
                          const newDos = [...brandVoice.dos];
                          newDos[i] = e.target.value;
                          setBrandVoice({...brandVoice, dos: newDos});
                        }} placeholder="Gunakan kata 'Kita'" className="w-full p-2 mb-2 bg-white border border-emerald-200 rounded-lg text-sm outline-none text-slate-900"/>
                      ))}
                      <button onClick={() => setBrandVoice({...brandVoice, dos: [...brandVoice.dos, '']})} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">+ Tambah DO</button>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-rose-700 mb-1 block">DON&apos;Ts (Dilarang)</label>
                      {brandVoice.donts.map((item, i) => (
                        <input key={i} value={item} onChange={e => {
                          const newDonts = [...brandVoice.donts];
                          newDonts[i] = e.target.value;
                          setBrandVoice({...brandVoice, donts: newDonts});
                        }} placeholder="Hindari sapaan kaku" className="w-full p-2 mb-2 bg-white border border-rose-200 rounded-lg text-sm outline-none text-slate-900"/>
                      ))}
                      <button onClick={() => setBrandVoice({...brandVoice, donts: [...brandVoice.donts, '']})} className="text-xs font-bold text-rose-600 hover:text-rose-700">+ Tambah DONT</button>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button onClick={handleSaveBrandVoice} disabled={savingBrandVoice} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                      {savingBrandVoice ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Simpan Panduan
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleGenerate} disabled={generating}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20}/>}
              {generating ? 'Sedang meracik konten...' : 'Generate Konten'}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL - OUTPUT */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900">2. Review & Automate</h3>
              {output.caption && (
                <div className="flex items-center gap-2">
                  <button onClick={handleGenerate} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors" title="Regenerate"><RefreshCw size={16}/> Regenerate</button>
                </div>
              )}
            </div>

            {!output.caption && !generating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Sparkles size={48} className="text-indigo-200 mb-4"/>
                <h4 className="text-lg font-bold text-slate-700 mb-2">Area Teks Generator</h4>
                <p className="text-slate-500 text-sm max-w-sm">Tulis content brief di sebelah kiri dan biarkan AI meracik caption, hashtag, serta thread yang menarik untuk Anda.</p>
              </div>
            )}

            {generating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <Loader2 size={48} className="text-indigo-500 animate-spin mb-4"/>
                <p className="font-bold text-indigo-900 animate-pulse">Menghasilkan keajaiban...</p>
              </div>
            )}

            {output.caption && !generating && (
              <div className="flex-1 flex flex-col">
                <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl w-fit mb-4">
                  <button onClick={() => setActiveTab('caption')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'caption' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Caption Utama</button>
                  <button onClick={() => setActiveTab('hashtags')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'hashtags' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Hashtags</button>
                  {output.thread && <button onClick={() => setActiveTab('thread')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'thread' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Thread (Khusus)</button>}
                </div>

                <div className="flex-1 min-h-[300px]">
                  {activeTab === 'caption' && (
                    <textarea 
                      value={output.caption} 
                      onChange={e => setOutput({...output, caption: e.target.value})}
                      className="w-full h-full min-h-[300px] p-4 bg-white border border-slate-200 rounded-2xl resize-y focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 leading-relaxed"
                    />
                  )}
                  {activeTab === 'hashtags' && (
                    <textarea 
                      value={output.hashtags} 
                      onChange={e => setOutput({...output, hashtags: e.target.value})}
                      className="w-full h-full min-h-[300px] p-4 bg-white border border-slate-200 rounded-2xl resize-y focus:ring-2 focus:ring-indigo-500 outline-none text-blue-600 leading-relaxed font-medium"
                    />
                  )}
                  {activeTab === 'thread' && (
                    <textarea 
                      value={output.thread} 
                      onChange={e => setOutput({...output, thread: e.target.value})}
                      className="w-full h-full min-h-[300px] p-4 bg-white border border-slate-200 rounded-2xl resize-y focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 leading-relaxed"
                    />
                  )}
                </div>

                {/* Quick Actions */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveToLibrary} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                      <Save size={18}/> Simpan ke Library
                    </button>
                    <button onClick={() => copyToClipboard(activeTab === 'caption' ? output.caption : activeTab === 'hashtags' ? output.hashtags : output.thread)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                      <Copy size={18}/> Copy Teks
                    </button>
                  </div>
                  <button onClick={handleSchedule} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition-colors shadow-sm">
                    <Calendar size={18}/> Jadwalkan Sekarang
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><History className="text-indigo-500"/> Riwayat Generator</h3>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ChevronDown className="rotate-90 text-slate-500"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {history.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">Belum ada riwayat untuk unit bisnis ini.</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} onClick={() => loadFromHistory(item)} className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Clock size={12}/> {new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                      <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">{item.platform}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">{item.prompt}</p>
                    <p className="text-xs font-medium text-slate-500 line-clamp-1">{item.output_caption}</p>
                    <div className="mt-3 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Gunakan draf ini →</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
