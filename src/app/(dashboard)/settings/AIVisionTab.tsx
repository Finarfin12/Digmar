import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCcw, Save, Camera, PlusCircle, Trash2, X, Activity } from 'lucide-react';
import Swal from 'sweetalert2';

import { logger } from '@/lib/utils/logger'
export default function AIVisionTab() {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('https://openrouter.ai/api/v1');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [providerName, setProviderName] = useState('openrouter');
  const [savedConfig, setSavedConfig] = useState<{ url: string, model: string, hasKey: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestProvider = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/health', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_type: 'vision', base_url: url, model, api_key: key })
      });
      const data = await res.json();

      const stepsHtml = data.steps
        ? data.steps.map((s: { step: string; status: string; detail: string; duration_ms: number }) =>
            `<div style="margin:4px 0;padding:6px 10px;border-radius:6px;font-size:12px;text-align:left;${s.status === 'pass' ? 'background:#ecfdf5;color:#065f46' : s.status === 'fail' ? 'background:#fef2f2;color:#991b1b' : 'background:#f8fafc;color:#64748b'}">
              <b>${s.status.toUpperCase()}</b> ${s.step}: ${s.detail} (${s.duration_ms}ms)
            </div>`).join('')
        : '';

      Swal.fire({
        title: data.summary === 'pass' ? '✅ Vision Provider Sehat' : '⚠️ Ada Masalah',
        html: `<div style="max-height:400px;overflow-y:auto">${stepsHtml}</div>`,
        icon: data.summary === 'pass' ? 'success' : 'warning',
        confirmButtonText: 'Tutup',
      });
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (val: string) => {
    setProviderName(val);
    setAvailableModels([]);
    if (val === 'groq') setUrl('https://api.groq.com/openai/v1');
    else if (val === 'openai') setUrl('https://api.openai.com/v1');
    else if (val === 'openrouter') setUrl('https://openrouter.ai/api/v1');
    else if (val === 'anthropic') setUrl('https://api.anthropic.com');
    else setUrl('http://YOUR_VPS_IP:PORT');
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const primary = data[0];
          if (primary.vision_base_url) {
            setSavedConfig({
              url: primary.vision_base_url,
              model: primary.vision_model,
              hasKey: !!primary.vision_api_key_encrypted
            });
            setUrl(primary.vision_base_url);
            setModel(primary.vision_model || '');
          }
        }
      }
    } catch (e) {
      logger.error(e);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const loadModels = async () => {
    if (!url || !key) return Swal.fire('Error', 'URL & API Key dibutuhkan untuk memuat model', 'error');
    setFetching(true);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: url, api_key: key })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const m = data.data.map((x: { id: string }) => x.id);
      setAvailableModels(m);
      if (m.length > 0) setModel(m[0]);
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/providers/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: url, model, api_key: key })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'Kredensial Mata AI Tersimpan', 'success');
      setKey('');
      setShowForm(false);
      fetchProviders();
    } else {
      const err = await res.json();
      Swal.fire('Error', err.error || 'Gagal menyimpan', 'error');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="text-indigo-600" size={20}/> AI Provider - Vision
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Konfigurasi khusus model AI pembaca gambar. Sangat disarankan menggunakan <b>OpenRouter</b> (Gratis) atau <b>Gemini Studio</b>.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2">
            <PlusCircle size={18} /> Tambah API Key Vision
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8">
          <div className="flex justify-between mb-4">
            <h4 className="font-extrabold text-lg text-slate-900">Kredensial Khusus Mata AI</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-red-600"><X/></button>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <select required value={providerName} onChange={e => handleChange(e.target.value)} className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                <option value="openrouter">OpenRouter</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="vps">VPS / Custom</option>
              </select>
              <input required value={url} onChange={e => setUrl(e.target.value)} type="text" className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="https://openrouter.ai/api/v1" />
            </div>
            
            <div className="relative">
              <input value={key} onChange={e => setKey(e.target.value)} type={showKey ? "text" : "password"} placeholder={savedConfig?.hasKey ? "(API Key sudah tersimpan, isi hanya jika ingin mengubah)" : "API Key"} className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3 text-slate-400">{showKey ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
            </div>

            <div className="flex gap-4">
              {availableModels.length > 0 ? (
                <select value={model} onChange={e => setModel(e.target.value)} className="flex-1 p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input required value={model} onChange={e => setModel(e.target.value)} type="text" placeholder="Model (cth: google/gemini-1.5-flash-free)" className="flex-1 p-3 border border-slate-300 bg-white text-slate-900 rounded-lg" />
              )}
              <button type="button" onClick={loadModels} disabled={fetching} className="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-lg flex items-center font-bold transition-colors">
                <RefreshCcw size={18} className={`mr-2 ${fetching ? "animate-spin" : ""}`} /> Load Models
              </button>
            </div>

            <button disabled={loading} type="submit" className="mt-2 bg-amber-500 text-white py-3 rounded-lg font-bold transition-colors">
              <Save className="inline mr-2" size={18}/> Simpan Kredensial Vision
            </button>
            <button type="button" onClick={handleTestProvider} disabled={testing} className="mt-2 bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
              <Activity size={18} className={testing ? 'animate-spin' : ''} /> {testing ? 'Testing...' : 'Test Provider'}
            </button>
          </div>
        </form>
      )}

      {savedConfig && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/50 relative">
            <div className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
              <Camera size={20} className="text-amber-500" /> Vision Provider Aktif
            </div>
            <div className="text-sm mt-2 text-slate-700">URL: {savedConfig.url}</div>
            <div className="text-sm font-bold text-amber-700 mt-1">Model: {savedConfig.model}</div>
          </div>
        </div>
      )}
    </div>
  );
}
