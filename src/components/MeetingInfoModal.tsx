import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { getPublicMeetingUrl, isPrivateAiStudioPreview } from '../utils/urlHelper';

interface MeetingInfoModalProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onAddTestParticipant?: () => void;
  onRemoveTestParticipant?: () => void;
  hasTestParticipant?: boolean;
}

export const MeetingInfoModal: React.FC<MeetingInfoModalProps> = ({
  roomId,
  roomName,
  onClose,
  onAddTestParticipant,
  onRemoveTestParticipant,
  hasTestParticipant,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Build clean public URL
  const currentUrl = getPublicMeetingUrl(roomId);
  const isPrivatePreview = isPrivateAiStudioPreview();

  const inviteMessage = `¡Paz del Señor hermanos! 🙏 Les invito a unirse a nuestra reunión de la iglesia: "${roomName}".\n\nPueden ingresar directo desde su celular o computadora (sin cuenta ni registro) haciendo clic aquí:\n${currentUrl}\n\n¡Dios les bendiga, les esperamos!`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyFullInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-serif">Invitar Hermanos a la Reunión</h3>
            <p className="text-xs text-slate-400">Comparte el enlace para unirse desde celular o PC</p>
          </div>
        </div>

        {/* Room Info */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 mb-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Nombre de la sala:</span>
            <span className="font-semibold text-slate-200">{roomName}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Código de acceso:</span>
            <span className="font-mono font-bold text-amber-300">{roomId}</span>
          </div>
        </div>

        {/* Multi-Device Connection Guidance */}
        <div className="mb-3.5 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-200 leading-relaxed">
          <span className="font-semibold text-white block mb-1">💡 Ingreso directo sin cuenta de Google:</span>
          <span>
            Los hermanos solo deben abrir este enlace en Chrome o Safari, escribir su nombre y entrar. No se solicita correo ni contraseña.
          </span>
        </div>

        {isPrivatePreview && (
          <div className="mb-3.5 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Estás en una URL de vista previa (<code className="text-amber-300">ais-dev</code> / <code className="text-amber-300">ais-pre</code>):</strong> Google AI Studio muestra una pantalla en inglés y pide cuenta de Google a personas externas. Pulsa <strong>Deploy app</strong> en AI Studio (acceso público en Cloud Run) y comparte esa URL final.
            </span>
          </div>
        )}

        {/* Shareable Link Box */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-300 block mb-1.5">
            Enlace directo de la videollamada:
          </label>
          <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="flex-1 bg-transparent text-xs text-slate-300 font-mono px-1 focus:outline-none truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Direct Action Buttons */}
        <div className="space-y-2 mb-4">
          {/* WhatsApp share */}
          <button
            onClick={handleShareWhatsApp}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Compartir por WhatsApp con los Hermanos</span>
          </button>

          {/* Copy Full Invitation */}
          <button
            onClick={handleCopyFullInvite}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            {copiedMessage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedMessage ? '¡Invitación completa copiada!' : 'Copiar texto con invitación pastoral'}</span>
          </button>
        </div>

        {/* Test participant in-app */}
        {onAddTestParticipant && (
          <div className="pt-3 border-t border-slate-800/80">
            <button
              onClick={() => {
                if (hasTestParticipant) {
                  onRemoveTestParticipant?.();
                } else {
                  onAddTestParticipant?.();
                }
              }}
              className={`w-full py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                hasTestParticipant
                  ? 'bg-red-950/60 hover:bg-red-900/60 text-red-300 border-red-800/60'
                  : 'bg-indigo-900/40 hover:bg-indigo-850/60 text-indigo-300 border-indigo-700/60 shadow-sm'
              }`}
            >
              {hasTestParticipant ? (
                <span>Desconectar Hermano Pedro (Prueba)</span>
              ) : (
                <span>👥 Probar ahora: Conectar Hermano Pedro (Prueba en vivo)</span>
              )}
            </button>
            <p className="mt-2 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Prueba la cuadrícula, audio y herramientas sin salir de la pestaña</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
