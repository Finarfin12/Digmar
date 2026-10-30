"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Loader2, MessageSquare, Search, Phone, Video, MoreVertical, Send, CheckCheck, Bot, Sparkles, Smile, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

import { logger } from '@/lib/utils/logger'
export default function InboxPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [replyText, setReplyText] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initial Fetch Business Units
  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        setUnits(data);
        if (data.length > 0) setSelectedUnit(data[0].id);
      })
      .catch(err => logger.error(err));
  }, []);

  // Fetch Conversations when Unit changes — with polling
  useEffect(() => {
    if (!selectedUnit) return;

    const fetchConvos = async () => {
      try {
        const res = await fetch(`/api/inbox?business_unit_id=${selectedUnit}`);
        const data = await res.json();
        if (data.success) {
          setConversations(data.data || []);
        }
        setLoadingConvos(false);
      } catch (err) {
        logger.error(err);
        setLoadingConvos(false);
      }
    };

    fetchConvos();
    const interval = setInterval(fetchConvos, 30000);
    return () => clearInterval(interval);
  }, [selectedUnit]);

  // Fetch Messages when Conversation selected
  useEffect(() => {
    if (!selectedConvo) return;
    setLoadingMessages(true);
    fetch(`/api/inbox/messages?conversation_id=${selectedConvo.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessages(data.data || []);
          setTimeout(() => scrollToBottom(), 100);
        }
        setLoadingMessages(false);
      })
      .catch(err => {
        logger.error(err);
        setLoadingMessages(false);
      });
  }, [selectedConvo]);

  const handleSyncConversations = async () => {
    if (!selectedUnit) return;
    try {
      Swal.fire({ title: 'Sync Instagram...', text: 'Mengambil percakapan dari Instagram...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      // Get accounts for this unit
      const accRes = await fetch(`/api/accounts?unit_id=${selectedUnit}`);
      const accounts = await accRes.json();
      if (!Array.isArray(accounts) || accounts.length === 0) {
        Swal.fire('Info', 'Tidak ada akun Instagram terhubung ke unit ini.', 'info');
        return;
      }

      let totalSynced = 0;
      let lastError = '';
      for (const account of accounts) {
        const res = await fetch('/api/inbox/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: account.id }),
        });
        const data = await res.json();
        if (data.success) {
          totalSynced += data.messages_synced || 0;
        } else {
          lastError = data.error || data.info || 'Unknown error';
        }
      }

      // Refresh
      const convRes = await fetch(`/api/inbox?business_unit_id=${selectedUnit}`);
      const convData = await convRes.json();
      if (convData.success) setConversations(convData.data || []);

      if (lastError) {
        Swal.fire({
          title: 'Sync Gagal',
          text: lastError,
          icon: 'error',
          footer: 'Cek permission di Facebook Developer: pages_manage_metadata + pages_messaging harus Active',
        });
      } else {
        Swal.fire({
          title: 'Selesai!',
          text: `Berhasil sinkron ${totalSynced} pesan baru dari Instagram.`,
          icon: 'success',
          timer: 3000,
        });
      }
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    }
  };

  const handleGenerateAIReply = async () => {
    if (!selectedConvo) return;
    setAiGenerating(true);
    
    // Check if there are instructions
    let prompt = '';
    const { value: formValues } = await Swal.fire({
      title: 'Tanya AI',
      input: 'text',
      inputLabel: 'Instruksi Khusus (Opsional)',
      inputPlaceholder: 'Misal: Tawarkan diskon 10% karena hari Senin',
      showCancelButton: true,
      confirmButtonText: 'Generate Balasan',
      cancelButtonText: 'Batal'
    });

    if (formValues !== undefined) {
      prompt = formValues;
    } else {
      setAiGenerating(false);
      return; // Cancelled
    }

    try {
      const res = await fetch('/api/inbox/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConvo.id,
          custom_prompt: prompt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setReplyText(data.reply);
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedConvo) return;
    
    const sendingText = replyText;
    const newMsg = {
      id: Math.random().toString(),
      conversation_id: selectedConvo.id,
      sender_type: 'brand',
      content: sendingText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMsg]);
    setReplyText('');
    setTimeout(() => scrollToBottom(), 100);

    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConvo.id,
          message: sendingText,
          sender_type: 'brand'
        })
      });
      const data = await res.json();

      if (!res.ok) {
        Swal.fire({ toast: true, position: 'top-end', title: 'Gagal mengirim', text: data.error, icon: 'error', timer: 2000 });
      } else {
        Swal.fire({ toast: true, position: 'top-end', title: 'Pesan Terkirim', icon: 'success', showConfirmButton: false, timer: 1500 });
      }
    } catch (err: unknown) {
      Swal.fire({ toast: true, position: 'top-end', title: 'Gagal mengirim', text: (err as Error).message, icon: 'error', timer: 2000 });
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch(sentiment?.toLowerCase()) {
      case 'keluhan': return 'bg-red-100 text-red-700 border-red-200';
      case 'positif': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'tanya_harga': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-100 -m-8 flex flex-col">
      {/* Header Select Unit */}
      <div className="bg-white text-slate-900 p-4 px-6 shrink-0 flex items-center justify-between border-b border-slate-200 z-10">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <MessageSquare size={20} className="text-green-600" />
          Smart Inbox
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncConversations}
            className="bg-green-50 hover:bg-green-100 text-green-700 text-xs px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors border border-green-200"
          >
            <RefreshCw size={14} /> Sync Now
          </button>
          <span className="text-sm font-bold text-slate-500">Unit Bisnis:</span>
          <select 
            value={selectedUnit} 
            onChange={e => setSelectedUnit(e.target.value)}
            className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-green-500 outline-none"
          >
            {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* L E F T   P A N E L (Chat List) */}
        <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari pesan atau nama..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingConvos ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageSquare className="mx-auto text-slate-300 mb-3" size={40} />
                <p className="text-slate-500 font-medium">Belum ada obrolan masuk.</p>
                
                {/* Tombol Buat Mock Data (Hanya untuk Demo) */}
                <button 
                  onClick={() => Swal.fire('Demo', 'Fitur mock data belum dibuat. Silakan tambahkan via database secara manual untuk testing.', 'info')}
                  className="mt-4 text-xs bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold"
                >
                  Buat Data Dummy
                </button>
              </div>
            ) : (
              conversations.map(convo => (
                <div 
                  key={convo.id} 
                  onClick={() => setSelectedConvo(convo)}
                  className={`p-4 border-b border-slate-50 cursor-pointer transition-colors ${selectedConvo?.id === convo.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                      {convo.customer_avatar_url ? (
                        <img src={convo.customer_avatar_url} alt={convo.customer_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                          {convo.customer_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-900 truncate pr-2">{convo.customer_name}</h4>
                        <span className="text-xs text-slate-400 shrink-0">{new Date(convo.latest_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mb-2">{convo.latest_message}</p>
                      <div className="flex gap-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {convo.platform} {convo.type}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getSentimentColor(convo.ai_sentiment)}`}>
                          {convo.ai_sentiment}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* R I G H T   P A N E L (Chat Window) */}
        <div className="flex-1 flex flex-col bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center relative">
          {/* Overlay pattern for WA feel */}
          <div className="absolute inset-0 bg-white/90 z-0"></div>

          {selectedConvo ? (
            <>
              {/* Chat Header */}
              <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-3 px-6 flex justify-between items-center z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                    {selectedConvo.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedConvo.customer_name}</h3>
                    <p className="text-xs font-medium text-slate-500 capitalize">{selectedConvo.platform} • {selectedConvo.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-slate-500">
                  <Phone size={20} className="cursor-pointer hover:text-indigo-600" />
                  <Video size={20} className="cursor-pointer hover:text-indigo-600" />
                  <MoreVertical size={20} className="cursor-pointer hover:text-indigo-600" />
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 z-10 custom-scrollbar">
                {loadingMessages ? (
                  <div className="flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-500 bg-white/50 py-2 px-4 rounded-full w-max mx-auto text-sm font-bold shadow-sm">Mulai percakapan</div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_type !== 'customer';
                    return (
                      <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl p-3 px-4 shadow-sm relative ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'}`}>
                          {msg.sender_type === 'ai_auto' && (
                            <div className="text-[10px] font-bold text-indigo-200 flex items-center gap-1 mb-1">
                              <Bot size={12}/> Dibalas oleh AI
                            </div>
                          )}
                          <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                          <div className={`text-[10px] font-medium mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            {isMe && <CheckCheck size={14} className="text-indigo-200" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Area */}
              <div className="bg-slate-100 p-3 z-10">
                {/* AI Assistant Banner */}
                <div className="flex justify-end mb-2">
                  <button 
                    onClick={handleGenerateAIReply}
                    disabled={aiGenerating}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold px-4 py-2 rounded-t-xl rounded-bl-xl shadow-lg flex items-center gap-2 transition-all"
                  >
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {aiGenerating ? 'AI Sedang Mengetik...' : 'Buat Balasan AI (Draft)'}
                  </button>
                </div>

                <div className="bg-white rounded-2xl flex items-end p-2 border border-slate-200 shadow-sm">
                  <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><Smile size={24} /></button>
                  <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><ImageIcon size={24} /></button>
                  <textarea 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Ketik pesan balasan..."
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-3 px-2 text-slate-800"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!replyText.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-md ml-2"
                  >
                    <Send size={20} className="ml-1" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center z-10 text-slate-500">
              <div className="w-24 h-24 bg-white/50 rounded-full flex items-center justify-center mb-4 shadow-sm border border-white">
                <MessageSquare size={48} className="text-slate-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">DigiMar Inbox</h3>
              <p className="font-medium mt-2">Pilih percakapan untuk mulai merespons dengan AI.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
