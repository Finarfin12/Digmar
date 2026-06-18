"use client";
import React, { useState, useEffect } from 'react';
import { Loader2, X, Search } from 'lucide-react';

import { logger } from '@/lib/utils/logger'
interface Props {
  type: 'captions' | 'hashtags';
  businessUnitId: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export default function LibrarySelectorModal({ type, businessUnitId, onSelect, onClose }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/library/${type}?business_unit_id=${businessUnitId}`);
        const data = await res.json();
        setItems(data || []);
      } catch (e) {
        logger.error(e);
      }
      setLoading(false);
    };
    fetchItems();
  }, [type, businessUnitId]);

  const filteredItems = items.filter(i => 
    i.title?.toLowerCase().includes(search.toLowerCase()) || 
    i.content?.toLowerCase().includes(search.toLowerCase()) ||
    (i.hashtags && i.hashtags.join(' ').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">
            Pilih dari {type === 'captions' ? 'Template Caption' : 'Bank Hashtag'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
        </div>
        
        <div className="p-4 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar space-y-3">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center p-8 text-slate-500 font-medium">Kosong atau tidak ditemukan.</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer transition-all flex flex-col"
                   onClick={() => {
                     const val = type === 'captions' ? item.content : item.hashtags.join(' ');
                     onSelect(val);
                   }}>
                <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                {type === 'captions' ? (
                  <p className="text-sm text-slate-600 line-clamp-2">{item.content}</p>
                ) : (
                  <p className="text-sm text-indigo-600 font-medium">{item.hashtags.join(' ')}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
