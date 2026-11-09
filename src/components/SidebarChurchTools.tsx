import React, { useState, useRef, useEffect } from 'react';
import {
  ChatMessage,
  Participant,
  PrayerRequest,
  UserRole,
  ActiveVerse,
} from '../types/meeting';
import {
  BIBLE_VERSES,
  CHURCH_HYMNS,
  ROLE_LABELS,
  BibleVerseItem,
} from '../data/churchData';
import {
  X,
  Send,
  MessageSquare,
  Users,
  BookOpen,
  Heart,
  Music,
  Search,
  Check,
  Copy,
  MicOff,
  Mic,
  Video,
  VideoOff,
  ShieldAlert,
  Sparkles,
  Share2,
} from 'lucide-react';

interface SidebarChurchToolsProps {
  activeTab: 'chat' | 'participants' | 'bible' | 'prayers' | 'hymns';
  onClose: () => void;
  onTabChange: (tab: 'chat' | 'participants' | 'bible' | 'prayers' | 'hymns') => void;
  // Chat
  chatMessages: ChatMessage[];
  onSendMessage: (text: string, isAnnouncement?: boolean) => void;
  currentUserId: string;
  currentUserRole: UserRole;
  // Participants
  participants: Participant[];
  onMuteParticipant: (id: string) => void;
  canModerate: boolean;
  // Bible
  onPresentVerse: (reference: string, text: string) => void;
  onClearVerse: () => void;
  activeVerse: ActiveVerse | null;
  // Prayers
  prayers: PrayerRequest[];
  onAddPrayer: (text: string) => void;
  onAmenPrayer: (id: string) => void;
}

export const SidebarChurchTools: React.FC<SidebarChurchToolsProps> = ({
  activeTab,
  onClose,
  onTabChange,
  chatMessages,
  onSendMessage,
  currentUserId,
  currentUserRole,
  participants,
  onMuteParticipant,
  canModerate,
  onPresentVerse,
  onClearVerse,
  activeVerse,
  prayers,
  onAddPrayer,
  onAmenPrayer,
}) => {
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Bible search state
  const [bibleSearchQuery, setBibleSearchQuery] = useState('');
  const [bibleCategory, setBibleCategory] = useState<string>('todos');
  const [copiedVerse, setCopiedVerse] = useState<string | null>(null);

  // Prayers state
  const [prayerInput, setPrayerInput] = useState('');

  // Selected Hymn
  const [selectedHymnId, setSelectedHymnId] = useState<string>(CHURCH_HYMNS[0].id);

  // Filter Bible verses
  const filteredVerses = BIBLE_VERSES.filter((v) => {
    const matchesCat = bibleCategory === 'todos' || v.category === bibleCategory;
    const q = bibleSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      v.reference.toLowerCase().includes(q) ||
      v.text.toLowerCase().includes(q) ||
      v.book.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handleQuickGreet = (text: string) => {
    onSendMessage(text);
  };

  const handleCopyVerse = (reference: string, text: string) => {
    navigator.clipboard.writeText(`"${text}" - ${reference} (RVR1960)`);
    setCopiedVerse(reference);
    setTimeout(() => setCopiedVerse(null), 2000);
  };

  const handleCreatePrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerInput.trim()) return;
    onAddPrayer(prayerInput);
    setPrayerInput('');
  };

  const selectedHymn = CHURCH_HYMNS.find((h) => h.id === selectedHymnId) || CHURCH_HYMNS[0];

  return (
    <aside className="w-full sm:w-96 md:w-[420px] h-full bg-slate-950/95 border-l border-slate-800/80 backdrop-blur-2xl flex flex-col z-30 shadow-2xl transition-all">
      {/* Header with Navigation Tabs */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            {activeTab === 'chat' && 'Chat de la Reunión'}
            {activeTab === 'participants' && 'Hermanos Conectados'}
            {activeTab === 'bible' && 'Sagradas Escrituras'}
            {activeTab === 'prayers' && 'Peticiones de Oración'}
            {activeTab === 'hymns' && 'Himnario y Alabanzas'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab pills */}
        <div className="grid grid-cols-5 gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onTabChange('chat')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 mb-0.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onTabChange('participants')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
              activeTab === 'participants'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Participantes"
          >
            <Users className="w-3.5 h-3.5 mb-0.5" />
            <span>Gente ({participants.length})</span>
          </button>

          <button
            onClick={() => onTabChange('bible')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
              activeTab === 'bible'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Biblia"
          >
            <BookOpen className="w-3.5 h-3.5 mb-0.5" />
            <span>Biblia</span>
          </button>

          <button
            onClick={() => onTabChange('prayers')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
              activeTab === 'prayers'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Peticiones"
          >
            <Heart className="w-3.5 h-3.5 mb-0.5" />
            <span>Oración</span>
          </button>

          <button
            onClick={() => onTabChange('hymns')}
            className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
              activeTab === 'hymns'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Himnos"
          >
            <Music className="w-3.5 h-3.5 mb-0.5" />
            <span>Himnos</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* ================= CHAT TAB ================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Quick Greetings Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar text-xs">
              <button
                onClick={() => handleQuickGreet('¡Paz de Dios y bendiciones a todos! 🙏')}
                className="px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
              >
                🙏 Paz de Dios
              </button>
              <button
                onClick={() => handleQuickGreet('¡Amén, gloria a Dios! ✨')}
                className="px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
              >
                ✨ ¡Amén!
              </button>
              <button
                onClick={() => handleQuickGreet('Nos unimos en oración hermanos ❤️')}
                className="px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap"
              >
                ❤️ En oración
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMessages.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay mensajes aún.</p>
                  <p className="text-xs">¡Saluda a los hermanos de la reunión!</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  const roleStyle = ROLE_LABELS[msg.senderRole] || ROLE_LABELS.member;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="font-semibold text-slate-300">
                          {isMe ? 'Tú' : msg.senderName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border ${roleStyle.bg} ${roleStyle.color}`}>
                          {roleStyle.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] break-words leading-relaxed text-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="mt-3 pt-2 border-t border-slate-800/80 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe un mensaje o saludo..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================= PARTICIPANTS TAB ================= */}
        {activeTab === 'participants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                En esta reunión ({participants.length})
              </span>
              {canModerate && (
                <button
                  onClick={() => {
                    participants.forEach((p) => {
                      if (p.id !== currentUserId && p.isMicOn) {
                        onMuteParticipant(p.id);
                      }
                    });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 hover:bg-red-900 transition-colors"
                >
                  Silenciar a todos
                </button>
              )}
            </div>

            <div className="space-y-2">
              {participants.map((p) => {
                const isMe = p.id === currentUserId;
                const roleInfo = ROLE_LABELS[p.role] || ROLE_LABELS.member;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-300">
                        {p.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {p.displayName} {isMe && '(Tú)'}
                          </p>
                          {p.isHandRaised && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-bold">
                              ✋
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border ${roleInfo.bg} ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Mic status */}
                      <span
                        className={`p-1.5 rounded-lg text-xs ${
                          p.isMicOn ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'
                        }`}
                        title={p.isMicOn ? 'Micrófono activo' : 'Micrófono silenciado'}
                      >
                        {p.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                      </span>

                      {/* Video status */}
                      <span
                        className={`p-1.5 rounded-lg text-xs ${
                          p.isCameraOn ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-500 bg-slate-800'
                        }`}
                        title={p.isCameraOn ? 'Cámara encendida' : 'Cámara apagada'}
                      >
                        {p.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                      </span>

                      {/* Moderator mute */}
                      {canModerate && !isMe && p.isMicOn && (
                        <button
                          onClick={() => onMuteParticipant(p.id)}
                          className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-700/60 transition-colors"
                          title="Silenciar a este participante"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= BIBLE TAB ================= */}
        {activeTab === 'bible' && (
          <div className="space-y-3">
            {/* Active verse indicator banner */}
            {activeVerse && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold flex items-center gap-1 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" /> Proyectando ahora:
                  </span>
                  <p className="mt-0.5 font-serif">{activeVerse.reference}</p>
                </div>
                <button
                  onClick={onClearVerse}
                  className="px-2 py-1 rounded bg-slate-900 border border-amber-500/40 text-amber-300 hover:text-white hover:bg-slate-800 text-[11px] font-semibold"
                >
                  Dejar de proyectar
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={bibleSearchQuery}
                onChange={(e) => setBibleSearchQuery(e.target.value)}
                placeholder="Buscar versículo o palabra clave..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Category Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {['todos', 'paz', 'fe', 'esperanza', 'salvacion', 'fortaleza', 'oracion', 'amor'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setBibleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full capitalize whitespace-nowrap text-[11px] transition-colors ${
                    bibleCategory === cat
                      ? 'bg-amber-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Verses List */}
            <div className="space-y-3 mt-2">
              {filteredVerses.map((item) => {
                const isProjected = activeVerse?.reference === item.reference;
                return (
                  <div
                    key={item.reference}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isProjected
                        ? 'bg-amber-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/50'
                        : 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-serif font-bold text-amber-300 text-sm">
                        {item.reference}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                        {item.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-serif leading-relaxed italic border-l-2 border-amber-500/40 pl-2.5 py-0.5 mb-3">
                      "{item.text}"
                    </p>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs">
                      {/* Project button */}
                      <button
                        onClick={() => onPresentVerse(item.reference, item.text)}
                        className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          isProjected
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{isProjected ? 'Proyectando' : 'Proyectar en pantalla'}</span>
                      </button>

                      {/* Copy button */}
                      <button
                        onClick={() => handleCopyVerse(item.reference, item.text)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Copiar versículo"
                      >
                        {copiedVerse === item.reference ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= PRAYERS TAB ================= */}
        {activeTab === 'prayers' && (
          <div className="space-y-4">
            {/* Create prayer petition */}
            <form onSubmit={handleCreatePrayer} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-emerald-400 block mb-2">
                Agregar Motivo de Oración / Acción de Gracias
              </span>
              <textarea
                value={prayerInput}
                onChange={(e) => setPrayerInput(e.target.value)}
                rows={2}
                placeholder="Por la salud de..., por trabajo, por salvación de mi familia..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
              />
              <button
                type="submit"
                disabled={!prayerInput.trim()}
                className="mt-2 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Compartir Petición de Oración</span>
              </button>
            </form>

            {/* List of prayer petitions */}
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-medium">
                Peticiones de la Congregación ({prayers.length})
              </span>

              {prayers.map((prayer) => (
                <div
                  key={prayer.id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-200">
                      {prayer.requesterName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(prayer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-slate-300 leading-relaxed mb-3">
                    {prayer.text}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <button
                      onClick={() => onAmenPrayer(prayer.id)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-medium transition-colors"
                    >
                      <span>🙏</span>
                      <span>Decir Amén ({prayer.amenCount})</span>
                    </button>
                    <span className="text-[10px] text-slate-400 italic">
                      Unidos en intercesión
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= HYMNS TAB ================= */}
        {activeTab === 'hymns' && (
          <div className="space-y-4">
            {/* Hymn selector buttons */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-medium">Seleccionar Himno / Alabanza:</span>
              <div className="flex flex-col gap-1">
                {CHURCH_HYMNS.map((hymn) => (
                  <button
                    key={hymn.id}
                    onClick={() => setSelectedHymnId(hymn.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      selectedHymnId === hymn.id
                        ? 'bg-purple-950/60 border-purple-500/80 text-purple-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold">{hymn.title}</p>
                      <span className="text-[10px] text-slate-400">{hymn.category}</span>
                    </div>
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Hymn Lyrics Display */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <h3 className="text-sm font-bold text-purple-300 font-serif mb-1">
                {selectedHymn.title}
              </h3>
              <p className="text-[10px] text-slate-400 mb-3">{selectedHymn.category}</p>

              {selectedHymn.chorus && (
                <div className="p-3 mb-3 rounded-lg bg-purple-950/40 border border-purple-600/30 text-purple-200 font-serif italic">
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-purple-400">
                    Coro:
                  </span>
                  {selectedHymn.chorus}
                </div>
              )}

              <div className="space-y-3 font-serif text-slate-200 leading-relaxed">
                {selectedHymn.stanzas.map((stanza, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-slate-950/50 border border-slate-800/80">
                    <span className="text-[10px] text-amber-400 font-bold block mb-0.5">
                      Estrofa {idx + 1}:
                    </span>
                    <p>{stanza}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
