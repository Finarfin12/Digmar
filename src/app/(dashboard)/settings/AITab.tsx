import { useState, useEffect } from 'react';
import { Key, PlusCircle, Save, X, Trash2, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import Swal from 'sweetalert2';

interface ProviderConfig {
  id: string;
  provider_name: string;
  base_url: string;
  model: string;
  has_key: boolean;
}

export default function AITab() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('groq');
  const [url, setUrl] = useState('https://api.groq.com/openai/v1');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) setProviders(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const handleChange = (val: string) => {
    setName(val); setAvailableModels([]);
    if (val === 'groq') setUrl('https://api.groq.com/openai/v1');
    else if (val === 'openai') setUrl('https://api.openai.com/v1');
    else if (val === 'openrouter') setUrl('https://openrouter.ai/api/v1');
    else if (val === 'anthropic') setUrl('https://api.anthropic.com');
    else setUrl('http://YOUR_VPS_IP:PORT');
  };

  const loadModels = async () => {
    if (!url || !key) return Swal.fire('Error', 'URL & Key dibutuhkan', 'error');
    setFetching(true);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: url, api_key: key })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const m = data.data.map((x: any) => x.id);
      setAvailableModels(m);
      if (m.length > 0) setModel(m[0]);
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/providers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: name, base_url: url, model, api_key: key })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'Tersimpan', 'success');
      setShowForm(false); setKey(''); setModel(''); fetchProviders();
    } else {
      Swal.fire('Error', 'Gagal', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({ title: 'Hapus?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    fetchProviders();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Key className="text-amber-500" size={20}/> AI Provider</h3>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2">
            <PlusCircle size={18} /> Tambah API Key
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8">
          <div className="flex justify-between mb-4">
            <h4 className="font-extrabold text-lg">Kredensial AI</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-red-600"><X/></button>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <select required value={name} onChange={e => handleChange(e.target.value)} className="p-3 border rounded-lg">
                <option value="groq">Groq</option><option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option>
                <option value="vps">VPS / Custom</option>
              </select>
              <input required value={url} onChange={e => setUrl(e.target.value)} type="text" className="p-3 border rounded-lg" />
            </div>
            <div className="relative">
              <input required value={key} onChange={e => setKey(e.target.value)} type={showKey ? "text" : "password"} placeholder="API Key" className="w-full p-3 border rounded-lg" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3">{showKey ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
            </div>
            <div className="flex gap-4">
              {availableModels.length > 0 ? (
                <select value={model} onChange={e => setModel(e.target.value)} className="flex-1 p-3 border rounded-lg">
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={model} onChange={e => setModel(e.target.value)} type="text" placeholder="Model manual" className="flex-1 p-3 border rounded-lg" />
              )}
              <button type="button" onClick={loadModels} disabled={fetching} className="bg-slate-800 text-white px-5 rounded-lg flex items-center">
                <RefreshCcw size={18} className={fetching ? "animate-spin" : ""} /> Load
              </button>
            </div>
            <button disabled={loading} type="submit" className="mt-2 bg-amber-500 text-white py-3 rounded-lg font-bold"><Save className="inline mr-2" size={18}/>Simpan</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map(p => (
          <div key={p.id} className="p-6 rounded-xl border border-amber-200 bg-amber-50/50 relative">
            <button onClick={() => handleDelete(p.id)} className="absolute top-4 right-4 text-amber-300 hover:text-red-500"><Trash2 size={20} /></button>
            <div className="font-extrabold text-xl capitalize flex items-center gap-2">{p.provider_name}</div>
            <div className="text-sm mt-2">URL: {p.base_url}</div>
            <div className="text-sm font-bold text-amber-700 mt-1">Model: {p.model || 'Default'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
