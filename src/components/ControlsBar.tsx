import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Hand,
  Smile,
  MessageSquare,
  Users,
  BookOpen,
  PhoneOff,
  Settings,
  Disc,
  Square,
} from 'lucide-react';

interface ControlsBarProps {
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isRecording: boolean;
  unreadChatCount: number;
  participantCount: number;
  activeSidebarTab: 'chat' | 'participants' | 'bible' | 'prayers' | 'hymns' | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onSendReaction: (emoji: string) => void;
  onToggleSidebarTab: (tab: 'chat' | 'participants' | 'bible' | 'prayers' | 'hymns') => void;
  onOpenInfo?: () => void;
  onOpenSettings: () => void;
  onToggleRecording: () => void;
  onLeaveCall: () => void;
}

const CHURCH_REACTIONS = [
  { emoji: '🙏', label: 'Amén / Oración' },
  { emoji: '✨', label: 'Gloria a Dios' },
  { emoji: '❤️', label: 'Amor fraternal' },
  { emoji: '👏', label: 'Aplauso al Señor' },
  { emoji: '🙌', label: 'Alabanza' },
  { emoji: '🔥', label: 'Fuego del Espíritu' },
];

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isHandRaised,
  isRecording,
  unreadChatCount,
  participantCount,
  activeSidebarTab,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onSendReaction,
  onToggleSidebarTab,
  onOpenSettings,
  onToggleRecording,
  onLeaveCall,
}) => {
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);

  return (
    <footer className="relative z-30 w-full bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 shadow-2xl">
      {/* Horizontally scrollable bar on mobile with smooth swipe */}
      <div className="w-full overflow-x-auto no-scrollbar scroll-smooth touch-pan-x flex items-center justify-between gap-3 px-3 py-2.5 md:py-3.5 max-w-7xl mx-auto">
        {/* Left: Recording button (Recording of service/sermon) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleRecording}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border text-xs md:text-sm font-medium transition-colors shrink-0 ${
              isRecording
                ? 'bg-red-950/80 border-red-500 text-red-200'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 text-slate-300'
            }`}
            title={isRecording ? 'Detener grabación local' : 'Grabar prédica/reunión'}
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-red-500 text-red-500 animate-pulse" />
                <span className="inline text-xs">Grabando</span>
              </>
            ) : (
              <>
                <Disc className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Grabar</span>
              </>
            )}
          </button>
        </div>

        {/* Center: Core Audio, Video, Screen, Hand, Reactions, Leave Call */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 shrink-0">
        {/* Microphone */}
        <button
          onClick={onToggleMic}
          className={`relative p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            isMicOn
              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
          }`}
          title={isMicOn ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          className={`relative p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            isCameraOn
              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
          }`}
          title={isCameraOn ? 'Apagar cámara' : 'Encender cámara'}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 md:p-3.5 rounded-full transition-all duration-200 border ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-600/30'
              : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700/80'
          }`}
          title={
            isScreenSharing
              ? 'Dejar de compartir pantalla'
              : 'Compartir pantalla (YouTube, video o diapositivas con audio)'
          }
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
        </button>

        {/* Hand Raise */}
        <button
          onClick={onToggleHandRaise}
          className={`p-3 md:p-3.5 rounded-full transition-all duration-200 border ${
            isHandRaised
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-lg shadow-amber-500/30'
              : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700/80'
          }`}
          title={isHandRaised ? 'Bajar la mano' : 'Levantar la mano (Pedir la palabra)'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Reactions Picker */}
        <div className="relative">
          <button
            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
            className={`p-3 md:p-3.5 rounded-full transition-all duration-200 border ${
              showReactionsMenu
                ? 'bg-slate-700 text-amber-300 border-amber-400/50'
                : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700/80'
            }`}
            title="Enviar reacción (Amén, Gloria a Dios)"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Reactions Popover */}
          {showReactionsMenu && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95">
              {CHURCH_REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => {
                    onSendReaction(r.emoji);
                    setShowReactionsMenu(false);
                  }}
                  className="group relative p-2.5 hover:bg-slate-800 rounded-xl transition-transform hover:scale-125 text-2xl"
                  title={r.label}
                >
                  <span>{r.emoji}</span>
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-950 px-2 py-0.5 rounded text-[10px] text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md border border-slate-700">
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leave Call Button */}
        <button
          onClick={onLeaveCall}
          className="px-4 py-3 md:px-5 md:py-3.5 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold transition-all shadow-lg shadow-red-700/40 flex items-center gap-2"
          title="Salir de la reunión"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Salir</span>
        </button>
      </div>

      {/* Right: Church Tools, Chat, Participants, Settings */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Church Ministry Tools (Biblia, Peticiones, Himnos) */}
        <button
          onClick={() => onToggleSidebarTab('bible')}
          className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border text-xs md:text-sm font-medium transition-colors shrink-0 ${
            activeSidebarTab === 'bible' || activeSidebarTab === 'prayers' || activeSidebarTab === 'hymns'
              ? 'bg-amber-500/20 border-amber-500/80 text-amber-300'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 text-slate-200'
          }`}
          title="Herramientas Eclesiales (Biblia, Himnos, Peticiones)"
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span className="hidden lg:inline">Ministerio</span>
        </button>

        {/* Chat */}
        <button
          onClick={() => onToggleSidebarTab('chat')}
          className={`relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border text-xs md:text-sm transition-colors shrink-0 ${
            activeSidebarTab === 'chat'
              ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 text-slate-200'
          }`}
          title="Abrir chat en vivo"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Participants */}
        <button
          onClick={() => onToggleSidebarTab('participants')}
          className={`relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border text-xs md:text-sm transition-colors shrink-0 ${
            activeSidebarTab === 'participants'
              ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 text-slate-200'
          }`}
          title="Ver lista de hermanos conectados"
        >
          <Users className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-slate-700 text-slate-200 font-bold text-[10px] flex items-center justify-center border border-slate-600">
            {participantCount}
          </span>
        </button>

        {/* Device Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors shrink-0"
          title="Configuración de audio y cámara"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
      </div>
    </footer>
  );
};
