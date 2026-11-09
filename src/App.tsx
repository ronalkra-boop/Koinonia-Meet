/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserRole } from './types/meeting';
import { Lobby } from './components/Lobby';
import { VideoConference } from './components/VideoConference';
import { Church, HeartHandshake, RotateCcw, Home } from 'lucide-react';

interface ActiveMeetingConfig {
  roomId: string;
  roomName: string;
  displayName: string;
  role: UserRole;
  initialMic: boolean;
  initialCamera: boolean;
}

export default function App() {
  const [meetingConfig, setMeetingConfig] = useState<ActiveMeetingConfig | null>(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [urlRoomId, setUrlRoomId] = useState<string>('');
  const [isAdminUrl, setIsAdminUrl] = useState<boolean>(false);

  useEffect(() => {
    // Check if a room was provided in URL params (?room=xxx)
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const admin = params.get('admin');
    if (room) {
      setUrlRoomId(room);
    }
    if (admin === 'true' || admin === '1') {
      setIsAdminUrl(true);
    }
  }, []);

  const handleJoin = (config: ActiveMeetingConfig) => {
    // Update browser URL query param cleanly without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('room', config.roomId);
    window.history.pushState({}, '', url.toString());

    setMeetingConfig(config);
    setHasLeft(false);
  };

  const handleLeave = () => {
    setMeetingConfig(null);
    setHasLeft(true);
  };

  const handleRejoin = () => {
    setHasLeft(false);
  };

  // Farewell / Post-meeting screen
  if (hasLeft) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/80 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <HeartHandshake className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold font-serif text-white mb-2">
            Has salido de la reunión
          </h2>
          <p className="text-sm text-slate-300 font-serif italic mb-6 leading-relaxed">
            "La gracia del Señor Jesucristo, el amor de Dios, y la comunión del Espíritu Santo sean con todos vosotros. Amén."
            <span className="block text-xs text-amber-400 font-sans not-italic mt-1">2 Corintios 13:14</span>
          </p>

          <div className="space-y-3">
            <button
              onClick={handleRejoin}
              className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Volver a conectarse</span>
            </button>

            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('room');
                window.history.pushState({}, '', url.toString());
                setUrlRoomId('');
                setHasLeft(false);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Ir a la sala principal / Otra reunión</span>
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500 flex items-center gap-2">
          <Church className="w-4 h-4 text-amber-400/60" />
          <span>Koinonía Meet • Iglesia Conectada en Comunión</span>
        </p>
      </div>
    );
  }

  // Active call view
  if (meetingConfig) {
    return (
      <VideoConference
        roomId={meetingConfig.roomId}
        roomName={meetingConfig.roomName}
        displayName={meetingConfig.displayName}
        role={meetingConfig.role}
        initialMic={meetingConfig.initialMic}
        initialCamera={meetingConfig.initialCamera}
        onLeave={handleLeave}
      />
    );
  }

  // Pre-call Lobby (Green Room)
  return <Lobby initialRoomId={urlRoomId} initialIsAdmin={isAdminUrl} onJoin={handleJoin} />;
}
