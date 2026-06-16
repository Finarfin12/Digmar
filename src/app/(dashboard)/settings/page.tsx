"use client";

import { useState, useEffect } from 'react';
import { Settings2, PlusCircle, Key, Link as LinkIcon, Instagram, Briefcase } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'units' | 'social' | 'ai'>('units');
  const [units, setUnits] = useState([]);
  const [providers, setProviders] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, pRes, aRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/providers'),
        fetch('/api/accounts')
      ]);
      if (uRes.ok) setUnits(await uRes.json());
      if (pRes.ok) setProviders(await pRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const addUnit = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Tambah Unit Bisnis',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="Nama Unit">
        <input id="swal-input2" class="swal2-input" placeholder="Kategori (Misal: Retail)">
        <textarea id="swal-input3" class="swal2-textarea" placeholder="AI System Prompt"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        return {
          name: (document.getElementById('swal-input1') as HTMLInputElement).value,
          category: (document.getElementById('swal-input2') as HTMLInputElement).value,
          ai_system_prompt: (document.getElementById('swal-input3') as HTMLTextAreaElement).value
        }
      }
    });

    if (formValues?.name) {
      MySwal.fire({ title: 'Menyimpan...', allowOutsideClick: false });
      MySwal.showLoading();
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) {
        MySwal.fire('Berhasil!', 'Unit berhasil ditambahkan.', 'success');
        fetchData();
      } else {
        MySwal.fire('Error', 'Gagal menyimpan', 'error');
      }
    }
  };

  const addAccount = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Hubungkan Akun Sosial',
      html: `
        <select id="swal-unit" class="swal2-input">
          ${units.map((u: any) => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select>
        <select id="swal-platform" class="swal2-input">
          <option value="instagram">Instagram</option>
          <option value="threads">Threads</option>
        </select>
        <input id="swal-ig-user" class="swal2-input" placeholder="User ID / Username">
        <input id="swal-token" class="swal2-input" type="password" placeholder="Access Token">
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        return {
          business_unit_id: (document.getElementById('swal-unit') as HTMLSelectElement).value,
          platform: (document.getElementById('swal-platform') as HTMLSelectElement).value,
          ig_user_id: (document.getElementById('swal-ig-user') as HTMLInputElement).value,
          access_token: (document.getElementById('swal-token') as HTMLInputElement).value
        }
      }
    });

    if (formValues?.access_token) {
      MySwal.fire({ title: 'Mengamankan Token...', allowOutsideClick: false });
      MySwal.showLoading();
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) {
        MySwal.fire('Berhasil!', 'Token dienkripsi dan disimpan.', 'success');
        fetchData();
      } else {
        MySwal.fire('Error', 'Gagal menyimpan', 'error');
      }
    }
  };

  const addProvider = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Konfigurasi AI Provider',
      html: `
        <select id="swal-prov-name" class="swal2-input">
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="vps">VPS Lokal</option>
        </select>
        <input id="swal-model" class="swal2-input" placeholder="Nama Model (opsional)">
        <input id="swal-api-key" class="swal2-input" type="password" placeholder="API Key">
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        return {
          provider_name: (document.getElementById('swal-prov-name') as HTMLSelectElement).value,
          model: (document.getElementById('swal-model') as HTMLInputElement).value,
          api_key: (document.getElementById('swal-api-key') as HTMLInputElement).value
        }
      }
    });

    if (formValues?.api_key) {
      MySwal.fire({ title: 'Menyimpan Konfigurasi...', allowOutsideClick: false });
      MySwal.showLoading();
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) {
        MySwal.fire('Berhasil!', 'API Key disimpan dengan aman.', 'success');
        fetchData();
      } else {
        MySwal.fire('Error', 'Gagal menyimpan', 'error');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-3">
        <div className="bg-indigo-100 p-3 rounded-xl shadow-sm">
          <Settings2 className="text-indigo-600" size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Pengaturan</h2>
          <p className="text-slate-500 mt-1">Konfigurasi pusat untuk API Key dan Unit Bisnis.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('units')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'units' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Unit Bisnis</button>
        <button onClick={() => setActiveTab('social')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'social' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Akun Sosial (API)</button>
        <button onClick={() => setActiveTab('ai')} className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${activeTab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>AI Provider (API)</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all">
        {activeTab === 'units' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Briefcase className="text-indigo-500" size={20}/> Unit Bisnis</h3>
                <p className="text-slate-500 text-sm mt-1">Daftar entitas atau brand yang Anda kelola.</p>
              </div>
              <button onClick={addUnit} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all transform hover:scale-105 active:scale-95">
                <PlusCircle size={18} /> Tambah Unit
              </button>
            </div>
            {units.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada unit bisnis.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {units.map((u: any) => (
                  <div key={u.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group bg-white">
                    <div className="font-bold text-lg text-slate-800">{u.name}</div>
                    <div className="text-sm text-indigo-600 font-medium">{u.category}</div>
                    <div className="text-xs text-slate-500 mt-3 truncate">{u.ai_system_prompt || 'Tidak ada custom prompt'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'social' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Instagram className="text-pink-500" size={20}/> Akun Sosial Media</h3>
                <p className="text-slate-500 text-sm mt-1">Hubungkan API Token Instagram / Threads di sini.</p>
              </div>
              <button onClick={addAccount} className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all transform hover:scale-105 active:scale-95">
                <LinkIcon size={18} /> Hubungkan Akun
              </button>
            </div>
            {accounts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada akun yang dihubungkan.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((a: any) => (
                  <div key={a.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-pink-50/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg text-slate-800 capitalize">{a.platform}</div>
                        <div className="text-sm text-slate-500 font-medium">User: {a.ig_user_id}</div>
                      </div>
                      <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Terkoneksi</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Key className="text-amber-500" size={20}/> AI Provider (API)</h3>
                <p className="text-slate-500 text-sm mt-1">Konfigurasi API Key Groq, OpenAI, Anthropic, dll.</p>
              </div>
              <button onClick={addProvider} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all transform hover:scale-105 active:scale-95">
                <PlusCircle size={18} /> Tambah Konfigurasi AI
              </button>
            </div>
            {providers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada penyedia AI yang dikonfigurasi. Menggunakan fallback bawaan sistem.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((p: any) => (
                  <div key={p.id} className="p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg text-slate-800 capitalize">{p.provider_name}</div>
                        <div className="text-sm text-slate-500 font-medium">Model: {p.model || 'Default'}</div>
                      </div>
                      {p.has_key && <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Key Tersimpan</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
