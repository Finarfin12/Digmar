"use client";

import { useState, useEffect } from 'react';
import { Settings2, PlusCircle, Key, Link as LinkIcon, Share2, Briefcase, Save, X, Eye, EyeOff } from 'lucide-react';
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
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialUser, setSocialUser] = useState('');
  const [socialToken, setSocialToken] = useState('');
  const [showSocialToken, setShowSocialToken] = useState(false);

  // AI Form
  const [aiName, setAiName] = useState('groq');
  const [aiModel, setAiModel] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);

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

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: unitName, category: unitCategory, ai_system_prompt: unitPrompt })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'Unit Bisnis berhasil ditambahkan.', 'success');
      setShowUnitForm(false);
      setUnitName(''); setUnitCategory(''); setUnitPrompt('');
      fetchData();
    } else {
      Swal.fire('Error', 'Gagal menyimpan unit', 'error');
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
      Swal.fire('Berhasil!', 'Akun Sosial berhasil dihubungkan & token dienkripsi.', 'success');
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
        model: aiModel,
        api_key: aiKey
      })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'API Key AI berhasil disimpan & dienkripsi.', 'success');
      setShowAiForm(false);
      setAiModel(''); setAiKey('');
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Pengaturan</h2>
          <p className="text-slate-500 mt-1">Konfigurasi tingkat lanjut untuk produksi: API Keys & Integrasi.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('units')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'units' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Unit Bisnis</button>
        <button onClick={() => setActiveTab('social')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'social' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Akun Sosial (Instagram/Meta)</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>AI Provider (Groq/OpenAI)</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all">
        {activeTab === 'units' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="text-indigo-500" size={20}/> Unit Bisnis</h3>
                <p className="text-slate-500 text-sm mt-1">Daftar entitas brand yang menjadi payung untuk setiap akun sosial.</p>
              </div>
              {!showUnitForm && (
                <button onClick={() => setShowUnitForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all">
                  <PlusCircle size={18} /> Tambah Unit
                </button>
              )}
            </div>

            {showUnitForm && (
              <form onSubmit={handleSaveUnit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800">Form Unit Bisnis Baru</h4>
                  <button type="button" onClick={() => setShowUnitForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Unit</label>
                    <input required value={unitName} onChange={e => setUnitName(e.target.value)} type="text" placeholder="Misal: Divisi Marketing A" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori/Industri</label>
                    <input value={unitCategory} onChange={e => setUnitCategory(e.target.value)} type="text" placeholder="Misal: F&B, Retail, Edukasi" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">AI System Prompt Khusus (Opsional)</label>
                    <textarea value={unitPrompt} onChange={e => setUnitPrompt(e.target.value)} rows={3} placeholder="Instruksi khusus untuk AI saat membuat konten untuk unit ini..." className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                  </div>
                  <button disabled={loading} type="submit" className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
                    {loading ? 'Menyimpan...' : <><Save size={18}/> Simpan Unit Bisnis</>}
                  </button>
                </div>
              </form>
            )}

            {units.length === 0 && !showUnitForm ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada unit bisnis terdaftar. Anda harus membuat satu terlebih dahulu.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {units.map((u: any) => (
                  <div key={u.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-white">
                    <div className="font-bold text-lg text-slate-800">{u.name}</div>
                    <div className="text-sm text-indigo-600 font-medium">{u.category}</div>
                    <div className="text-xs text-slate-500 mt-3 truncate">{u.ai_system_prompt || 'Tidak ada custom prompt'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'social' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Share2 className="text-pink-500" size={20}/> Integrasi Meta / Instagram API</h3>
                <p className="text-slate-500 text-sm mt-1">Masukkan ID Pengguna Instagram dan Access Token Graph API Anda.</p>
              </div>
              {!showSocialForm && (
                <button onClick={() => setShowSocialForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all">
                  <PlusCircle size={18} /> Hubungkan API
                </button>
              )}
            </div>

            {showSocialForm && (
              <form onSubmit={handleSaveSocial} autoComplete="off" className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800">Form Kredensial Meta API</h4>
                  <button type="button" onClick={() => setShowSocialForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                {units.length === 0 ? (
                  <div className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4">Anda harus membuat Unit Bisnis terlebih dahulu di tab sebelah!</div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Target Unit Bisnis</label>
                        <select required value={socialUnit} onChange={e => setSocialUnit(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white">
                          <option value="" disabled>Pilih Unit...</option>
                          {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Platform</label>
                        <select value={socialPlatform} onChange={e => setSocialPlatform(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white">
                          <option value="instagram">Instagram Graph API</option>
                          <option value="threads">Threads API</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Instagram Business Account ID</label>
                      <input required value={socialUser} onChange={e => setSocialUser(e.target.value)} type="text" placeholder="Misal: 17841400000000000" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" autoComplete="new-password" />
                      <p className="text-xs text-slate-500 mt-1">ID Angka unik dari Meta Developer Portal.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Long-Lived Access Token</label>
                      <div className="relative">
                        <input required value={socialToken} onChange={e => setSocialToken(e.target.value)} type={showSocialToken ? "text" : "password"} placeholder="EAAG..." className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none font-mono text-sm" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowSocialToken(!showSocialToken)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                          {showSocialToken ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Token ini akan dienkripsi dengan AES-256-GCM di server sebelum disimpan.</p>
                    </div>
                    <button disabled={loading} type="submit" className="mt-2 bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
                      {loading ? 'Mengenkripsi & Menyimpan...' : <><Save size={18}/> Simpan Akses Sosmed</>}
                    </button>
                  </div>
                )}
              </form>
            )}

            {accounts.length === 0 && !showSocialForm ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada API Sosial Media yang terhubung.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((a: any) => (
                  <div key={a.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-pink-50/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg text-slate-800 capitalize">{a.platform}</div>
                        <div className="text-sm text-slate-600 font-mono mt-1">ID: {a.ig_user_id}</div>
                      </div>
                      <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">API Terkoneksi</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Key className="text-amber-500" size={20}/> Integrasi AI Provider (Groq/OpenAI)</h3>
                <p className="text-slate-500 text-sm mt-1">Masukkan API Key asli dari layanan AI pilihan Anda untuk digenerate oleh sistem.</p>
              </div>
              {!showAiForm && (
                <button onClick={() => setShowAiForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all">
                  <PlusCircle size={18} /> Tambah API Key
                </button>
              )}
            </div>

            {showAiForm && (
              <form onSubmit={handleSaveAi} autoComplete="off" className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800">Form Kredensial AI API</h4>
                  <button type="button" onClick={() => setShowAiForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Provider Utama</label>
                      <select required value={aiName} onChange={e => setAiName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white">
                        <option value="groq">Groq (Cepat & Murah)</option>
                        <option value="openai">OpenAI (Akurat)</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="vps">Lokal VPS Lama3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Spesifik Model (Opsional)</label>
                      <input value={aiModel} onChange={e => setAiModel(e.target.value)} type="text" placeholder="Misal: llama-3.3-70b-versatile" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" autoComplete="new-password" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Secret API Key</label>
                    <div className="relative">
                      <input required value={aiKey} onChange={e => setAiKey(e.target.value)} type={showAiKey ? "text" : "password"} placeholder="gsk_... / sk-..." className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono text-sm" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowAiKey(!showAiKey)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                        {showAiKey ? <EyeOff size={20}/> : <Eye size={20}/>}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">API Key dienkripsi level militer (AES-256-GCM) di *database* Supabase.</p>
                  </div>
                  <button disabled={loading} type="submit" className="mt-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
                    {loading ? 'Mengenkripsi & Menyimpan...' : <><Save size={18}/> Simpan Kunci AI</>}
                  </button>
                </div>
              </form>
            )}

            {providers.length === 0 && !showAiForm ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada API Key AI yang disimpan. Sistem akan menggunakan fallback env variable jika ada.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((p: any) => (
                  <div key={p.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg text-slate-800 capitalize">{p.provider_name}</div>
                        <div className="text-sm text-slate-600 font-mono mt-1">Model: {p.model || 'Default API'}</div>
                      </div>
                      {p.has_key && <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">API Key Aktif</div>}
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
