import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { 
  Sparkles, 
  Send, 
  Image as ImageIcon, 
  X, 
  Zap, 
  Trash2, 
  Plus, 
  History,
  MessageSquare,
  ChevronLeft,
  Settings,
  MoreVertical,
  Coffee,
  Undo2,
  Check,
  Search,
  BookOpen,
  PieChart,
  Target,
  PenLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ReplyCard } from '@/components/ReplyCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Reply {
  option_number: number;
  category: string;
  content: string;
  explanation: string;
}

interface APIResponse {
  match_name: string;
  confidence_score: number;
  vibe_read: string;
  draft_replies: Reply[];
  follow_up_question: string;
  if_they_go_quiet_message: string;
  thing_to_avoid_next: string;
}

interface RefinementState {
  originalText: string;
  currentRefinedVersion: string;
  conversationHistory: Message[];
}

interface Conversation {
  id: string;
  title: string;
  last_message?: string;
  created_at: string;
}

export default function Home() {
  const [context, setContext] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [vibe, setVibe] = useState('Playful/Witty');
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [refinement, setRefinement] = useState<RefinementState | null>(null);
  const [userFeedback, setUserFeedback] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [selectedReplyId, setSelectedReplyId] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [previousState, setPreviousState] = useState<any>(null);
  const [showContinuation, setShowContinuation] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const vibes = [
    'Playful/Witty',
    'Bold/Direct',
    'Soft/Warm',
    'Intriguing/Mysterious',
    'Self-Deprecating',
    'Intellectual'
  ];

  const quickActions = [
    'Make it shorter',
    'More chaotic',
    'Add a compliment',
    'Less aggressive',
    'Make it a question'
  ];

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationHistory, response, loading]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setImages(prev => [...prev, event.target!.result as string]);
                    }
                };
                reader.readAsDataURL(blob);
            }
        }
    }
  };

  const generateReplies = async () => {
    setLoading(true);
    setResponse(null);
    setShowContinuation(false);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context, 
          images, 
          vibe,
          history: conversationHistory,
          conversationId: currentConversationId
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setResponse(data);
      
      // If no conversation active, create one or update title if it's the first turn
      if (!currentConversationId && data.match_name) {
        const createRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Chat with ${data.match_name}` })
        });
        const newConv = await createRes.json();
        setCurrentConversationId(newConv.id);
        fetchConversations();
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = (text: string) => {
    setRefinement({
      originalText: text,
      currentRefinedVersion: text,
      conversationHistory: []
    });
    setUserFeedback('');
  };

  const submitRefinement = async (feedback: string) => {
    if (!feedback.trim() || !refinement) return;
    setRefineLoading(true);
    
    try {
      const newUserMsg: Message = { role: 'user', content: feedback };
      const updatedHistory = [...refinement.conversationHistory, newUserMsg];

      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_reply: refinement.originalText,
          current_version: refinement.currentRefinedVersion,
          feedback: feedback,
          history: updatedHistory,
          context: context,
          vibe: vibe
        }),
      });
      const data = await res.json();
      
      const assistantMsg: Message = { role: 'assistant', content: data.explanation };
      
      setRefinement({
        ...refinement,
        currentRefinedVersion: data.refined_reply,
        conversationHistory: [...updatedHistory, assistantMsg]
      });
      setUserFeedback('');
    } catch (error) {
      console.error('Refinement failed:', error);
    } finally {
      setRefineLoading(false);
    }
  };

  const handleChoose = (text: string) => {
    // Save state BEFORE clearing for undo
    setPreviousState({
      response,
      refinement,
      context,
      images
    });
    setCanUndo(true);

    navigator.clipboard.writeText(text);
    
    // Persist choice
    if (currentConversationId) {
      fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          last_message: text,
          history: [...conversationHistory, { role: 'user', content: text }]
        })
      });
    }

    // Add to conversation history
    setConversationHistory(prev => [
      ...prev,
      { role: 'user', content: text }
    ]);

    // Show continuation UI instead of clearing
    setShowContinuation(true);
    setResponse(null);
    setRefinement(null);
    setSelectedReplyId(null);
  };

  const handleContinue = async () => {
    // Add placeholder for the "Them" turn that will be represented by the next screenshot
    setConversationHistory(prev => [
      ...prev,
      { role: 'assistant', content: '[Waiting for next message...]' }
    ]);

    // Clear continuation UI
    setShowContinuation(false);
    
    // Clear input fields for next turn
    setContext('');
    setImages([]);
    setResponse(null);
    setRefinement(null);
  };

  const handleUndo = () => {
    if (!previousState) return;
    setResponse(previousState.response);
    setRefinement(previousState.refinement);
    setContext(previousState.context);
    setImages(previousState.images);
    setConversationHistory(prev => prev.slice(0, -1));
    setShowContinuation(false);
    setCanUndo(false);
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setConversationHistory([]);
    setContext('');
    setImages([]);
    setResponse(null);
    setShowContinuation(false);
    setIsSidebarOpen(false);
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setCurrentConversationId(id);
      setConversationHistory(data.history || []);
      setResponse(null);
      setShowContinuation(false);
      setIsSidebarOpen(false);
    } catch (err) {
      console.error('Failed to load conversation');
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (currentConversationId === id) startNewChat();
      fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-pink-500/30 overflow-hidden font-sans">
      <Head>
        <title>FlirtBot | Your AI Dating Wingman</title>
        <meta name="description" content="Master the art of digital flirting with GPT-4 powered response coaching." />
      </Head>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <motion.aside
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={clsx(
          "fixed inset-y-0 left-0 w-80 bg-[#0f0f0f] border-r border-white/5 z-50 flex flex-col shadow-2xl transition-all",
          "lg:translate-x-0 lg:static lg:block"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              FLIRTBOT
            </span>
          </div>

          <button
            onClick={startNewChat}
            className="flex items-center gap-3 w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-sm font-bold mb-6 group"
          >
            <div className="p-1 px-2 rounded-lg bg-pink-500/10 text-pink-500 group-hover:scale-110 transition-transform">
              <Plus size={16} />
            </div>
            New Wingman Session
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest px-2 mb-4">Past Conquests</p>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={clsx(
                  "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                  currentConversationId === conv.id
                    ? "bg-white/10 border-white/10 text-white"
                    : "bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/60"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className={currentConversationId === conv.id ? "text-pink-500" : "text-white/10"} />
                  <span className="text-xs font-medium truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => deleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-white/5 space-y-2">
            <button 
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all text-xs font-semibold"
            >
              <PieChart size={16} /> Charm Analytics
            </button>
            <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all text-xs font-semibold">
              <Settings size={16} /> Advanced Settings
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-screen">
        {/* Header */}
        <header className="fixed top-0 inset-x-0 lg:left-80 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 lg:hidden text-white/40 hover:text-white"
              >
                <History size={20} />
              </button>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold text-white tracking-tight">
                  {currentConversationId 
                    ? conversations.find(c => c.id === currentConversationId)?.title 
                    : 'Unidentified Match'}
                </h1>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Assistant Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                <Target size={12} className="text-pink-500" />
                <span className="text-[10px] font-bold text-white/60">GOAL: GET NUMBER</span>
              </div>
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Analytics Overlay */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-x-6 top-20 z-40 p-6 bg-[#151515] border border-white/10 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <PieChart size={16} className="text-pink-500" /> Charm Performance
                </h2>
                <button onClick={() => setShowStats(false)} className="text-white/20 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Wit Ratio', val: '86%', color: 'text-purple-400' },
                  { label: 'Risk Score', val: 'High', color: 'text-pink-400' },
                  { label: 'Conversations', val: conversations.length, color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-white/30 uppercase font-black mb-1">{s.label}</p>
                    <p className={clsx("text-lg font-bold", s.color)}>{s.val}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thread Area */}
        <main className="flex-1 flex flex-col relative pt-16 h-full overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth no-scrollbar custom-scrollbar"
          >
            {conversationHistory.length === 0 && !loading && !response && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6">
                <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500 animate-pulse">
                  <Sparkles size={32} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-2">Ready to Flirt?</h2>
                  <p className="text-sm text-white/40">Drop a screenshot or paste messages to get the perfect reply.</p>
                </div>
              </div>
            )}

            {/* Conversation History Bubbles */}
            {conversationHistory.map((msg, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx}
                className={clsx(
                  "flex flex-col max-w-[85%] space-y-1",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={clsx(
                  "px-4 py-3 rounded-2xl text-sm shadow-sm",
                  msg.role === 'user'
                    ? "bg-pink-600 text-white rounded-tr-none"
                    : "bg-white/10 text-white/90 rounded-tl-none border border-white/5"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {/* Generation Results (Inline) */}
            <AnimatePresence>
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pb-4"
                >
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Coach's Suggestions</span>
                  </div>

                  {/* Vibe Read Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-lg">
                    <p className="text-blue-100/80 text-sm italic leading-relaxed">
                      "{response.vibe_read}"
                    </p>
                  </div>

                  {/* Reply Cards */}
                  <div className="space-y-3">
                    {response.draft_replies.map((reply) => (
                      <ReplyCard
                        key={reply.option_number}
                        reply={reply}
                        index={reply.option_number}
                        isSelected={selectedReplyId === reply.option_number}
                        onSelect={() => setSelectedReplyId(reply.option_number)}
                        onRefine={handleRefine}
                        onChoose={(r) => handleChoose(r.content)}
                      />
                    ))}
                  </div>

                  {/* Advice Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2 text-yellow-300">
                        <Zap size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">Avoid</span>
                      </div>
                      <p className="text-white/70 text-xs">{response.thing_to_avoid_next}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2 text-purple-300">
                        <Coffee size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">If Quiet</span>
                      </div>
                      <p className="text-white/70 text-xs">{response.if_they_go_quiet_message}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading Indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-white/40 italic text-sm py-4"
              >
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"></span>
                </div>
                Assistant is typing...
              </motion.div>
            )}

            {/* Continuation UI */}
            {showContinuation && !response && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 bg-green-500/5 rounded-2xl border border-green-500/20 text-center space-y-3"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="text-green-500" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reply Chosen!</h3>
                  <p className="text-xs text-white/40">Ready for their next response?</p>
                </div>
                <button
                  onClick={handleContinue}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-full text-xs font-bold transition-all border border-green-500/30"
                >
                  <Plus size={14} /> Next Screenshot / Turn
                </button>
              </motion.div>
            )}
          </div>

          {/* Fixed Bottom Input Area */}
          <section className="p-4 bg-[#0a0a0a] border-t border-white/5 z-20 shrink-0">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Vibe Selector (Compressed) */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
                {vibes.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVibe(v)}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border",
                      vibe === v
                        ? "bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/20"
                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Input Wrapper */}
              <div className="relative group">
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Paste context or messages..."
                  className="w-full bg-[#151515] rounded-2xl p-4 pr-12 text-sm text-white placeholder:text-white/20 border border-white/5 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 resize-none transition-all min-h-[56px] max-h-32"
                  rows={context.split('\n').length > 1 ? 3 : 1}
                />

                {/* Upload Button overlay */}
                <label className="absolute right-3 top-3 text-white/20 hover:text-pink-400 cursor-pointer transition-colors">
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                  <div className="p-1 rounded-lg bg-white/5 border border-white/10">
                    <Sparkles size={16} />
                  </div>
                </label>

                {/* Image Grid Overlay (Small) */}
                {images && images.length > 0 && (
                  <div className="absolute left-4 -top-12 flex gap-2 p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group/img">
                        <img src={img} alt="" className="w-8 h-8 object-cover rounded-md border border-white/10" />
                        <button
                          onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                    <div className="text-[10px] flex items-center px-1 text-white/40">
                      {images.length} Context Images
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons Row */}
              <div className="flex gap-2">
                {canUndo && (
                  <button
                    onClick={handleUndo}
                    className="flex-none p-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                    title="Undo Choice"
                  >
                    <Undo2 size={18} />
                  </button>
                )}

                <button
                  onClick={() => generateReplies()}
                  disabled={loading || (!context && images.length === 0)}
                  className={clsx(
                    'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg',
                    loading || (!context && images.length === 0)
                      ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                      : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:scale-[1.01] active:scale-[0.99] text-white shadow-pink-500/10'
                  )}
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Zap size={18} className="fill-white" />
                    </motion.div>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>{showContinuation ? 'Generate for Next Turn' : 'Generate Magic'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Refinement Dialogue Overlay (Integrated) */}
          <AnimatePresence>
            {refinement && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-x-0 bottom-0 top-[20%] bg-[#0a0a0a] border-t border-white/10 z-[60] flex flex-col shadow-2xl rounded-t-[2rem] overflow-hidden"
              >
                {/* Refinement Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-xl">
                      <MessageSquare size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">AI Response Coach</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Fine-tune your charm</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRefinement(null)}
                    className="p-2 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Refinement Main area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* The actual text we are refining */}
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 text-center space-y-4">
                    <p className="text-xs text-purple-300 font-bold uppercase tracking-widest">New Version</p>
                    <p className="text-2xl font-medium text-white leading-relaxed">
                      "{refinement.currentRefinedVersion}"
                    </p>
                    <button
                      onClick={() => handleChoose(refinement.currentRefinedVersion)}
                      className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full text-sm font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95"
                    >
                      Use This Message
                    </button>
                  </div>

                  {/* Coach Chat History */}
                  <div className="space-y-4">
                    {refinement.conversationHistory.length === 0 ? (
                      <div className="text-center space-y-4 py-4">
                        <p className="text-sm text-white/30 italic">How should we change the tone?</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {quickActions.map((action) => (
                            <button
                              key={action}
                              onClick={() => submitRefinement(action)}
                              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/5 transition-all"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      refinement.conversationHistory.map((msg, idx) => (
                        <div
                          key={idx}
                          className={clsx(
                            'p-3 rounded-2xl max-w-[85%] text-sm',
                            msg.role === 'user'
                              ? 'bg-purple-600 text-white ml-auto rounded-tr-none'
                              : 'bg-white/10 text-white/80 mr-auto rounded-tl-none border border-white/5'
                          )}
                        >
                          {msg.content}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Refinement Inputs */}
                <div className="p-4 bg-[#111] border-t border-white/5 shrink-0">
                  <div className="max-w-xl mx-auto flex gap-2">
                    <input
                      type="text"
                      value={userFeedback}
                      onChange={(e) => setUserFeedback(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && submitRefinement(userFeedback)}
                      placeholder="e.g. make it punchier..."
                      className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      disabled={refineLoading}
                    />
                    <button
                      onClick={() => submitRefinement(userFeedback)}
                      disabled={refineLoading || !userFeedback.trim()}
                      className={clsx(
                        'p-3 rounded-xl transition-all',
                        refineLoading || !userFeedback.trim()
                          ? 'bg-white/5 text-white/20'
                          : 'bg-purple-600 text-white hover:scale-105 active:scale-95 shadow-lg shadow-purple-600/20'
                      )}
                    >
                      {refineLoading ? (
                        <Zap size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
