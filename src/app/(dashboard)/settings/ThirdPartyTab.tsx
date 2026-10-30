"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, AlertCircle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ThirdPartyTab() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessUnitId, setBusinessUnitId] = useState('');
  
  const [useSerpApi, setUseSerpApi] = useState(false);
  const [serpApiKey, setSerpApiKey] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        
        const { data: bu, error } = await supabase
          .from('business_units')
          .select('id, use_serpapi, serpapi_key')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (bu) {
          setBusinessUnitId(bu.id);
          setUseSerpApi(bu.use_serpapi || false);
          setSerpApiKey(bu.serpapi_key || '');
        }
      } catch (err) {
        console.error("Error fetching third party settings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    if (!businessUnitId) {
      Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu.', 'error');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_units')
        .update({
          use_serpapi: useSerpApi,
          serpapi_key: serpApiKey
        })
        .eq('id', businessUnitId);

      if (error) throw error;
      
      Swal.fire({
        title: 'Berhasil!',
        text: 'Pengaturan API Pihak Ketiga telah disimpan.',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
    } catch (err: unknown) {
      Swal.fire('Gagal Menyimpan', (err as Error).message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center items-center">
        <RefreshCw className="animate-spin text-indigo-500" size={24} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h3 className="text-xl font-extrabold text-slate-900 mb-1">Integrasi Pihak Ketiga</h3>
        <p className="text-sm text-slate-500">Konfigurasi API eksternal untuk memperkuat fitur analisis DigiMar.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-bold text-slate-800">SerpApi (Google Search & Trends)</h4>
              <p className="text-sm text-slate-600 mt-1">Mengaktifkan pencarian Google Trends & Keyword secara real-time.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={useSerpApi}
                onChange={(e) => setUseSerpApi(e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {useSerpApi && (
            <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                SerpApi API Key
              </label>
              <input
                type="password"
                value={serpApiKey}
                onChange={(e) => setSerpApiKey(e.target.value)}
                placeholder="Kosongkan jika menggunakan token default sistem"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
              />
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Perhatian:</strong> Free tier SerpApi membatasi 250 request per bulan. 
                  Sistem DigiMar memiliki <em>Circuit Breaker</em> yang akan mengunci fitur ini secara otomatis 
                  jika menyentuh batas 250 pemakaian dalam bulan berjalan.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !businessUnitId}
            className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
