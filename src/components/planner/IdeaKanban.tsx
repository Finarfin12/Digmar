"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Trash2, Upload, Loader2, AlertCircle, Hash, Send, Save } from 'lucide-react';
import Swal from 'sweetalert2';

interface Idea {
  id: string;
  title: string;
  description: string;
  status: 'unassigned' | 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  platform: string;
  business_unit_id: string | null;
  media_url: string;
  tags: string[];
  scheduled_at: string | null;
  position: number;
  created_at: string;
}

const COLUMNS = [
  { key: 'unassigned', label: 'Unassigned', color: 'bg-stone-50', headerBg: 'bg-stone-100', headerText: 'text-stone-700', dotColor: 'bg-stone-400' },
  { key: 'todo', label: 'To Do', color: 'bg-sky-50', headerBg: 'bg-sky-100', headerText: 'text-sky-700', dotColor: 'bg-sky-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-50', headerBg: 'bg-amber-100', headerText: 'text-amber-700', dotColor: 'bg-amber-400' },
  { key: 'done', label: 'Done', color: 'bg-emerald-50', headerBg: 'bg-emerald-100', headerText: 'text-emerald-700', dotColor: 'bg-emerald-400' },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-stone-100 text-stone-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

const COL_LABEL_STYLES: Record<string, string> = {
  unassigned: 'bg-stone-100 text-stone-700',
  todo: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
};

interface IdeaKanbanProps {
  businessUnitId?: string;
}

export default function IdeaKanban({ businessUnitId }: IdeaKanbanProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [createCol, setCreateCol] = useState<string | null>(null);
  const [editIdea, setEditIdea] = useState<Idea | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formPlatform, setFormPlatform] = useState('');
  const [formMediaUrl, setFormMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = editIdea !== null;
  const activeCol = isEditMode ? editIdea!.status : createCol;

  const fetchIdeas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (businessUnitId) params.set('business_unit_id', businessUnitId);
      const res = await fetch(`/api/ideas?${params}`);
      if (res.ok) setIdeas(await res.json());
    } catch {
      // handled below
    } finally {
      setLoading(false);
    }
  }, [businessUnitId]);

  useEffect(() => { fetchIdeas() }, [fetchIdeas]);

  useEffect(() => {
    if (createCol && titleInputRef.current) titleInputRef.current.focus();
  }, [createCol]);

  const getColumnIdeas = (status: string) =>
    ideas.filter(i => i.status === status);

  const openCreateModal = (colKey: string) => {
    setCreateCol(colKey);
    setEditIdea(null);
    resetForm();
  };

  const openEditModal = (idea: Idea) => {
    setEditIdea(idea);
    setCreateCol(null);
    setFormTitle(idea.title);
    setFormDesc(idea.description || '');
    setFormTags((idea.tags || []).join(', '));
    setFormPriority(idea.priority);
    setFormPlatform(idea.platform || '');
    setFormMediaUrl(idea.media_url || '');
  };

  const closeModal = () => {
    setCreateCol(null);
    setEditIdea(null);
    resetForm();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormTags('');
    setFormPriority('medium');
    setFormPlatform('');
    setFormMediaUrl('');
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !createCol) return;
    const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc,
          business_unit_id: businessUnitId,
          status: createCol,
          priority: formPriority,
          platform: formPlatform,
          tags: tagsArray,
          media_url: formMediaUrl,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setIdeas(prev => [...prev, created]);
        closeModal();
      } else {
        const err = await res.json();
        Swal.fire('Error', err.error || 'Failed to create idea', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to create idea', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editIdea || !formTitle.trim()) return;
    const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/ideas/${editIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc,
          priority: formPriority,
          platform: formPlatform,
          tags: tagsArray,
          media_url: formMediaUrl,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIdeas(prev => prev.map(i => i.id === editIdea.id ? { ...i, ...updated } : i));
        closeModal();
      } else {
        const err = await res.json();
        Swal.fire('Error', err.error || 'Failed to update', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to update', 'error');
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
      if (!res.ok) setIdeas(prev);
    } catch {
      setIdeas(prev);
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

  const handleMediaUpload = async (file: File) => {
    if (!businessUnitId) {
      Swal.fire('Error', 'Select a brand first to upload media', 'error');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('business_unit_id', businessUnitId);
      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setFormMediaUrl(data.url || data.publicUrl);
      } else {
        Swal.fire('Error', 'Failed to upload image', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleMediaUpload(file);
  };

  const handleDragStart = (e: React.DragEvent, idea: Idea) => {
    setDragId(idea.id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
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

  const handleCardClick = (idea: Idea, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    openEditModal(idea);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const modalTitle = isEditMode ? 'Edit Idea' : 'Create Idea';
  const colLabel = activeCol ? COLUMNS.find(c => c.key === activeCol)?.label || '' : '';

  return (
    <>
      <div className="flex gap-5 overflow-x-auto pb-4 min-h-[600px]">
        {COLUMNS.map(col => {
          const colIdeas = getColumnIdeas(col.key);
          const isOver = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              className={`flex-1 min-w-[280px] max-w-[340px] rounded-xl ${col.color} p-3 transition-all duration-200 flex flex-col ${isOver ? 'ring-2 ring-indigo-400 shadow-lg' : ''}`}
              onDragOver={e => handleDragOver(e, col.key)}
              onDrop={e => handleDrop(e, col.key)}
            >
              <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg ${col.headerBg}`}>
                <div className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className={col.headerText}>{col.label}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${col.headerBg} opacity-60`}>
                    {colIdeas.length}
                  </span>
                </div>
                <button
                  onClick={() => openCreateModal(col.key)}
                  className="p-1 rounded-md hover:bg-black/10 transition-colors"
                  title="Add idea"
                >
                  <Plus size={15} className={col.headerText} />
                </button>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[80px]">
                {colIdeas.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-stone-500">
                    <AlertCircle size={22} className="mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-stone-500 mb-2">No ideas yet</p>
                    <button
                      onClick={() => openCreateModal(col.key)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Plus size={13} /> Add your first idea
                    </button>
                  </div>
                )}
                {colIdeas.map(idea => (
                  <div
                    key={idea.id}
                    draggable
                    onDragStart={e => handleDragStart(e, idea)}
                    onDragEnd={handleDragEnd}
                    onClick={e => handleCardClick(idea, e)}
                    className={`group bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${dragId === idea.id ? 'opacity-40 scale-95 rotate-1' : ''}`}
                  >
                    {idea.media_url && (
                      <div className="w-full h-28 rounded-t-xl overflow-hidden bg-stone-100">
                        <img src={idea.media_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="p-3.5">
                      <div className="flex items-start justify-between mb-1.5">
                        <h4 className="text-sm font-semibold text-stone-900 line-clamp-2 leading-snug">{idea.title}</h4>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(idea); }}
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-50 transition-all ml-1.5 shrink-0"
                          title="Delete"
                        >
                          <Trash2 size={13} className="text-rose-400" />
                        </button>
                      </div>

                      {idea.description && (
                        <p className="text-xs text-stone-600 line-clamp-2 mb-2.5 leading-relaxed">{idea.description}</p>
                      )}

                      {idea.tags && idea.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {idea.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Hash size={9} />{tag}
                            </span>
                          ))}
                          {idea.tags.length > 3 && (
                            <span className="text-[10px] font-semibold text-stone-500">+{idea.tags.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${PRIORITY_STYLES[idea.priority] || PRIORITY_STYLES.medium}`}>
                          {idea.priority}
                        </span>
                        {idea.platform && (
                          <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">
                            {idea.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(createCol || editIdea) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-stone-900">{modalTitle}</h3>
                {colLabel && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${COL_LABEL_STYLES[activeCol || ''] || ''}`}>
                    {colLabel}
                  </span>
                )}
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <X size={18} className="text-stone-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && formTitle.trim()) isEditMode ? handleSaveEdit() : handleCreate(); }}
                  className="w-full text-xl font-bold text-stone-900 outline-none placeholder:text-stone-300"
                  placeholder="Give your idea a title"
                />
              </div>

              <div>
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full text-sm text-stone-600 outline-none resize-none placeholder:text-stone-300 border-b border-stone-200 pb-3 focus:border-indigo-400 transition-colors"
                  placeholder="Let it flow... or"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 border border-stone-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500">
                <Hash size={14} className="text-stone-400 shrink-0" />
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  className="w-full text-sm outline-none text-stone-600 placeholder:text-stone-300"
                  placeholder="Add tags (comma separated)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Priority</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value)}
                    className="w-full p-2.5 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Platform</label>
                  <input
                    type="text"
                    value={formPlatform}
                    onChange={e => setFormPlatform(e.target.value)}
                    className="w-full p-2.5 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-stone-300"
                    placeholder="e.g. Instagram"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Media</label>
                <div
                  className={`border-2 border-dashed rounded-xl py-5 text-center transition-colors ${formMediaUrl ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 hover:border-indigo-400 bg-stone-50'}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  {formMediaUrl ? (
                    <div className="relative max-w-xs mx-auto">
                      <img src={formMediaUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => setFormMediaUrl('')}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={22} className="mx-auto text-stone-400 mb-2" />
                      <p className="text-sm text-stone-600 font-medium mb-1">Drag & drop or select a file</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Select File'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200">
              <button
                onClick={closeModal}
                className="px-5 py-2 text-sm font-bold text-stone-600 hover:text-stone-800 transition-colors"
              >
                Cancel
              </button>
              {isEditMode ? (
                <button
                  onClick={handleSaveEdit}
                  disabled={!formTitle.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40"
                >
                  <Save size={15} /> Save Idea
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!formTitle.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40"
                  >
                    <Save size={15} /> Save Idea
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!formTitle.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40"
                  >
                    <Send size={15} /> Create Post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
