import React, { useState, useEffect } from 'react';
import { UserRole, Participant } from '../types/meeting';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoTile } from './VideoTile';
import { ControlsBar } from './ControlsBar';
import { SidebarChurchTools } from './SidebarChurchTools';
import { BiblePresenterOverlay } from './BiblePresenterOverlay';
import { ReactionsOverlay } from './ReactionsOverlay';
import { MeetingInfoModal } from './MeetingInfoModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';
import {
  Church,
  LayoutGrid,
  Share2,
  Pin,
  PinOff,
} from 'lucide-react';

interface VideoConferenceProps {
  roomId: string;
  roomName: string;
  displayName: string;
  role: UserRole;
  initialMic: boolean;
  initialCamera: boolean;
  onLeave: () => void;
}

export const VideoConference: React.FC<VideoConferenceProps> = ({
  roomId,
  roomName,
  displayName,
  role,
  initialMic,
  initialCamera,
  onLeave,
}) => {
  // Device selections
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  // UI state
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    'chat' | 'participants' | 'bible' | 'prayers' | 'hymns' | null
  >(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [callDuration, setCallDuration] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Initialize WebRTC
  const {
    localPeerId,
    localStream,
    screenStream,
    remoteParticipants,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    hasScreenAudio,
    isHandRaised,
    connectionStatus,
    localAudioLevel,
    chatMessages,
    activeVerse,
    prayers,
    reactions,
    mediaError,
    isRecording,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    sendChatMessage,
    sendReaction,
    presentVerse,
    clearVerse,
    addPrayerRequest,
    amenPrayer,
    muteParticipant,
    startRecording,
    stopRecording,
    addTestParticipant,
    removeTestParticipant,
    hasTestParticipant,
  } = useWebRTC({
    roomId,
    roomName,
    displayName,
    role,
    initialMic,
    initialCamera,
    selectedAudioDeviceId: selectedAudioId,
    selectedVideoDeviceId: selectedVideoId,
    onKicked: onLeave,
  });

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format call duration HH:MM:SS
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Track unread chat messages when sidebar is not on 'chat'
  useEffect(() => {
    if (chatMessages.length > 0 && activeSidebarTab !== 'chat') {
      setUnreadChatCount((prev) => prev + 1);
    }
  }, [chatMessages, activeSidebarTab]);

  const handleToggleSidebarTab = (tab: 'chat' | 'participants' | 'bible' | 'prayers' | 'hymns') => {
    if (activeSidebarTab === tab) {
      setActiveSidebarTab(null);
    } else {
      setActiveSidebarTab(tab);
      if (tab === 'chat') setUnreadChatCount(0);
    }
  };

  // Combine local participant and remote participants
  const localParticipant: Participant = {
    id: localPeerId,
    displayName,
    role,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    isHandRaised,
    stream: screenStream || localStream,
    audioLevel: localAudioLevel,
  };

  const allParticipants: Participant[] = [localParticipant, ...remoteParticipants];

  // Identify host or pastor to allow 1-tap pinning
  const hostParticipant =
    allParticipants.find((p) => p.role === 'pastor') ||
    allParticipants.find((p) => p.role === 'leader') ||
    (allParticipants.length > 1 ? allParticipants[1] : allParticipants[0]);

  // Google Meet-style dynamic rebalancing grid containers
  const getGridContainerClass = (total: number) => {
    if (total <= 1) {
      return 'w-full h-full flex items-center justify-center p-1 sm:p-2';
    }
    if (total === 2) {
      // Google Meet 2-user layout: 50/50 vertical split on phones, horizontal split on desktop
      return 'w-full h-full grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1 gap-2 p-1 sm:p-2';
    }
    if (total === 3) {
      // Google Meet 3-user layout: 1 top tile + 2 bottom tiles on phone; 3 columns on desktop
      return 'w-full h-full grid grid-cols-2 grid-rows-2 md:grid-cols-3 md:grid-rows-1 gap-2 p-1 sm:p-2';
    }
    if (total === 4) {
      // Google Meet 4-user layout: 2x2 grid filling 100% of screen without vertical scroll
      return 'w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-1 sm:p-2';
    }
    if (total <= 6) {
      return 'w-full h-full grid grid-cols-2 grid-rows-3 sm:grid-cols-3 sm:grid-rows-2 gap-2 p-1 sm:p-2';
    }
    return 'w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-fr gap-2 p-1 sm:p-2 overflow-y-auto';
  };

  const getParticipantGridClass = (index: number, total: number) => {
    if (total <= 1) return 'w-full h-full max-w-4xl max-h-[82vh] min-h-0';
    if (total === 2) return 'w-full h-full min-h-0';
    if (total === 3) {
      // First tile spans both columns on mobile (top half), bottom 2 tiles share the bottom half
      if (index === 0) return 'col-span-2 md:col-span-1 row-span-1 w-full h-full min-h-0';
      return 'col-span-1 md:col-span-1 row-span-1 w-full h-full min-h-0';
    }
    if (total === 4) return 'col-span-1 row-span-1 w-full h-full min-h-0';
    return 'w-full h-full min-h-0';
  };

  // Pinned participant or active screen sharer
  const activePinned = pinnedParticipantId
    ? allParticipants.find((p) => p.id === pinnedParticipantId)
    : allParticipants.find((p) => p.isScreenSharing) || null;

  // Auto switch to speaker / spotlight view when someone starts sharing screen
  useEffect(() => {
    const screenSharer = allParticipants.find((p) => p.isScreenSharing);
    if (screenSharer) {
      setLayoutMode('speaker');
    }
  }, [isScreenSharing, remoteParticipants]);

  // Can current user moderate (mute others)?
  const canModerate = role === 'pastor' || role === 'leader';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="h-14 px-3 sm:px-4 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-20">
        {/* Left: Church logo & Room Name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Church className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs md:max-w-md font-serif">
                {roomName}
              </h2>
              {canModerate && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-semibold flex items-center gap-1 shadow-sm shrink-0">
                  👑 Anfitrión
                </span>
              )}
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">
                {roomId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px]">En Vivo</span>
              </span>
              <span>•</span>
              <span className="font-mono text-[10px]">{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick actions (Single Invitar button, Pin Host, Test brother, Layout toggle) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Single unified Invite button (Replaces duplicates in top and bottom) */}
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-semibold text-amber-300 transition-colors shadow-sm"
            title="Invitar hermanos a la reunión (enlace y WhatsApp)"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Invitar</span>
          </button>

          {/* Quick 1-tap Pin Host / Pastor button */}
          {hostParticipant && allParticipants.length > 1 && (
            <button
              onClick={() => {
                if (pinnedParticipantId === hostParticipant.id && layoutMode === 'speaker') {
                  setPinnedParticipantId(null);
                  setLayoutMode('grid');
                } else {
                  setPinnedParticipantId(hostParticipant.id);
                  setLayoutMode('speaker');
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                pinnedParticipantId === hostParticipant.id && layoutMode === 'speaker'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-md shadow-amber-500/25'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-amber-300'
              }`}
              title={
                pinnedParticipantId === hostParticipant.id && layoutMode === 'speaker'
                  ? 'Desanclar orador y volver a vista de cuadrícula'
                  : `Anclar pantalla de ${hostParticipant.displayName}`
              }
            >
              {pinnedParticipantId === hostParticipant.id && layoutMode === 'speaker' ? (
                <>
                  <PinOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Desanclar</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Anclar Pastor</span>
                </>
              )}
            </button>
          )}

          {/* Test another participant in-app */}
          <button
            onClick={() => {
              if (hasTestParticipant) {
                removeTestParticipant();
              } else {
                addTestParticipant();
              }
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              hasTestParticipant
                ? 'bg-red-950/70 border-red-700/60 text-red-300 hover:bg-red-900/70'
                : 'bg-indigo-950/70 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/70'
            }`}
            title="Conectar o desconectar un segundo participante de prueba sin salir de la pestaña"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{hasTestParticipant ? 'Quitar Hermano' : 'Simular 2do Hermano'}</span>
          </button>

          {/* Layout Toggle (Grid vs Speaker) */}
          <button
            onClick={() => {
              setLayoutMode((prev) => (prev === 'grid' ? 'speaker' : 'grid'));
              if (layoutMode === 'grid' && !pinnedParticipantId && allParticipants.length > 0) {
                setPinnedParticipantId(allParticipants[0].id);
              }
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
            title={layoutMode === 'grid' ? 'Cambiar a vista de orador' : 'Cambiar a mosaico'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIDEO STAGE */}
        <main className="flex-1 p-2 md:p-4 overflow-y-auto relative flex flex-col justify-center items-center">
          {/* Active Scripture Verse Overlay */}
          {activeVerse && (
            <BiblePresenterOverlay
              verse={activeVerse}
              onClose={clearVerse}
              canDismiss={role === 'pastor' || role === 'leader' || activeVerse.presenterName === displayName}
            />
          )}

          {/* Floating Emoji Reactions Overlay */}
          <ReactionsOverlay reactions={reactions} />

          {/* Media Error Notification */}
          {mediaError && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs shadow-lg backdrop-blur-md">
              {mediaError}
            </div>
          )}

          {/* Screen Share Audio Notification Banner */}
          {isScreenSharing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-amber-500/50 shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs">
              {hasScreenAudio ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-medium">
                    🎵 Transmitiendo audio de YouTube / Video en vivo
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-200">
                    📺 Compartiendo pantalla sin audio.{' '}
                    <span className="text-slate-400 hidden sm:inline">
                      (Para YouTube, elige 'Pestaña de Chrome' y marca 'Compartir audio')
                    </span>
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={toggleScreenShare}
                className="ml-1 px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium text-[10px] transition-colors"
              >
                Detener
              </button>
            </div>
          )}

          {/* === VIDEO TILES LAYOUT (Google Meet Style) === */}
          {layoutMode === 'speaker' && activePinned ? (
            /* SPEAKER / SPOTLIGHT VIEW */
            <div className="w-full h-full flex flex-col gap-2 min-h-0">
              {/* Main Stage: Host / Speaker pinned */}
              <div className="flex-1 w-full relative min-h-0">
                <VideoTile
                  participant={activePinned}
                  isLocal={activePinned.id === localPeerId}
                  isPinned={true}
                  onPinToggle={() => {
                    setPinnedParticipantId(null);
                    setLayoutMode('grid');
                  }}
                  onMuteParticipant={() => muteParticipant(activePinned.id)}
                  canModerate={canModerate}
                />
              </div>

              {/* Thumbnails row (Other participants) */}
              <div className="h-24 sm:h-28 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1 shrink-0 touch-pan-x">
                {allParticipants.map((p) => (
                  <div key={p.id} className="h-full w-36 sm:w-44 flex-shrink-0 min-h-0">
                    <VideoTile
                      participant={p}
                      isLocal={p.id === localPeerId}
                      isPinned={p.id === activePinned.id}
                      onPinToggle={() => {
                        if (pinnedParticipantId === p.id) {
                          setPinnedParticipantId(null);
                          setLayoutMode('grid');
                        } else {
                          setPinnedParticipantId(p.id);
                          setLayoutMode('speaker');
                        }
                      }}
                      onMuteParticipant={() => muteParticipant(p.id)}
                      canModerate={canModerate}
                      disableAudio={p.id === activePinned.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* GRID / MOSAIC VIEW (Google Meet Dynamic Auto-Rebalancing) */
            <div className={getGridContainerClass(allParticipants.length)}>
              {allParticipants.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-center ${getParticipantGridClass(
                    idx,
                    allParticipants.length
                  )}`}
                >
                  <VideoTile
                    participant={p}
                    isLocal={p.id === localPeerId}
                    isPinned={false}
                    onPinToggle={() => {
                      setPinnedParticipantId(p.id);
                      setLayoutMode('speaker');
                    }}
                    onMuteParticipant={() => muteParticipant(p.id)}
                    canModerate={canModerate}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* SIDEBAR CHURCH TOOLS DRAWER */}
        {activeSidebarTab && (
          <SidebarChurchTools
            activeTab={activeSidebarTab}
            onClose={() => setActiveSidebarTab(null)}
            onTabChange={(tab) => setActiveSidebarTab(tab)}
            chatMessages={chatMessages}
            onSendMessage={sendChatMessage}
            currentUserId={localPeerId}
            currentUserRole={role}
            participants={allParticipants}
            onMuteParticipant={muteParticipant}
            canModerate={canModerate}
            onPresentVerse={presentVerse}
            onClearVerse={clearVerse}
            activeVerse={activeVerse}
            prayers={prayers}
            onAddPrayer={addPrayerRequest}
            onAmenPrayer={amenPrayer}
          />
        )}
      </div>

      {/* ================= BOTTOM CONTROLS BAR ================= */}
      <ControlsBar
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        isRecording={isRecording}
        unreadChatCount={unreadChatCount}
        participantCount={allParticipants.length}
        activeSidebarTab={activeSidebarTab}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleHandRaise={toggleHandRaise}
        onSendReaction={sendReaction}
        onToggleSidebarTab={handleToggleSidebarTab}
        onOpenInfo={() => setIsInfoModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onToggleRecording={() => {
          if (isRecording) stopRecording();
          else startRecording();
        }}
        onLeaveCall={onLeave}
      />

      {/* MODALS */}
      {isInfoModalOpen && (
        <MeetingInfoModal
          roomId={roomId}
          roomName={roomName}
          onClose={() => setIsInfoModalOpen(false)}
          onAddTestParticipant={addTestParticipant}
          onRemoveTestParticipant={removeTestParticipant}
          hasTestParticipant={hasTestParticipant}
        />
      )}

      {isSettingsModalOpen && (
        <DeviceSettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          selectedAudioDeviceId={selectedAudioId}
          selectedVideoDeviceId={selectedVideoId}
          onDeviceChange={(aId, vId) => {
            setSelectedAudioId(aId);
            setSelectedVideoId(vId);
          }}
        />
      )}
    </div>
  );
};
