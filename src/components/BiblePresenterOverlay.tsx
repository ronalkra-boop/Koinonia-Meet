import React from 'react';
import { ActiveVerse } from '../types/meeting';
import { BookOpen, X, Share2 } from 'lucide-react';

interface BiblePresenterOverlayProps {
  verse: ActiveVerse;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const BiblePresenterOverlay: React.FC<BiblePresenterOverlayProps> = ({
  verse,
  onClose,
  canDismiss = true,
}) => {
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl z-30 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950/95 via-indigo-950/90 to-slate-950/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl p-5 md:p-6 text-slate-100">
        {/* Subtle decorative cross or warm light glow */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm tracking-wide uppercase">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <BookOpen className="w-4 h-4 text-amber-400" />
            </span>
            <span>Sagradas Escrituras • Reina-Valera 1960</span>
          </div>

          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Cerrar proyección bíblica"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Verse text */}
        <div className="mt-3">
          <blockquote className="font-serif text-base md:text-xl lg:text-2xl text-slate-100 leading-relaxed italic border-l-2 border-amber-400/60 pl-4 py-1">
            "{verse.text}"
          </blockquote>
        </div>

        {/* Reference & Presenter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300 text-sm md:text-base font-serif">
              {verse.reference}
            </span>
          </div>

          <div className="text-slate-400 flex items-center gap-1.5">
            <span>Proyectado por:</span>
            <span className="text-slate-200 font-medium">{verse.presenterName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
