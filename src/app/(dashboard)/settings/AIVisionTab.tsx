import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCcw, Save, Camera } from 'lucide-react';
import Swal from 'sweetalert2';

export default function AIVisionTab() {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('https://openrouter.ai/api/v1');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [savedConfig, setSavedConfig] = useState<{ url: string, model: string, hasKey: boolean } | null>(null);

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
      console.error(e);
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
      </div>

      <form onSubmit={handleSave} className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-200 mb-8">
        <div className="flex justify-between mb-4">
          <h4 className="font-extrabold text-lg text-indigo-900">Kredensial Khusus Mata AI</h4>
        </div>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">Base URL Endpoint</label>
            <input required value={url} onChange={e => setUrl(e.target.value)} type="text" className="w-full p-3 border border-indigo-200 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="https://openrouter.ai/api/v1" />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">API Key</label>
            <div className="relative">
              <input value={key} onChange={e => setKey(e.target.value)} type={showKey ? "text" : "password"} placeholder={savedConfig?.hasKey ? "(API Key sudah tersimpan, isi hanya jika ingin mengubah)" : "API Key"} className="w-full p-3 border border-indigo-200 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3 text-slate-400">{showKey ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">Vision Model</label>
            <div className="flex gap-4">
              {availableModels.length > 0 ? (
                <select value={model} onChange={e => setModel(e.target.value)} className="flex-1 p-3 border border-indigo-200 bg-white text-slate-900 rounded-lg">
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input required value={model} onChange={e => setModel(e.target.value)} type="text" placeholder="google/gemini-1.5-flash-free" className="flex-1 p-3 border border-indigo-200 bg-white text-slate-900 rounded-lg" />
              )}
              <button type="button" onClick={loadModels} disabled={fetching} className="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-lg flex items-center font-bold transition-colors">
                <RefreshCcw size={18} className={`mr-2 ${fetching ? "animate-spin" : ""}`} /> Load Models
              </button>
            </div>
            <p className="text-xs text-indigo-700 mt-2">
              Pilih model yang memiliki kemampuan Vision. Contoh: <code>google/gemini-1.5-flash-free</code>, <code>qwen/qwen-vl-plus:free</code>.
            </p>
          </div>

          <button disabled={loading} type="submit" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold transition-colors">
            <Save className="inline mr-2" size={18}/> Simpan Kredensial Vision
          </button>
        </div>
      </form>

      {savedConfig && (
        <div className="p-6 rounded-xl border border-indigo-200 bg-white flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
            <Camera size={24} />
          </div>
          <h4 className="font-extrabold text-slate-900 text-lg">Mata AI Siap Digunakan</h4>
          <p className="text-sm text-slate-600 mt-1">URL: {savedConfig.url}</p>
          <p className="text-sm font-bold text-indigo-700 mt-1">Model Aktif: {savedConfig.model}</p>
        </div>
      )}
    </div>
  );
}
