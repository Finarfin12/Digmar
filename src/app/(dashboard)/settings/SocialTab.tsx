import { useState, useEffect } from 'react';
import { Share2, PlusCircle, Save, X, Trash2, Eye, EyeOff, Bot } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit } from './UnitsTab';

interface SocialAccount {
  id: string;
  business_unit_id: string;
  platform: string;
  ig_user_id: string;
  auto_reply_enabled: boolean;
}

export default function SocialTab() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [unit, setUnit] = useState('');
  const [platform, setPlatform] = useState('meta_ig');
  const [user, setUser] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [autoReply, setAutoReply] = useState(false);

  const fetchData = async () => {
    try {
      const [uRes, aRes] = await Promise.all([fetch('/api/units'), fetch('/api/accounts')]);
      if (uRes.ok) {
        const data = await uRes.json();
        setUnits(data);
        if (data.length > 0 && !unit) setUnit(data[0].id);
      }
      if (aRes.ok) setAccounts(await aRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return Swal.fire('Error', 'Pilih Unit', 'error');
    setLoading(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_unit_id: unit, platform, ig_user_id: user, access_token: token, auto_reply_enabled: autoReply })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'Disimpan & dienkripsi', 'success');
      setShowForm(false); setUser(''); setToken(''); setAutoReply(false); fetchData();
    } else {
      Swal.fire('Error', 'Gagal menghubungkan', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({ title: 'Hapus?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    fetchData();
    Swal.fire('Terhapus!', '', 'success');
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_reply_enabled: !current })
      });
      fetchData();
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Share2 className="text-pink-600" size={20}/> Akun Sosial</h3>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2">
            <PlusCircle size={18} /> Hubungkan API
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8">
          <div className="flex justify-between mb-4">
            <h4 className="font-extrabold text-lg text-slate-900">Kredensial Meta API</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-red-600"><X/></button>
          </div>
          {units.length === 0 ? (
             <div className="text-red-600 bg-red-100 p-4 rounded-lg font-bold">Buat Unit Bisnis dahulu!</div>
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Target Unit</label>
                  <select required value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                    {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Platform</label>
                  <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                    <option value="meta_ig">Instagram Graph API</option>
                    <option value="facebook">Facebook Pages API</option>
                    <option value="threads">Threads API</option>
                    <option value="tiktok">TikTok API</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">ID Pengguna</label>
                <input required value={user} onChange={e => setUser(e.target.value)} type="text" autoComplete="off" className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Access Token</label>
                <div className="relative">
                  <input required value={token} onChange={e => setToken(e.target.value)} type={showToken ? "text" : "password"} autoComplete="new-password" className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg" />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-3 text-slate-500">{showToken ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                </div>
              </div>
              {platform === 'meta_ig' && (
                <div className="mt-2 bg-pink-50 p-4 rounded-lg border border-pink-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-1"><Bot size={16}/> Aktifkan AI Smart Auto-Reply (DM & Komentar)</div>
                    <div className="text-xs text-slate-500">Pastikan Anda telah mengisi "AI System Prompt" di Unit Bisnis.</div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={autoReply} onChange={() => setAutoReply(!autoReply)} className="sr-only" />
                    <div className={`w-12 h-7 rounded-full ${autoReply ? 'bg-pink-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 mt-1 ml-1 bg-white rounded-full transition-transform ${autoReply ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
              )}
              <button disabled={loading} type="submit" className="mt-2 bg-pink-600 text-white py-3 rounded-lg font-bold"><Save className="inline mr-2" size={18}/>Simpan</button>
            </div>
          )}
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map(a => (
          <div key={a.id} className="p-6 rounded-xl border border-pink-100 bg-gradient-to-br from-white to-pink-50 relative">
            <button onClick={() => handleDelete(a.id)} className="absolute top-4 right-4 text-pink-300 hover:text-red-500"><Trash2 size={20} /></button>
            <div className="font-extrabold text-xl text-slate-900 capitalize flex items-center gap-2">{a.platform}</div>
            <div className="text-sm text-pink-700 font-bold mt-2">ID: {a.ig_user_id}</div>
            <div className="text-xs text-slate-600 mt-1 mb-3">Unit: {units.find(u => u.id === a.business_unit_id)?.brand_name}</div>
            {a.platform === 'meta_ig' && (
              <label className="flex items-center gap-3 cursor-pointer bg-white/60 p-2 rounded-lg border">
                <input type="checkbox" checked={!!a.auto_reply_enabled} onChange={() => handleToggle(a.id, !!a.auto_reply_enabled)} className="sr-only" />
                <div className={`w-10 h-6 rounded-full ${a.auto_reply_enabled ? 'bg-pink-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 mt-1 ml-1 bg-white rounded-full transition-transform ${a.auto_reply_enabled ? 'translate-x-4' : ''}`}></div>
                </div>
                <div className="text-xs font-bold">Auto-Reply</div>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
