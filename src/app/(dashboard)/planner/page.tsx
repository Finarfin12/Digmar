"use client";
import { useEffect, useState, useRef } from 'react';
import { PlusCircle, Calendar as CalendarIcon, X, Loader2, Save, Sparkles, ImageIcon, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';

export default function Planner() {
  const [events, setEvents] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Form States
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formUnit, setFormUnit] = useState('');
  const [formAccount, setFormAccount] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formCaption, setFormCaption] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, uRes, aRes] = await Promise.all([
        fetch('/api/posts?limit=100'),
        fetch('/api/units'),
        fetch('/api/accounts')
      ]);
      
      if (uRes.ok) setUnits(await uRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
      
      if (pRes.ok) {
        const posts = await pRes.json();
        const mappedEvents = posts.map((p: any) => ({
          id: p.id,
          title: p.job_code,
          start: p.scheduled_at,
          backgroundColor: p.status === 'published' ? '#10b981' : p.status === 'failed' ? '#ef4444' : '#3b82f6',
          borderColor: 'transparent',
          extendedProps: { ...p }
        }));
        setEvents(mappedEvents);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.date);
    setShowModal(true);
    resetForm();
  };

  const handleEventDrop = async (arg: any) => {
    const { event } = arg;
    try {
      const res = await fetch(`/api/posts/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: event.start.toISOString() })
      });
      if (!res.ok) throw new Error('Gagal update jadwal');
      fetchData();
    } catch (err: any) {
      arg.revert();
      Swal.fire('Error', err.message, 'error');
    }
  };

  const resetForm = () => {
    setFormPrompt('');
    setFormCaption('');
    setFormImageUrl('');
    if (units.length > 0) setFormUnit(units[0].id);
    if (accounts.length > 0) setFormAccount(accounts[0].id);
  };

  const generateAI = async () => {
    if (!formUnit || !formPrompt) {
      return Swal.fire('Oops', 'Pilih Unit Bisnis dan masukkan Konteks Ide Konten!', 'warning');
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: formUnit,
          prompt_context: formPrompt,
          tone_voice: 'profesional dan menarik'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate AI');
      setFormCaption(data.caption + '\n\n' + (data.hashtags?.join(' ') || ''));
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const savePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount || !selectedDate || !formCaption) {
      return Swal.fire('Error', 'Lengkapi formulir (Akun, Tanggal, Caption)', 'error');
    }
    setLoading(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_account_ids: [formAccount],
          scheduled_at: selectedDate.toISOString(),
          caption: formCaption,
          media_urls: formImageUrl ? [formImageUrl] : [],
          post_type: 'single_image'
        })
      });
      if (!res.ok) throw new Error('Gagal menjadwalkan post');
      Swal.fire({ title: 'Berhasil', text: 'Post terjadwal!', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(a => a.business_unit_id === formUnit);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Content Planner</h2>
            <p className="text-slate-600 text-sm font-medium">Klik tanggal untuk menjadwalkan, atau geser (drag) post yang sudah ada.</p>
          </div>
        </div>
        <button onClick={() => { setSelectedDate(new Date()); setShowModal(true); resetForm(); }} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
          <PlusCircle size={18} /> Buat Jadwal Baru
        </button>
      </header>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 overflow-hidden calendar-container text-slate-900">
        <style dangerouslySetInnerHTML={{__html: `
          .fc-col-header-cell { padding: 12px 0; background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 0.8rem; }
          .fc-daygrid-day { transition: background 0.2s; cursor: pointer; }
          .fc-daygrid-day:hover { background: #f1f5f9; }
          .fc-event { padding: 4px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: grab; }
          .fc-button-primary { background-color: #f1f5f9 !important; border-color: #e2e8f0 !important; color: #1e293b !important; font-weight: 700 !important; text-transform: capitalize !important;}
          .fc-button-primary:hover { background-color: #e2e8f0 !important; }
          .fc-button-active { background-color: #cbd5e1 !important; }
        `}} />
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          dateClick={handleDateClick}
          eventDrop={handleEventDrop}
          editable={true}
          droppable={true}
          height="auto"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="text-blue-600" /> Jadwalkan Post
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2"><X size={20}/></button>
            </div>
            
            <form onSubmit={savePost} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Tanggal & Waktu Tayang</label>
                  <input required type="datetime-local" value={selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setSelectedDate(new Date(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Unit Bisnis (Konteks AI)</label>
                  <select required value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium">
                    {units.map(u => <option key={u.id} value={u.id} className="text-slate-900">{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Akun Sosial (Tujuan)</label>
                <select required value={formAccount} onChange={e => setFormAccount(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium">
                  {filteredAccounts.length === 0 && <option value="" disabled>-- Tidak ada akun terhubung --</option>}
                  {filteredAccounts.map(a => <option key={a.id} value={a.id} className="text-slate-900 capitalize">{a.platform} - {a.ig_user_id}</option>)}
                </select>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
                <label className="block text-sm font-bold text-indigo-900 mb-1 flex items-center gap-1"><Sparkles size={16}/> Ide Konten (Untuk AI)</label>
                <div className="flex gap-2">
                  <input value={formPrompt} onChange={e => setFormPrompt(e.target.value)} type="text" placeholder="Misal: Buatkan caption promo kopi susu 50% untuk akhir pekan..." className="w-full p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium" />
                  <button type="button" onClick={generateAI} disabled={generating} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-lg font-bold flex items-center gap-2 transition-colors">
                    {generating ? <Loader2 className="animate-spin" size={18}/> : 'Generate'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1"><FileText size={16}/> Caption</label>
                <textarea required value={formCaption} onChange={e => setFormCaption(e.target.value)} rows={5} placeholder="Tulis caption atau gunakan tombol Generate AI di atas..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1"><ImageIcon size={16}/> URL Gambar (Opsional)</label>
                <input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} type="url" placeholder="https://example.com/image.jpg" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium" />
                <p className="text-xs text-slate-500 font-medium mt-1">Harus format public URL gambar (jpg/png) untuk Instagram API.</p>
              </div>

              <div className="border-t border-slate-200 pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-extrabold flex items-center gap-2 shadow-md transition-colors">
                  {loading ? 'Menyimpan...' : <><Save size={18}/> Simpan & Jadwalkan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
