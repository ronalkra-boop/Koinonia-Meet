import React, { useEffect, useRef, useState } from 'react';
import { Participant, UserRole } from '../types/meeting';
import { ROLE_LABELS } from '../data/churchData';
import { MicOff, Pin, PinOff, Hand, Volume2, ShieldAlert } from 'lucide-react';

interface VideoTileProps {
  participant: Participant;
  isLocal?: boolean;
  isPinned?: boolean;
  onPinToggle?: () => void;
  onMuteParticipant?: () => void;
  canModerate?: boolean;
  disableAudio?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal = false,
  isPinned = false,
  onPinToggle,
  onMuteParticipant,
  canModerate = false,
  disableAudio = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach stream to video element (MUTED video is 100% allowed to autoplay by all browsers)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      if (participant.stream && videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      if (participant.stream) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [participant.stream, participant.isCameraOn, participant.isScreenSharing]);

  // Attach stream to separate audio element for remote participants
  useEffect(() => {
    if (!isLocal && audioRef.current && participant.stream) {
      if (audioRef.current.srcObject !== participant.stream) {
        audioRef.current.srcObject = participant.stream;
      }
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback waiting for gesture:', err);
      });
    }
  }, [isLocal, participant.stream]);

  // Audio & video autoplay unlocker on user interaction (touch or click)
  useEffect(() => {
    const unlock = () => {
      if (videoRef.current) {
        videoRef.current.muted = true;
        if (videoRef.current.paused && participant.stream) {
          videoRef.current.play().catch(() => {});
        }
      }
      if (!isLocal && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [isLocal, participant.stream]);

  const [hasFrames, setHasFrames] = useState<boolean>(false);

  useEffect(() => {
    if (!participant.isCameraOn && !participant.isScreenSharing) {
      setHasFrames(false);
    }
  }, [participant.isCameraOn, participant.isScreenSharing, participant.stream]);

  const checkVideoFrames = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      setHasFrames(true);
    }
  };

  const roleInfo = ROLE_LABELS[participant.role] || ROLE_LABELS.member;
  const isSpeaking = (participant.audioLevel || 0) > 15 && participant.isMicOn;
  const hasLiveVideoTrack = !!participant.stream?.getVideoTracks().some((t) => t.readyState === 'live');
  const shouldShowVideo =
    (participant.isCameraOn || participant.isScreenSharing) &&
    (isLocal ? hasLiveVideoTrack : (hasLiveVideoTrack && hasFrames));

  // Generate initials for avatar
  const initials =
    participant.displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'H';

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-slate-900 border transition-all duration-300 flex items-center justify-center select-none ${
        isSpeaking
          ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/50'
          : isPinned
          ? 'border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : 'border-slate-800/80 hover:border-slate-700'
      } ${isPinned ? 'w-full h-full' : 'w-full h-full min-h-[220px]'}`}
    >
      {/* Dedicated audio element for remote participants so audio is decoupled from video rendering */}
      {!isLocal && !disableAudio && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          onCanPlay={(e) => {
            (e.target as HTMLAudioElement).play().catch(() => {});
          }}
        />
      )}

      {/* Video element is ALWAYS muted: browsers never block muted video playback */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        onLoadedMetadata={checkVideoFrames}
        onLoadedData={checkVideoFrames}
        onCanPlay={(e) => {
          const v = e.target as HTMLVideoElement;
          v.defaultMuted = true;
          v.muted = true;
          v.play().catch(() => {});
          checkVideoFrames();
        }}
        onPlaying={checkVideoFrames}
        onTimeUpdate={checkVideoFrames}
        className={`w-full h-full object-cover rounded-2xl transition-opacity duration-200 ${
          isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''
        } ${shouldShowVideo ? 'opacity-100 block' : 'opacity-0 absolute pointer-events-none'}`}
      />

      {/* Peaceful, spiritual church avatar when camera is off or frames not yet arriving */}
      {!shouldShowVideo && (
        <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300 relative z-10">
          <div className="relative">
            <div
              className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl md:text-4xl font-bold font-serif shadow-inner border-2 transition-transform duration-300 ${
                isSpeaking
                  ? 'scale-105 border-emerald-400 bg-emerald-950/60 text-emerald-200'
                  : 'border-amber-500/40 bg-gradient-to-br from-slate-800 to-indigo-950/60 text-amber-200'
              }`}
            >
              {initials}
            </div>

            {/* Speaking audio ripples */}
            {isSpeaking && (
              <span className="absolute inset-0 rounded-full animate-ping border-2 border-emerald-400 opacity-40 pointer-events-none" />
            )}
          </div>
          <p className="mt-3 text-sm md:text-base font-medium text-slate-200 max-w-[180px] truncate">
            {participant.displayName} {isLocal && '(Tú)'}
          </p>
          {participant.isCameraOn && !isLocal && !hasFrames && (
            <span className="mt-1 text-[11px] text-amber-300/80 animate-pulse flex items-center gap-1 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
              Conectando señal de video...
            </span>
          )}
          <span className={`mt-1 text-xs px-2.5 py-0.5 rounded-full border ${roleInfo.bg} ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        </div>
      )}

      {/* Floating Status Badges - Top Row */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Hand Raised badge */}
        {participant.isHandRaised && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-semibold text-xs shadow-lg animate-bounce pointer-events-auto">
            <Hand className="w-3.5 h-3.5 fill-current" />
            <span>Mano levantada</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Speaking Audio Indicator */}
          {isSpeaking && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/90 text-emerald-300 text-xs border border-emerald-500/40 backdrop-blur-md">
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[11px] font-medium hidden sm:inline">Hablando</span>
            </div>
          )}

          {/* Screen Sharing badge */}
          {participant.isScreenSharing && (
            <div className="px-2.5 py-0.5 rounded-full bg-blue-600/90 text-white text-[11px] font-semibold border border-blue-400/30 backdrop-blur-md">
              Pantalla compartida
            </div>
          )}
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 max-w-[70%] bg-slate-950/75 backdrop-blur-md border border-slate-700/60 rounded-xl px-2.5 py-1 text-white text-xs">
          <span className="font-medium truncate">
            {participant.displayName} {isLocal && '(Tú)'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded border ${roleInfo.bg} ${roleInfo.color} hidden sm:inline`}>
            {roleInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Mute indicator */}
          {!participant.isMicOn ? (
            <div
              className="w-7 h-7 rounded-lg bg-red-600/90 text-white flex items-center justify-center shadow-md border border-red-400/30"
              title="Micrófono silenciado"
            >
              <MicOff className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-900/80 text-emerald-400 flex items-center justify-center border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Hover action overlay (Pin, Spotlight, Moderator mute) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
        {onPinToggle && (
          <button
            onClick={onPinToggle}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              isPinned
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80'
            }`}
            title={isPinned ? 'Desfijar orador' : 'Fijar en pantalla principal'}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        )}

        {/* Pastor / Leader can mute participant */}
        {canModerate && !isLocal && participant.isMicOn && onMuteParticipant && (
          <button
            onClick={onMuteParticipant}
            className="p-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-600/60 backdrop-blur-md transition-all"
            title="Silenciar micrófono de este participante"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
