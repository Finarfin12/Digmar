"use client";
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Sparkles, Loader2, CalendarRange } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit, SocialAccount } from '@/types';

interface CampaignArchitectModalProps {
  units: BusinessUnit[];
  accounts: SocialAccount[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CampaignArchitectModal({ units, accounts, onClose, onSuccess }: CampaignArchitectModalProps) {
  const [formUnit, setFormUnit] = useState(units.length > 0 ? units[0].id : '');
  const [formAccount, setFormAccount] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [campaignIdea, setCampaignIdea] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'12:00"));
  const [toneVoice, setToneVoice] = useState('Profesional & Informatif');
  
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!formUnit && units.length > 0) setFormUnit(units[0].id);
  }, [units, formUnit]);

  useEffect(() => {
    if (!formAccount && accounts.length > 0) setFormAccount(accounts[0].id);
  }, [accounts, formAccount]);

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount || !campaignIdea || !startDate) {
      return Swal.fire('Error', 'Harap lengkapi semua isian', 'error');
    }

    setGenerating(true);
    Swal.fire({
      title: 'AI Sedang Meracik Kampanye...',
      html: `Merencanakan strategi dan menulis copywriting untuk ${durationDays} hari.<br/>Mohon tunggu sebentar.`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: formUnit,
          target_account_ids: [formAccount],
          campaign_idea: campaignIdea,
          duration_days: durationDays,
          start_date: startDate,
          tone_voice: toneVoice
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kampanye');

      Swal.fire({
        title: 'Berhasil!',
        text: `${durationDays} postingan kampanye berhasil dijadwalkan!`,
        icon: 'success'
      });
      onSuccess();
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10 text-white">
            <h3 className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="text-yellow-200" /> Campaign Architect
            </h3>
            <p className="font-medium text-amber-50 mt-1">AI meracik strategi kampanye berseri dalam 1 klik.</p>
          </div>
          <button onClick={onClose} className="relative z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
          <CalendarRange size={120} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
        </div>

        {/* Body */}
        <form onSubmit={handleGenerate} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Unit Bisnis</label>
              <select value={formUnit} onChange={e => {setFormUnit(e.target.value); setFormAccount('');}} className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500">
                {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Akun Tujuan</label>
              <select required value={formAccount} onChange={e => setFormAccount(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500">
                <option value="">-- Pilih Akun --</option>
                {filteredAccounts.map(a => <option key={a.id} value={a.id} className="capitalize">{a.platform}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Ide Utama Kampanye</label>
            <textarea 
              required
              value={campaignIdea} 
              onChange={e => setCampaignIdea(e.target.value)} 
              rows={3} 
              className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white font-medium text-slate-800"
              placeholder="Contoh: Launching koleksi sepatu lari terbaru 'AeroDash'. Buatkan hype dan promo khusus early bird!"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Durasi Kampanye</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {[3, 5, 7].map(days => (
                  <button 
                    key={days}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    className={`flex-1 py-2 font-bold text-sm rounded-lg transition-all ${durationDays === days ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {days} Hari
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Tone & Gaya Bahasa</label>
              <select value={toneVoice} onChange={e => setToneVoice(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500">
                <option value="Profesional & Informatif">Profesional & Informatif</option>
                <option value="Santai & Friendly">Santai & Friendly</option>
                <option value="Lucu & Menghibur">Lucu & Menghibur</option>
                <option value="Inspiratif & Memotivasi">Inspiratif & Memotivasi</option>
                <option value="Tegas & Hard Selling">Tegas & Hard Selling</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Tanggal Mulai (Post Pertama)</label>
            <input 
              required
              type="datetime-local" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white text-slate-900 font-bold" 
            />
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Post selanjutnya akan dijadwalkan otomatis +1 hari dari tanggal ini secara berurutan.
            </p>
          </div>

          <button 
            disabled={generating} 
            type="submit" 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-70 text-lg mt-4"
          >
            {generating ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24} className="text-amber-400"/>}
            {generating ? 'AI Sedang Meracik...' : `Generate ${durationDays} Postingan`}
          </button>
        </form>

      </div>
    </div>
  );
}
