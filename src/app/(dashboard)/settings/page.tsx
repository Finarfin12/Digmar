"use client";

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import UnitsTab from './UnitsTab';
import SocialTab from './SocialTab';
import AITab from './AITab';
import AIVisionTab from './AIVisionTab';
import ChatbotTab from './ChatbotTab';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'units' | 'social' | 'ai' | 'chatbot' | 'vision'>('units');

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
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden transition-all">
        {activeTab === 'units' && <UnitsTab />}
        {activeTab === 'social' && <SocialTab />}
        {activeTab === 'chatbot' && <ChatbotTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'vision' && <AIVisionTab />}
      </div>
    </div>
  );
}
