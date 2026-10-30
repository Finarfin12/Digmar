"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, AlertTriangle, KeyRound, CheckCircle2, ClipboardCheck } from 'lucide-react';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 60_000;

function iconFor(type: string) {
  if (type.startsWith('publish')) return <AlertTriangle size={15} className="text-rose-500" />;
  if (type === 'token_refreshed') return <CheckCircle2 size={15} className="text-emerald-500" />;
  if (type.startsWith('token')) return <KeyRound size={15} className="text-amber-500" />;
  if (type.startsWith('approval')) return <ClipboardCheck size={15} className="text-indigo-500" />;
  return <Bell size={15} className="text-slate-400" />;
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch {
      // jaringan putus: coba lagi di polling berikutnya
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    const ids = 'ids' in body ? new Set(body.ids) : null;
    const now = new Date().toISOString();
    setItems(cur => cur.map(n => (!n.read_at && (!ids || ids.has(n.id))) ? { ...n, read_at: now } : n));
    setUnread(cur => ids ? Math.max(0, cur - items.filter(n => !n.read_at && ids.has(n.id)).length) : 0);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
        aria-label={unread > 0 ? `${unread} notifikasi belum dibaca` : 'Notifikasi'}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Notifikasi</span>
            {unread > 0 && (
              <button onClick={() => markRead({ all: true })} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <CheckCheck size={13} /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-500">Belum ada notifikasi.</p>
            )}
            {items.map(n => {
              const content = (
                <div className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${n.read_at ? '' : 'bg-indigo-50/40'}`}>
                  <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                    {n.message && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
              const onSelect = () => { if (!n.read_at) markRead({ ids: [n.id] }); setOpen(false); };
              return n.link
                ? <Link key={n.id} href={n.link} onClick={onSelect}>{content}</Link>
                : <button key={n.id} onClick={onSelect} className="w-full text-left">{content}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
