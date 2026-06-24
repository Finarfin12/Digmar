"use client";
import { useEffect, useState, useRef } from 'react';
import { PlusCircle, Calendar as CalendarIcon, X, Sparkles, Filter, Upload, LayoutList } from 'lucide-react';
import Swal from 'sweetalert2';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import PostScheduler from '@/components/planner/PostScheduler';
import HashtagModal from '@/components/planner/HashtagModal';
import CampaignArchitectModal from '@/components/planner/CampaignArchitectModal';
import BulkImportModal from '@/components/planner/BulkImportModal';
import { Hash } from 'lucide-react';
import QueuePage from '../queue/page';

import { logger } from '@/lib/utils/logger'

import { useSearchParams } from 'next/navigation';

const platformColors: Record<string, string> = {
  meta_ig: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#000000',
  threads: '#000000',
  linkedin: '#0A66C2',
};

const statusIcons: Record<string, string> = {
  waiting: '⏳',
  processing: '🔄',
  success: '✅',
  published: '✅',
  partial: '⚠️',
  failed: '❌',
};

function getEventColor(status: string, platform: string): string {
  if (status === 'failed') return '#ef4444';
  return platformColors[platform] || '#3b82f6';
}
import { Suspense } from 'react';

export default function Planner() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Memuat Planner...</div>}>
      <PlannerContent />
    </Suspense>
  );
}

function PlannerContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [showHashtagModal, setShowHashtagModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialIdea, setInitialIdea] = useState<string>('');
  const [initialMode, setInitialMode] = useState<'autopilot'|'manual'>('autopilot');
  const [activeTab, setActiveTab] = useState<'calendar' | 'queue' | 'drafts'>('calendar');
  
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => { 
    fetchData(); 
    const ideaParam = searchParams.get('idea');
    const modeParam = searchParams.get('mode');
    if (ideaParam) {
      setInitialIdea(ideaParam);
      if (modeParam === 'manual') setInitialMode('manual');
      setShowModal(true);
      window.history.replaceState(null, '', '/planner'); // remove idea from URL
    }
  }, [searchParams]);

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
        setAllPosts(posts);
        mapEvents(posts);
      }
    } catch (err) {
      logger.error(err);
    }
  };

  const getAccountPlatform = (targetAccountIds: string[]): string => {
    if (!targetAccountIds || targetAccountIds.length === 0) return 'unknown';
    const acc = accounts.find((a: any) => a.id === targetAccountIds[0]);
    return acc?.platform || 'unknown';
  };

  const mapEvents = (posts: any[]) => {
    let filtered = posts;
    if (filterPlatform !== 'all') {
      filtered = filtered.filter(p => getAccountPlatform(p.target_account_ids) === filterPlatform);
    }
    if (filterUnit !== 'all') {
      filtered = filtered.filter(p => {
        const acc = accounts.find((a: any) => a.id === p.target_account_ids?.[0]);
        return acc?.business_unit_id === filterUnit;
      });
    }

    const mappedEvents = filtered.map((p: any) => {
      const platform = getAccountPlatform(p.target_account_ids);
      const icon = statusIcons[p.status] || '';
      return {
        id: p.id,
        title: `${icon} ${p.job_code}`,
        start: p.scheduled_at,
        backgroundColor: getEventColor(p.status, platform),
        borderColor: p.status === 'waiting' ? 'rgba(255,255,255,0.4)' : 'transparent',
        borderStyle: p.status === 'waiting' ? 'dashed' : 'solid',
        textColor: platform === 'tiktok' || platform === 'threads' ? '#ffffff' : '#ffffff',
        classNames: [p.status === 'processing' ? 'animate-pulse' : ''],
        extendedProps: { ...p, platform }
      };
    });
    setEvents(mappedEvents);
  };

  useEffect(() => { mapEvents(allPosts); }, [filterPlatform, filterUnit]);

  const handleDateClick = (arg: { date: Date }) => {
    setSelectedDate(arg.date);
    setShowModal(true);
  };

  const handleEventClick = (arg: { event: { extendedProps: any } }) => {
    setSelectedEvent(arg.event.extendedProps);
    setShowPreviewModal(true);
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
    <div className="space-y-0 animate-in fade-in duration-500 pb-20">
      <header className="bg-white p-6 pb-0 rounded-t-2xl border border-slate-200 border-b-0">
        <div className="flex justify-between items-center w-full pb-6 border-b border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900">Scheduler</h2>
          <button onClick={() => { setSelectedDate(new Date()); setShowModal(true); }} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/30 transition-all font-bold">
            <PlusCircle size={18} /> New Post
          </button>
        </div>
      </header>

      {/* Secondary Toolbar */}
      <div className="bg-white px-6 py-4 flex gap-3 flex-wrap border-x border-slate-200">
          <button onClick={() => setShowBulkModal(true)} className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2 transition-all">
            <Upload size={16} className="text-slate-400"/> Import CSV
          </button>
          <button onClick={() => setShowCampaignModal(true)} className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2 transition-all">
            <Sparkles size={16} className="text-amber-500" /> Campaign Architect
          </button>
          <button onClick={() => setShowHashtagModal(true)} className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2 transition-all">
            <Hash size={16} className="text-slate-400"/> Riset Hashtag
          </button>
          <button onClick={() => { setSelectedDate(new Date()); setShowModal(true); }} className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 flex items-center gap-2 transition-all">
            <Sparkles size={16} className="text-fuchsia-500" /> Smart Auto-Slot
          </button>
      </div>

      {/* Filter and Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white px-6 border border-slate-200 rounded-b-2xl shadow-sm mb-6">
        <div className="flex gap-6 -mb-px">
          {['calendar', 'queue', 'drafts'].map((tab) => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
               {tab === 'calendar' ? 'Calendar' : tab === 'queue' ? 'Content Queue' : 'Drafts'}
             </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 py-3">
          <Filter size={16} className="text-slate-400" />
          <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="text-sm font-bold bg-transparent text-slate-600 cursor-pointer outline-none">
            <option value="all">Semua Unit</option>
            {units.map((u: any) => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="text-sm font-bold bg-transparent text-slate-600 cursor-pointer outline-none ml-2">
            <option value="all">Semua Platform</option>
            <option value="meta_ig">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="threads">Threads</option>
          </select>
        </div>
      </div>
      
      {activeTab === 'calendar' ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden calendar-container text-slate-900">
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
              eventClick={handleEventClick}
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

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Posts</h3>
            <div className="space-y-3">
              {events.filter(e => new Date(e.start) >= new Date() && e.extendedProps.status === 'waiting').sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0,5).map(e => (
                <div key={e.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleEventClick({event: e} as any)}>
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{backgroundColor: getEventColor(e.extendedProps.status, e.extendedProps.platform)}}>
                        {e.extendedProps.platform === 'meta_ig' ? 'IG' : e.extendedProps.platform === 'facebook' ? 'FB' : e.extendedProps.platform === 'tiktok' ? 'TT' : e.extendedProps.platform === 'threads' ? 'TH' : 'LI'}
                     </div>
                     <div>
                       <p className="font-bold text-slate-900">{e.extendedProps.job_code}</p>
                       <p className="text-xs text-slate-500">{new Date(e.start).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                     </div>
                   </div>
                   <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Scheduled</span>
                </div>
              ))}
              {events.filter(e => new Date(e.start) >= new Date() && e.extendedProps.status === 'waiting').length === 0 && (
                <div className="text-center py-6 text-slate-500 text-sm">No upcoming posts scheduled.</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'queue' ? (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <QueuePage />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Kanban Columns */}
          <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200">
            <h4 className="font-extrabold text-slate-700 mb-5 flex items-center justify-between">
              <span>Menunggu (Draft)</span>
              <span className="bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full text-xs">{events.filter(e => e.extendedProps.status === 'waiting').length}</span>
            </h4>
            <div className="space-y-4">
              {events.filter(e => e.extendedProps.status === 'waiting').map(e => (
                <div key={e.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group" onClick={() => handleEventClick({event: e} as any)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: getEventColor(e.extendedProps.status, e.extendedProps.platform)}}></span>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{e.extendedProps.platform}</span>
                  </div>
                  <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{e.extendedProps.job_code}</p>
                  <p className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1"><CalendarIcon size={12}/> {new Date(e.start).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100">
            <h4 className="font-extrabold text-blue-800 mb-5 flex items-center justify-between">
              <span>Sedang Diproses</span>
              <span className="bg-blue-200 text-blue-700 px-2.5 py-0.5 rounded-full text-xs">{events.filter(e => e.extendedProps.status === 'processing').length}</span>
            </h4>
            <div className="space-y-4">
              {events.filter(e => e.extendedProps.status === 'processing').map(e => (
                <div key={e.id} className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => handleEventClick({event: e} as any)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{backgroundColor: getEventColor(e.extendedProps.status, e.extendedProps.platform)}}></span>
                    <span className="text-xs font-black text-blue-500 uppercase tracking-widest">{e.extendedProps.platform}</span>
                  </div>
                  <p className="font-bold text-slate-900">{e.extendedProps.job_code}</p>
                  <p className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1"><CalendarIcon size={12}/> {new Date(e.start).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50/50 rounded-3xl p-5 border border-emerald-100">
            <h4 className="font-extrabold text-emerald-800 mb-5 flex items-center justify-between">
              <span>Selesai (Published)</span>
              <span className="bg-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs">{events.filter(e => ['success', 'published', 'partial'].includes(e.extendedProps.status)).length}</span>
            </h4>
            <div className="space-y-4">
              {events.filter(e => ['success', 'published', 'partial'].includes(e.extendedProps.status)).map(e => (
                <div key={e.id} className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm cursor-pointer hover:shadow-md transition-all opacity-80" onClick={() => handleEventClick({event: e} as any)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: getEventColor(e.extendedProps.status, e.extendedProps.platform)}}></span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{e.extendedProps.platform}</span>
                  </div>
                  <p className="font-bold text-slate-900 line-through decoration-emerald-200">{e.extendedProps.job_code}</p>
                  <p className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1"><CalendarIcon size={12}/> {new Date(e.start).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                initialIdea={initialIdea}
                initialMode={initialMode}
                onSuccess={() => {
                  fetchData();
                  setShowModal(false);
                  setInitialIdea('');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showHashtagModal && <HashtagModal onClose={() => setShowHashtagModal(false)} units={units} />}
      
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

      {showBulkModal && (
        <BulkImportModal
          units={units}
          accounts={accounts}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            fetchData();
            setShowBulkModal(false);
          }}
        />
      )}

      {/* Post Preview Modal */}
      {showPreviewModal && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 my-auto">
            <div className="bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center">
              <span className="font-black text-slate-500 text-[10px] uppercase tracking-widest">{selectedEvent.platform === 'meta_ig' ? 'Instagram Preview' : selectedEvent.platform === 'facebook' ? 'Facebook Preview' : selectedEvent.platform + ' Preview'}</span>
              <button onClick={() => setShowPreviewModal(false)} className="bg-slate-200 hover:bg-slate-300 rounded-full p-1.5 transition-colors text-slate-500 hover:text-slate-900"><X size={16} /></button>
            </div>
            {/* Header IG */}
            <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-0.5 rounded-full shadow-sm">
                <div className="bg-white w-full h-full rounded-full border-2 border-white overflow-hidden">
                  <img src={`https://ui-avatars.com/api/?name=${selectedEvent.platform}&background=random`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 leading-none">@digimar.official</p>
                <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">{new Date(selectedEvent.scheduled_at).toLocaleString('id-ID')}</p>
              </div>
            </div>
            {/* Media */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center relative group overflow-hidden">
              {selectedEvent.media_urls?.[0] ? (
                 <img src={selectedEvent.media_urls[0]} alt="Post" className="w-full h-full object-cover" />
              ) : (
                 <div className="text-slate-400 font-bold flex flex-col items-center gap-3"><Upload size={40} className="opacity-50" /> No Media Selected</div>
              )}
            </div>
            {/* Action Bar IG */}
            <div className="p-5 border-t border-slate-100 min-h-[100px]">
              <p className="text-sm text-slate-800 leading-relaxed">
                <span className="font-bold mr-2 text-slate-900">digimar.official</span>
                {selectedEvent.caption || <span className="text-slate-400 italic">Belum ada caption...</span>}
              </p>
            </div>
            <div className="bg-slate-50 p-4 flex justify-between gap-3 border-t border-slate-200">
               <button onClick={() => setShowPreviewModal(false)} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">Tutup</button>
               {selectedEvent.status !== 'success' && selectedEvent.status !== 'published' && (
                 <button className="flex-1 bg-indigo-600 py-3 rounded-xl text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all">Edit Post</button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

