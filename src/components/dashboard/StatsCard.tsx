"use client";
import { type LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: 'blue' | 'emerald' | 'amber' | 'fuchsia' | 'slate';
}

const colorMap = {
  blue:   { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  emerald:{ bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber:  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  fuchsia:{ bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  slate:  { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
};

export default function StatsCard({ icon: Icon, label, value, sub, color }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${c.bg} ${c.text} rounded-xl flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-4xl font-black text-slate-900">{value}</div>
      {sub && (
        <p className="text-xs text-slate-500 mt-2 font-medium">{sub}</p>
      )}
    </div>
  );
}
