"use client";

import { useState, useEffect } from 'react';
import { Settings2, Zap, CheckCircle2, ZapOff } from 'lucide-react';
import Swal from 'sweetalert2';
import UnitsTab from './UnitsTab';
import SocialTab from './SocialTab';
import AITab from './AITab';
import AIVisionTab from './AIVisionTab';
import AIImageTab from './AIImageTab';
import ChatbotTab from './ChatbotTab';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'units' | 'social' | 'ai' | 'chatbot' | 'vision' | 'image'>('units');
  const [publishMode, setPublishMode] = useState<'cepat' | 'lanjutan'>('cepat');
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    fetch('/api/configurations?key=publish_mode')
      .then(r => r.json())
      .then(d => { if (d && d.value) setPublishMode(d.value); })
      .catch(() => {});
  }, []);

  const savePublishMode = async (mode: 'cepat' | 'lanjutan') => {
    setPublishMode(mode);
    setSavingMode(true);
    try {
      await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'publish_mode', value: mode }),
      });
    } catch {
      Swal.fire('Error', 'Gagal menyimpan preferensi', 'error');
    } finally {
      setSavingMode(false);
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
        <button onClick={() => setActiveTab('chatbot')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'chatbot' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Chatbot Rules</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>AI Provider</button>
        <button onClick={() => setActiveTab('vision')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'vision' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>AI Provider-Vision</button>
        <button onClick={() => setActiveTab('image')} className={`px-6 py-3 font-bold transition-all duration-200 border-b-2 ${activeTab === 'image' ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>AI Provider-Image</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden transition-all">
        {activeTab === 'units' && (
          <>
            <UnitsTab />
            <div className="border-t border-slate-100 p-6">
              <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-2">
                <Zap className="text-amber-500" size={20} /> Mode Publish Konten
              </h4>
              <p className="text-sm text-slate-600 mb-4">Pilih bagaimana Anda memposting ke beberapa akun sekaligus.</p>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => savePublishMode('cepat')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all relative ${publishMode === 'cepat' ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  {publishMode === 'cepat' && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 size={18} className="text-indigo-600" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${publishMode === 'cepat' ? 'border-indigo-600' : 'border-slate-300'}`}>
                      {publishMode === 'cepat' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap size={16} className={publishMode === 'cepat' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="font-extrabold text-slate-900">Mode Cepat</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 ml-8">Pilih beberapa akun, 1 caption untuk semua. Cocok untuk konten seragam.</p>
                </div>
                <div
                  onClick={() => savePublishMode('lanjutan')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all relative ${publishMode === 'lanjutan' ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  {publishMode === 'lanjutan' && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 size={18} className="text-indigo-600" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${publishMode === 'lanjutan' ? 'border-indigo-600' : 'border-slate-300'}`}>
                      {publishMode === 'lanjutan' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <ZapOff size={16} className={publishMode === 'lanjutan' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="font-extrabold text-slate-900">Mode Lanjutan</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 ml-8">Multi-select akun + caption berbeda per platform. Cocok untuk optimasi konten.</p>
                </div>
              </div>
              {savingMode && (
                <p className="text-xs text-indigo-600 mt-3 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Mode disimpan
                </p>
              )}
            </div>
          </>
        )}
        {activeTab === 'social' && <SocialTab />}
        {activeTab === 'chatbot' && <ChatbotTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'vision' && <AIVisionTab />}
        {activeTab === 'image' && <AIImageTab />}
      </div>
    </div>
  );
}
