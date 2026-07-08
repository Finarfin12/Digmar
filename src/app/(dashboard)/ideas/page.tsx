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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <LayoutGrid size={18} className="text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Ideas</h1>
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

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <IdeaKanban businessUnitId={selectedUnit} />
      </div>
    </div>
  );
}
