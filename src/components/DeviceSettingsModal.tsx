import React, { useEffect, useState } from 'react';
import { X, Mic, Video, Check, Globe, Shield, Sparkles, ExternalLink, RotateCcw, Crown, Lock, AlertCircle } from 'lucide-react';

interface DeviceSettingsModalProps {
  onClose: () => void;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  onDeviceChange: (audioId: string, videoId: string) => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  onClose,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onDeviceChange,
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'turn' | 'security'>('devices');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioId, setAudioId] = useState(selectedAudioDeviceId || '');
  const [videoId, setVideoId] = useState(selectedVideoDeviceId || '');

  // Pastor PIN settings
  const [pastorPin, setPastorPin] = useState(() => {
    return localStorage.getItem('koinonia_pastor_pin') || '7777';
  });
  const [pinSaved, setPinSaved] = useState(false);

  // Metered API settings
  const [meteredAppName, setMeteredAppName] = useState('');
  const [meteredApiKey, setMeteredApiKey] = useState('');
  const [meteredLoading, setMeteredLoading] = useState(false);
  const [meteredStatus, setMeteredStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [meteredMessage, setMeteredMessage] = useState<string | null>(null);
  const [meteredConnected, setMeteredConnected] = useState(false);
  const [isInvalidFormat, setIsInvalidFormat] = useState(false);

  // Custom TURN 4G settings
  const [turnUrls, setTurnUrls] = useState('');
  const [turnUsername, setTurnUsername] = useState('');
  const [turnCredential, setTurnCredential] = useState('');
  const [turnSaved, setTurnSaved] = useState(false);

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === 'audioinput');
        const videos = devices.filter((d) => d.kind === 'videoinput');
        setAudioDevices(audios);
        setVideoDevices(videos);

        if (!audioId && audios.length > 0) setAudioId(audios[0].deviceId);
        if (!videoId && videos.length > 0) setVideoId(videos[0].deviceId);
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }
    }
    getDevices();

    // Load saved TURN config from server or localStorage
    (async () => {
      try {
        const saved = localStorage.getItem('koinonia_turn_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          setTurnUrls(Array.isArray(parsed.urls) ? parsed.urls.join(',') : parsed.urls || '');
          setTurnUsername(parsed.username || '');
          setTurnCredential(parsed.credential || '');
        } else {
          // Check if server already has a church TURN configuration
          const res = await fetch('/api/ice-servers');
          if (res.ok) {
            const data = await res.json();
            const custom = (data.iceServers || []).find((s: any) => s.username && s.username !== 'openrelayproject');
            if (custom) {
              setTurnUrls(Array.isArray(custom.urls) ? custom.urls.join(',') : custom.urls || '');
              setTurnUsername(custom.username || '');
              setTurnCredential(custom.credential || '');
            }
          }
        }
      } catch (e) {}
    })();

    // Check Metered status from server
    fetch('/api/metered-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.appName) setMeteredAppName(data.appName);
        setMeteredConnected(data.iceServersCount > 0 && !data.lastFailure);
        setIsInvalidFormat(data.isInvalidFormat);
        if (data.isInvalidFormat) {
          setMeteredMessage('La API Key actual configurada parece ser un nombre en lugar de la clave secreta de Metered.');
          setMeteredStatus('error');
        }
      })
      .catch(() => {});
  }, [audioId, videoId]);

  const handleSaveMetered = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!meteredAppName.trim() || !meteredApiKey.trim()) {
      setMeteredStatus('error');
      setMeteredMessage('Ingresa el nombre de la app y la API Key de Metered.');
      return;
    }

    setMeteredLoading(true);
    setMeteredMessage(null);
    try {
      const res = await fetch('/api/metered-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: meteredAppName.trim(),
          apiKey: meteredApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMeteredStatus('success');
        setMeteredMessage(data.message);
        setMeteredConnected(true);
        setIsInvalidFormat(false);
      } else {
        setMeteredStatus('error');
        setMeteredMessage(data.message || 'Error al validar credenciales de Metered');
        setMeteredConnected(false);
      }
    } catch {
      setMeteredStatus('error');
      setMeteredMessage('No se pudo conectar con el servidor.');
    } finally {
      setMeteredLoading(false);
    }
  };

  const handleSaveDevices = () => {
    onDeviceChange(audioId, videoId);
    onClose();
  };

  const handleSaveTurn = async () => {
    if (turnUrls.trim() && turnUsername.trim() && turnCredential.trim()) {
      const config = {
        urls: turnUrls.trim().split(',').map((u) => u.trim()),
        username: turnUsername.trim(),
        credential: turnCredential.trim(),
      };
      // Save locally
      localStorage.setItem('koinonia_turn_config', JSON.stringify(config));
      // Save on server for all church members
      try {
        await fetch('/api/turn-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
      } catch (e) {
        console.warn('Could not sync TURN to server:', e);
      }
      setTurnSaved(true);
      setTimeout(() => setTurnSaved(false), 3000);
    } else {
      localStorage.removeItem('koinonia_turn_config');
      try {
        await fetch('/api/turn-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      } catch (e) {}
      setTurnSaved(true);
      setTimeout(() => setTurnSaved(false), 3000);
    }
  };

  const handleResetTurn = async () => {
    localStorage.removeItem('koinonia_turn_config');
    setTurnUrls('');
    setTurnUsername('');
    setTurnCredential('');
    try {
      await fetch('/api/turn-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    } catch (e) {}
    setTurnSaved(true);
    setTimeout(() => setTurnSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white font-serif mb-1">
          Ajustes de la Reunión
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Configura tus dispositivos y la conectividad para celulares 4G/LTE.
        </p>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'devices'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Cámara y Mic</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('turn')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'turn'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>4G (TURN)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'security'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>PIN de Anfitrión</span>
          </button>
        </div>

        {activeTab === 'devices' && (
          <div className="space-y-4 mb-6">
            {/* Microphone select */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Micrófono:</span>
              </label>
              <select
                value={audioId}
                onChange={(e) => setAudioId(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {audioDevices.length === 0 ? (
                  <option value="">Micrófono predeterminado del sistema</option>
                ) : (
                  audioDevices.map((d, index) => (
                    <option key={d.deviceId || index} value={d.deviceId}>
                      {d.label || `Micrófono ${index + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Camera select */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Video className="w-4 h-4 text-amber-400" />
                <span>Cámara de video:</span>
              </label>
              <select
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {videoDevices.length === 0 ? (
                  <option value="">Cámara predeterminada del sistema</option>
                ) : (
                  videoDevices.map((d, index) => (
                    <option key={d.deviceId || index} value={d.deviceId}>
                      {d.label || `Cámara ${index + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={handleSaveDevices}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar dispositivos</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'turn' && (
          <div className="space-y-4 mb-5 max-h-[60vh] overflow-y-auto pr-1">
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-xs text-indigo-200 leading-relaxed">
              <p className="flex items-center gap-1.5 font-semibold text-white mb-1">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Servidor TURN para Redes Móviles (4G / 5G)</span>
              </p>
              <span>
                En Wi-Fi la llamada conecta directo. Pero en redes celulares (4G/5G) las operadoras usan cortafuegos (CGNAT) que requieren un servidor de retransmisión (TURN) para enlazar el audio y video sin esperas.
              </span>
            </div>

            {/* SECCIÓN METERED API (RECOMENDADO) */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${meteredConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <strong className="text-xs text-white">Opción A: Metered Video (Recomendada)</strong>
                </div>
                <a
                  href="https://dashboard.metered.ca/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>Abrir Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {isInvalidFormat && (
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">
                    <strong>API Key no válida:</strong> La clave actual guardada es el nombre de la app. Para obtener la API Key real: entra a Metered &gt; <strong>TURN Server</strong> &gt; copia la clave de <strong>"API Key"</strong> y pégala aquí abajo.
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveMetered} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Nombre de tu App en Metered:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. koinonia-cdd (sin .metered.live)"
                    value={meteredAppName}
                    onChange={(e) => setMeteredAppName(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    API Key de Metered:
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Pega aquí la API Key copiada de Metered"
                    value={meteredApiKey}
                    onChange={(e) => setMeteredApiKey(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    * En tu panel de Metered: ve a <strong>TURN Server</strong> y copia el valor alfanumérico del campo <strong>API Key</strong>.
                  </p>
                </div>

                {meteredMessage && (
                  <p className={`text-xs font-semibold flex items-center gap-1.5 p-2 rounded-xl border ${
                    meteredStatus === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/40 text-red-300'
                  }`}>
                    {meteredStatus === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{meteredMessage}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={meteredLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  {meteredLoading ? (
                    <span>Verificando con Metered...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{meteredConnected ? 'Actualizar y Probar Metered' : 'Probar y Conectar con Metered'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* SECCIÓN MANUAL (OPCIONAL) */}
            <details className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-300">
              <summary className="font-semibold text-slate-400 cursor-pointer hover:text-white transition-colors">
                Opción B: Servidor TURN Manual (Coturn / Twilio / Cloudflare)
              </summary>
              <div className="pt-3 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    URLs TURN (separadas por coma):
                  </label>
                  <input
                    type="text"
                    placeholder="turn:mi-servidor:3478,turns:mi-servidor:443?transport=tcp"
                    value={turnUrls}
                    onChange={(e) => setTurnUrls(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Usuario TURN:
                    </label>
                    <input
                      type="text"
                      placeholder="Usuario"
                      value={turnUsername}
                      onChange={(e) => setTurnUsername(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Contraseña / Credencial:
                    </label>
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={turnCredential}
                      onChange={(e) => setTurnCredential(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {turnSaved && (
                  <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 justify-center">
                    <Check className="w-3.5 h-3.5" />
                    <span>¡Configuración TURN guardada exitosamente!</span>
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetTurn}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTurn}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-650 text-white font-medium text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Servidor Manual</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4 mb-5">
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-200 leading-relaxed">
              <p className="flex items-center gap-1.5 font-semibold text-white mb-1">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Control de Moderación y Privilegios</span>
              </p>
              <span>
                Este PIN protege la sala para que los hermanos e invitados que abran el enlace no puedan entrar como administradores ni silenciar a otros.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                PIN de Pastor / Anfitrión:
              </label>
              <input
                type="text"
                maxLength={8}
                value={pastorPin}
                onChange={(e) => setPastorPin(e.target.value)}
                placeholder="Ej. 1234"
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-center text-white font-mono tracking-widest focus:outline-none focus:border-amber-500"
              />
            </div>

            {pinSaved && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 justify-center">
                <Check className="w-3.5 h-3.5" />
                <span>¡PIN pastoral guardado exitosamente!</span>
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPastorPin('7777');
                  localStorage.setItem('koinonia_pastor_pin', '7777');
                  setPinSaved(true);
                  setTimeout(() => setPinSaved(false), 2000);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer predeterminado</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = pastorPin.trim() || '7777';
                  setPastorPin(cleaned);
                  localStorage.setItem('koinonia_pastor_pin', cleaned);
                  setPinSaved(true);
                  setTimeout(() => setPinSaved(false), 2500);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Nuevo PIN</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
