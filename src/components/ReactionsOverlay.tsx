import React from 'react';
import { FloatingReaction } from '../types/meeting';

interface ReactionsOverlayProps {
  reactions: FloatingReaction[];
}

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({ reactions }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {reactions.map((r) => (
        <div
          key={r.id}
          style={{ left: `${r.x}%` }}
          className="absolute bottom-24 flex flex-col items-center animate-reaction-float transition-all select-none"
        >
          <div className="text-3xl md:text-5xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] transform hover:scale-125 transition-transform">
            {r.emoji}
          </div>
          <span className="mt-1 px-2 py-0.5 rounded-full bg-slate-950/80 text-[10px] text-slate-200 border border-slate-700/60 backdrop-blur-sm whitespace-nowrap shadow-lg">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};
