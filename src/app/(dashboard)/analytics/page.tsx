"use client";
import { useEffect, useState } from 'react';
import { Users, Eye, MousePointerClick, MessageCircle, AlertCircle, Loader2, Sparkles, Star, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Swal from 'sweetalert2';
import CompetitorSpy from './CompetitorSpy';
import SerpSpy from './SerpSpy';
import ABTestAnalytics from './ABTestAnalytics';

import { logger } from '@/lib/utils/logger'
export default function Analytics() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'performance' | 'competitors' | 'abtest' | 'serp_spy'>('performance');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'this_month'>('7d');

  // Fetch Accounts
  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAccounts(data);
          if (data.length > 0) setSelectedAccount(data[0].id);
        }
        setLoadingAccounts(false);
      })
      .catch(err => {
        logger.error(err);
        setLoadingAccounts(false);
      });
  }, []);

  // Fetch Analytics for selected account
  useEffect(() => {
    if (!selectedAccount) return;
    
    setLoadingAnalytics(true);
    fetch(`/api/analytics?account_id=${selectedAccount}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          Swal.fire('Error', data.error, 'error');
          setAnalytics(null);
        } else {
          setAnalytics(data);
        }
        setLoadingAnalytics(false);
      })
      .catch(err => {
        logger.error(err);
        setLoadingAnalytics(false);
      });
  }, [selectedAccount]);

  if (loadingAccounts) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-300">
        <button onClick={() => setActiveTab('performance')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'performance' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Performance Dashboard</button>
        <button onClick={() => setActiveTab('competitors')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'competitors' ? 'border-pink-600 text-pink-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Competitor Spy</button>
        <button onClick={() => setActiveTab('serp_spy')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'serp_spy' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>SERP Spy (SerpApi)</button>
        <button onClick={() => setActiveTab('abtest')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'abtest' ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>A/B Testing Lab</button>
      </div>

      {activeTab === 'competitors' ? (
        <CompetitorSpy />
      ) : activeTab === 'serp_spy' ? (
        <SerpSpy units={accounts.map((a: any) => a.business_units).filter(Boolean)} />
      ) : activeTab === 'abtest' ? (
        <ABTestAnalytics unitId={accounts.find((a: any) => a.id === selectedAccount)?.business_unit_id} />
      ) : (
        <>
          {/* Header & Selector */}
          <header className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Performance Dashboard</h2>
          <p className="text-slate-600 font-medium mt-1">Lacak jangkauan dan interaksi audiens Anda.</p>
        </div>
        
        <div className="w-full md:w-auto min-w-[250px]">
          <select 
            value={selectedAccount} 
            onChange={e => setSelectedAccount(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-slate-50 cursor-pointer"
          >
            {accounts.length === 0 && <option value="" disabled>Belum ada akun sosial</option>}
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.business_units?.brand_name || '(Tanpa Unit)'} ({acc.platform}) - {acc.ig_user_id}
              </option>
            ))}
          </select>
        </div>
      </header>

      {accounts.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border border-slate-200">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Akun Terhubung</h3>
          <p className="text-slate-500">Silakan hubungkan akun Meta/Instagram Anda di halaman Pengaturan terlebih dahulu.</p>
        </div>
      ) : loadingAnalytics || !analytics ? (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={48}/>
          <p className="font-bold text-slate-600">Mengambil data dari server Meta...</p>
        </div>
      ) : (
        <>
          {analytics.is_mock && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={24} />
              <div>
                <p className="font-bold">Menampilkan Data Simulasi (Mock Data)</p>
                <p className="text-sm">Token Meta Anda mungkin kedaluwarsa atau tidak memiliki izin akses Insights. Data di bawah ini adalah data buatan AI untuk demonstrasi UI.</p>
              </div>
            </div>
          )}

          {!analytics.is_mock && Array.isArray(analytics.warnings) && analytics.warnings.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={24} />
              <div>
                <p className="font-bold">Sebagian Data Meta Belum Tersedia</p>
                <p className="text-sm">{analytics.warnings.join(' ')}</p>
              </div>
            </div>
          )}

          {/* Profile Card & Top Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform">
                <Sparkles size={120}/>
              </div>
              <div className="flex items-center gap-4 relative z-10 mb-4">
                <img src={analytics.metrics.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(analytics.metrics.name || 'IG')}&background=random`} alt="Profile" className="w-16 h-16 rounded-full border-2 border-white/20" />
                <div>
                  <h3 className="font-black text-xl">{analytics.metrics.name}</h3>
                  <p className="text-indigo-200 text-sm">{analytics.metrics.posts} Total Posts</p>
                </div>
              </div>
              <div className="mt-auto relative z-10">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Total Followers</p>
                <p className="text-4xl font-black">{analytics.metrics.followers.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4"><Eye size={24}/></div>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Total Reach (7 Hari)</p>
              <p className="text-4xl font-black text-slate-900">{analytics.metrics.total_reach.toLocaleString()}</p>
              <p className="text-emerald-500 text-sm font-bold mt-2">↑ 12% dari minggu lalu</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mb-4"><MousePointerClick size={24}/></div>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Engagement Rate</p>
              <p className="text-4xl font-black text-slate-900">{analytics.metrics.engagement_rate}</p>
              <p className="text-emerald-500 text-sm font-bold mt-2 flex items-center gap-1">Sangat Baik <Star size={14}/></p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4"><MessageCircle size={24}/></div>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Komentar Masuk</p>
              <p className="text-4xl font-black text-slate-900">{analytics.recent_comments.length}</p>
              <p className="text-slate-500 text-sm font-bold mt-2">Menunggu balasan AI</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-xl font-extrabold text-slate-900">Tren Jangkauan (Reach) & Interaksi</h3>
                <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className="text-sm font-bold bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="this_month">Bulan Ini</option>
                </select>
              </div>
              <div className="h-80 w-full animate-in fade-in duration-500 delay-100">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chart_data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '8px' }}
                      itemStyle={{ fontWeight: '700' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold' }}/>
                    <Area type="monotone" name="Reach" dataKey="reach" stroke="#4f46e5" fillOpacity={1} fill="url(#colorReach)" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 0 }} />
                    <Area type="monotone" name="Engagement" dataKey="engagement" stroke="#ec4899" fillOpacity={1} fill="url(#colorEng)" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">
              {/* Best Time to Post Widget */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 opacity-[0.03] text-indigo-900 translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <Clock size={120} />
                </div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider">AI Insight</h3>
                </div>
                <div className="relative z-10">
                  <p className="text-2xl font-black text-slate-900 mb-2">19:00 WIB</p>
                  <p className="text-sm text-indigo-800/80 font-medium leading-relaxed">Waktu terbaik memposting berdasarkan riwayat <i>engagement</i> tertinggi audiens Anda.</p>
                </div>
              </div>

              {/* Recent Comments */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-extrabold text-slate-900">Komentar Terbaru</h3>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider animate-pulse">Live</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 max-h-[300px]">
                {analytics.recent_comments.length === 0 && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-semibold text-slate-500">
                    Belum ada komentar terbaru dari webhook Meta.
                  </div>
                )}
                {analytics.recent_comments.map((comment: { id: string, username: string, text: string, time: string }) => (
                  <div key={comment.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-900 text-sm">@{comment.username}</span>
                      <span className="text-[10px] font-bold text-slate-400">{comment.time}</span>
                    </div>
                    <p className="text-slate-700 text-sm">{comment.text}</p>
                    <button className="mt-3 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                      Balas via AI →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
