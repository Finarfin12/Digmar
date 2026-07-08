"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Trash2, GripVertical, Image as ImageIcon, Upload, Loader2, AlertCircle, Hash, ExternalLink } from 'lucide-react';
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
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editPlatform, setEditPlatform] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      }
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

  const openEditModal = (idea: Idea) => {
    setEditingIdea(idea);
    setEditTitle(idea.title);
    setEditDesc(idea.description || '');
    setEditTags((idea.tags || []).join(', '));
    setEditPriority(idea.priority);
    setEditPlatform(idea.platform || '');
    setEditMediaUrl(idea.media_url || '');
  };

  const closeEditModal = () => {
    setEditingIdea(null);
    setEditTitle('');
    setEditDesc('');
    setEditTags('');
    setEditPriority('medium');
    setEditPlatform('');
    setEditMediaUrl('');
  };

  const handleSaveEdit = async () => {
    if (!editingIdea || !editTitle.trim()) return;
    const tagsArray = editTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/ideas/${editingIdea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc,
          priority: editPriority,
          platform: editPlatform,
          tags: tagsArray,
          media_url: editMediaUrl,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIdeas(prev => prev.map(i => i.id === editingIdea.id ? { ...i, ...updated } : i));
        closeEditModal();
      } else {
        const err = await res.json();
        Swal.fire('Error', err.error || 'Failed to update', 'error');
      }
    } catch {
      Swal.fire('Error', 'Failed to update', 'error');
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
        setEditMediaUrl(data.url || data.publicUrl);
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
                  onClick={() => setAddingToCol(col.key)}
                  className="p-1 rounded-md hover:bg-black/10 transition-colors"
                  title="Add idea"
                >
                  <Plus size={15} className={col.headerText} />
                </button>
              </div>

              {addingToCol === col.key && (
                <div className="mb-3 p-3 bg-white rounded-xl border border-stone-200 shadow-sm">
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
                    className="w-full p-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddIdea(col.key)}
                      className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingToCol(null); setNewIdeaText(''); }}
                      className="px-3 py-1.5 bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[80px]">
                {colIdeas.length === 0 && !addingToCol && (
                  <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                    <AlertCircle size={22} className="mb-1.5 opacity-50" />
                    <p className="text-xs font-semibold">No ideas yet</p>
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

      {editingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeEditModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-900">Edit Idea</h3>
              <button onClick={closeEditModal} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <X size={18} className="text-stone-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full p-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Idea title"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Add details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">Priority</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full p-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                    value={editPlatform}
                    onChange={e => setEditPlatform(e.target.value)}
                    className="w-full p-2.5 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Instagram"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Tags</label>
                <div className="flex items-center gap-2 p-2.5 border border-stone-300 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500">
                  <Hash size={14} className="text-stone-500 shrink-0" />
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    className="w-full text-sm outline-none"
                    placeholder="campaign, seasonal, urgent (comma separated)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Media</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${editMediaUrl ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 hover:border-indigo-400 bg-stone-50'}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  {editMediaUrl ? (
                    <div className="relative">
                      <img src={editMediaUrl} alt="Preview" className="w-full h-36 object-cover rounded-lg" />
                      <button
                        onClick={() => setEditMediaUrl('')}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mx-auto text-stone-500 mb-2" />
                      <p className="text-xs text-stone-700 font-medium mb-1">Drag & drop or click to upload</p>
                      <p className="text-[10px] text-stone-500">PNG, JPG, GIF up to 10MB</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-bold text-stone-700 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
