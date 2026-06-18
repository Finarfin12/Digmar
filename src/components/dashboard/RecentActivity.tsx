"use client";
import { Clock, CheckCircle2, AlertCircle, MessageSquare, Send } from 'lucide-react';

interface Activity {
  type: string;
  timestamp: string;
  message: string;
}

const iconMap: Record<string, React.ReactNode> = {
  post_success: <CheckCircle2 size={16} className="text-emerald-500" />,
  post_published: <CheckCircle2 size={16} className="text-emerald-500" />,
  post_failed: <AlertCircle size={16} className="text-red-500" />,
  post_waiting: <Clock size={16} className="text-blue-500" />,
  post_processing: <Clock size={16} className="text-amber-500 animate-spin" />,
  conversation: <MessageSquare size={16} className="text-fuchsia-500" />,
  message_sent: <Send size={16} className="text-indigo-500" />,
};

export default function RecentActivity({ activities }: { activities: Activity[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wide mb-4">Aktivitas Terkini</h4>
        <div className="text-center py-8 text-slate-400">
          <Clock size={40} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-bold">Belum ada aktivitas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wide mb-4">Aktivitas Terkini</h4>
      <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
            <div className="mt-0.5 shrink-0">
              {iconMap[a.type] || <Clock size={16} className="text-slate-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-700 font-medium truncate">{a.message}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {new Date(a.timestamp).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
