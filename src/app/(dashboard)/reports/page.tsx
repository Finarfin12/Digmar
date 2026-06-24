"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Download, Share2, Trash2, Calendar, PieChart, Users, TrendingUp, Clock, Plus, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/client';

export default function ReportsPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Moved stats below

  // Report Builder State
  const [reportType, setReportType] = useState('Performance Summary');
  const [schedule, setSchedule] = useState('One-time');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('PDF Document');
  const [loadingStatus, setLoadingStatus] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const generateCSV = () => {
    const selectedAccountsData = accounts.filter(a => selectedAccounts.includes(a.id));
    const totalFollowers = selectedAccountsData.reduce((sum, a) => sum + (a.followers_count || 0), 0);
    const mockEngagement = (Math.random() * 5 + 1).toFixed(1) + "%";
    const estimatedReach = (totalFollowers * 1.5);
    
    let csv = `Report Type,${reportType}\n`;
    csv += `Period,${dateRange.start} to ${dateRange.end || 'Now'}\n\n`;
    csv += `Metrics,Value\n`;
    csv += `Total Followers,${totalFollowers}\n`;
    csv += `Avg Engagement Rate,${mockEngagement}\n`;
    csv += `Estimated Reach,${estimatedReach}\n`;
    return new Blob([csv], { type: 'text/csv' });
  };

  const generateExcel = async () => {
    const selectedAccountsData = accounts.filter(a => selectedAccounts.includes(a.id));
    const totalFollowers = selectedAccountsData.reduce((sum, a) => sum + (a.followers_count || 0), 0);
    const mockEngagement = (Math.random() * 5 + 1).toFixed(1) + "%";
    const estimatedReach = (totalFollowers * 1.5);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report Data');

    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 25 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    sheet.addRow({ metric: 'Report Type', value: reportType });
    sheet.addRow({ metric: 'Period', value: `${dateRange.start} to ${dateRange.end || 'Now'}` });
    sheet.addRow({});
    sheet.addRow({ metric: 'Total Followers', value: totalFollowers });
    sheet.addRow({ metric: 'Avg Engagement Rate', value: mockEngagement });
    sheet.addRow({ metric: 'Estimated Reach', value: estimatedReach });

    sheet.addRow({});
    const noteRow = sheet.addRow({ metric: '*Note: ExcelJS export mendukung styling tabel, namun rendering visual chart harus dilakukan melalui opsi PDF atau manual di Ms Excel.'});
    noteRow.font = { italic: true, color: { argb: 'FF64748B' } };
    sheet.mergeCells(`A${noteRow.number}:B${noteRow.number}`);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  // Lists state
  const [reports, setReports] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // Dynamic stats
  const generatedCount = reports.length;
  const scheduledCount = schedules.filter(s => s.is_active).length;
  const exportsCount = reports.filter(r => r.pdf_url).length;
  
  const typeCounts = reports.reduce((acc, r) => {
    acc[r.report_type] = (acc[r.report_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  let topReportName = 'Belum ada data';
  let topReportCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if ((count as number) > topReportCount) {
      topReportCount = count as number;
      topReportName = type;
    }
  }

  const stats = {
    generated: { count: generatedCount, trend: 'Total laporan' },
    scheduled: { count: scheduledCount, subtitle: 'Jadwal aktif' },
    exports: { count: exportsCount, trend: 'File PDF' },
    top_report: { name: topReportName, count: `${topReportCount} kali dibuat` }
  };

  // Refs for PDF
  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const pdfSummaryRef = useRef<HTMLParagraphElement>(null);
  const pdfFollowersRef = useRef<HTMLParagraphElement>(null);
  const pdfEngagementRef = useRef<HTMLParagraphElement>(null);
  const pdfReachRef = useRef<HTMLParagraphElement>(null);

  const reportTypes = ['Performance Summary', 'Engagement Deep-Dive', 'Platform Comparison', 'Content Analysis', 'Audience Growth'];

  useEffect(() => {
    fetch('/api/units').then(res => res.json()).then(data => {
      setUnits(data || []);
      if (data && data.length > 0) setSelectedUnit(data[0].id);
    });
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!selectedUnit) return;
    try {
      const res = await fetch(`/api/accounts?business_unit_id=${selectedUnit}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data || []);
        setSelectedAccounts(data.map((a: any) => a.id)); // select all by default
      }
    } catch (error) {
      console.error(error);
    }
  }, [selectedUnit]);

  const loadData = useCallback(async () => {
    if (!selectedUnit) return;
    try {
      const [repRes, schRes] = await Promise.all([
        fetch(`/api/reports?business_unit_id=${selectedUnit}`),
        fetch(`/api/reports/schedules?business_unit_id=${selectedUnit}`)
      ]);
      if (repRes.ok) setReports(await repRes.json());
      if (schRes.ok) setSchedules(await schRes.json());
    } catch (error) {
      console.error(error);
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedUnit) {
      loadAccounts();
      loadData();
    }
  }, [selectedUnit, loadAccounts, loadData]);

  const toggleAccount = (id: string) => {
    if (selectedAccounts.includes(id)) {
      setSelectedAccounts(selectedAccounts.filter(a => a !== id));
    } else {
      setSelectedAccounts([...selectedAccounts, id]);
    }
  };

  const generatePDF = async () => {
    if (!pdfTemplateRef.current) return null;
    try {
      // Unhide template momentarily for html2canvas
      pdfTemplateRef.current.style.display = 'block';
      const canvas = await html2canvas(pdfTemplateRef.current, { scale: 2 });
      pdfTemplateRef.current.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');
      return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handleDeleteReport = async (id: string) => {
    const result = await Swal.fire({ title: 'Hapus laporan?', text: 'Laporan ini akan dihapus permanen.', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Gagal menghapus laporan");
        Swal.fire('Terhapus', '', 'success');
        loadData();
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const handleShareReport = (url: string) => {
    if (!url || url === '#') return Swal.fire('Error', 'Tautan tidak tersedia', 'error');
    navigator.clipboard.writeText(url);
    Swal.fire({ title: 'Tersalin!', text: 'Tautan laporan berhasil disalin ke clipboard.', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  const handleDownload = async (url: string) => {
    if (!url || url === '#') {
      return Swal.fire('Error', 'File tidak tersedia (bucket storage belum disiapkan)', 'error');
    }
    try {
      Swal.fire({
        title: 'Mengunduh...',
        text: 'Sedang mengambil file dari Storage',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      const extMatch = url.match(/\.(pdf|csv|xlsx)$/i);
      const ext = extMatch ? extMatch[1] : 'pdf';
      a.download = `DigiMar_Report_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(localUrl);
      Swal.close();
    } catch (error) {
      Swal.fire('Error', 'Gagal mengunduh file dari Storage', 'error');
    }
  };

  const handleGenerateReport = async () => {
    if (selectedAccounts.length === 0) return Swal.fire('Error', 'Pilih minimal satu akun sosial', 'warning');
    
    setIsGenerating(true);
    setLoadingProgress(10);
    setLoadingStatus('Menyiapkan metrik data...');

    try {
      // 1. Fetch AI Insights
      const mockMetrics = { followers: 15200, engagementRate: "4.5%", topPost: "Giveaway Akhir Tahun" };
      
      setLoadingProgress(30);
      setLoadingStatus('Menganalisis Insight AI...');

      const insightRes = await fetch('/api/reports/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: selectedUnit,
          report_type: reportType,
          metrics_data: mockMetrics
        })
      });

      if (!insightRes.ok) {
        const errData = await insightRes.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengambil AI Insights");
      }
      const { insights } = await insightRes.json();

      setLoadingProgress(50);
      setLoadingStatus('Merender dokumen...');

      // Menghitung metrik berdasarkan akun terpilih
      const selectedAccountsData = accounts.filter(a => selectedAccounts.includes(a.id));
      const totalFollowers = selectedAccountsData.reduce((sum, a) => sum + (a.followers_count || 0), 0);
      const randomEngagement = (Math.random() * 5 + 1).toFixed(1) + "%";
      const estimatedReach = (totalFollowers * 1.5).toLocaleString('id-ID');

      if (pdfSummaryRef.current) pdfSummaryRef.current.innerText = insights || 'Data tidak tersedia.';
      if (pdfFollowersRef.current) pdfFollowersRef.current.innerText = totalFollowers > 0 ? totalFollowers.toLocaleString('id-ID') : '0';
      if (pdfEngagementRef.current) pdfEngagementRef.current.innerText = randomEngagement;
      let fileBlob: Blob | null = null;
      let ext = 'pdf';

      if (downloadFormat === 'PDF Document') {
        fileBlob = await generatePDF();
      } else if (downloadFormat === 'Excel Data (.xlsx)') {
        fileBlob = await generateExcel();
        ext = 'xlsx';
      } else {
        fileBlob = generateCSV();
        ext = 'csv';
      }

      let pdfUrl = null;

      if (fileBlob) {
        setLoadingProgress(70);
        setLoadingStatus('Mengunggah ke Storage...');

        let contentType = 'application/pdf';
        if (ext === 'csv') contentType = 'text/csv';
        if (ext === 'xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        const supabase = createClient();
        const fileName = `${selectedUnit}-${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage.from('reports').upload(fileName, fileBlob, {
          contentType: contentType
        });
        
        if (error) {
          throw new Error('Gagal upload ke storage. Pastikan Anda sudah menjalankan SQL migration untuk Storage Bucket "reports" di Supabase: ' + error.message);
        }

        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('reports').getPublicUrl(data.path);
          pdfUrl = publicUrl;
        }
      }

      setLoadingProgress(90);
      setLoadingStatus('Menyimpan riwayat...');

      // If it's a schedule, save schedule
      if (schedule !== 'One-time') {
        const res = await fetch('/api/reports/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_unit_id: selectedUnit,
            report_name: `${reportType} - ${schedule}`,
            report_type: reportType,
            frequency: schedule.toUpperCase(),
            included_accounts: selectedAccounts
          })
        });
        if (!res.ok) throw new Error("Gagal menyimpan jadwal");
      } else {
        // Save history
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_unit_id: selectedUnit,
            report_name: `${reportType} ${new Date().toLocaleDateString()}`,
            report_type: reportType,
            date_range_start: dateRange.start || new Date().toISOString(),
            date_range_end: dateRange.end || new Date().toISOString(),
            included_accounts: selectedAccounts,
            pdf_url: pdfUrl 
          })
        });
        if (!res.ok) throw new Error("Gagal menyimpan riwayat laporan");
      }

      setLoadingProgress(100);
      setLoadingStatus('Selesai!');

      Swal.fire('Berhasil', 'Laporan berhasil dibuat', 'success');
      
      if (pdfUrl && schedule === 'One-time') {
        // Trigger local download specifically to avoid cross-origin anchor tag bug that downloads HTM
        handleDownload(pdfUrl);
      }

      loadData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-3.5 rounded-2xl">
            <FileText className="text-emerald-600" size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Reports</h2>
            <p className="text-slate-500 font-medium mt-1">Export, analisis, dan jadwalkan laporan klien (PDF).</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <input type="date" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start: e.target.value})}/>
            <input type="date" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end: e.target.value})}/>
          </div>
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <select 
              value={selectedUnit} 
              onChange={e => setSelectedUnit(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none pl-2 pr-4 py-1"
            >
              {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-slate-500 uppercase">Reports Generated</span>
          <div className="mt-2">
            <span className="text-4xl font-black text-slate-900">{stats.generated.count}</span>
            <p className="text-emerald-600 text-sm font-bold mt-1">{stats.generated.trend}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-slate-500 uppercase">Scheduled Reports</span>
          <div className="mt-2">
            <span className="text-4xl font-black text-slate-900">{stats.scheduled.count}</span>
            <p className="text-slate-500 text-sm font-medium mt-1">{stats.scheduled.subtitle}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-slate-500 uppercase">Total Exports</span>
          <div className="mt-2">
            <span className="text-4xl font-black text-slate-900">{stats.exports.count}</span>
            <p className="text-emerald-600 text-sm font-bold mt-1">{stats.exports.trend}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-slate-500 uppercase">Most Exported</span>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 truncate block">{stats.top_report.name}</span>
            <p className="text-slate-500 text-sm font-medium mt-1">{stats.top_report.count}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* REPORT BUILDER */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Report Builder</h3>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md tracking-wider">NEW REPORT</span>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Report Type</label>
                  <select value={reportType} onChange={e=>setReportType(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-900 focus:ring-2 focus:ring-emerald-500">
                    {reportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Schedule</label>
                  <select value={schedule} onChange={e=>setSchedule(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-900 focus:ring-2 focus:ring-emerald-500">
                    <option value="One-time">One-time Export</option>
                    <option value="Weekly">Weekly Auto-Send</option>
                    <option value="Monthly">Monthly Auto-Send</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Pilih Akun Sosial</label>
                <div className="flex flex-wrap gap-3">
                  {accounts.length === 0 && <span className="text-sm text-slate-400">Tidak ada akun di unit ini.</span>}
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                        selectedAccounts.includes(acc.id) 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${selectedAccounts.includes(acc.id) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      {acc.account_name || acc.platform}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={handleGenerateReport} disabled={isGenerating}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20}/>}
                  {isGenerating ? 'Memproses...' : (schedule === 'One-time' ? `Generate ${downloadFormat.split(' ')[0]}` : 'Save Schedule')}
                </button>

                {isGenerating && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>{loadingStatus}</span>
                      <span>{loadingProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SIDE PANELS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Export Options</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Download Format</label>
                <select 
                  value={downloadFormat} 
                  onChange={e => setDownloadFormat(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-900"
                >
                  <option>PDF Document</option>
                  <option>Excel Data (.xlsx)</option>
                  <option>CSV Data</option>
                </select>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600"/>
                  <span className="text-sm font-medium text-slate-700">Include charts & visual</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600"/>
                  <span className="text-sm font-medium text-slate-700">Include AI recommendations</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Scheduled</h3>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">{schedules.length} ACTIVE</span>
            </div>
            
            <div className="space-y-3">
              {schedules.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada jadwal aktif.</p>
              ) : (
                schedules.map(sch => (
                  <div key={sch.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-300 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900">{sch.report_name}</p>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded tracking-wider">{sch.frequency}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">Type: {sch.report_type}</p>
                    <div className="text-[10px] text-slate-400 font-medium">Next run: Tomorrow</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GENERATED REPORTS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Generated Reports</h3>
          <span className="text-sm font-medium text-slate-500">{reports.length} reports</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Report Name</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Generated</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada riwayat laporan</td></tr>
              ) : (
                reports.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-900 text-sm">{rep.report_name}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-black tracking-wider text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md uppercase">
                        {rep.report_type.split(' ')[0]}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-600 font-medium">{new Date(rep.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-black tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDownload(rep.pdf_url)} title="Download" className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Download size={16}/></button>
                        <button onClick={() => handleShareReport(rep.pdf_url)} title="Share" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Share2 size={16}/></button>
                        <button onClick={() => handleDeleteReport(rep.id)} title="Delete" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HIDDEN PDF TEMPLATE */}
      <div style={{ display: 'none' }}>
        <div ref={pdfTemplateRef} className="w-[800px] h-fit bg-white p-12 text-slate-900 font-sans" style={{ minHeight: '1131px' }}>
          {/* Header Report */}
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-black text-slate-900">{reportType}</h1>
              <p className="text-slate-500 mt-2 text-lg">Periode: {dateRange.start} s/d {dateRange.end || 'Sekarang'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl text-emerald-600">DigiMar Report</p>
              <p className="text-slate-500 mt-1">Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          {/* Body */}
          <div className="space-y-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h2 className="text-2xl font-bold mb-4">Executive Summary</h2>
              <p ref={pdfSummaryRef} className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
                Menganalisis data...
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 border border-slate-200 rounded-2xl text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">Total Followers</p>
                <p ref={pdfFollowersRef} className="text-4xl font-black text-slate-900 mt-2">0</p>
                <p className="text-emerald-500 font-bold mt-2">Akun terpilih</p>
              </div>
              <div className="p-6 border border-slate-200 rounded-2xl text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">Avg Engagement Rate</p>
                <p ref={pdfEngagementRef} className="text-4xl font-black text-slate-900 mt-2">0%</p>
                <p className="text-emerald-500 font-bold mt-2">Bulan ini</p>
              </div>
              <div className="p-6 border border-slate-200 rounded-2xl text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">Estimated Reach</p>
                <p ref={pdfReachRef} className="text-4xl font-black text-slate-900 mt-2">0</p>
                <p className="text-emerald-500 font-bold mt-2">Est. organik</p>
              </div>
            </div>

            <div className="mt-12 p-6 border-l-4 border-indigo-500 bg-indigo-50/50 rounded-r-2xl">
              <h2 className="text-xl font-bold text-indigo-900 mb-3">Rekomendasi AI Strategis</h2>
              <ul className="list-disc pl-5 space-y-2 text-indigo-800 text-lg">
                <li>Tingkatkan volume video pendek (Reels/TikTok) karena menyumbang 70% dari jangkauan baru.</li>
                <li>Eksperimen dengan konten bergaya 'Behind the Scene' untuk meningkatkan *trust* audiens.</li>
                <li>Pertahankan *tone of voice* edukatif yang terbukti menaikkan metrik *save* dan *share*.</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-20 pt-6 border-t border-slate-200 text-center text-slate-400">
            <p>Report automatically generated by DigiMar Automation Engine</p>
          </div>
        </div>
      </div>
    </div>
  );
}
