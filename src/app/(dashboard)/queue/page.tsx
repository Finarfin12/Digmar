"use client";
import { useEffect, useState } from 'react';
import { ListOrdered, PlusCircle, Trash2, Clock, CalendarDays, Loader2, Save, Image as ImageIcon } from 'lucide-react';
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

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function QueuePage() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  
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
      fetch(`/api/queue?business_unit_id=${selectedUnit}`).then(r => r.json())
    ]).then(([schedData, contData]) => {
      setSchedules(schedData);
      setContents(contData);
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
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Hapus jadwal rutin ini?')) return;
    await fetch(`/api/queue/schedules?id=${id}`, { method: 'DELETE' });
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const deleteContent = async (id: string) => {
    if (!confirm('Hapus konten dari antrean?')) return;
    await fetch(`/api/queue?id=${id}`, { method: 'DELETE' });
    setContents(contents.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3"><ListOrdered className="text-indigo-400" size={32}/> Enterprise Auto-Queue</h2>
          <p className="text-slate-400 mt-2 font-medium">Atur jadwal rutin, lempar konten ke antrean, dan biarkan sistem memposting otomatis.</p>
        </div>
        <div className="w-full md:w-64">
          <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Unit Bisnis</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full p-3 border-2 border-slate-700 bg-slate-800 rounded-xl font-bold text-white outline-none focus:border-indigo-500">
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
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><CalendarDays className="text-indigo-500" size={20}/> Wadah Antrean Konten</h3>
              <button onClick={() => Swal.fire('Info', 'Fitur Bulk Upload sedang dibangun.', 'info')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                <PlusCircle size={16}/> Tambah ke Antrean
              </button>
            </div>

            {contents.length === 0 ? (
              <div className="text-center py-20 px-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <ImageIcon className="mx-auto text-slate-300 mb-3" size={48} />
                <h4 className="font-extrabold text-slate-900 text-lg mb-1">Antrean Kosong!</h4>
                <p className="text-slate-500 text-sm font-medium">Tambahkan postingan tanpa tanggal, sistem akan otomatis mencabutnya sesuai Jadwal Rutin yang kosong.</p>
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
