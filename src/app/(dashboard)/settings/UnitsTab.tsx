import { useState, useEffect } from 'react';
import { Briefcase, PlusCircle, Save, X, Trash2, Edit2, BrainCircuit } from 'lucide-react';
import Swal from 'sweetalert2';

export interface BusinessUnit {
  id: string;
  brand_name: string;
  business_category: string;
  ai_system_prompt: string;
  custom_variables?: any;
  use_vision_ai?: boolean;
}

export default function UnitsTab() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [promptAudiens, setPromptAudiens] = useState('');
  const [promptKepribadian, setPromptKepribadian] = useState('');
  const [promptProduk, setPromptProduk] = useState('');
  const [customVariables, setCustomVariables] = useState('');
  const [useVisionAi, setUseVisionAi] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchUnits = async () => {
    try {
      const res = await fetch('/api/units');
      if (res.ok) setUnits(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const method = editingId ? 'PUT' : 'POST';
    const combinedPrompt = `[Target Audiens]\n${promptAudiens}\n\n[Kepribadian AI]\n${promptKepribadian}\n\n[Produk & Harga]\n${promptProduk}`;

    let parsedVars = {};
    try {
      if (customVariables.trim()) parsedVars = JSON.parse(customVariables);
    } catch(e) {
      return Swal.fire('Error', 'Format Custom Variables harus JSON yang valid', 'error');
    }

    const bodyPayload = editingId 
      ? { id: editingId, brand_name: name, business_category: category, ai_system_prompt: combinedPrompt, custom_variables: parsedVars, use_vision_ai: useVisionAi }
      : { brand_name: name, business_category: category, ai_system_prompt: combinedPrompt, custom_variables: parsedVars, use_vision_ai: useVisionAi };

    const res = await fetch('/api/units', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    setLoading(false);
    if (res.ok) {
      Swal.fire({ title: 'Berhasil!', text: 'Unit Bisnis disimpan.', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowForm(false);
      setName(''); setCategory(''); setPromptAudiens(''); setPromptKepribadian(''); setPromptProduk(''); setCustomVariables(''); setUseVisionAi(false); setEditingId(null);
      fetchUnits();
    } else {
      const err = await res.json().catch(()=>({}));
      Swal.fire('Error', err.error || 'Gagal menyimpan', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({
      title: 'Hapus?',
      text: 'Akun sosial yang terhubung akan ikut terhapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus'
    });
    if (!res.isConfirmed) return;
    await fetch(`/api/units/${id}`, { method: 'DELETE' });
    fetchUnits();
    Swal.fire('Terhapus!', '', 'success');
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Briefcase className="text-indigo-600" size={20}/> Unit Bisnis</h3>
          <p className="text-slate-600 text-sm mt-1">Daftar entitas brand yang menjadi payung untuk setiap akun sosial.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold">
            <PlusCircle size={18} /> Tambah Unit
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-extrabold text-slate-900 text-lg">{editingId ? 'Edit Unit Bisnis' : 'Tambah Unit Bisnis'}</h4>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setName(''); setCategory(''); setPromptAudiens(''); setPromptKepribadian(''); setPromptProduk(''); setCustomVariables(''); setUseVisionAi(false); }} className="text-slate-500 hover:text-red-600"><X size={24}/></button>
          </div>
          <div className="grid gap-4 text-slate-900">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Nama Unit</label>
              <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full p-3 border border-slate-300 rounded-lg bg-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Kategori/Industri</label>
              <input value={category} onChange={e => setCategory(e.target.value)} type="text" className="w-full p-3 border border-slate-300 rounded-lg bg-white" />
            </div>
            <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-sm font-bold text-indigo-900">Gunakan Mata AI (Vision)</label>
                <p className="text-xs text-indigo-700 font-medium">Beri izin AI untuk membaca & mendeskripsikan gambar saat Auto-Pilot dijalankan.</p>
              </div>
              <button 
                type="button"
                onClick={() => setUseVisionAi(!useVisionAi)} 
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${useVisionAi ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${useVisionAi ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Custom Variables (JSON)</label>
              <textarea value={customVariables} onChange={e => setCustomVariables(e.target.value)} rows={2} className="w-full p-3 border border-slate-300 rounded-lg bg-white font-mono text-xs" placeholder='Contoh: {"promo": "Diskon 50%", "link": "https://brand.com"}'></textarea>
              <p className="text-[10px] text-slate-500 mt-1">Variabel ini bisa dipakai di caption dengan format &#123;promo&#125; atau &#123;link&#125;.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm mt-2">
              <h5 className="font-extrabold text-indigo-900 mb-4 border-b pb-2 flex items-center gap-2"><BrainCircuit size={18}/> Konfigurasi Otak AI (Knowledge Base)</h5>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">1. Target Audiens</label>
                  <input value={promptAudiens} onChange={e => setPromptAudiens(e.target.value)} type="text" className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50" placeholder="Contoh: Gen-Z, Mahasiswa, atau Ibu Rumah Tangga" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">2. Kepribadian & Peran AI</label>
                  <textarea value={promptKepribadian} onChange={e => setPromptKepribadian(e.target.value)} rows={2} className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50" placeholder="Contoh: Anda adalah admin yang asik, ramah, dan suka menggunakan emoji santai."></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">3. Informasi Produk & Harga (QnA)</label>
                  <textarea value={promptProduk} onChange={e => setPromptProduk(e.target.value)} rows={3} className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50" placeholder="Contoh: Kemeja Polos Rp100.000. Pengiriman dari Jakarta. Jika ada yang tanya ongkir, suruh cek di website."></textarea>
                </div>
              </div>
            </div>
            <button disabled={loading} type="submit" className="mt-2 bg-indigo-600 text-white py-3 rounded-lg font-bold flex justify-center gap-2">
              {loading ? 'Menyimpan...' : <><Save size={18}/> Simpan</>}
            </button>
          </div>
        </form>
      )}

      {units.length === 0 && !showForm ? (
        <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 rounded-xl border-2 border-dashed">Belum ada unit bisnis terdaftar.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {units.map(u => (
            <div key={u.id} className="p-6 rounded-xl border bg-white relative group">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => {
                  setEditingId(u.id);
                  setName(u.brand_name);
                  setCategory(u.business_category || '');
                  
                  const savedPrompt = u.ai_system_prompt || '';
                  if (savedPrompt.includes('[Target Audiens]')) {
                    const audiensMatch = savedPrompt.match(/\[Target Audiens\]\n([\s\S]*?)\n\n\[Kepribadian AI\]/);
                    const kepribadianMatch = savedPrompt.match(/\[Kepribadian AI\]\n([\s\S]*?)\n\n\[Produk & Harga\]/);
                    const produkMatch = savedPrompt.match(/\[Produk & Harga\]\n([\s\S]*)$/);
                    
                    setPromptAudiens(audiensMatch ? audiensMatch[1] : '');
                    setPromptKepribadian(kepribadianMatch ? kepribadianMatch[1] : '');
                    setPromptProduk(produkMatch ? produkMatch[1] : '');
                  } else {
                    setPromptAudiens('');
                    setPromptKepribadian(savedPrompt);
                    setPromptProduk('');
                  }
                  
                  setCustomVariables(u.custom_variables ? JSON.stringify(u.custom_variables, null, 2) : '');
                  setUseVisionAi(u.use_vision_ai || false);
                  
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} className="text-slate-400 hover:text-indigo-600 bg-slate-100 p-1.5 rounded-md"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(u.id)} className="text-slate-400 hover:text-red-600 bg-slate-100 p-1.5 rounded-md"><Trash2 size={16} /></button>
              </div>
              <div className="font-extrabold text-xl text-slate-900">{u.brand_name}</div>
              <div className="text-sm text-indigo-700 font-bold mt-1">{u.business_category || 'Tanpa Kategori'}</div>
              <div className="text-sm text-slate-600 mt-3 line-clamp-2 bg-slate-50 p-2 rounded">{u.ai_system_prompt || 'Tidak ada custom prompt'}</div>
              {u.use_vision_ai && (
                <div className="mt-3 inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[10px] px-2 py-1 rounded-full font-bold">
                  👁️ Mata AI Aktif
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
