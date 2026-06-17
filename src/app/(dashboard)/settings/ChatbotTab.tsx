import { useState, useEffect } from 'react';
import { Bot, Plus, Loader2, Save, Trash2, Edit } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit } from '@/types';

export default function ChatbotTab() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formId, setFormId] = useState('');
  const [formKeyword, setFormKeyword] = useState('');
  const [formMode, setFormMode] = useState('static_text');
  const [formContent, setFormContent] = useState('');
  const [formPriority, setFormPriority] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (selectedUnit) fetchRules();
  }, [selectedUnit]);

  const fetchUnits = async () => {
    const res = await fetch('/api/units');
    const data = await res.json();
    setUnits(data);
    if (data.length > 0) setSelectedUnit(data[0].id);
  };

  const fetchRules = async () => {
    setLoading(true);
    const res = await fetch(`/api/chatbot/rules?business_unit_id=${selectedUnit}`);
    const data = await res.json();
    setRules(data);
    setLoading(false);
  };

  const resetForm = () => {
    setIsEditing(false);
    setFormId('');
    setFormKeyword('');
    setFormMode('static_text');
    setFormContent('');
    setFormPriority(10);
  };

  const editRule = (rule: any) => {
    setIsEditing(true);
    setFormId(rule.id);
    setFormKeyword(rule.trigger_keyword);
    setFormMode(rule.reply_mode);
    setFormContent(rule.response_content || '');
    setFormPriority(rule.priority);
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyword) return Swal.fire('Error', 'Keyword Wajib Diisi', 'error');

    setSaving(true);
    try {
      const res = await fetch('/api/chatbot/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId,
          business_unit_id: selectedUnit,
          trigger_keyword: formKeyword,
          reply_mode: formMode,
          response_content: formContent,
          priority: formPriority,
          is_active: true
        })
      });
      if (!res.ok) throw new Error(await res.text());
      Swal.fire('Sukses', 'Rule Chatbot berhasil disimpan!', 'success');
      resetForm();
      fetchRules();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Rule?', text: 'Rule chatbot ini akan dihapus secara permanen.', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;

    try {
      await fetch(`/api/chatbot/rules?id=${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (err) {
      Swal.fire('Error', 'Gagal menghapus rule', 'error');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
            <Bot className="text-indigo-600" /> Auto-Reply Rules
          </h3>
          <p className="text-slate-600 font-medium mt-1">Konfigurasi keyword dan trigger balasan untuk setiap Unit Bisnis.</p>
        </div>
        
        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="p-3 border border-slate-400 rounded-xl font-bold bg-slate-50 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
          {units.map((u) => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM */}
        <div className="lg:col-span-1 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm self-start sticky top-6">
          <h4 className="font-bold text-slate-800 mb-4">{isEditing ? 'Edit Rule' : 'Tambah Rule Baru'}</h4>
          <form onSubmit={saveRule} className="space-y-4">
            
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">Trigger Keywords</label>
              <input value={formKeyword} onChange={e => setFormKeyword(e.target.value)} type="text" placeholder="Misal: harga, brp, price" className="w-full p-2.5 border border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 placeholder:text-slate-500 placeholder:font-medium" />
              <p className="text-xs text-slate-600 mt-1">Pisahkan dengan koma jika lebih dari satu.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">Mode Balasan</label>
              <select value={formMode} onChange={e => setFormMode(e.target.value)} className="w-full p-2.5 border border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 bg-white">
                <option value="static_text">Teks Statis Langsung</option>
                <option value="human_handoff">Abaikan (Serahkan ke Admin)</option>
                <option value="ai_generated">Teruskan ke AI dengan Konteks</option>
              </select>
            </div>

            {formMode !== 'human_handoff' && (
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  {formMode === 'ai_generated' ? 'Konteks Tambahan AI' : 'Teks Balasan'}
                </label>
                <textarea value={formContent} onChange={e => setFormContent(e.target.value)} rows={3} placeholder={formMode === 'ai_generated' ? "Misal: Jawab dengan kasual dan arahkan ke link bio" : "Masukkan balasan statis..."} className="w-full p-2.5 border border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 placeholder:text-slate-500 placeholder:font-medium" />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">Prioritas (Makin besar makin didahulukan)</label>
              <input value={formPriority} onChange={e => setFormPriority(Number(e.target.value))} type="number" className="w-full p-2.5 border border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Simpan
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-3 rounded-lg font-bold">Batal</button>
              )}
            </div>
          </form>
        </div>

        {/* LIST */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
          ) : rules.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-400 rounded-2xl p-10 flex flex-col items-center text-center">
              <Bot size={48} className="text-slate-500 mb-4" />
              <p className="font-extrabold text-slate-900">Belum Ada Rule Dibuat</p>
              <p className="text-sm font-medium text-slate-600">Tambahkan rule baru untuk Unit Bisnis ini melalui form di sebelah kiri.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map(r => (
                <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {r.trigger_keyword.split(',').map((kw: string, i: number) => (
                          <span key={i} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">{kw.trim()}</span>
                        ))}
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${r.reply_mode === 'static_text' ? 'bg-blue-100 text-blue-700' : r.reply_mode === 'human_handoff' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                        {r.reply_mode === 'static_text' ? 'Static Text' : r.reply_mode === 'human_handoff' ? 'Human Handoff' : 'AI Mode'}
                      </span>
                      <span className="text-xs font-bold text-slate-400 ml-2">Pri: {r.priority}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => editRule(r)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => deleteRule(r.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  {r.reply_mode !== 'human_handoff' && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 font-medium mt-2 whitespace-pre-wrap">
                      {r.response_content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
