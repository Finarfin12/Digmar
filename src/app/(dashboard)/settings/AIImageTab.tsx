"use client";

import { useState, useEffect } from 'react';
import { ImagePlus, PlusCircle, Save, Trash2, Eye, EyeOff, X, Activity } from 'lucide-react';
import Swal from 'sweetalert2';

interface ImageProviderState {
  provider_type: string | null;
  model: string | null;
  has_key: boolean;
  config: Record<string, unknown> | null;
}

export default function AIImageTab() {
  const [provider, setProvider] = useState<ImageProviderState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [providerType, setProviderType] = useState('dalle');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('standard');
  const [style, setStyle] = useState('vivid');
  const [testing, setTesting] = useState(false);

  const handleTestProvider = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/health', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_type: 'image', model, api_key: key })
      });
      const data = await res.json();

      const stepsHtml = data.steps
        ? data.steps.map((s: { step: string; status: string; detail: string; duration_ms: number }) =>
            `<div style="margin:4px 0;padding:6px 10px;border-radius:6px;font-size:12px;text-align:left;${s.status === 'pass' ? 'background:#ecfdf5;color:#065f46' : s.status === 'fail' ? 'background:#fef2f2;color:#991b1b' : 'background:#f8fafc;color:#64748b'}">
              <b>${s.status.toUpperCase()}</b> ${s.step}: ${s.detail} (${s.duration_ms}ms)
            </div>`).join('')
        : '';

      Swal.fire({
        title: data.summary === 'pass' ? '✅ Image Provider Sehat' : '⚠️ Ada Masalah',
        html: `<div style="max-height:400px;overflow-y:auto">${stepsHtml}</div>`,
        icon: data.summary === 'pass' ? 'success' : 'warning',
        confirmButtonText: 'Tutup',
      });
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const fetchProvider = async () => {
    try {
      const res = await fetch('/api/providers/image');
      if (res.ok) {
        const data = await res.json();
        if (data && data.provider_type) {
          setProvider(data);
          setProviderType(data.provider_type);
          setModel(data.model || '');
        } else {
          setProvider(null);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => { fetchProvider(); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const handleProviderChange = (val: string) => {
    setProviderType(val);
    if (val === 'dalle') {
      setModel('dall-e-3');
      setSize('1024x1024');
      setQuality('standard');
      setStyle('vivid');
    } else if (val === 'stability') {
      setModel('stable-diffusion-xl');
    } else if (val === 'leonardo') {
      setModel('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      return Swal.fire('Error', 'API Key wajib diisi', 'error');
    }
    setLoading(true);
    try {
      const res = await fetch('/api/providers/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_type: providerType,
          api_key: key,
          model,
          config: providerType === 'dalle' ? { size, quality, style } : {},
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      Swal.fire('Berhasil!', 'Image AI Provider tersimpan', 'success');
      setShowForm(false);
      setKey('');
      fetchProvider();
    } catch (e: unknown) {
      Swal.fire('Error', (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Hapus konfigurasi?',
      text: 'Anda tidak bisa generate gambar AI sampai provider dikonfigurasi ulang.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
    });
    if (!result.isConfirmed) return;

    const res = await fetch('/api/providers/image', { method: 'DELETE' });
    if (res.ok) {
      setProvider(null);
      setKey('');
      Swal.fire('Terhapus', 'Konfigurasi image AI telah dihapus', 'success');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ImagePlus className="text-fuchsia-500" size={20} /> AI Provider - Image
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Konfigurasi untuk generate gambar fotorealistik. Mendukung <b>DALL-E 3</b>, <b>Stable Diffusion</b>, dan <b>Leonardo AI</b>.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2">
            <PlusCircle size={18} /> {provider ? 'Edit Provider' : 'Tambah API Key'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-100 p-6 rounded-xl border border-slate-300 mb-8">
          <div className="flex justify-between mb-4">
            <h4 className="font-extrabold text-lg text-slate-900">Kredensial Image AI</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-red-600"><X /></button>
          </div>

          <div className="grid gap-4">
            <select
              required
              value={providerType}
              onChange={e => handleProviderChange(e.target.value)}
              className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg"
            >
              <option value="dalle">DALL-E 3 (OpenAI)</option>
              <option value="stability">Stable Diffusion (Stability AI)</option>
              <option value="leonardo">Leonardo AI</option>
            </select>

            <div className="relative">
              <input
                required
                value={key}
                onChange={e => setKey(e.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder={provider?.has_key ? '(API Key sudah tersimpan — isi hanya jika ingin mengubah)' : 'API Key'}
                className="w-full p-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-fuchsia-400"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3 text-slate-400">
                {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              type="text"
              placeholder="Model (dall-e-3 / stable-diffusion-xl / ...)"
              className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg"
            />

            {providerType === 'dalle' && (
              <div className="grid grid-cols-3 gap-4">
                <select value={size} onChange={e => setSize(e.target.value)} className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                  <option value="1024x1024">1024×1024 (Square)</option>
                  <option value="1792x1024">1792×1024 (Landscape)</option>
                  <option value="1024x1792">1024×1792 (Portrait)</option>
                </select>
                <select value={quality} onChange={e => setQuality(e.target.value)} className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                  <option value="standard">Standard</option>
                  <option value="hd">HD</option>
                </select>
                <select value={style} onChange={e => setStyle(e.target.value)} className="p-3 border border-slate-300 bg-white text-slate-900 rounded-lg">
                  <option value="vivid">Vivid</option>
                  <option value="natural">Natural</option>
                </select>
              </div>
            )}

            <button disabled={loading} type="submit" className="mt-2 bg-fuchsia-500 hover:bg-fuchsia-600 text-white py-3 rounded-lg font-bold transition-colors">
              <Save className="inline mr-2" size={18} /> Simpan Kredensial Image AI
            </button>
            <button type="button" onClick={handleTestProvider} disabled={testing} className="mt-2 bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
              <Activity size={18} className={testing ? 'animate-spin' : ''} /> {testing ? 'Testing...' : 'Test Provider'}
            </button>
          </div>
        </form>
      )}

      {provider && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-6 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 relative">
            <button onClick={handleDelete} className="absolute top-4 right-4 text-fuchsia-300 hover:text-red-500">
              <Trash2 size={20} />
            </button>
            <div className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
              <ImagePlus size={20} className="text-fuchsia-500" /> {provider.provider_type?.toUpperCase()}
            </div>
            <div className="text-sm mt-2 text-slate-700">Model: {provider.model || 'Default'}</div>
            {provider.config && typeof provider.config === 'object' && Object.keys(provider.config).length > 0 && (
              <div className="text-sm text-slate-700 mt-1">
                Config: {JSON.stringify(provider.config)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
