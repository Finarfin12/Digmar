"use client";
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, CalendarDays, Clock } from 'lucide-react';

interface ReviewPost {
  job_code: string;
  status: string;
  caption: string;
  media_urls: string[];
  post_type: string;
  scheduled_at: string;
  platforms: string[];
  brand: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const PLATFORM_NAMES: Record<string, string> = { meta_ig: 'Instagram', facebook: 'Facebook', threads: 'Threads', tiktok: 'TikTok', linkedin: 'LinkedIn' };

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [post, setPost] = useState<ReviewPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/review/${token}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Link review tidak ditemukan atau sudah tidak berlaku.' : 'Gagal memuat post.');
        return;
      }
      setPost(await res.json());
    } catch {
      setError('Gagal memuat post.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) {
      setError('Tulis catatan perbaikan sebelum menolak.');
      return;
    }
    setError('');
    setSubmitting(action);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note, reviewer_name: reviewerName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan keputusan.');
      } else {
        await load();
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-600 text-sm font-medium text-center">{error}</p>
      </div>
    );
  }

  const pending = post.status === 'pending_review';
  const decided = post.reviewed_at && !pending;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Review Konten</p>
          <h1 className="text-lg font-black text-slate-900 mt-1">{post.brand || 'Post'} · {post.job_code}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1"><CalendarDays size={13} /> {new Date(post.scheduled_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            {post.platforms.length > 0 && <span>{post.platforms.map(p => PLATFORM_NAMES[p] || p).join(', ')}</span>}
          </div>
        </div>

        {post.media_urls?.length > 0 && (
          <div className="grid gap-1 bg-slate-100" style={{ gridTemplateColumns: post.media_urls.length > 1 ? 'repeat(2, 1fr)' : '1fr' }}>
            {post.media_urls.map(url => (
              /\.(mp4|webm|mov)(\?|$)/i.test(url)
                ? <video key={url} src={url} controls className="w-full max-h-[480px] object-contain bg-black" />
                : <img key={url} src={url} alt="" className="w-full max-h-[480px] object-contain" />
            ))}
          </div>
        )}

        <div className="px-6 py-5">
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.caption || '(Tanpa caption)'}</p>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50">
          {decided && (
            <div className={`flex items-start gap-2 text-sm font-semibold ${post.status === 'rejected' ? 'text-rose-700' : 'text-emerald-700'}`}>
              {post.status === 'rejected' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
              <div>
                <p>{post.status === 'rejected' ? 'Ditolak' : 'Disetujui'} oleh {post.reviewed_by}</p>
                {post.review_note && <p className="font-normal text-slate-600 mt-1">{post.review_note}</p>}
              </div>
            </div>
          )}

          {!pending && !decided && (
            <p className="flex items-center gap-2 text-sm text-slate-600"><Clock size={16} /> Post ini tidak sedang menunggu persetujuan.</p>
          )}

          {pending && (
            <div className="space-y-3">
              <input
                value={reviewerName}
                onChange={e => setReviewerName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900"
              />
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Catatan (wajib jika menolak)"
                rows={3}
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900"
              />
              {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => decide('reject')}
                  disabled={submitting !== null}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-200 bg-white text-rose-700 text-sm font-bold hover:bg-rose-50 disabled:opacity-60"
                >
                  {submitting === 'reject' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Tolak
                </button>
                <button
                  onClick={() => decide('approve')}
                  disabled={submitting !== null}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Setujui
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
