"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { ListOrdered, PlusCircle, Trash2, Clock, CalendarDays, Loader2, Image as ImageIcon, Send, AlertCircle, CheckCircle2, Hourglass, Play, ClipboardCheck, XCircle, Link as LinkIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import type { BusinessUnit } from '@/types';

interface Schedule {
  id: string;
  business_unit_id: string;
  day_of_week: number;
  time_of_day: string;
  is_active: boolean;
}

interface ContentItem {
  id: string;
  business_unit_id: string;
  media_urls: string[];
  caption: string;
  first_comment: string;
  post_type: string;
  priority: number;
}

interface ScheduledPost {
  id: string;
  job_code: string;
  target_account_ids: string[];
  scheduled_at: string;
  media_urls: string[];
  caption: string;
  first_comment?: string;
  post_type: string;
  status: 'waiting' | 'processing' | 'success' | 'partial' | 'failed' | 'pending_review' | 'rejected' | 'draft' | string;
  log_messages?: Array<Record<string, unknown>>;
  approval_token?: string | null;
  review_note?: string | null;
  reviewed_by?: string | null;
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const statusStyles: Record<string, { label: string; className: string; icon: ReactNode }> = {
  waiting: { label: 'Menunggu publish', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Hourglass size={13} /> },
  processing: { label: 'Sedang diproses', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Loader2 size={13} className="animate-spin" /> },
  success: { label: 'Sudah publish', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  partial: { label: 'Sebagian berhasil', className: 'bg-orange-50 text-orange-700 border-orange-200', icon: <AlertCircle size={13} /> },
  failed: { label: 'Gagal publish', className: 'bg-red-50 text-red-700 border-red-200', icon: <AlertCircle size={13} /> },
  skipped: { label: 'Di-skip (belum didukung)', className: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Clock size={13} /> },
  draft: { label: 'Draft', className: 'bg-slate-50 text-slate-600 border-slate-200', icon: <Clock size={13} /> },
  pending_review: { label: 'Menunggu persetujuan', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <ClipboardCheck size={13} /> },
  rejected: { label: 'Ditolak', className: 'bg-rose-50 text-rose-700 border-rose-200', icon: <XCircle size={13} /> },
};

function formatSchedule(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QueuePage() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  
  const [fetching, setFetching] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  const [newDay, setNewDay] = useState(1);
  const [newTime, setNewTime] = useState('09:00');

  useEffect(() => {
    fetch('/api/units')
      .then(r => r.json())
      .then(data => {
        setUnits(data);
        if (data.length > 0) setSelectedUnit(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedUnit) return;
    setFetching(true);
    Promise.all([
      fetch(`/api/queue/schedules?business_unit_id=${selectedUnit}`).then(r => r.json()),
      fetch(`/api/queue?business_unit_id=${selectedUnit}`).then(r => r.json()),
      fetch(`/api/posts?business_unit_id=${selectedUnit}&limit=100`).then(r => r.json())
    ]).then(async ([schedData, contData, postData]) => {
      setSchedules(schedData);
      setContents(contData);
      let posts = Array.isArray(postData) ? postData : [];
      if (posts.length === 0) {
        const fallbackRes = await fetch('/api/posts?limit=100');
        const fallbackData = await fallbackRes.json();
        posts = Array.isArray(fallbackData) ? fallbackData : [];
      }
      setScheduledPosts(posts);
      setFetching(false);
    });
  }, [selectedUnit]);

  const addSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/queue/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: selectedUnit, day_of_week: newDay, time_of_day: newTime })
      });
      if (!res.ok) throw new Error(await res.text());
      const newSched = await res.json();
      setSchedules([...schedules, newSched].sort((a, b) => a.day_of_week - b.day_of_week || a.time_of_day.localeCompare(b.time_of_day)));
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus jadwal rutin ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    await fetch(`/api/queue/schedules?id=${id}`, { method: 'DELETE' });
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const deleteContent = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus konten dari antrean?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    await fetch(`/api/queue?id=${id}`, { method: 'DELETE' });
    setContents(contents.filter(c => c.id !== id));
  };

  const handlePublishNow = async (postId: string) => {
    const result = await Swal.fire({
      title: 'Publish sekarang?',
      text: 'Post akan segera diproses ke akun tujuan.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, publish!',
    });
    if (!result.isConfirmed) return;

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const { processed, jobs, diagnostic } = data;
      const jobInfo = jobs?.map((j: { job: string; status: string; error?: string; retry_count?: number; token_preview?: string; accounts?: Array<{platform: string; error: string; token_preview?: string; token_length?: number; suggestion?: string; account_type?: string}>; skipped?: number }) => {
        const retryInfo = j.retry_count != null ? ` (retry #${j.retry_count})` : '';
        const errInfo = j.error ? ` — ❌ ${j.error}` : '';
        const tokenInfo = j.token_preview ? `<br>  🔑 Token: ${j.token_preview} (${j.token_preview.length > 4 ? 'decrypted OK' : 'empty/corrupt'})` : '';
        const accountErrors = j.accounts?.map(a => {
          const errMsg = `  ↳ ${a.platform}: ${a.error}${(a as { suggestion?: string; account_type?: string }).suggestion ? '\n  💡 ' + (a as { suggestion?: string }).suggestion : ''}${(a as { token_preview?: string }).token_preview ? ' [token: ' + (a as { token_preview?: string }).token_preview + ']' : ''}`;
          return errMsg;
        }).join('<br>') || '';
        const skipInfo = j.skipped ? `<br>  ⏭️ ${j.skipped} akun di-skip (belum diimplementasi)` : '';
        return `<b>${j.job}</b>: ${j.status}${retryInfo}${errInfo}${tokenInfo}${accountErrors ? '<br>' + accountErrors : ''}${skipInfo}`;
      }).join('<br>') || '';

      let diagHtml = '';
      if (diagnostic) {
        diagHtml = `<br><br><b>🔍 Diagnostic:</b><br>
          Server time: ${diagnostic.server_time}<br>
          Total waiting: ${diagnostic.total_waiting_jobs}<br>
          Total pending: ${(diagnostic.pending_jobs as unknown[])?.length || 0}`;
      }

      if (processed > 0) {
        Swal.fire({
          title: 'Hasil Publish',
          html: `<b>${processed} post diproses:</b><br><br>${jobInfo}${diagHtml}`,
          icon: jobs?.some((j: { status: string }) => j.status === 'success') ? 'success' : 'warning',
          width: 700,
        });
      } else {
        Swal.fire({
          title: 'Tidak ada yang diproses',
          html: `Post mungkin sudah diproses sebelumnya atau belum waktunya.${diagHtml}`,
          icon: 'info',
          width: 700,
        });
      }
      // refresh
      fetch(`/api/posts?business_unit_id=${selectedUnit}&limit=100`)
        .then(r => r.json())
        .then(d => setScheduledPosts(Array.isArray(d) ? d : []));
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    }
  };

  const handleReview = async (post: ScheduledPost, action: 'submit' | 'approve' | 'reject') => {
    let note = '';
    if (action === 'reject') {
      const result = await Swal.fire({
        title: 'Tolak post?',
        input: 'textarea',
        inputPlaceholder: 'Catatan perbaikan',
        showCancelButton: true,
        confirmButtonText: 'Tolak',
        inputValidator: value => (!value?.trim() ? 'Catatan wajib diisi' : null),
      });
      if (!result.isConfirmed) return;
      note = result.value;
    }

    const res = await fetch(`/api/posts/${post.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      Swal.fire('Error', data.error || 'Gagal memperbarui status review', 'error');
      return;
    }
    setScheduledPosts(cur => cur.map(p => p.id === post.id ? { ...p, ...data } : p));
    if (action === 'submit' && data.approval_token) copyReviewLink(data.approval_token);
  };

  const copyReviewLink = async (token: string) => {
    const link = `${window.location.origin}/review/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      Swal.fire({ title: 'Link review disalin', text: 'Kirim link ini ke klien untuk disetujui.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch {
      Swal.fire({ title: 'Link review', input: 'text', inputValue: link, confirmButtonText: 'Tutup' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3 text-slate-900"><ListOrdered className="text-green-600" size={32}/> Auto-Queue</h2>
          <p className="text-slate-500 mt-2 font-medium">Atur jadwal rutin, lempar konten ke antrean, dan biarkan sistem memposting otomatis.</p>
        </div>
        <div className="w-full md:w-64">
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Unit Bisnis</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full p-3 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl font-bold outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500">
            {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>
        </div>
      </div>

      {fetching ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Kolom 1: Schedules */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:col-span-1">
            <h3 className="font-black text-slate-900 text-lg mb-4 flex items-center gap-2 border-b pb-3"><Clock className="text-emerald-500" size={20}/> Aturan Jadwal Rutin</h3>
            
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Hari</label>
                  <select value={newDay} onChange={e=>setNewDay(parseInt(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold bg-white text-slate-900">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Jam</label>
                  <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold bg-white text-slate-900" />
                </div>
              </div>
              <button disabled={savingSchedule} onClick={addSchedule} className="w-full bg-slate-900 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                {savingSchedule ? <Loader2 size={16} className="animate-spin"/> : <PlusCircle size={16}/>} Tambah Jadwal
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {schedules.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 font-medium">Belum ada jadwal. Tambahkan di atas.</p>
              ) : schedules.map(s => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center font-black leading-none">
                      <span className="text-[10px] uppercase">{DAYS[s.day_of_week].substring(0,3)}</span>
                    </div>
                    <span className="font-extrabold text-slate-900 text-lg">{s.time_of_day.substring(0,5)}</span>
                  </div>
                  <button onClick={() => deleteSchedule(s.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom 2: Content Queue */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><Send className="text-indigo-500" size={20}/> Antrean Publish Terjadwal</h3>
              <button onClick={() => Swal.fire('Info', 'Fitur Bulk Upload sedang dibangun.', 'info')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                <PlusCircle size={16}/> Tambah ke Antrean
              </button>
            </div>

            {scheduledPosts.length === 0 ? (
              <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mb-6">
                <CalendarDays className="mx-auto text-slate-300 mb-3" size={44} />
                <h4 className="font-extrabold text-slate-900 text-lg mb-1">Belum Ada Publish Terjadwal</h4>
                <p className="text-slate-500 text-sm font-medium">Posting dari Planner akan muncul di sini selama masih menunggu, diproses, atau punya riwayat publish.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar mb-8">
                {scheduledPosts.map(post => {
                  const style = statusStyles[post.status] || statusStyles.waiting;
                  const latestLog = post.log_messages?.[post.log_messages.length - 1];
                  const latestError = latestLog?.error ? String(latestLog.error) : '';
                  const canRetry = post.status === 'waiting' || post.status === 'failed';
                  return (
                    <div key={post.id} className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-indigo-200 transition">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                          {post.media_urls?.[0] ? (
                            post.media_urls[0].includes('.mp4')
                              ? <video src={post.media_urls[0]} className="w-full h-full object-cover" />
                              : <img src={post.media_urls[0]} alt="media" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={24}/></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-black text-slate-900 text-sm">{formatSchedule(post.scheduled_at)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-black ${style.className}`}>
                              {style.icon} {style.label}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">{post.job_code}</span>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2 font-medium">{post.caption || '(Tanpa Caption)'}</p>
                          <div className="flex flex-wrap gap-2">
                          {canRetry && (
                            <button
                              onClick={() => handlePublishNow(post.id)}
                              className="mt-2 inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Play size={12} /> Publish Now
                            </button>
                          )}
                          {post.status === 'pending_review' && (
                            <>
                              <button onClick={() => handleReview(post, 'approve')} className="mt-2 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                <CheckCircle2 size={12} /> Setujui
                              </button>
                              <button onClick={() => handleReview(post, 'reject')} className="mt-2 inline-flex items-center gap-1 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                <XCircle size={12} /> Tolak
                              </button>
                              {post.approval_token && (
                                <button onClick={() => copyReviewLink(post.approval_token!)} className="mt-2 inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                  <LinkIcon size={12} /> Salin link review
                                </button>
                              )}
                            </>
                          )}
                          {(post.status === 'waiting' || post.status === 'draft' || post.status === 'rejected') && (
                            <button onClick={() => handleReview(post, 'submit')} className="mt-2 inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              <ClipboardCheck size={12} /> Minta review
                            </button>
                          )}
                          </div>
                          {post.status === 'rejected' && post.review_note && (
                            <p className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">Ditolak{post.reviewed_by ? ` oleh ${post.reviewed_by}` : ''}: {post.review_note}</p>
                          )}
                          {latestError && (
                            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 line-clamp-2">{latestError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><CalendarDays className="text-indigo-500" size={20}/> Wadah Konten Tanpa Tanggal</h3>
            </div>

            {contents.length === 0 ? (
              <div className="text-center py-16 px-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <ImageIcon className="mx-auto text-slate-300 mb-3" size={48} />
                <h4 className="font-extrabold text-slate-900 text-lg mb-1">Antrean Konten Kosong</h4>
                <p className="text-slate-500 text-sm font-medium">Tambahkan postingan tanpa tanggal, sistem akan otomatis menjadwalkannya sesuai Jadwal Rutin yang kosong.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {contents.map((c, i) => (
                  <div key={c.id} className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col bg-slate-50 relative group">
                    <button onClick={() => deleteContent(c.id)} className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-lg text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                    <div className="h-32 bg-slate-200 relative overflow-hidden">
                      {c.media_urls.length > 0 ? (
                        <img src={c.media_urls[0]} alt="media" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={32}/></div>
                      )}
                      <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">#{i + 1}</div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-xs text-slate-700 font-medium line-clamp-3 mb-2 flex-1">{c.caption || '(Tanpa Caption)'}</p>
                      {c.first_comment && (
                        <p className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-100 italic line-clamp-1 truncate">Komentar: {c.first_comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
