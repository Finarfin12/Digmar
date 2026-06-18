"use client";
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

interface BulkImportModalProps {
  units: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
}

export default function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/posts/bulk', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setResult(data);

      if (data.failed === 0) {
        Swal.fire({ title: 'Sukses!', text: `${data.success} post berhasil diimport.`, icon: 'success' });
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: unknown) {
      Swal.fire('Error', err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const sampleCSV = `target_account_ids,scheduled_at,caption,first_comment,media_urls,post_type,cover_url,tone_voice,content_idea
"UUID_AKUN_IG","2026-06-20 15:00","Promo Ramadhan Diskon 50%","Cek link bio!","","single_image","","profesional",""
"UUID_AKUN_IG","2026-06-21 09:00","Produk baru kami sudah tersedia","","https://storage/photo.jpg","single_image","","santai",""`;

  const downloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'digimar_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Upload size={20} className="text-emerald-600" /> Import CSV Bulk
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 bg-slate-100 rounded-full p-2"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600 font-medium">Upload file CSV dengan format:</p>
            <button onClick={downloadSample} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <FileText size={14} /> Download Template
            </button>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg font-mono">
            target_account_ids, scheduled_at, caption, first_comment, media_urls, post_type, cover_url, tone_voice, content_idea
          </div>

          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
                <FileText size={20} /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            ) : (
              <div className="text-slate-500 text-sm font-medium">
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                Klik atau drag CSV ke sini
              </div>
            )}
          </div>

          {result && (
            <div className={`p-4 rounded-xl ${result.failed === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2 font-bold">
                {result.failed === 0 ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
                {result.total} baris: {result.success} sukses, {result.failed} gagal
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-700 bg-red-50 p-2 rounded">
                      Baris {e.row}: {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {importing ? 'Mengimport...' : 'Import Sekarang'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
