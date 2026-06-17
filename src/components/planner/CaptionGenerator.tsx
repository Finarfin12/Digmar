"use client";
import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Lightbulb, Tag } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit, AIResult } from '@/types';

interface Props {
  units: BusinessUnit[];
  formUnit: string;
  setFormUnit: (id: string) => void;
  onCaptionSelect: (caption: string) => void;
}

export default function CaptionGenerator({ units, formUnit, setFormUnit, onCaptionSelect }: Props) {
  const [formContext, setFormContext] = useState('');
  const [toneVoice, setToneVoice] = useState('profesional');
  const [generating, setGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<AIResult | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<number>(0);

  const generateAI = async () => {
    if (!formUnit || !formContext) {
      return Swal.fire('Oops', 'Pilih Unit Bisnis dan masukkan Konteks Ide Konten!', 'warning');
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: formUnit, prompt_context: formContext, tone_voice: toneVoice })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate AI');
      
      setAiResults(data);
      if (data.pilihan_1) {
        setSelectedCaption(1);
        onCaptionSelect(data.pilihan_1.caption + '\n\n' + data.pilihan_1.hashtag);
      }
    } catch (err: unknown) {
      Swal.fire('Error AI', (err as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const selectCaption = (num: number, choice: { caption: string, hashtag: string }) => {
    setSelectedCaption(num);
    onCaptionSelect(choice.caption + '\n\n' + choice.hashtag);
  };

  return (
    <>
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
        <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4"><Sparkles size={18}/> AI Caption Generator</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">Unit Bisnis (Konteks)</label>
              <select value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium">
                {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">Tone & Voice</label>
              <select value={toneVoice} onChange={e => setToneVoice(e.target.value)} className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium">
                <option value="profesional">Profesional & Informatif</option>
                <option value="kasual">Kasual & Santai</option>
                <option value="humoris">Humoris / Lucu</option>
                <option value="inspiratif">Inspiratif & Motivasi</option>
                <option value="hard_selling">Hard Selling (Jualan Keras)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-indigo-800 mb-1">Ide Konten</label>
            <textarea value={formContext} onChange={e => setFormContext(e.target.value)} rows={2} placeholder="Misal: Promo akhir tahun diskon 50% untuk produk X..." className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 text-sm font-medium" />
          </div>

          <button type="button" onClick={generateAI} disabled={generating || !formContext} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            {generating ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
            {generating ? 'AI Sedang Menulis...' : 'Generate 3 Pilihan Caption'}
          </button>
        </div>
      </div>

      {aiResults && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h4 className="font-bold text-slate-800 text-sm border-b pb-2">Pilih Caption Terbaik:</h4>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[1, 2, 3].map(num => {
              const key = `pilihan_${num}` as keyof AIResult;
              const choice = aiResults[key] as {caption: string, hashtag: string};
              if (!choice) return null;
              const isSelected = selectedCaption === num;
              
              return (
                <div key={num} onClick={() => selectCaption(num, choice)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Pilihan {num}</span>
                    {isSelected && <CheckCircle2 className="text-indigo-600" size={18} />}
                  </div>
                  <p className="text-sm text-slate-800 mb-4 whitespace-pre-wrap flex-1">{choice.caption}</p>
                  <p className="text-xs font-bold text-blue-600 break-words">{choice.hashtag}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <span className="text-xs font-extrabold text-amber-800 uppercase mb-1 flex items-center gap-1"><Lightbulb size={14}/> Ide Cerita Musiman</span>
            <p className="text-sm text-amber-900">{aiResults.cerita_musiman}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1"><Tag size={14}/> Keyword Cloud</span>
            <div className="flex flex-wrap gap-1">
              {aiResults.keyword_cloud?.map((kw: string, i: number) => <span key={i} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{kw}</span>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
