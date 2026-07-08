"use client";
import { useState, useEffect } from 'react';
import IdeaKanban from '@/components/planner/IdeaKanban';
import { LayoutGrid, Loader2, Lightbulb } from 'lucide-react';

interface BusinessUnit {
  id: string;
  brand_name: string;
}

export default function IdeasPage() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        setUnits(data || []);
        if (data && data.length > 0) setSelectedUnit(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Lightbulb size={18} className="text-indigo-600" />
              </span>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Ideas</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
              This is a place to plan <span className="inline-block">&#x270D;&#xFE0F;</span> your content
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed max-w-xl">
              Save your Ideas before converting them into posts. Brainstorm, plan ahead, and keep everything organized in one place. Click + on any column to get started.
            </p>
          </div>
          {units.length > 0 && (
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="text-sm font-semibold bg-white text-stone-700 py-2 px-3.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shrink-0 shadow-sm"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.brand_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <IdeaKanban businessUnitId={selectedUnit} />
      </div>
    </div>
  );
}
