"use client";

import { useState, useEffect } from 'react';
import { Settings2, PlusCircle, Key, Link as LinkIcon, Share2, Briefcase, Save, X, Eye, EyeOff, Trash2, RefreshCcw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'units' | 'social' | 'ai'>('units');
  const [units, setUnits] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form states
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showSocialForm, setShowSocialForm] = useState(false);
  const [showAiForm, setShowAiForm] = useState(false);

  // Unit Form
  const [unitName, setUnitName] = useState('');
  const [unitCategory, setUnitCategory] = useState('');
  const [unitPrompt, setUnitPrompt] = useState('');

  // Social Form
  const [socialUnit, setSocialUnit] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('meta_ig');
  const [socialUser, setSocialUser] = useState('');
  const [socialToken, setSocialToken] = useState('');
  const [showSocialToken, setShowSocialToken] = useState(false);

  // AI Form
  const [aiName, setAiName] = useState('groq');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.groq.com/openai');
  const [aiModel, setAiModel] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, pRes, aRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/providers'),
        fetch('/api/accounts')
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUnits(uData);
        if (uData.length > 0 && !socialUnit) setSocialUnit(uData[0].id);
      }
      if (pRes.ok) setProviders(await pRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    const res = await Swal.fire({
      title: 'Hapus Unit Bisnis?',
      text: 'Semua akun sosial yang terhubung ke unit ini akan ikut terhapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });
    if (!res.isConfirmed) return;
    await fetch(`/api/units/${id}`, { method: 'DELETE' });
    fetchData();
    Swal.fire('Terhapus!', 'Unit Bisnis berhasil dihapus.', 'success');
  };

  const handleDeleteSocial = async (id: string) => {
    const res = await Swal.fire({
      title: 'Hapus Koneksi Sosial?',
      text: 'DigiMar tidak akan bisa memposting ke akun ini lagi.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Putuskan Koneksi',
      cancelButtonText: 'Batal'
    });
    if (!res.isConfirmed) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    fetchData();
    Swal.fire('Terhapus!', 'Koneksi sosial berhasil dihapus.', 'success');
  };

  const handleToggleAutoReply = async (id: string, currentValue: boolean) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_reply_enabled: !currentValue })
      });
      if (!res.ok) throw new Error('Gagal update status auto-reply');
      fetchData(); // refresh data
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleDeleteAi = async (id: string) => {
    const res = await Swal.fire({
      title: 'Hapus Konfigurasi AI?',
      text: 'API Key yang tersimpan untuk provider ini akan ikut terhapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });
    if (!res.isConfirmed) return;
    await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    fetchData();
    Swal.fire('Terhapus!', 'Konfigurasi AI berhasil dihapus.', 'success');
  };

  const handleProviderChange = (e: any) => {
    const val = e.target.value;
    setAiName(val);
    setAvailableModels([]);
    if (val === 'groq') setAiBaseUrl('https://api.groq.com/openai');
    else if (val === 'openai') setAiBaseUrl('https://api.openai.com');
    else if (val === 'anthropic') setAiBaseUrl('https://api.anthropic.com');
    else setAiBaseUrl('http://YOUR_VPS_IP:PORT');
  };

  const handleFetchModels = async () => {
    if (!aiBaseUrl || !aiKey) {
      return Swal.fire('Error', 'Masukkan Base URL dan Secret API Key terlebih dahulu untuk mengambil model', 'error');
    }
    setFetchingModels(true);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: aiBaseUrl, api_key: aiKey })
      });
      if (!res.ok) throw new Error('Gagal mengambil model. Pastikan API Key dan URL benar.');
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        setAvailableModels(models);
        if (models.length > 0) setAiModel(models[0]);
        Swal.fire({ title: 'Berhasil', text: `Ditemukan ${models.length} model!`, icon: 'success', timer: 1500, showConfirmButton: false });
      } else {
        throw new Error('Format balasan API tidak dikenali.');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_name: unitName, business_category: unitCategory, ai_system_prompt: unitPrompt })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire({ title: 'Berhasil!', text: 'Unit Bisnis berhasil ditambahkan.', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowUnitForm(false);
      setUnitName(''); setUnitCategory(''); setUnitPrompt('');
      fetchData();
    } else {
      const errData = await res.json().catch(()=>({}));
      Swal.fire('Error', errData.error || 'Gagal menyimpan unit', 'error');
    }
  };

  const handleSaveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialUnit) return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu', 'error');
    setLoading(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_unit_id: socialUnit,
        platform: socialPlatform,
        ig_user_id: socialUser,
        access_token: socialToken
      })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire({ title: 'Berhasil!', text: 'Akun Sosial berhasil dihubungkan & token dienkripsi.', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowSocialForm(false);
      setSocialUser(''); setSocialToken('');
      fetchData();
    } else {
      Swal.fire('Error', 'Gagal menghubungkan akun', 'error');
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_name: aiName,
        base_url: aiBaseUrl,
        model: aiModel,
        api_key: aiKey
      })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire({ title: 'Berhasil!', text: 'API Key AI berhasil disimpan & dienkripsi.', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowAiForm(false);
      setAiModel(''); setAiKey(''); setAvailableModels([]);
      fetchData();
    } else {
      Swal.fire('Error', 'Gagal menyimpan konfigurasi AI', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center gap-3">
        <div className="bg-indigo-100 p-3 rounded-xl shadow-sm">
          <Settings2 className="text-indigo-600" size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pengaturan</h2>
          <p className="text-slate-600 mt-1 font-medium">Konfigurasi tingkat lanjut untuk produksi: API Keys & Integrasi.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-300">
        <button onClick={() => setActiveTab('units')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'units' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Unit Bisnis</button>
        <button onClick={() => setActiveTab('social')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'social' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Akun Sosial</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>AI Provider</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden transition-all">
        
        {/* UNITS TAB */}
        {activeTab === 'units' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Briefcase className="text-indigo-600" size={20}/> Unit Bisnis</h3>
                <p className="text-slate-600 text-sm mt-1">Daftar entitas brand yang menjadi payung untuk setiap akun sosial.</p>
              </div>
              {!showUnitForm && (
                <button onClick={() => setShowUnitForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
                  <PlusCircle size={18} /> Tambah Unit
                </button>
              )}
            </div>

            {showUnitForm && (
              <form onSubmit={handleSaveUnit} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-extrabold text-slate-900 text-lg">Form Unit Bisnis Baru</h4>
                  <button type="button" onClick={() => setShowUnitForm(false)} className="text-slate-500 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="grid gap-4 text-slate-900">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Nama Unit</label>
                    <input required value={unitName} onChange={e => setUnitName(e.target.value)} type="text" placeholder="Misal: Kedai Kopi Senja" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Kategori/Industri</label>
                    <input value={unitCategory} onChange={e => setUnitCategory(e.target.value)} type="text" placeholder="Misal: F&B, Retail, Edukasi" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">AI System Prompt Khusus (Opsional)</label>
                    <textarea value={unitPrompt} onChange={e => setUnitPrompt(e.target.value)} rows={3} placeholder="Instruksi khusus untuk AI saat membuat konten untuk unit ini..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400"></textarea>
                  </div>
                  <button disabled={loading} type="submit" className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-md">
                    {loading ? 'Menyimpan...' : <><Save size={18}/> Simpan Unit Bisnis</>}
                  </button>
                </div>
              </form>
            )}

            {units.length === 0 && !showUnitForm ? (
              <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">Belum ada unit bisnis terdaftar. Anda harus membuat satu terlebih dahulu.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {units.map((u: any) => (
                  <div key={u.id} className="p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white relative group">
                    <button onClick={() => handleDeleteUnit(u.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={20} />
                    </button>
                    <div className="font-extrabold text-xl text-slate-900">{u.brand_name}</div>
                    <div className="text-sm text-indigo-700 font-bold mt-1">{u.business_category || 'Tanpa Kategori'}</div>
                    <div className="text-sm text-slate-600 mt-3 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">{u.ai_system_prompt || 'Tidak ada custom prompt'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === 'social' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Share2 className="text-pink-600" size={20}/> Integrasi Meta / Instagram API</h3>
                <p className="text-slate-600 text-sm mt-1">Masukkan ID Pengguna Instagram dan Access Token Graph API Anda.</p>
              </div>
              {!showSocialForm && (
                <button onClick={() => setShowSocialForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
                  <PlusCircle size={18} /> Hubungkan API
                </button>
              )}
            </div>

            {showSocialForm && (
              <form onSubmit={handleSaveSocial} autoComplete="off" className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-extrabold text-slate-900 text-lg">Form Kredensial Meta API</h4>
                  <button type="button" onClick={() => setShowSocialForm(false)} className="text-slate-500 hover:text-red-600"><X size={24}/></button>
                </div>
                {units.length === 0 ? (
                  <div className="text-red-600 bg-red-100 p-4 rounded-lg font-bold border border-red-200 mb-4">Anda harus membuat Unit Bisnis terlebih dahulu di tab sebelah!</div>
                ) : (
                  <div className="grid gap-4 text-slate-900">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">Target Unit Bisnis</label>
                        <select required value={socialUnit} onChange={e => setSocialUnit(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white text-slate-900 font-medium">
                          <option value="" disabled>Pilih Unit...</option>
                          {units.map((u: any) => <option key={u.id} value={u.id} className="text-slate-900">{u.brand_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">Platform</label>
                        <select value={socialPlatform} onChange={e => setSocialPlatform(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white text-slate-900 font-medium">
                          <option value="meta_ig" className="text-slate-900">Instagram Graph API</option>
                          <option value="threads" className="text-slate-900">Threads API</option>
                          <option value="tiktok" className="text-slate-900">TikTok Content API</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">
                        {socialPlatform === 'tiktok' ? 'TikTok Username / Open ID' : socialPlatform === 'threads' ? 'Threads User ID' : 'Instagram Business Account ID'}
                      </label>
                      <input required value={socialUser} onChange={e => setSocialUser(e.target.value)} type="text" placeholder={socialPlatform === 'tiktok' ? "Misal: @mybrand" : "Misal: 17841400000000000"} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400" autoComplete="new-password" />
                      <p className="text-xs text-slate-600 mt-1.5 font-medium">
                        {socialPlatform === 'tiktok' ? 'Username TikTok atau Open ID dari Developer Portal.' : 'ID Angka unik dari Meta Developer Portal.'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">
                        {socialPlatform === 'tiktok' ? 'TikTok Access Token' : 'Long-Lived Access Token'}
                      </label>
                      <div className="relative">
                        <input required value={socialToken} onChange={e => setSocialToken(e.target.value)} type={showSocialToken ? "text" : "password"} placeholder="EAAG..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none font-mono text-sm bg-white text-slate-900 placeholder-slate-400" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowSocialToken(!showSocialToken)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-800">
                          {showSocialToken ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 font-medium">Token ini akan dienkripsi dengan AES-256-GCM di server sebelum disimpan.</p>
                    </div>
                    <button disabled={loading} type="submit" className="mt-2 bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-md">
                      {loading ? 'Mengenkripsi & Menyimpan...' : <><Save size={18}/> Simpan Akses Sosmed</>}
                    </button>
                  </div>
                )}
              </form>
            )}

            {accounts.length === 0 && !showSocialForm ? (
              <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">Belum ada API Sosial Media yang terhubung.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((a: any) => {
                  const unitName = units.find(u => u.id === a.business_unit_id)?.brand_name || 'Unit Tidak Dikenal';
                  return (
                    <div key={a.id} className="p-6 rounded-xl border border-pink-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-pink-50/50 relative group">
                      <button onClick={() => handleDeleteSocial(a.id)} className="absolute top-4 right-4 text-pink-300 hover:text-red-500 transition-colors">
                        <Trash2 size={20} />
                      </button>
                      <div className="flex justify-between items-start">
                        <div className="pr-8">
                          <div className="font-extrabold text-xl text-slate-900 capitalize flex items-center gap-2">
                            {a.platform} 
                            <span className="bg-green-100 text-green-700 text-xs px-2.5 py-0.5 rounded-full font-bold">API Terhubung</span>
                          </div>
                          <div className="text-sm text-pink-700 font-bold mt-2">ID: {a.ig_user_id}</div>
                          <div className="text-xs text-slate-600 font-medium mt-1 mb-3">Terikat ke: {unitName}</div>
                          
                          {a.platform === 'meta_ig' && (
                            <label className="flex items-center gap-3 cursor-pointer bg-white/60 p-2 rounded-lg border border-pink-200">
                              <div className="relative">
                                <input type="checkbox" className="sr-only" checked={!!a.auto_reply_enabled} onChange={() => handleToggleAutoReply(a.id, !!a.auto_reply_enabled)} />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${a.auto_reply_enabled ? 'bg-pink-500' : 'bg-slate-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${a.auto_reply_enabled ? 'translate-x-4' : ''}`}></div>
                              </div>
                              <div className="text-xs font-bold text-slate-700">Auto-Reply via AI</div>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AI TAB */}
        {activeTab === 'ai' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Key className="text-amber-500" size={20}/> Integrasi AI Provider (API)</h3>
                <p className="text-slate-600 text-sm mt-1">Masukkan Endpoint & API Key untuk melakukan fetch model dan konfigurasi AI.</p>
              </div>
              {!showAiForm && (
                <button onClick={() => setShowAiForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
                  <PlusCircle size={18} /> Tambah API Key
                </button>
              )}
            </div>

            {showAiForm && (
              <form onSubmit={handleSaveAi} autoComplete="off" className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-extrabold text-slate-900 text-lg">Form Kredensial AI API</h4>
                  <button type="button" onClick={() => setShowAiForm(false)} className="text-slate-500 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="grid gap-5 text-slate-900">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">Provider Utama</label>
                      <select required value={aiName} onChange={handleProviderChange} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-medium">
                        <option value="groq" className="text-slate-900">Groq (Cepat & Murah)</option>
                        <option value="openai" className="text-slate-900">OpenAI (Akurat)</option>
                        <option value="anthropic" className="text-slate-900">Anthropic Claude</option>
                        <option value="vps" className="text-slate-900">VPS / Custom Endpoint</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">Endpoint (Base URL)</label>
                      <input required value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)} type="text" placeholder="https://api.openai.com" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400" autoComplete="new-password" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Secret API Key</label>
                    <div className="relative">
                      <input required value={aiKey} onChange={e => setAiKey(e.target.value)} type={showAiKey ? "text" : "password"} placeholder="gsk_... / sk-..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono text-sm bg-white text-slate-900 placeholder-slate-400" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowAiKey(!showAiKey)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-800">
                        {showAiKey ? <EyeOff size={20}/> : <Eye size={20}/>}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 font-medium">API Key dienkripsi level militer (AES-256-GCM). Key yang lama tidak akan dihapus jika Anda membuat konfigurasi untuk Provider lain.</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Pilih Model AI (Dari Endpoint)</label>
                      {availableModels.length > 0 ? (
                        <select value={aiModel} onChange={e => setAiModel(e.target.value)} className="w-full p-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-medium">
                          {availableModels.map(m => <option key={m} value={m} className="text-slate-900">{m}</option>)}
                        </select>
                      ) : (
                        <input value={aiModel} onChange={e => setAiModel(e.target.value)} type="text" placeholder="Ketik model manual atau tekan tombol Load..." className="w-full p-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-medium placeholder-slate-400" />
                      )}
                    </div>
                    <button type="button" onClick={handleFetchModels} disabled={fetchingModels} className="shrink-0 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors">
                      <RefreshCcw size={18} className={fetchingModels ? "animate-spin" : ""} /> Load Models
                    </button>
                  </div>

                  <button disabled={loading} type="submit" className="mt-4 bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-lg font-extrabold flex justify-center items-center gap-2 transition-colors shadow-md text-lg">
                    {loading ? 'Mengenkripsi & Menyimpan...' : <><Save size={20}/> Simpan Konfigurasi AI</>}
                  </button>
                </div>
              </form>
            )}

            {providers.length === 0 && !showAiForm ? (
              <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">Belum ada API Key AI yang disimpan.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((p: any) => (
                  <div key={p.id} className="p-6 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/50 relative group">
                    <button onClick={() => handleDeleteAi(p.id)} className="absolute top-4 right-4 text-amber-300 hover:text-red-500 transition-colors">
                      <Trash2 size={20} />
                    </button>
                    <div className="flex justify-between items-start">
                      <div className="pr-8">
                        <div className="font-extrabold text-xl text-slate-900 capitalize flex items-center gap-2">
                          {p.provider_name === 'vps' ? 'VPS / Custom' : p.provider_name}
                          {p.has_key && <span className="bg-green-100 text-green-700 text-xs px-2.5 py-0.5 rounded-full font-bold">API Key Aktif</span>}
                        </div>
                        <div className="text-sm text-slate-600 font-medium mt-2 break-all">URL: {p.base_url || 'Default Endpoint'}</div>
                        <div className="text-sm text-amber-700 font-bold mt-1">Model: {p.model || 'Model Default Bawaan API'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
