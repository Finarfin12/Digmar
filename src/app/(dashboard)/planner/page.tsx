"use client";
import { useEffect, useState, useRef } from 'react';
import { PlusCircle, Calendar as CalendarIcon, X, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import PostScheduler from '@/components/planner/PostScheduler';

export default function Planner() {
  const [events, setEvents] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
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
        <button onClick={() => { setSelectedDate(new Date()); setShowModal(true); }} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
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

      {/* Modal Studio */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl my-8 relative animate-in zoom-in-95">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 rounded-t-3xl">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="text-indigo-600" /> Post Creator Studio
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full p-2"><X size={20}/></button>
            </div>
            
            <div className="p-6">
              <PostScheduler 
                units={units}
                accounts={accounts}
                initialDate={selectedDate}
                onSuccess={() => {
                  fetchData();
                  setShowModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
