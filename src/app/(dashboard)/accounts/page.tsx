"use client";
import { useState, useEffect } from 'react';
import { PlusCircle, Search, Loader2, CheckCircle2, X, MoreHorizontal } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit } from '@/types';

// Extend local types based on SocialAccount
interface Account {
  id: string;
  business_unit_id: string;
  platform: string;
  ig_user_id: string;
  auto_reply_enabled: boolean;
  avatar_url?: string;
  account_name?: string;
  followers_count?: number;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [filter, setFilter] = useState('All');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState('');
  const [platform, setPlatform] = useState('meta_ig');
  const [user, setUser] = useState('');
  const [token, setToken] = useState('');
  const [autoReply, setAutoReply] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPages, setDiscoveredPages] = useState<Array<{page_id: string; page_name: string; ig_business_account_id: string | null; ig_username: string | null; error?: string}>>([]);

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

    const existingAccount = accounts.find(a => a.business_unit_id === unit && a.platform === platform);
    if (existingAccount) {
      const platformName = platform === 'meta_ig' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : platform === 'tiktok' ? 'TikTok' : 'Threads';
      return Swal.fire('Batas Akun', `Unit Bisnis ini sudah memiliki akun ${platformName} terhubung. Maksimal 1 akun per platform untuk setiap unit. Hapus akun lama jika ingin menggantinya.`, 'warning');
    }

    setLoading(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_unit_id: unit, platform, ig_user_id: user, access_token: token, auto_reply_enabled: autoReply })
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire('Berhasil!', 'Akun terhubung', 'success');
      setShowModal(false); setUser(''); setToken(''); setAutoReply(false); 
      fetchData();
      // Trigger background sync immediately for the new token
      fetch('/api/accounts/sync-profile', { method: 'POST' }).then(() => fetchData());
    } else {
      Swal.fire('Error', 'Gagal menghubungkan', 'error');
    }
  };

  const handleDiscoverPages = async () => {
    if (!token.trim()) return Swal.fire('Error', 'Masukkan token terlebih dahulu', 'error');
    setDiscovering(true);
    setDiscoveredPages([]);
    try {
      if (platform === 'threads') {
        const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token.trim()}`);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message || 'Token Threads tidak valid');
        setUser(data.id);
        Swal.fire({ title: 'Ditemukan!', text: `Threads User ID: ${data.id} (@${data.username})`, icon: 'success', timer: 2500 });
        return;
      }

      const res = await fetch('/api/accounts/instagram-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data');
      if (data.pages && data.pages.length > 0) {
        setDiscoveredPages(data.pages);
        if (platform === 'facebook') {
          setUser(data.pages[0].page_id);
          Swal.fire({ title: 'Ditemukan!', text: `Auto-select: ${data.pages[0].page_name} (Page ID)`, icon: 'success', timer: 2000 });
        } else {
          const firstWithIG = data.pages.find((p: any) => p.ig_business_account_id);
          if (firstWithIG) {
            setUser(firstWithIG.ig_business_account_id);
            Swal.fire({ title: 'Ditemukan!', text: `Auto-select: ${firstWithIG.ig_username || firstWithIG.ig_business_account_id} (${firstWithIG.page_name})`, icon: 'success', timer: 2000 });
          } else {
            Swal.fire('Peringatan', 'Tidak ada Instagram Business Account terhubung ke Facebook Pages kamu.', 'warning');
          }
        }
      } else {
        Swal.fire('Error', 'Tidak ada Facebook Pages ditemukan.', 'error');
      }
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({ title: 'Hapus/Disconnect?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    fetchData();
    Swal.fire('Terhapus!', '', 'success');
  };

  const getPlatformIcon = (plat: string) => {
    switch (plat) {
      case 'meta_ig': return <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-pink-500/30 text-xl">IG</div>;
      case 'facebook': return <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30 text-xl">f</div>;
      case 'threads': return <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold shadow-lg shadow-black/30 text-xl">@</div>;
      case 'tiktok': return <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg shadow-slate-900/30 text-xl">TT</div>;
      default: return <div className="w-12 h-12 rounded-full bg-slate-200" />;
    }
  };

  const getPlatformName = (plat: string) => {
    switch (plat) {
      case 'meta_ig': return 'Instagram';
      case 'facebook': return 'Facebook';
      case 'threads': return 'Threads';
      case 'tiktok': return 'TikTok';
      default: return plat;
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const filteredAccounts = filter === 'All' ? accounts : accounts.filter(a => a.platform === filter);
  const platforms = ['All', 'meta_ig', 'threads', 'facebook', 'tiktok'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Stats */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Accounts</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/30 transition-all hover:-translate-y-0.5">
          <PlusCircle size={20} /> Connect Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200/60">
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Total Accounts</p>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{accounts.length}</h2>
        </div>
        <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200/60">
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Active Platforms</p>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{new Set(accounts.map(a => a.platform)).size}</h2>
        </div>
        <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200/60">
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Business Units</p>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{units.length}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filter === p ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {p === 'All' ? 'All Accounts' : getPlatformName(p)}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAccounts.map(account => (
          <div key={account.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:shadow-md transition-shadow">
            <div className="flex items-center gap-5">
              {account.avatar_url ? (
                <img src={account.avatar_url} alt="Profile" className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-slate-100" />
              ) : (
                getPlatformIcon(account.platform)
              )}
              
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {account.account_name || units.find(u => u.id === account.business_unit_id)?.brand_name || 'Unknown'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {getPlatformName(account.platform)} • {formatNumber(account.followers_count)} followers
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-xs font-semibold text-slate-600">Connected</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between h-full">
              <div className="relative dropdown-container">
                <button onClick={() => handleDelete(account.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-50" title="Disconnect">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State Card */}
        <div onClick={() => setShowModal(true)} className="border-2 border-dashed border-slate-200 p-6 rounded-2xl flex items-center justify-between cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors">
           <div className="flex items-center gap-5">
             <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl">
               +
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-900">Add Account</h3>
               <p className="text-sm text-slate-500">Connect a new profile</p>
             </div>
           </div>
           <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
             Connect
           </button>
        </div>
      </div>

      {/* Modal / Popup for Connecting API */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Connect API Account</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              {units.length === 0 ? (
                <div className="text-red-600 bg-red-50 p-4 rounded-xl font-bold flex items-center gap-2 border border-red-100">
                  Buat Unit Bisnis terlebih dahulu di menu Pengaturan!
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Target Unit Bisnis</label>
                      <select required value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none">
                        {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Platform Sosial</label>
                      <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full p-3 border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none">
                        <option value="meta_ig">Instagram Graph API</option>
                        <option value="facebook">Facebook Pages API</option>
                        <option value="threads">Threads API</option>
                        <option value="tiktok">TikTok API</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Access Token / Rahasia API
                    </label>
                    <input required value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="Masukkan token rahasia..." className="w-full p-3 border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none font-mono text-sm" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {platform === 'threads' ? 'Threads User ID' : platform === 'tiktok' ? 'TikTok Open ID' : 'Target Account / Page ID'}
                    </label>
                    <div className="flex gap-2">
                      <input required value={user} onChange={e => setUser(e.target.value)} type="text" placeholder={platform === 'tiktok' ? 'Open ID' : 'Klik Discover untuk isi otomatis'} className="flex-1 p-3 border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none" />
                      {(platform !== 'tiktok') && (
                        <button type="button" onClick={handleDiscoverPages} disabled={discovering} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
                          {discovering ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                          Discover
                        </button>
                      )}
                    </div>
                    {platform === 'threads' && <p className="text-xs text-slate-500 mt-2">💡 Masukkan <strong>Threads Long-Lived Token</strong> (dimulai dengan THAA), lalu klik Discover.</p>}
                    {platform === 'meta_ig' && <p className="text-xs text-slate-500 mt-2">💡 Masukkan <strong>Facebook Page Access Token</strong>, lalu klik Discover untuk mencari akun IG.</p>}
                  </div>

                  {discoveredPages.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2">
                      {discoveredPages.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setUser(platform === 'facebook' ? p.page_id : (p.ig_business_account_id || ''))}
                          className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                            user === p.ig_business_account_id || user === p.page_id ? 'bg-green-100 text-green-800 border-green-200 shadow-sm' : 'hover:bg-white text-slate-700 border border-transparent hover:border-slate-200'
                          }`}
                        >
                          <span>
                            {p.page_name}
                            {p.ig_username && <span className="text-pink-600 ml-2">@{p.ig_username}</span>}
                          </span>
                          {platform === 'facebook' ? (
                            user === p.page_id ? <CheckCircle2 size={18} className="text-green-600" /> : <span className="text-xs text-slate-400">ID: {p.page_id.substring(0, 10)}...</span>
                          ) : p.ig_business_account_id ? (
                            user === p.ig_business_account_id ? <CheckCircle2 size={18} className="text-green-600" /> : <span className="text-xs text-slate-400">Pilih</span>
                          ) : <span className="text-xs text-red-400 italic">No IG Linked</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                      Batal
                    </button>
                    <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/30 transition-all disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5">
                      {loading ? <Loader2 size={18} className="animate-spin" /> : 'Simpan & Connect'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
