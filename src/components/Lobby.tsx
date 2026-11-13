import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types/meeting';
import { PRESET_ROOMS, ROLE_LABELS } from '../data/churchData';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  Users,
  Church,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Copy,
  Check,
  Crown,
  MessageCircle,
  Camera,
  Lock,
  Unlock,
  KeyRound,
  X,
  Settings,
} from 'lucide-react';
import { getPublicMeetingUrl, isPrivateAiStudioPreview } from '../utils/urlHelper';
import { DeviceSettingsModal } from './DeviceSettingsModal';

interface LobbyProps {
  initialRoomId?: string;
  initialIsAdmin?: boolean;
  onJoin: (config: {
    roomId: string;
    roomName: string;
    displayName: string;
    role: UserRole;
    initialMic: boolean;
    initialCamera: boolean;
  }) => void;
}

const DEFAULT_PASTOR_PIN = '7777';

export const Lobby: React.FC<LobbyProps> = ({ initialRoomId, initialIsAdmin = false, onJoin }) => {
  // Solo se considera admin si el dispositivo ya fue verificado o si introdujo el PIN pastoral
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('koinonia_admin_auth') === 'true';
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    const isAuth = localStorage.getItem('koinonia_admin_auth') === 'true';
    return !!(initialIsAdmin && isAuth);
  });
  const [roomId, setRoomId] = useState(initialRoomId || 'culto-general');
  const [roomName, setRoomName] = useState(() => {
    const matched = PRESET_ROOMS.find((r) => r.id === (initialRoomId || 'culto-general'));
    return matched ? matched.name : 'Culto General de la Iglesia';
  });

  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId);
      const matched = PRESET_ROOMS.find((r) => r.id === initialRoomId);
      setRoomName(matched ? matched.name : initialRoomId);
    }
  }, [initialRoomId]);

  const [displayName, setDisplayName] = useState(() => {
    const saved = localStorage.getItem('koinonia_username');
    if (saved) return saved;
    const isAuth = localStorage.getItem('koinonia_admin_auth') === 'true';
    return initialIsAdmin && isAuth ? 'Pastor / Administrador' : '';
  });
  const [role, setRole] = useState<UserRole>(() => {
    const isAuth = localStorage.getItem('koinonia_admin_auth') === 'true';
    return initialIsAdmin && isAuth ? 'pastor' : 'member';
  });

  // Modal de PIN para anfitrión / pastor
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [audioMeter, setAudioMeter] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'requesting'>('prompt');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [copiedLobbyLink, setCopiedLobbyLink] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const lobbyMeetingUrl = getPublicMeetingUrl(roomId);
  const isPrivatePreview = isPrivateAiStudioPreview();

  const handleCopyLobbyLink = () => {
    navigator.clipboard.writeText(lobbyMeetingUrl);
    setCopiedLobbyLink(true);
    setTimeout(() => setCopiedLobbyLink(false), 2000);
  };

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setRole('member');
    } else {
      if (isAdminAuthenticated) {
        setIsAdmin(true);
        setRole('pastor');
        if (!displayName || displayName === 'Hermano(a)') {
          setDisplayName('Pastor / Administrador');
        }
      } else {
        setEnteredPin('');
        setPinError(null);
        setShowAdminPinModal(true);
      }
    }
  };

  const handleLockAdmin = () => {
    localStorage.removeItem('koinonia_admin_auth');
    setIsAdminAuthenticated(false);
    setIsAdmin(false);
    setRole('member');
    if (displayName === 'Pastor / Administrador') {
      setDisplayName('');
    }
  };

  const handleSelectRole = (selectedRole: UserRole) => {
    if (selectedRole === 'pastor' || selectedRole === 'leader') {
      if (isAdminAuthenticated) {
        setRole(selectedRole);
        setIsAdmin(true);
      } else {
        setEnteredPin('');
        setPinError(null);
        setShowAdminPinModal(true);
      }
    } else {
      setRole(selectedRole);
      setIsAdmin(false);
    }
  };

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const storedPin = localStorage.getItem('koinonia_pastor_pin') || DEFAULT_PASTOR_PIN;
    if (enteredPin.trim() === storedPin) {
      localStorage.setItem('koinonia_admin_auth', 'true');
      setIsAdminAuthenticated(true);
      setIsAdmin(true);
      setRole('pastor');
      if (!displayName || displayName === 'Hermano(a)') {
        setDisplayName('Pastor / Administrador');
      }
      setShowAdminPinModal(false);
      setPinError(null);
    } else {
      setPinError('PIN incorrecto. Los hermanos e invitados deben ingresar como Hermano(a).');
    }
  };

  const handleShareWhatsApp = () => {
    const inviteText = `¡Paz del Señor hermanos! 🙏\nLes invito a unirse a la reunión de nuestra iglesia: "${roomName}".\n\nPueden ingresar desde su celular o computadora aquí:\n${lobbyMeetingUrl}\n\n¡Dios les bendiga, les esperamos!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Request media access with user interaction or initial attempt
  const requestDeviceAccess = async (explicitUserClick: boolean = false) => {
    setPermissionState('requesting');
    setPermissionError(null);

    // Clean up existing stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('denied');
      setPermissionError(
        'Tu navegador o dispositivo no permite acceso a la cámara o la página no está cargada con HTTPS.'
      );
      return;
    }

    let media: MediaStream | null = null;

    // Intento 1: Cámara frontal o trasera ideal + Micrófono
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: true,
      });
    } catch (err1: any) {
      console.warn('Fallo intento 1 (facingMode ideal + audio):', err1);
    }

    // Intento 2: Cámara genérica (video: true) + Micrófono
    if (!media) {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err2: any) {
        console.warn('Fallo intento 2 (video: true + audio):', err2);
      }
    }

    // Intento 3: Solo cámara (por si el micrófono está bloqueado o da error en este dispositivo)
    if (!media) {
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: true });
        // Intentar agregar audio en segundo plano si está disponible
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioOnly.getAudioTracks().forEach((track) => media?.addTrack(track));
        } catch (audioErr) {
          console.warn('Solo cámara concedida sin audio:', audioErr);
        }
      } catch (err3: any) {
        console.warn('Fallo intento 3 (solo video):', err3);
      }
    }

    // Intento 4: Solo audio (si la cámara está ocupada por otra app o bloqueada físicamente)
    if (!media) {
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsCameraOn(false);
        setPermissionError('No se pudo abrir la cámara. Has ingresado solo con micrófono.');
      } catch (err4: any) {
        console.warn('Fallo intento 4 (solo audio):', err4);
      }
    }

    if (media) {
      media.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
      if (media.getVideoTracks().length > 0) {
        media.getVideoTracks()[0].enabled = true;
        setIsCameraOn(true);
        setPermissionError(null);
      } else {
        setIsCameraOn(false);
      }

      setStream(media);
      setPermissionState('granted');

      // Audio level meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          audioCtx.resume().catch(() => {});
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const source = audioCtx.createMediaStreamSource(media);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            if (isMicOn) {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setAudioMeter(Math.min(100, Math.round((avg / 128) * 100)));
            } else {
              setAudioMeter(0);
            }
            animFrameRef.current = requestAnimationFrame(loop);
          };
          loop();
        }
      } catch (e) {
        console.warn('AudioContext no soportado:', e);
      }
    } else {
      // Si el usuario hizo clic explícito en el botón de activar y fue denegado:
      if (explicitUserClick) {
        setPermissionState('denied');
        setPermissionError(
          'El acceso a la cámara o micrófono no fue concedido. Por favor autoriza los permisos en tu navegador o celular.'
        );
      } else {
        // En carga automática sin interacción del usuario, mantener en 'prompt' para que el botón esté visible
        setPermissionState('prompt');
      }
    }
  };

  useEffect(() => {
    // Attempt automatic device preview
    requestDeviceAccess(false);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [facingMode]);

  // Synchronize video element with stream whenever stream or camera state updates
  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('Reproducción de video diferida:', err);
      });
    }
  }, [stream, isCameraOn, permissionState]);

  // Handle local video toggle with re-acquisition if track was missing
  const handleToggleCamera = async () => {
    if (!isCameraOn) {
      const existingTrack = stream?.getVideoTracks()[0];
      if (existingTrack && existingTrack.readyState === 'live') {
        existingTrack.enabled = true;
        setIsCameraOn(true);
      } else {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
          }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

          const newTrack = videoStream.getVideoTracks()[0];
          if (newTrack) {
            newTrack.enabled = true;
            if (stream) {
              stream.getVideoTracks().forEach((t) => {
                t.stop();
                stream.removeTrack(t);
              });
              stream.addTrack(newTrack);
              setStream(new MediaStream(stream.getTracks()));
            } else {
              setStream(videoStream);
            }
            setIsCameraOn(true);
            setPermissionError(null);
            setPermissionState('granted');
          }
        } catch (err) {
          console.warn('No se pudo reactivar la cámara:', err);
          setPermissionError('No se pudo activar la cámara. Revisa los permisos de tu dispositivo.');
        }
      }
    } else {
      setIsCameraOn(false);
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    }
  };

  // Handle local mic toggle
  const handleToggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
  };

  // Switch camera between front/back
  const handleFlipCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    if (isCameraOn && stream && navigator.mediaDevices?.getUserMedia) {
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextMode } },
        }).catch(() => navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextMode } },
        }));

        const newTrack = newVideoStream.getVideoTracks()[0];
        if (newTrack) {
          stream.getVideoTracks().forEach((t) => {
            t.stop();
            stream.removeTrack(t);
          });
          stream.addTrack(newTrack);
          setStream(new MediaStream(stream.getTracks()));
        }
      } catch (err) {
        console.warn('Error al cambiar de cámara:', err);
      }
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = displayName.trim() || 'Hermano(a)';
    localStorage.setItem('koinonia_username', finalName);

    // Stop lobby media tracks so meeting hook can acquire clean stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    onJoin({
      roomId,
      roomName,
      displayName: finalName,
      role,
      initialMic: isMicOn,
      initialCamera: isCameraOn,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/80 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Modal de Validación de PIN Pastoral / Administrador */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl text-slate-100 relative">
            <button
              type="button"
              onClick={() => {
                setShowAdminPinModal(false);
                setPinError(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-serif">Acceso de Pastor / Anfitrión</h3>
                <p className="text-xs text-slate-400">Moderación y control de la llamada</p>
              </div>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Ingresa el PIN de Administrador:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    maxLength={10}
                    autoFocus
                    placeholder="PIN pastoral (Ej. 1234)"
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-center text-white font-mono tracking-widest focus:outline-none focus:border-amber-500"
                  />
                </div>
                {pinError && (
                  <p className="mt-2 text-[11px] text-red-400 leading-snug">
                    {pinError}
                  </p>
                )}
                <p className="mt-2 text-[10px] text-slate-500">
                  * Clave confidencial para pastores y moderadores. Los hermanos e invitados deben ingresar con el rol Hermano(a).
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPinModal(false);
                    setPinError(null);
                    setRole('member');
                    setIsAdmin(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Entrar como Hermano
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow-md cursor-pointer"
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ajustes Generales, Dispositivos y Servidores TURN (4G/5G) */}
      {showSettingsModal && (
        <DeviceSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onDeviceChange={() => {}}
        />
      )}

      {/* Diálogo / Modal en Español para Solicitud de Permisos o Ayuda */}
      {permissionState === 'denied' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-3xl p-6 md:p-7 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-serif">
                  Solicitud de Acceso a Cámara y Micrófono
                </h3>
                <p className="text-xs text-amber-300">
                  Permiso necesario para la videollamada de la iglesia
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Para que el pastor y los hermanos puedan verte y escucharte durante el servicio, tu navegador o celular necesita tu autorización para activar la cámara y el micrófono.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 mb-5">
              <p className="font-semibold text-slate-200">
                📱 Cómo conceder permiso en tu dispositivo:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>
                  <strong className="text-slate-300">En celular (Chrome / Safari):</strong> Toca el icono de candado o ajustes junto a la dirección web y activa <em>"Cámara"</em> y <em>"Micrófono"</em>.
                </li>
                <li>
                  <strong className="text-slate-300">En computadora:</strong> Haz clic en el icono de cámara o candado arriba a la izquierda y selecciona <em>"Permitir siempre"</em>.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => requestDeviceAccess(true)}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Autorizar y Reintentar Acceso</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPermissionState('granted');
                  setPermissionError(null);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                Continuar como oyente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Church className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-serif text-white tracking-tight flex items-center gap-2">
              Koinonía Meet <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">En Vivo</span>
            </h1>
            <p className="text-xs text-slate-400">Videollamadas y Conferencias de la Iglesia</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            {isAdminAuthenticated ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Unlock className="w-4 h-4" />
                <span className="font-semibold">Candado Desbloqueado (Pastor)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Lock className="w-4 h-4" />
                <span className="font-semibold">Candado Pastoral Activo</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            title="Ajustes de dispositivos, configuración Metered / TURN 4G y PIN pastoral"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Ajustes / 4G</span>
          </button>
        </div>
      </header>

      {/* Alerta si está abierto dentro del navegador de WhatsApp */}
      {typeof navigator !== 'undefined' && /WhatsApp|FBAN|FBAV/i.test(navigator.userAgent) && (
        <div className="max-w-6xl w-full mx-auto my-3 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-start gap-3 text-xs text-amber-200 shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white block mb-0.5">⚠️ Aviso para celulares (Enlace abierto en WhatsApp):</span>
            El visor interno de WhatsApp suele bloquear el acceso a la cámara. Para activar tu cámara y micrófono, toca los <strong>3 puntitos (⋮)</strong> arriba a la derecha de tu pantalla y selecciona <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en el navegador"</strong>.
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Video Preview & Checks (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-full max-w-lg aspect-video rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl flex items-center justify-center group">
            {isCameraOn && stream && stream.getVideoTracks().some((t) => t.readyState === 'live') ? (
              <video
                ref={(node) => {
                  videoRef.current = node;
                  if (node && stream) {
                    if (node.srcObject !== stream) {
                      node.srcObject = stream;
                    }
                    node.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            ) : (
              <div className="flex flex-col items-center text-center p-6 max-w-sm">
                <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-amber-400 font-serif mb-3 shadow-inner">
                  {displayName.trim() ? displayName.slice(0, 2).toUpperCase() : 'IG'}
                </div>
                <p className="text-slate-200 font-semibold text-sm">
                  {permissionState === 'requesting'
                    ? 'Solicitando acceso a tu cámara...'
                    : !isCameraOn
                    ? 'Cámara apagada'
                    : 'Cámara en espera'}
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                  {permissionState === 'requesting'
                    ? 'Por favor pulsa "Permitir" en la ventana de tu navegador.'
                    : 'Activa tu cámara para que los hermanos puedan verte.'}
                </p>
                <button
                  type="button"
                  onClick={() => requestDeviceAccess(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Activar mi Cámara y Micrófono</span>
                </button>
              </div>
            )}

            {/* Overlaid preview badge */}
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sala de Preparación y Comprobación</span>
            </div>

            {/* Audio meter floating indicator */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs">
              <Volume2 className={`w-3.5 h-3.5 ${audioMeter > 10 ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                  style={{ width: `${audioMeter}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {isMicOn ? (audioMeter > 10 ? 'Voz detectada' : 'Prueba tu voz') : 'Micrófono apagado'}
              </span>
            </div>

            {/* Flip camera on mobile */}
            <button
              onClick={handleFlipCamera}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
              title="Cambiar entre cámara frontal y trasera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Floating Controls to Toggle Video / Mic */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-3 rounded-full transition-all shadow-lg cursor-pointer ${
                  isMicOn
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
                title={isMicOn ? 'Silenciar micrófono' : 'Activar micrófono'}
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={handleToggleCamera}
                className={`p-3 rounded-full transition-all shadow-lg cursor-pointer ${
                  isCameraOn
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
                title={isCameraOn ? 'Apagar cámara' : 'Encender cámara'}
              >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {permissionError && (!stream || !stream.getVideoTracks().some((t) => t.readyState === 'live')) && (
            <div className="mt-3 text-xs text-amber-300 bg-amber-950/60 border border-amber-500/40 p-3 rounded-2xl text-center max-w-lg flex flex-col items-center gap-2">
              <p>{permissionError}</p>
              <button
                type="button"
                onClick={() => requestDeviceAccess(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Volver a solicitar acceso
              </button>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400 text-center flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Verifica tu imagen y audio antes de ingresar con la congregación.</span>
          </p>
        </div>

        {/* Right Side: Join Form & Room Selection (5 cols) */}
        <div className={`lg:col-span-5 bg-slate-900/80 border rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl transition-all ${
          isAdmin ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-800'
        }`}>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              {/* Aviso de acceso directo para invitados con enlace */}
              {initialRoomId && !isAdminAuthenticated && (
                <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2.5 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <span className="font-bold text-white block">Acceso directo sin cuenta ni registro</span>
                    <span className="text-[11px] text-emerald-100/90">
                      No necesitas cuenta de Google ni contraseña. Solo escribe tu nombre abajo y entra a la sala.
                    </span>
                  </div>
                </div>
              )}

              {/* Candado de Seguridad Pastoral Banner */}
              <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2.5 transition-all mb-3 ${
                isAdminAuthenticated
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    isAdminAuthenticated ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isAdminAuthenticated ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                      <span>{isAdminAuthenticated ? 'Candado Desbloqueado' : 'Acceso Libre para Hermanos'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        isAdminAuthenticated
                          ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-amber-300'
                      }`}>
                        {isAdminAuthenticated ? 'Pastor Verificado' : 'Pastor requiere PIN'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">
                      {isAdminAuthenticated
                        ? 'Este dispositivo tiene privilegios de moderación.'
                        : 'Entra directo sin cuenta; solo Pastor/Líder pide PIN.'}
                    </p>
                  </div>
                </div>

                {isAdminAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLockAdmin}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    title="Cerrar sesión de pastor para probar como invitado"
                  >
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Bloquear</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredPin('');
                      setPinError(null);
                      setShowAdminPinModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>PIN Pastor</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {isAdmin ? '👑 Modo Administrador' : 'Ingreso a la Reunión'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleAdmin}
                    className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isAdmin
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isAdminAuthenticated ? (
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>
                      {isAdmin
                        ? 'Modo Pastor Activo'
                        : isAdminAuthenticated
                        ? 'Activar Modo Pastor'
                        : 'Ingresar como Admin (PIN)'}
                    </span>
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-bold font-serif text-white mb-1">
                {isAdmin ? 'Panel del Administrador / Pastor' : '¿Todo listo para conectarte?'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'Iniciarás la reunión con privilegios para silenciar micrófonos, proyectar pasajes bíblicos y compartir el enlace oficial.'
                  : 'Ingresa tus datos para identificarte ante los demás hermanos.'}
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Tu Nombre completo o saludo: *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. Hno. Carlos Méndez / Pastora Elena"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Church Role Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Tu Rol o Ministerio en la Iglesia:
                </label>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400/80" />
                  <span>Pastor y Líder protegidos</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['member', 'pastor', 'leader', 'musician', 'guest'] as UserRole[]).map((r) => {
                  const info = ROLE_LABELS[r];
                  const isSelected = role === r;
                  const isRestrictedRole = r === 'pastor' || r === 'leader';
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSelectRole(r)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? `${info.bg} ${info.color} ring-1 ring-amber-400/50 shadow-sm`
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{info.label}</span>
                      {isRestrictedRole && (
                        isAdminAuthenticated ? (
                          <span title="Desbloqueado con PIN" className="ml-1 shrink-0 flex items-center">
                            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        ) : (
                          <span title="Bloqueado con PIN Pastoral" className="ml-1 shrink-0 flex items-center">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Room selection (Preset vs Custom) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Sala de la reunión:
              </label>
              <div className="space-y-2">
                <select
                  value={roomId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setRoomId(selectedId);
                    const found = PRESET_ROOMS.find((r) => r.id === selectedId);
                    if (found) setRoomName(found.name);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {PRESET_ROOMS.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.badge})
                    </option>
                  ))}
                  {!PRESET_ROOMS.some((r) => r.id === roomId) && roomId !== 'sala-personalizada' && (
                    <option value={roomId}>
                      {roomName || roomId} (Enlace recibido)
                    </option>
                  )}
                  <option value="sala-personalizada">-- Otra Sala Personalizada --</option>
                </select>

                {roomId === 'sala-personalizada' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código o nombre de sala..."
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/\s+/g, '-');
                        setRoomName(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Join Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span>{isAdmin ? '👑 Iniciar Reunión como Anfitrión' : 'Entrar a la Videollamada'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Share link directly from lobby */}
            <div className={`pt-3 border-t space-y-2 ${isAdmin ? 'border-amber-500/30' : 'border-slate-800/80'}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className={isAdmin ? 'text-amber-300 font-semibold flex items-center gap-1.5' : ''}>
                  {isAdmin ? '🔗 Enlace generado para compartir a los hermanos:' : 'Enlace para invitar a los hermanos:'}
                </span>
                {copiedLobbyLink && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                    <Check className="w-3.5 h-3.5" /> ¡Copiado!
                  </span>
                )}
              </div>
              {isAdmin && (
                <p className="text-[11px] text-slate-400 leading-snug">
                  Copia este enlace o envíalo por WhatsApp. Los hermanos entrarán directamente a tu misma reunión sin necesidad de cuenta de Google.
                </p>
              )}
              <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-xl">
                <input
                  type="text"
                  readOnly
                  value={lobbyMeetingUrl}
                  className="flex-1 bg-transparent text-[11px] text-slate-300 font-mono px-2 focus:outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLobbyLink}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Compartir enlace por WhatsApp</span>
              </button>

              {isPrivatePreview && (
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 leading-snug flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso antes de compartir:</strong> Estás en una URL de vista previa de AI Studio (<code className="text-amber-300">ais-dev</code> / <code className="text-amber-300">ais-pre</code>), la cual muestra una pantalla de seguridad en inglés y pide cuenta de Google a otras personas. Para que los hermanos entren directo en español sin cuenta, pulsa el botón <strong>Deploy app</strong> (arriba a la derecha en AI Studio) para publicar en Cloud Run y comparte esa URL pública.
                  </span>
                </div>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* Footer info */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <p>Koinonía Meet • Plataforma Eclesial de Comunión y Oración</p>
        <p>Compatible con celulares Android, iPhone, tablets y computadoras.</p>
      </footer>
    </div>
  );
};
