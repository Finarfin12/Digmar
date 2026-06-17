"use client";
import { useEffect, useState, useRef } from 'react';
import { PlusCircle, Calendar as CalendarIcon, X, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import PostScheduler from '@/components/planner/PostScheduler';
import HashtagModal from '@/components/planner/HashtagModal';
import CampaignArchitectModal from '@/components/planner/CampaignArchitectModal';
import { Hash } from 'lucide-react';

export default function Planner() {
  const [events, setEvents] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [showHashtagModal, setShowHashtagModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
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
        const mappedEvents = posts.map((p: { id: string, caption: string, scheduled_at: string, status: string, job_code: string }) => ({
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

  const handleDateClick = (arg: { date: Date }) => {
    setSelectedDate(arg.date);
    setShowModal(true);
  };

  const handleEventDrop = async (arg: { event: { id: string, start: Date | null }, revert: () => void }) => {
    const { event } = arg;
    if (!event.start) return;
    try {
      const res = await fetch(`/api/posts/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: event.start.toISOString() })
      });
      if (!res.ok) throw new Error('Gagal update jadwal');
      fetchData();
    } catch (err: unknown) {
      arg.revert();
      Swal.fire('Error', (err as Error).message, 'error');
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
        <div className="flex gap-2">
          <button onClick={() => setShowCampaignModal(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/30 transition-all font-extrabold border border-amber-400">
            <Sparkles size={18} className="text-yellow-100" /> Campaign Architect
          </button>
          <button onClick={() => setShowHashtagModal(true)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-3 rounded-xl flex items-center gap-2 transition-all font-bold border border-indigo-200">
            <Hash size={18} /> Riset Hashtag
          </button>
          <button onClick={() => { setSelectedDate(new Date()); setShowModal(true); }} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all font-bold">
            <PlusCircle size={18} /> Buat Jadwal Baru
          </button>
        </div>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl my-auto relative animate-in zoom-in-95">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center z-10 rounded-t-3xl shadow-sm">
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

      {showHashtagModal && <HashtagModal onClose={() => setShowHashtagModal(false)} />}
      
      {showCampaignModal && (
        <CampaignArchitectModal 
          units={units}
          accounts={accounts}
          onClose={() => setShowCampaignModal(false)}
          onSuccess={() => {
            fetchData();
            setShowCampaignModal(false);
          }}
        />
      )}
    </div>
  );
}
