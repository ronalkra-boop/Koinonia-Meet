import { useEffect, useRef, useState, useCallback } from 'react';
import { Participant, ChatMessage, ActiveVerse, PrayerRequest, FloatingReaction, UserRole } from '../types/meeting';

interface UseWebRTCProps {
  roomId: string;
  roomName: string;
  displayName: string;
  role: UserRole;
  initialMic: boolean;
  initialCamera: boolean;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  onKicked?: () => void;
}

/**
 * IMPORTANTE: los TURN públicos de OpenRelay son gratuitos y suelen estar saturados.
 * Para producción crea una cuenta (Metered, Twilio, Cloudflare Realtime) o usa tu propio coturn
 * y define estas variables en tu .env:
 *   VITE_TURN_URL=turn:tu-servidor:3478
 *   VITE_TURN_USERNAME=usuario
 *   VITE_TURN_CREDENTIAL=clave
 */
let globalCachedIceServers: RTCIceServer[] = [];

export function setCachedIceServers(servers: RTCIceServer[]) {
  if (Array.isArray(servers) && servers.length > 0) {
    globalCachedIceServers = servers;
  }
}

export function getIceServers(customServerIceServers?: RTCIceServer[]): RTCConfiguration {
  let userTurn: RTCIceServer[] = [];
  try {
    const saved = localStorage.getItem('koinonia_turn_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.urls && parsed.username && parsed.credential) {
        userTurn = [
          {
            urls: typeof parsed.urls === 'string' ? parsed.urls.split(',') : parsed.urls,
            username: parsed.username,
            credential: parsed.credential,
          },
        ];
      }
    }
  } catch (e) {}

  const env: any = (import.meta as any).env || {};
  const envTurn: RTCIceServer[] = env.VITE_TURN_URL
    ? [
        {
          urls: String(env.VITE_TURN_URL).split(','),
          username: env.VITE_TURN_USERNAME,
          credential: env.VITE_TURN_CREDENTIAL,
        },
      ]
    : [];

  const serverProvided =
    customServerIceServers && customServerIceServers.length > 0
      ? customServerIceServers
      : globalCachedIceServers;

  // Lista optimizada de alta velocidad: priorizar Relay TCP 443 para atravesar CGNAT 4G inmediatamente
  const defaultTurnFallbacks: RTCIceServer[] = [
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  const primaryStuns: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  // Servidores combinados: El servidor (/api/ice-servers) es la fuente principal.
  // Los relays públicos antiguos solo se usan si el servidor no entregó ningún servidor,
  // para evitar recolección lenta de candidatos en redes móviles.
  const combined = [
    ...userTurn,
    ...envTurn,
    ...serverProvided,
    ...(serverProvided.length === 0 ? defaultTurnFallbacks : []),
    ...primaryStuns,
  ];

  const seenUrls = new Set<string>();
  const deduplicated: RTCIceServer[] = [];

  for (const s of combined) {
    const rawUrls = Array.isArray(s.urls) ? s.urls : [s.urls];
    const uniqueForThisServer = rawUrls.filter((u) => !seenUrls.has(u));
    if (uniqueForThisServer.length > 0) {
      uniqueForThisServer.forEach((u) => seenUrls.add(u));
      deduplicated.push({
        ...s,
        urls: uniqueForThisServer.length === 1 ? uniqueForThisServer[0] : uniqueForThisServer,
      });
    }
  }

  const valid = deduplicated.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    const needsAuth = urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    return !needsAuth || (Boolean(s.username) && Boolean(s.credential));
  });

  return {
    iceServers: valid,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

export function useWebRTC({
  roomId,
  roomName,
  displayName,
  role,
  initialMic,
  initialCamera,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onKicked,
}: UseWebRTCProps) {
  const [localPeerId] = useState<string>(
    () => `peer-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [isMicOn, setIsMicOn] = useState<boolean>(initialMic);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(initialCamera);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeVerse, setActiveVerse] = useState<ActiveVerse | null>(null);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [hasScreenAudio, setHasScreenAudio] = useState<boolean>(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenMixerContextRef = useRef<AudioContext | null>(null);
  const screenMixerGainRef = useRef<GainNode | null>(null);
  const activeAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);
  const serverIceServersRef = useRef<RTCIceServer[]>(globalCachedIceServers);

  // Refs que guardan el valor más reciente SIN disparar re-ejecución de efectos.
  // (Antes, isMicOn estaba en las dependencias de initLocalMedia y reiniciaba toda la conexión.)
  const isMicOnRef = useRef<boolean>(initialMic);
  const isCameraOnRef = useRef<boolean>(initialCamera);
  const initialMicRef = useRef<boolean>(initialMic);
  const initialCameraRef = useRef<boolean>(initialCamera);
  const audioDeviceRef = useRef<string | undefined>(selectedAudioDeviceId);
  const videoDeviceRef = useRef<string | undefined>(selectedVideoDeviceId);
  const onKickedRef = useRef<(() => void) | undefined>(onKicked);

  isMicOnRef.current = isMicOn;
  isCameraOnRef.current = isCameraOn;
  onKickedRef.current = onKicked;
  // OJO: ya NO se hace localStreamRef.current = localStream en cada render,
  // porque podía pisar el stream real con null antes de crear las conexiones.

  // Fetch initial ICE servers from server
  useEffect(() => {
    fetch('/api/ice-servers')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          serverIceServersRef.current = data.iceServers;
          setCachedIceServers(data.iceServers);
        }
      })
      .catch(() => {});
  }, []);

  // ---------- Helpers ----------

  const sendWs = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  /** Reemplaza el track de un tipo (audio/video) en todas las conexiones de forma infalible vía transceptores */
  const replaceTrackInPeers = useCallback((kind: 'audio' | 'video', track: MediaStreamTrack | null) => {
    peerConnections.current.forEach((pc) => {
      const t = pc.getTransceivers().find((tr) => tr.receiver.track.kind === kind);
      if (t && t.sender) {
        t.sender
          .replaceTrack(track)
          .then(() => {
            if (kind === 'video' && track) {
              try {
                const params = t.sender.getParameters();
                if (!params.encodings || params.encodings.length === 0) {
                  params.encodings = [{}];
                }
                // Limitar bitrate para no desbordar buffers de datos móviles 4G ni servidores TURN
                params.encodings[0].maxBitrate = screenStreamRef.current ? 1200000 : 750000;
                params.degradationPreference = 'maintain-framerate';
                t.sender.setParameters(params).catch(() => {});
              } catch {}
            }
          })
          .catch((e) => console.warn(`replaceTrack ${kind} falló:`, e));
      }
    });
  }, []);

  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    // Limpiar análisis anterior
    if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;

    if (stream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      audioContextRef.current = audioCtx;
      audioCtx.resume().catch(() => {});

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastTime = 0;
      let lastLevel = 0;

      const checkAudio = () => {
        const now = performance.now();
        if (isMicOnRef.current) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const nextLevel = Math.min(100, Math.round((avg / 128) * 100));

          // Actualizar estado solo si pasaron 100 ms o si hubo un cambio notable (ahorro de batería en móviles)
          if (now - lastTime > 100 || Math.abs(nextLevel - lastLevel) >= 5) {
            lastTime = now;
            lastLevel = nextLevel;
            setLocalAudioLevel(nextLevel);
          }
        } else if (lastLevel !== 0) {
          lastLevel = 0;
          setLocalAudioLevel(0);
        }
        audioAnimFrameRef.current = requestAnimationFrame(checkAudio);
      };
      checkAudio();
    } catch (e) {
      console.warn('AudioContext not supported or restricted', e);
    }
  }, []);

  // Initialize Local Media Stream
  const initLocalMedia = useCallback(
    async (isCancelled: () => boolean = () => false): Promise<MediaStream | null> => {
      const applyAndCommit = (stream: MediaStream): MediaStream | null => {
        // Si el efecto fue cancelado mientras se pedía el permiso (StrictMode / desmontaje),
        // soltamos la cámara para no dejarla encendida.
        if (isCancelled()) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }
        stream.getAudioTracks().forEach((t) => (t.enabled = initialMicRef.current));
        stream.getVideoTracks().forEach((t) => (t.enabled = initialCameraRef.current));
        localStreamRef.current = stream;
        activeAudioTrackRef.current = stream.getAudioTracks()[0] || null;
        setLocalStream(stream);
        return stream;
      };

      const audioId = audioDeviceRef.current;
      const videoId = videoDeviceRef.current;

      const requestWithRetry = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err: any) {
            const isBusy =
              err.name === 'NotReadableError' ||
              err.name === 'TrackStartError' ||
              err.name === 'AbortError' ||
              err.message?.includes('starting');
            if (isBusy && attempt < 2) {
              await new Promise((r) => setTimeout(r, 350));
              continue;
            }
            throw err;
          }
        }
        throw new Error('No se pudo inicializar el dispositivo tras varios reintentos');
      };

      // Intento 1: dispositivos elegidos con soporte flexible para móvil y PC
      try {
        const constraints: MediaStreamConstraints = {
          audio: audioId ? { deviceId: { exact: audioId } } : true,
          video: videoId
            ? { deviceId: { exact: videoId } }
            : { facingMode: { ideal: 'user' } },
        };
        const stream = await requestWithRetry(constraints);
        const committed = applyAndCommit(stream);
        if (committed) {
          setMediaError(null);
          setupAudioAnalyser(committed);
        }
        return committed;
      } catch (err: any) {
        console.warn('Falló getUserMedia con dispositivos elegidos:', err);
      }

      // Intento 2: audio + video genéricos (por si el deviceId guardado ya no existe)
      try {
        const stream = await requestWithRetry({ audio: true, video: true });
        const committed = applyAndCommit(stream);
        if (committed) {
          setMediaError(null);
          setupAudioAnalyser(committed);
        }
        return committed;
      } catch (err: any) {
        console.warn('Falló getUserMedia genérico, probando solo video o solo audio:', err);
      }

      // Intento 3: solo video (por si el micro está bloqueado o en uso)
      try {
        const videoOnly = await requestWithRetry({ video: true });
        const committed = applyAndCommit(videoOnly);
        if (committed) {
          setIsMicOn(false);
          setMediaError('Micrófono no disponible. Has ingresado solo con cámara.');
        }
        return committed;
      } catch (videoErr: any) {
        console.warn('Falló solo video:', videoErr);
      }

      // Intento 4: solo audio
      try {
        const audioOnly = await requestWithRetry({ audio: true });
        const committed = applyAndCommit(audioOnly);
        if (committed) {
          setIsCameraOn(false);
          setMediaError('Cámara no disponible. Has ingresado solo con audio.');
          setupAudioAnalyser(committed);
        }
        return committed;
      } catch (audioErr: any) {
        console.error('All media devices blocked or unavailable:', audioErr);
      }

      // Intento 4: modo oyente
      if (isCancelled()) return null;
      setMediaError(
        window.isSecureContext
          ? 'Permiso de micrófono/cámara denegado. Estás en modo oyente.'
          : 'El navegador bloquea la cámara y el micrófono en conexiones no seguras. Abre la página con HTTPS.'
      );
      const emptyStream = new MediaStream();
      localStreamRef.current = emptyStream;
      setLocalStream(emptyStream);
      setIsCameraOn(false);
      setIsMicOn(false);
      return emptyStream;
    },
    [setupAudioAnalyser]
  );

  const sendIceRestart = useCallback(
    (pc: RTCPeerConnection, peerId: string) => {
      if (pc.signalingState !== 'stable') {
        console.log(`[WebRTC ${peerId}] Omitiendo iceRestart: signalingState=${pc.signalingState} no es 'stable'`);
        return;
      }
      console.log(`[WebRTC ${peerId}] Generando oferta iceRestart...`);
      pc.createOffer({ iceRestart: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendWs({
            type: 'signal',
            targetId: peerId,
            signal: { type: pc.localDescription?.type, sdp: pc.localDescription?.sdp },
          });
        })
        .catch((e) => console.warn(`[WebRTC ${peerId}] iceRestart no completado:`, e));
    },
    [sendWs]
  );

  // Helper to create and setup a PeerConnection for a remote peer
  const createPeerConnection = useCallback(
    (remotePeerId: string, isInitiator: boolean) => {
      const existingPc = peerConnections.current.get(remotePeerId);
      if (existingPc) return existingPc;

      const pc = new RTCPeerConnection(getIceServers(serverIceServersRef.current));
      peerConnections.current.set(remotePeerId, pc);

      // Inicializar transceptores limpios: audio en m-line 0, video en m-line 1
      const currentLocal = localStreamRef.current;
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      const audioTrack = activeAudioTrackRef.current ?? currentLocal?.getAudioTracks()[0] ?? null;
      const videoTrack = screenTrack ?? currentLocal?.getVideoTracks()[0] ?? null;

      ([['audio', audioTrack], ['video', videoTrack]] as const).forEach(([kind, track]) => {
        pc.addTransceiver(track ?? kind, {
          direction: 'sendrecv',
          streams: currentLocal ? [currentLocal] : [],
        });
      });

      const t0 = performance.now();
      const ts = () => `${Math.round(performance.now() - t0)}ms`;

      pc.onsignalingstatechange = () => {
        console.log(`[WebRTC ${remotePeerId}] signalingState: ${pc.signalingState} @${ts()}`);
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[ICE ${remotePeerId}] iceGatheringState: ${pc.iceGatheringState} @${ts()}`);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            `[ICE ${remotePeerId}] candidato local ${event.candidate.type}/${event.candidate.protocol} (${event.candidate.address || 'ip'}:${event.candidate.port}) @${ts()}`
          );
          sendWs({
            type: 'signal',
            targetId: remotePeerId,
            signal: {
              type: 'candidate',
              candidate: {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                usernameFragment: event.candidate.usernameFragment,
              },
            },
          });
        }
      };

      (pc as any).onicecandidateerror = (e: any) => {
        console.warn(`[ICE ${remotePeerId}] error ${e.errorCode} ${e.url} ${e.errorText} @${ts()}`);
      };

      pc.ontrack = (event) => {
        console.log(`[WebRTC ${remotePeerId}] ontrack recibido: tipo ${event.track.kind}, id: ${event.track.id}, readyState: ${event.track.readyState}`);
        const existing = remoteStreams.current.get(remotePeerId);
        let currentTracks: MediaStreamTrack[] = [];
        if (existing) {
          currentTracks = existing.getTracks().filter((t) => t.id !== event.track.id && t.kind !== event.track.kind);
        }
        currentTracks.push(event.track);

        const newStream = new MediaStream(currentTracks);
        remoteStreams.current.set(remotePeerId, newStream);

        setRemoteParticipants((prev) =>
          prev.map((p) => {
            if (p.id === remotePeerId) {
              return {
                ...p,
                stream: newStream,
              };
            }
            return p;
          })
        );
      };

      let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let iceRestartCount = 0;
      const MAX_ICE_RESTARTS = 3;

      // Vigía de conexión inicial (solo para el iniciador): si tras 16s no se ha conectado,
      // realiza un reinicio seguro para evitar que la llamada se quede congelada indefinidamente.
      let connectWatchdog: ReturnType<typeof setTimeout> | null = null;
      let watchdogRetries = 0;
      const MAX_WATCHDOG_RETRIES = 2;
      const CONNECT_TIMEOUT_MS = 16000;

      const clearConnectWatchdog = () => {
        if (connectWatchdog) {
          clearTimeout(connectWatchdog);
          connectWatchdog = null;
        }
      };

      const armConnectWatchdog = () => {
        if (!isInitiator) return;
        clearConnectWatchdog();
        connectWatchdog = setTimeout(() => {
          const st = pc.iceConnectionState;
          if (st === 'connected' || st === 'completed' || st === 'closed' || pc.connectionState === 'closed') {
            return;
          }
          if (watchdogRetries >= MAX_WATCHDOG_RETRIES) {
            console.warn(`[ICE ${remotePeerId}] Sin conexión tras ${MAX_WATCHDOG_RETRIES} reintentos vigía.`);
            return;
          }
          if (pc.signalingState !== 'stable') {
            console.log(`[ICE ${remotePeerId}] Watchdog en espera (signalingState: ${pc.signalingState})`);
            armConnectWatchdog();
            return;
          }
          watchdogRetries++;
          console.warn(`[ICE ${remotePeerId}] Sin conexión tras 16s (estado ${st}). Reintentando conexión ${watchdogRetries}/${MAX_WATCHDOG_RETRIES}...`);
          sendIceRestart(pc, remotePeerId);
          armConnectWatchdog();
        }, CONNECT_TIMEOUT_MS);
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        console.log(`[ICE ${remotePeerId}] iceConnectionState: ${st} @${ts()}`);
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }

        if (st === 'connected' || st === 'completed') {
          iceRestartCount = 0; // reset al conectar con éxito
          clearConnectWatchdog();
        } else if (st === 'closed') {
          clearConnectWatchdog();
        }

        if (!isInitiator) return;

        const attemptRestart = (reason: string) => {
          if (iceRestartCount >= MAX_ICE_RESTARTS) {
            console.warn(
              `[DIAGNÓSTICO WebRTC ${remotePeerId}] Límite de ${MAX_ICE_RESTARTS} reintentos ICE alcanzado. Se detiene bucle de ofertas repetidas.`
            );
            return;
          }
          iceRestartCount++;
          const delay = iceRestartCount * 3000;
          console.log(`[ICE ${remotePeerId}] ${reason}. Programando iceRestart (intento ${iceRestartCount}/${MAX_ICE_RESTARTS}) en ${delay}ms...`);
          setTimeout(() => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
              sendIceRestart(pc, remotePeerId);
            }
          }, delay);
        };

        if (st === 'failed') {
          attemptRestart('ICE falló');
        } else if (st === 'disconnected') {
          // En redes móviles 4G un 'disconnected' suele ser una fluctuación temporal de 3-8s.
          // Esperamos 14 segundos antes de forzar un costoso reinicio ICE.
          disconnectTimer = setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              attemptRestart('ICE desconectado persistente');
            }
          }, 14000);
        }
      };

      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState;
        console.log(`[WebRTC ${remotePeerId}] connectionState: ${cs} @${ts()}`);
        if (cs === 'connected') {
          pc.getStats().then((stats) => {
            let selectedPair: any = null;
            let bytesRecv = 0;
            let bytesSent = 0;
            stats.forEach((r: any) => {
              if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
                selectedPair = r;
              }
              if (r.type === 'inbound-rtp') bytesRecv += r.bytesReceived || 0;
              if (r.type === 'outbound-rtp') bytesSent += r.bytesSent || 0;
            });
            if (selectedPair) {
              const local = stats.get(selectedPair.localCandidateId);
              const remote = stats.get(selectedPair.remoteCandidateId);
              console.log(
                `[ICE ÉXITO] Ruta establecida: local(${local?.candidateType}/${local?.protocol}) <-> remote(${remote?.candidateType}/${remote?.protocol}) @${ts()}`
              );
            }
            console.log(`[WebRTC Flujo] Datos RTP acumulados: bytesEnviados=${bytesSent}, bytesRecibidos=${bytesRecv}`);
          }).catch(() => {});
        } else if (cs === 'failed') {
          pc.getStats().then((stats) => {
            let hosts = 0;
            let srflx = 0;
            let relays = 0;
            stats.forEach((r: any) => {
              if (r.type === 'local-candidate') {
                if (r.candidateType === 'host') hosts++;
                else if (r.candidateType === 'srflx') srflx++;
                else if (r.candidateType === 'relay') relays++;
              }
            });
            console.warn(`[DIAGNÓSTICO WebRTC FALLO] Candidatos locales recolectados: host=${hosts}, srflx=${srflx}, relay=${relays}.`);
            if (relays === 0) {
              console.warn(
                '[DIAGNÓSTICO CRÍTICO] CERO candidatos relay generados. Red 4G con NAT simétrico no puede conectar sin un servidor TURN accesible.'
              );
            }
          }).catch(() => {});
        }
      };

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendWs({
              type: 'signal',
              targetId: remotePeerId,
              signal: {
                type: pc.localDescription?.type,
                sdp: pc.localDescription?.sdp,
              },
            });
            armConnectWatchdog();
          })
          .catch((err) => console.error(`Error creating offer for ${remotePeerId}:`, err));
      }

      return pc;
    },
    [sendWs, sendIceRestart]
  );

  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      peerConnections.current.delete(peerId);
    }
    remoteStreams.current.delete(peerId);
    candidateQueues.current.delete(peerId);
  }, []);

  const drainCandidates = useCallback(async (pc: RTCPeerConnection, peerId: string) => {
    if (!peerConnections.current.has(peerId)) return;
    const queue = candidateQueues.current.get(peerId) || [];
    while (queue.length > 0) {
      const candidateInit = queue.shift();
      if (candidateInit && peerConnections.current.has(peerId)) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          console.warn(`[WebRTC] Error aplicando candidato acumulado para ${peerId}:`, e);
        }
      }
    }
  }, []);

  // ---------- Conexión principal ----------

  useEffect(() => {
    let isCancelled = false;
    let reconnectTimer: any = null;
    let reconnectAttempts = 0;

    function connectWs() {
      if (isCancelled) return;
      const old = wsRef.current;
      if (old) {
        old.onclose = null;
        old.onmessage = null;
        try {
          old.close();
        } catch {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let lastMsgAt = Date.now();
      const watchdog = setInterval(() => {
        if (wsRef.current !== ws) {
          clearInterval(watchdog);
          return;
        }
        if (ws.readyState === WebSocket.OPEN && Date.now() - lastMsgAt > 40000) {
          console.warn('[WS] Sin señal del servidor tras 40s (socket zombi), reconectando...');
          clearInterval(watchdog);
          connectWs();
        }
      }, 10000);

      ws.onopen = () => {
        if (isCancelled) return;
        reconnectAttempts = 0;
        setConnectionStatus('connected');
        const currentStream = localStreamRef.current;
        sendWs({
          type: 'join',
          roomId,
          roomName,
          participant: {
            id: localPeerId,
            displayName,
            role,
            isCameraOn: isCameraOnRef.current && (currentStream?.getVideoTracks().length ?? 0) > 0,
            isMicOn: isMicOnRef.current && (currentStream?.getAudioTracks().length ?? 0) > 0,
            isScreenSharing: false,
          },
        });
      };

      ws.onclose = () => {
        clearInterval(watchdog);
        if (isCancelled) return;
        setConnectionStatus('connecting');
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 8000);
        console.log(`[WS] Reconectando en ${Math.round(delay)}ms (intento ${reconnectAttempts})...`);
        reconnectTimer = setTimeout(connectWs, delay);
      };

      ws.onerror = (err) => {
        console.warn('[WS] Error de socket:', err);
      };

      ws.onmessage = async (event) => {
        if (isCancelled) return;
        lastMsgAt = Date.now();
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'room-state': {
              if (msg.iceServers && Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
                serverIceServersRef.current = msg.iceServers;
                setCachedIceServers(msg.iceServers);
              }

              const existingPeers: Participant[] = msg.peers.map((p: any) => ({
                id: p.id,
                displayName: p.displayName,
                role: p.role,
                isCameraOn: p.isCameraOn,
                isMicOn: p.isMicOn,
                isScreenSharing: p.isScreenSharing,
                isHandRaised: p.isHandRaised,
                stream: remoteStreams.current.get(p.id) ?? null,
              }));

              setRemoteParticipants(existingPeers);
              if (msg.activeVerse) setActiveVerse(msg.activeVerse);
              if (msg.prayers) setPrayers(msg.prayers);

              // Al recibir room-state (especialmente al reconectar), cerramos conexiones viejas
              peerConnections.current.forEach((_, id) => closePeer(id));

              // Como recién llegado, esperamos la oferta de los peers existentes
              existingPeers.forEach((p) => {
                if (!candidateQueues.current.has(p.id)) candidateQueues.current.set(p.id, []);
                createPeerConnection(p.id, false);
              });
              break;
            }

            case 'peer-joined': {
              const newPeer = msg.peer;

              // Si quedó una conexión vieja del mismo peer (reconexión), la cerramos
              if (peerConnections.current.has(newPeer.id)) {
                closePeer(newPeer.id);
              }

              setRemoteParticipants((prev) => {
                if (prev.some((p) => p.id === newPeer.id)) return prev;
                return [
                  ...prev,
                  {
                    id: newPeer.id,
                    displayName: newPeer.displayName,
                    role: newPeer.role,
                    isCameraOn: newPeer.isCameraOn,
                    isMicOn: newPeer.isMicOn,
                    isScreenSharing: newPeer.isScreenSharing,
                    isHandRaised: newPeer.isHandRaised,
                    stream: remoteStreams.current.get(newPeer.id) ?? null,
                  },
                ];
              });

              candidateQueues.current.set(newPeer.id, []);

              // El peer establecido inicia la oferta hacia el recién llegado
              createPeerConnection(newPeer.id, true);
              break;
            }

            case 'peer-left': {
              const leavingId = msg.peerId;
              setRemoteParticipants((prev) => prev.filter((p) => p.id !== leavingId));
              closePeer(leavingId);
              break;
            }

            case 'signal': {
              const { senderId, signal } = msg;
              if (!signal) break;
              let pc = peerConnections.current.get(senderId);
              if (!pc) pc = createPeerConnection(senderId, false);

              if (signal.type === 'offer') {
                try {
                  const offerCollision = pc.signalingState !== 'stable';
                  const isPolite = localPeerId < senderId;
                  if (offerCollision) {
                    if (!isPolite) {
                      console.log(`[WebRTC] Colisión de oferta: ignorando oferta entrante de ${senderId}`);
                      break;
                    }
                    console.log(`[WebRTC] Colisión de oferta: ejecutando rollback para aceptar oferta de ${senderId}`);
                    await pc.setLocalDescription({ type: 'rollback' });
                  }

                  await pc.setRemoteDescription(new RTCSessionDescription(signal));

                  // Asegurar que las pistas locales estén conectadas a los transceptores para que la respuesta envíe audio y video
                  const currentLocal = localStreamRef.current;
                  const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
                  const audioTrack = activeAudioTrackRef.current ?? currentLocal?.getAudioTracks()[0] ?? null;
                  const videoTrack = screenTrack ?? currentLocal?.getVideoTracks()[0] ?? null;

                  pc.getTransceivers().forEach((transceiver) => {
                    const kind = transceiver.receiver.track.kind;
                    transceiver.direction = 'sendrecv';
                    if (kind === 'audio' && audioTrack && (!transceiver.sender.track || transceiver.sender.track.id !== audioTrack.id)) {
                      transceiver.sender.replaceTrack(audioTrack).catch(() => {});
                    }
                    if (kind === 'video' && videoTrack && (!transceiver.sender.track || transceiver.sender.track.id !== videoTrack.id)) {
                      transceiver.sender.replaceTrack(videoTrack).catch(() => {});
                    }
                  });

                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);

                  sendWs({
                    type: 'signal',
                    targetId: senderId,
                    signal: {
                      type: pc.localDescription?.type,
                      sdp: pc.localDescription?.sdp,
                    },
                  });

                  // Desahogar candidatos acumulados una vez que la descripción local está lista y la conexión es estable
                  await drainCandidates(pc, senderId);
                } catch (offerErr) {
                  console.error(`[WebRTC] Error procesando oferta de ${senderId}:`, offerErr);
                }
              } else if (signal.type === 'answer') {
                if (!peerConnections.current.has(senderId)) {
                  break;
                }
                // Si la conexión ya regresó a 'stable' o no está en 'have-local-offer',
                // la respuesta ya fue procesada o es redundante; ignorarla de forma segura.
                if (pc.signalingState !== 'have-local-offer') {
                  console.log(
                    `[WebRTC ${senderId}] Ignorando respuesta redundante (signalingState actual: ${pc.signalingState})`
                  );
                  break;
                }
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal));
                  await drainCandidates(pc, senderId);
                } catch (ansErr) {
                  console.error(`[WebRTC] Error procesando respuesta de ${senderId}:`, ansErr);
                }
              } else if (signal.type === 'candidate' && signal.candidate) {
                // Solo aplicar candidato directo si el peer tiene remoteDescription y no está en estado inestable
                const canApplyDirectly =
                  pc.remoteDescription && (pc.signalingState === 'stable' || pc.localDescription);

                if (canApplyDirectly) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                  } catch (e) {
                    console.warn(`[WebRTC] Re-encolando candidato para ${senderId}:`, e);
                    if (!candidateQueues.current.has(senderId)) {
                      candidateQueues.current.set(senderId, []);
                    }
                    candidateQueues.current.get(senderId)!.push(signal.candidate);
                  }
                } else {
                  if (!candidateQueues.current.has(senderId)) {
                    candidateQueues.current.set(senderId, []);
                  }
                  candidateQueues.current.get(senderId)!.push(signal.candidate);
                }
              }
              break;
            }

            case 'user-updated': {
              setRemoteParticipants((prev) =>
                prev.map((p) => (p.id === msg.peerId ? { ...p, ...msg.update } : p))
              );
              break;
            }

            case 'chat-broadcast': {
              setChatMessages((prev) => [...prev, msg.message]);
              break;
            }

            case 'reaction-broadcast': {
              const newReaction: FloatingReaction = {
                id: `react-${Date.now()}-${Math.random()}`,
                senderName: msg.senderName,
                emoji: msg.emoji,
                x: 15 + Math.random() * 70,
                timestamp: Date.now(),
              };
              setReactions((prev) => [...prev, newReaction]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
              }, 4000);
              break;
            }

            case 'verse-presented': {
              setActiveVerse(msg.activeVerse);
              break;
            }

            case 'verse-cleared': {
              setActiveVerse(null);
              break;
            }

            case 'prayer-added': {
              setPrayers((prev) => [msg.prayer, ...prev]);
              break;
            }

            case 'prayer-amen-updated': {
              setPrayers((prev) =>
                prev.map((pr) => (pr.id === msg.prayerId ? { ...pr, amenCount: msg.amenCount } : pr))
              );
              break;
            }

            case 'force-mute': {
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
              }
              setIsMicOn(false);
              break;
            }

            case 'kicked': {
              onKickedRef.current?.();
              break;
            }

            case 'ping': {
              sendWs({ type: 'pong' });
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };
    }

    const navConn = (navigator as any).connection;
    let netTimer: ReturnType<typeof setTimeout> | null = null;
    let lastNetType = navConn?.type;

    // Recuperación instantánea ante cambios de red (de 4G a Wi-Fi, cortes temporales o cambio de antena)
    const handleNetworkChange = () => {
      if (netTimer) clearTimeout(netTimer);
      netTimer = setTimeout(() => {
        const typeChanged = navConn?.type !== lastNetType;
        lastNetType = navConn?.type;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          connectWs();
        }
        peerConnections.current.forEach((pc, id) => {
          const healthy = ['connected', 'completed'].includes(pc.iceConnectionState);
          if (typeChanged || !healthy) sendIceRestart(pc, id);
        });
      }, 1500);
    };

    window.addEventListener('online', handleNetworkChange);
    if (navConn && typeof navConn.addEventListener === 'function') {
      navConn.addEventListener('change', handleNetworkChange);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleNetworkChange();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    async function start() {
      const stream = await initLocalMedia(() => isCancelled);
      if (isCancelled || !stream) return;
      connectWs();
    }

    start();

    return () => {
      isCancelled = true;
      if (netTimer) clearTimeout(netTimer);
      window.removeEventListener('online', handleNetworkChange);
      if (navConn && typeof navConn.removeEventListener === 'function') {
        navConn.removeEventListener('change', handleNetworkChange);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* noop */
        }
      }

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      remoteStreams.current.clear();
      candidateQueues.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
    };
    // Estas dependencias son estables: ya no se reinicia la sala al activar/silenciar el micrófono.
  }, [roomId, roomName, displayName, role, createPeerConnection, closePeer, drainCandidates, initLocalMedia, localPeerId, sendWs, sendIceRestart]);

  // ---------- Cambio de dispositivos en caliente (sin reiniciar la sala) ----------

  const lastDevicesRef = useRef({ audio: selectedAudioDeviceId, video: selectedVideoDeviceId });

  useEffect(() => {
    audioDeviceRef.current = selectedAudioDeviceId;
    videoDeviceRef.current = selectedVideoDeviceId;

    const last = lastDevicesRef.current;
    const audioChanged = selectedAudioDeviceId !== last.audio;
    const videoChanged = selectedVideoDeviceId !== last.video;
    if (!audioChanged && !videoChanged) return;
    lastDevicesRef.current = { audio: selectedAudioDeviceId, video: selectedVideoDeviceId };

    const current = localStreamRef.current;
    if (!current) return;

    (async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioChanged && selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : false,
          video:
            videoChanged && selectedVideoDeviceId
              ? { deviceId: { exact: selectedVideoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : false,
        });

        const tracks = [...current.getTracks()];

        newStream.getAudioTracks().forEach((newTrack) => {
          newTrack.enabled = isMicOnRef.current;
          tracks.filter((t) => t.kind === 'audio').forEach((t) => {
            t.stop();
            tracks.splice(tracks.indexOf(t), 1);
          });
          tracks.push(newTrack);
          if (screenMixerContextRef.current && screenMixerGainRef.current) {
            try {
              const newSource = screenMixerContextRef.current.createMediaStreamSource(new MediaStream([newTrack]));
              newSource.connect(screenMixerGainRef.current);
            } catch (err) {
              console.warn('Error reconectando mic al mixer de pantalla:', err);
            }
          } else {
            activeAudioTrackRef.current = newTrack;
            replaceTrackInPeers('audio', newTrack);
          }
        });

        newStream.getVideoTracks().forEach((newTrack) => {
          newTrack.enabled = isCameraOnRef.current;
          tracks.filter((t) => t.kind === 'video').forEach((t) => {
            t.stop();
            tracks.splice(tracks.indexOf(t), 1);
          });
          tracks.push(newTrack);
          // Si se está compartiendo pantalla, no pisar el track de la pantalla
          if (!screenStreamRef.current) replaceTrackInPeers('video', newTrack);
        });

        const updated = new MediaStream(tracks);
        localStreamRef.current = updated;
        setLocalStream(updated);
        if (audioChanged) setupAudioAnalyser(updated);
      } catch (e) {
        console.warn('No se pudo cambiar de dispositivo:', e);
      }
    })();
  }, [selectedAudioDeviceId, selectedVideoDeviceId, replaceTrackInPeers, setupAudioAnalyser]);

  // ---------- Controles ----------

  const toggleMic = useCallback(() => {
    const nextState = !isMicOnRef.current;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    // Si hay un mezclador de audio de pantalla activo, silenciar o activar la ganancia del micrófono
    if (screenMixerGainRef.current) {
      screenMixerGainRef.current.gain.value = nextState ? 1.0 : 0.0;
    }
    setIsMicOn(nextState);
    sendWs({ type: 'user-update', update: { isMicOn: nextState } });
  }, [sendWs]);

  const toggleCamera = useCallback(async () => {
    const nextState = !isCameraOnRef.current;
    isCameraOnRef.current = nextState;
    setIsCameraOn(nextState);

    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = nextState;
        });
        if (!screenStreamRef.current) {
          replaceTrackInPeers('video', nextState ? videoTracks[0] : null);
        }
      } else if (nextState) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: videoDeviceRef.current
              ? { deviceId: { exact: videoDeviceRef.current } }
              : { facingMode: { ideal: 'user' } },
          });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          if (newVideoTrack) {
            stream.addTrack(newVideoTrack);
            setLocalStream(new MediaStream(stream.getTracks()));
            if (!screenStreamRef.current) {
              replaceTrackInPeers('video', newVideoTrack);
            }
          }
        } catch (e) {
          console.warn('No se pudo activar la cámara:', e);
          setIsCameraOn(false);
          isCameraOnRef.current = false;
        }
      }
    }
    sendWs({ type: 'user-update', update: { isCameraOn: nextState } });
  }, [replaceTrackInPeers, sendWs]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    setHasScreenAudio(false);

    // Limpiar el mezclador de audio de pantalla si existía
    if (screenMixerContextRef.current) {
      try {
        screenMixerContextRef.current.close().catch(() => {});
      } catch {}
      screenMixerContextRef.current = null;
    }
    screenMixerGainRef.current = null;

    // Restaurar el audio original del micrófono a todos los participantes
    const originalMicTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    activeAudioTrackRef.current = originalMicTrack;
    replaceTrackInPeers('audio', originalMicTrack);

    // Restaurar el analizador de volumen local con el micrófono
    if (localStreamRef.current) {
      setupAudioAnalyser(localStreamRef.current);
    }

    // Volver a la cámara en todas las conexiones
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    replaceTrackInPeers('video', camTrack);

    sendWs({ type: 'user-update', update: { isScreenSharing: false } });
  }, [replaceTrackInPeers, sendWs, setupAudioAnalyser]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaError('Compartir pantalla no está soportado en este dispositivo móvil.');
      setTimeout(() => setMediaError(null), 4000);
      return;
    }

    try {
      let stream: MediaStream;
      // Solicitar captura de pantalla con audio de alta fidelidad para YouTube / video
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'browser',
            frameRate: { ideal: 15, max: 20 },
            width: { max: 1920 },
            height: { max: 1080 },
          } as any,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false, // El presentador sigue escuchando el video en su propia pestaña
          } as any,
          systemAudio: 'include',
          surfaceSwitching: 'include',
          selfBrowserSurface: 'exclude',
        } as any);
      } catch (errConstraint) {
        console.warn('getDisplayMedia con opciones avanzadas rechazado, probando básico:', errConstraint);
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 15, max: 20 },
            },
            audio: true,
          });
        } catch (errBasic) {
          // Si el navegador no permite audio o el usuario deniega audio, compartir solo video
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 15, max: 20 },
            },
          });
        }
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      const screenVideoTrack = stream.getVideoTracks()[0];
      if (screenVideoTrack) {
        replaceTrackInPeers('video', screenVideoTrack);
        screenVideoTrack.onended = () => stopScreenShare();
      }

      // MANEJO DE AUDIO DE YOUTUBE / PANTALLA:
      const screenAudioTracks = stream.getAudioTracks();
      console.log(`[ScreenShare] Tracks: Video=${stream.getVideoTracks().length}, Audio=${screenAudioTracks.length}`);

      if (screenAudioTracks.length > 0) {
        const screenAudioTrack = screenAudioTracks[0];
        setHasScreenAudio(true);
        console.log('[ScreenShare] ✅ Pista de audio de YouTube/Pantalla detectada:', screenAudioTrack.label);

        try {
          // Mezclar el audio de la pantalla con el micrófono local mediante Web Audio API
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const mixerCtx = new AudioContextClass();
          if (mixerCtx.state === 'suspended') {
            await mixerCtx.resume();
          }
          screenMixerContextRef.current = mixerCtx;

          const destination = mixerCtx.createMediaStreamDestination();

          // 1. Audio del video / YouTube al 100% de volumen
          const screenSource = mixerCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          const screenGain = mixerCtx.createGain();
          screenGain.gain.value = 1.0;
          screenSource.connect(screenGain);
          screenGain.connect(destination);

          // 2. Audio del micrófono local (para que el predicador o hermano pueda comentar el video en vivo)
          const micTrack = localStreamRef.current?.getAudioTracks()[0];
          if (micTrack) {
            const micSource = mixerCtx.createMediaStreamSource(new MediaStream([micTrack]));
            const micGain = mixerCtx.createGain();
            micGain.gain.value = isMicOnRef.current ? 1.0 : 0.0;
            screenMixerGainRef.current = micGain;
            micSource.connect(micGain);
            micGain.connect(destination);
          }

          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          if (mixedAudioTrack) {
            activeAudioTrackRef.current = mixedAudioTrack;
            replaceTrackInPeers('audio', mixedAudioTrack);
            setupAudioAnalyser(destination.stream);
          }
        } catch (mixerErr) {
          console.warn('[ScreenShare] Error en AudioContext mixer, enviando pista directa:', mixerErr);
          activeAudioTrackRef.current = screenAudioTrack;
          replaceTrackInPeers('audio', screenAudioTrack);
        }
      } else {
        setHasScreenAudio(false);
        console.log('[ScreenShare] No se incluyó pista de audio en la pantalla compartida.');
      }

      sendWs({ type: 'user-update', update: { isScreenSharing: true } });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Error al compartir pantalla:', err);
      }
    }
  }, [replaceTrackInPeers, sendWs, stopScreenShare, setupAudioAnalyser]);

  const isHandRaisedRef = useRef<boolean>(false);
  const toggleHandRaise = useCallback(() => {
    const nextState = !isHandRaisedRef.current;
    isHandRaisedRef.current = nextState;
    setIsHandRaised(nextState);
    sendWs({ type: 'user-update', update: { isHandRaised: nextState } });
  }, [sendWs]);

  const sendChatMessage = useCallback(
    (text: string, isAnnouncement: boolean = false) => {
      if (!text.trim()) return;
      sendWs({ type: 'chat', text: text.trim(), isAnnouncement });
    },
    [sendWs]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      sendWs({ type: 'reaction', emoji });
    },
    [sendWs]
  );

  const presentVerse = useCallback(
    (reference: string, text: string) => {
      sendWs({ type: 'present-verse', reference, text });
    },
    [sendWs]
  );

  const clearVerse = useCallback(() => {
    sendWs({ type: 'clear-verse' });
  }, [sendWs]);

  const addPrayerRequest = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendWs({ type: 'prayer-request', text: text.trim() });
    },
    [sendWs]
  );

  const amenPrayer = useCallback(
    (prayerId: string) => {
      sendWs({ type: 'amen-prayer', prayerId });
    },
    [sendWs]
  );

  const muteParticipant = useCallback(
    (targetId: string) => {
      sendWs({ type: 'mute-participant', targetId });
    },
    [sendWs]
  );

  // ---------- Grabación local ----------

  const startRecording = useCallback(() => {
    try {
      const videoTrack = (screenStreamRef.current || localStreamRef.current)?.getVideoTracks()[0];
      const audioTrack = activeAudioTrackRef.current || localStreamRef.current?.getAudioTracks()[0];
      const tracksToRecord = [videoTrack, audioTrack].filter(Boolean) as MediaStreamTrack[];
      if (tracksToRecord.length === 0) return;

      const streamToRecord = new MediaStream(tracksToRecord);

      // Safari/iPhone no soporta vp9: elegir el primer formato disponible
      const mimeType =
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) =>
          MediaRecorder.isTypeSupported(t)
        ) || '';

      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamToRecord, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
        const ext = type === 'video/mp4' ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reunion-iglesia-${new Date().toISOString().slice(0, 10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (e) {
      console.error('Recording not supported on this browser:', e);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ---------- Participante de prueba para simulación en vivo ----------
  const simulatedStreamRef = useRef<MediaStream | null>(null);

  const addTestParticipant = useCallback(() => {
    if (remoteParticipants.some((p) => p.id === 'test-hermano-pedro')) return;

    // Crear stream dinámico simulado con canvas para pruebas dentro de la plataforma
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const renderFrame = () => {
      if (!ctx) return;
      t += 0.05;
      const grad = ctx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);

      // Círculo avatar con pulso suave
      const pulse = Math.sin(t) * 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(320, 150, 52 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HP', 320, 150);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Hermano Pedro (Enlace de Prueba)', 320, 235);

      ctx.fillStyle = '#10b981';
      ctx.font = '13px monospace';
      ctx.fillText('• Transmisión activa (Cámara y Audio)', 320, 265);
    };

    const interval = setInterval(renderFrame, 80);
    renderFrame();

    let stream: MediaStream;
    if ((canvas as any).captureStream) {
      stream = (canvas as any).captureStream(20);
    } else {
      stream = new MediaStream();
    }
    (stream as any)._interval = interval;
    simulatedStreamRef.current = stream;

    const testParticipant: Participant = {
      id: 'test-hermano-pedro',
      displayName: 'Hermano Pedro',
      role: 'member',
      isCameraOn: true,
      isMicOn: true,
      isScreenSharing: false,
      isHandRaised: false,
      stream,
      audioLevel: 30,
    };

    setRemoteParticipants((prev) => [...prev.filter((p) => p.id !== testParticipant.id), testParticipant]);
  }, [remoteParticipants]);

  const removeTestParticipant = useCallback(() => {
    if (simulatedStreamRef.current) {
      const interval = (simulatedStreamRef.current as any)._interval;
      if (interval) clearInterval(interval);
      simulatedStreamRef.current.getTracks().forEach((tr) => tr.stop());
      simulatedStreamRef.current = null;
    }
    setRemoteParticipants((prev) => prev.filter((p) => p.id !== 'test-hermano-pedro'));
  }, []);

  const hasTestParticipant = remoteParticipants.some((p) => p.id === 'test-hermano-pedro');

  return {
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
  };
}
