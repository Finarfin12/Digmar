"use client";
import { useState, useEffect } from 'react';
import IdeaKanban from '@/components/planner/IdeaKanban';
import { LayoutGrid, Loader2 } from 'lucide-react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutGrid size={28} className="text-indigo-600" />
            Idea Board
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Brainstorm, organize, and move content ideas through your workflow
          </p>
        </div>
        {units.length > 0 && (
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            className="text-sm font-bold bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.brand_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <IdeaKanban businessUnitId={selectedUnit} />
      </div>
    </div>
  );
}
