"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, GripVertical, Trash2, Lightbulb, Sparkles, Eye, CalendarCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

interface Idea {
  id: string;
  title: string;
  description: string;
  status: 'idea' | 'in_progress' | 'review' | 'scheduled';
  priority: 'low' | 'medium' | 'high';
  platform: string;
  business_unit_id: string | null;
  media_urls: string[];
  scheduled_at: string | null;
  position: number;
  created_at: string;
}

const COLUMNS = [
  { key: 'idea', label: 'Ideas', icon: Lightbulb, color: 'bg-amber-50 border-amber-200', headerColor: 'text-amber-700 bg-amber-100', accentColor: 'amber' },
  { key: 'in_progress', label: 'In Progress', icon: Sparkles, color: 'bg-blue-50 border-blue-200', headerColor: 'text-blue-700 bg-blue-100', accentColor: 'blue' },
  { key: 'review', label: 'Review', icon: Eye, color: 'bg-purple-50 border-purple-200', headerColor: 'text-purple-700 bg-purple-100', accentColor: 'purple' },
  { key: 'scheduled', label: 'Scheduled', icon: CalendarCheck, color: 'bg-emerald-50 border-emerald-200', headerColor: 'text-emerald-700 bg-emerald-100', accentColor: 'emerald' },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

interface IdeaKanbanProps {
  businessUnitId?: string;
}

export default function IdeaKanban({ businessUnitId }: IdeaKanbanProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [newIdeaText, setNewIdeaText] = useState('');
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (businessUnitId) params.set('business_unit_id', businessUnitId);
      const res = await fetch(`/api/ideas?${params}`);
      if (res.ok) setIdeas(await res.json());
    } catch {
      Swal.fire('Error', 'Failed to load ideas', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessUnitId]);

  useEffect(() => { fetchIdeas() }, [fetchIdeas]);

  useEffect(() => {
    if (addingToCol && inputRef.current) inputRef.current.focus();
  }, [addingToCol]);

  const getColumnIdeas = (status: string) =>
    ideas.filter(i => i.status === status);

  const handleAddIdea = async (status: string) => {
    if (!newIdeaText.trim()) return;
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIdeaText.trim(),
          business_unit_id: businessUnitId,
          status,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setIdeas(prev => [...prev, created]);
        setNewIdeaText('');
        setAddingToCol(null);
      } else {
        const err = await res.json();
        Swal.fire('Error', err.error || 'Failed to create idea', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to create idea', 'error');
    }
  };

  const updateIdeaStatus = async (id: string, newStatus: string) => {
    const prev = [...ideas];
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: newStatus as Idea['status'] } : i));
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setIdeas(prev);
        const err = await res.json();
        Swal.fire('Error', err.error || 'Failed to update', 'error');
      }
    } catch {
      setIdeas(prev);
      Swal.fire('Error', 'Failed to update idea', 'error');
    }
  };

  const handleDelete = async (idea: Idea) => {
    const result = await Swal.fire({
      title: 'Delete idea?',
      text: `"${idea.title}" will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
      if (res.ok) {
        setIdeas(prev => prev.filter(i => i.id !== idea.id));
      } else {
        Swal.fire('Error', 'Failed to delete', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to delete', 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, idea: Idea) => {
    setDragId(idea.id);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDragId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragId) return;
    const idea = ideas.find(i => i.id === dragId);
    if (!idea || idea.status === colKey) return;
    updateIdeaStatus(dragId, colKey);
  };

  const handleCardClick = async (idea: Idea) => {
    const { value: formValues } = await Swal.fire({
      title: 'Edit Idea',
      html: `
        <div style="text-align:left">
          <label style="font-weight:600;font-size:13px;color:#475569">Title</label>
          <input id="swal-title" class="swal2-input" value="${idea.title.replace(/"/g, '&quot;')}" style="width:100%;margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;color:#475569">Description</label>
          <textarea id="swal-desc" class="swal2-textarea" style="width:100%;min-height:80px;margin-bottom:12px">${(idea.description || '').replace(/"/g, '&quot;')}</textarea>
          <label style="font-weight:600;font-size:13px;color:#475569">Priority</label>
          <select id="swal-priority" class="swal2-select" style="width:100%;margin-bottom:12px">
            <option value="low" ${idea.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${idea.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${idea.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
          <label style="font-weight:600;font-size:13px;color:#475569">Platform</label>
          <input id="swal-platform" class="swal2-input" value="${(idea.platform || '').replace(/"/g, '&quot;')}" placeholder="e.g. Instagram, TikTok" style="width:100%">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save',
      preConfirm: () => ({
        title: (document.getElementById('swal-title') as HTMLInputElement).value,
        description: (document.getElementById('swal-desc') as HTMLTextAreaElement).value,
        priority: (document.getElementById('swal-priority') as HTMLSelectElement).value,
        platform: (document.getElementById('swal-platform') as HTMLInputElement).value,
      }),
    });
    if (!formValues) return;
    if (!formValues.title.trim()) {
      Swal.showValidationMessage('Title is required');
      return;
    }
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });
      if (res.ok) {
        const updated = await res.json();
        setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, ...updated } : i));
      } else {
        Swal.fire('Error', 'Failed to update', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to update', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {COLUMNS.map(col => {
        const colIdeas = getColumnIdeas(col.key);
        const Icon = col.icon;
        const isOver = dragOverCol === col.key;

        return (
          <div
            key={col.key}
            className={`flex-1 min-w-[260px] max-w-[320px] rounded-2xl border-2 p-4 transition-all duration-200 flex flex-col ${col.color} ${isOver ? 'scale-[1.02] shadow-lg ring-2 ring-indigo-400' : ''}`}
            onDragOver={e => handleDragOver(e, col.key)}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className={`flex items-center justify-between mb-4 px-3 py-2 rounded-xl ${col.headerColor}`}>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Icon size={16} />
                <span>{col.label}</span>
                <span className="text-xs font-medium opacity-60">({colIdeas.length})</span>
              </div>
              <button
                onClick={() => setAddingToCol(col.key)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors"
                title="Add idea"
              >
                <Plus size={16} />
              </button>
            </div>

            {addingToCol === col.key && (
              <div className="mb-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <input
                  ref={inputRef}
                  type="text"
                  value={newIdeaText}
                  onChange={e => setNewIdeaText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddIdea(col.key);
                    if (e.key === 'Escape') { setAddingToCol(null); setNewIdeaText(''); }
                  }}
                  placeholder="Idea title..."
                  className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddIdea(col.key)}
                    className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingToCol(null); setNewIdeaText(''); }}
                    className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto min-h-[100px]">
              {colIdeas.length === 0 && !addingToCol && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">No ideas yet</p>
                </div>
              )}
              {colIdeas.map(idea => (
                <div
                  key={idea.id}
                  draggable
                  onDragStart={e => handleDragStart(e, idea)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleCardClick(idea)}
                  className={`group bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 ${dragId === idea.id ? 'opacity-50 scale-95 rotate-2' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{idea.title}</h4>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(idea); }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-50 transition-all ml-2 shrink-0"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-rose-400" />
                    </button>
                  </div>

                  {idea.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{idea.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[idea.priority] || PRIORITY_STYLES.medium}`}>
                      {idea.priority}
                    </span>
                    {idea.platform && (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {idea.platform}
                      </span>
                    )}
                    {idea.scheduled_at && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {new Date(idea.scheduled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {col.key !== 'scheduled' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                      <span className="text-[10px] font-medium text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Drag to move <ArrowRight size={12} />
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
