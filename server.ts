import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

interface Participant {
  id: string;
  ws: WebSocket;
  roomId: string;
  displayName: string;
  role: string;
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: number;
}

interface RoomData {
  id: string;
  name: string;
  createdAt: number;
  participants: Map<string, Participant>;
  activeVerse?: {
    reference: string;
    text: string;
    presenterName: string;
  } | null;
  prayers: Array<{
    id: string;
    requesterName: string;
    text: string;
    timestamp: number;
    amenCount: number;
  }>;
}

// In-memory rooms repository
const rooms = new Map<string, RoomData>();

function getOrCreateRoom(roomId: string, roomName?: string): RoomData {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomName || roomId,
      createdAt: Date.now(),
      participants: new Map(),
      activeVerse: null,
      prayers: [
        {
          id: 'p-default-1',
          requesterName: 'Pastoral',
          text: 'Oramos por la bendición, salud y paz de cada familia de nuestra congregación.',
          timestamp: Date.now() - 3600000,
          amenCount: 5,
        },
      ],
    });
  }
  return rooms.get(roomId)!;
}

// Global server-backed TURN configuration for all church members
const TURN_STORAGE_FILE = path.join(process.cwd(), 'turn-config.json');

function loadSavedTurnConfig(): any[] {
  try {
    if (fs.existsSync(TURN_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TURN_STORAGE_FILE, 'utf-8'));
      if (data && data.urls) return [data];
    }
  } catch (e) {
    console.warn('Could not read turn-config.json:', e);
  }
  return [];
}

let activeTurnConfig: any[] = loadSavedTurnConfig();

function getFullIceServers() {
  const defaultStun = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  const envTurnUrl = process.env.VITE_TURN_URL || process.env.TURN_URL;
  const envTurnUser = process.env.VITE_TURN_USERNAME || process.env.TURN_USERNAME;
  const envTurnCred = process.env.VITE_TURN_CREDENTIAL || process.env.TURN_CREDENTIAL;

  const envTurn = envTurnUrl
    ? [
        {
          urls: envTurnUrl.split(','),
          username: envTurnUser,
          credential: envTurnCred,
        },
      ]
    : [];

  return [
    ...activeTurnConfig,
    ...envTurn,
    // Prioridad 1: TURN Relay sobre TCP 443 (atraviesa CGNAT móvil de inmediato sin tiempos de espera)
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
    ...defaultStun,
  ];
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ice-servers', (req, res) => {
  res.json({
    iceServers: getFullIceServers(),
    hasCustomTurn: activeTurnConfig.length > 0 || !!process.env.VITE_TURN_URL,
  });
});

app.post('/api/turn-config', (req, res) => {
  const { urls, username, credential } = req.body || {};
  if (!urls || !username || !credential) {
    activeTurnConfig = [];
    try {
      if (fs.existsSync(TURN_STORAGE_FILE)) fs.unlinkSync(TURN_STORAGE_FILE);
    } catch (e) {}
    console.log('[TURN] Configuración restablecida a predeterminada');
    return res.json({ success: true, message: 'TURN restablecido', hasCustomTurn: false });
  }

  const newConfig = {
    urls: Array.isArray(urls) ? urls : String(urls).split(',').map((u) => u.trim()),
    username: String(username).trim(),
    credential: String(credential).trim(),
  };

  activeTurnConfig = [newConfig];
  try {
    fs.writeFileSync(TURN_STORAGE_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write turn-config.json:', e);
  }

  console.log('[TURN] Servidor TURN guardado en el servidor para todos los miembros');
  res.json({ success: true, message: 'Servidor TURN guardado en el servidor', hasCustomTurn: true });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.json({ exists: false });
  }
  return res.json({
    exists: true,
    id: room.id,
    name: room.name,
    participantCount: room.participants.size,
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentParticipantId: string | null = null;
  let currentRoomId: string | null = null;
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  const send = (socket: WebSocket, data: any) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  // Heartbeat every 15s to prevent Cloud Run proxy disconnects
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!isAlive) {
        console.log(`[WS] Heartbeat timeout for ${currentParticipantId || 'unjoined'}`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
      send(ws, { type: 'ping' });
    }
  }, 15000);

  const broadcastToRoom = (roomId: string, data: any, excludeId?: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const [peerId, participant] of room.participants.entries()) {
      if (excludeId && peerId === excludeId) continue;
      send(participant.ws, data);
    }
  };

  ws.on('message', (rawMessage: string) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      switch (msg.type) {
        case 'join': {
          const { roomId, participant } = msg;
          currentParticipantId = participant.id;
          currentRoomId = roomId;

          const room = getOrCreateRoom(roomId, msg.roomName);

          const newParticipant: Participant = {
            id: participant.id,
            ws,
            roomId,
            displayName: participant.displayName || 'Hermano(a)',
            role: participant.role || 'member',
            isCameraOn: !!participant.isCameraOn,
            isMicOn: !!participant.isMicOn,
            isScreenSharing: !!participant.isScreenSharing,
            isHandRaised: false,
            joinedAt: Date.now(),
          };

          room.participants.set(participant.id, newParticipant);
          console.log(`[SALA ${roomId}] Se unió: ${newParticipant.displayName} (${newParticipant.id}). Total conectados: ${room.participants.size}`);

          // Get existing live peers (excluding the joining one and dead sockets)
          const existingPeers = Array.from(room.participants.values())
            .filter((p) => p.id !== participant.id && p.ws.readyState === WebSocket.OPEN)
            .map((p) => ({
              id: p.id,
              displayName: p.displayName,
              role: p.role,
              isCameraOn: p.isCameraOn,
              isMicOn: p.isMicOn,
              isScreenSharing: p.isScreenSharing,
              isHandRaised: p.isHandRaised,
            }));

          // Send room state and server-managed ICE servers to the newly joined user
          send(ws, {
            type: 'room-state',
            roomId,
            roomName: room.name,
            peers: existingPeers,
            activeVerse: room.activeVerse,
            prayers: room.prayers,
            iceServers: getFullIceServers(),
          });

          // Broadcast to everyone else that a new peer joined
          broadcastToRoom(
            roomId,
            {
              type: 'peer-joined',
              peer: {
                id: newParticipant.id,
                displayName: newParticipant.displayName,
                role: newParticipant.role,
                isCameraOn: newParticipant.isCameraOn,
                isMicOn: newParticipant.isMicOn,
                isScreenSharing: newParticipant.isScreenSharing,
                isHandRaised: newParticipant.isHandRaised,
              },
            },
            participant.id
          );
          break;
        }

        // WebRTC Signaling: Offer, Answer, ICE Candidate
        case 'signal': {
          const { targetId, signal } = msg;
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) {
            console.warn(`[SEÑAL ERROR] Sala ${currentRoomId} no existe`);
            return;
          }

          const target = room.participants.get(targetId);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            const sigType = signal?.type || (signal?.candidate ? 'ice-candidate' : 'desconocido');
            console.log(`[SEÑAL] ${sigType} de ${currentParticipantId} -> ${targetId}`);
            send(target.ws, {
              type: 'signal',
              senderId: currentParticipantId,
              signal,
            });
          } else if (target) {
            console.warn(`[SEÑAL ERROR] Destinatario ${targetId} socket cerrado, limpiando`);
            room.participants.delete(targetId);
            broadcastToRoom(currentRoomId, { type: 'peer-left', peerId: targetId });
          } else {
            console.warn(`[SEÑAL ERROR] Destinatario ${targetId} no encontrado en sala ${currentRoomId}`);
          }
          break;
        }

        case 'user-update': {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const participant = room.participants.get(currentParticipantId);
          if (participant) {
            const allowed = ['isCameraOn', 'isMicOn', 'isScreenSharing', 'isHandRaised'] as const;
            const safe: Record<string, boolean> = {};
            for (const k of allowed) {
              if (typeof msg.update?.[k] === 'boolean') {
                safe[k] = msg.update[k];
              }
            }
            Object.assign(participant, safe);
            broadcastToRoom(
              currentRoomId,
              {
                type: 'user-updated',
                peerId: currentParticipantId,
                update: safe,
              },
              currentParticipantId
            );
          }
          break;
        }

        case 'chat': {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const participant = room.participants.get(currentParticipantId);

          const chatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            senderId: currentParticipantId,
            senderName: participant ? participant.displayName : 'Participante',
            senderRole: participant ? participant.role : 'member',
            text: msg.text,
            timestamp: Date.now(),
            isAnnouncement: !!msg.isAnnouncement,
          };

          broadcastToRoom(currentRoomId, {
            type: 'chat-broadcast',
            message: chatMessage,
          });
          break;
        }

        case 'reaction': {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const participant = room.participants.get(currentParticipantId);

          broadcastToRoom(currentRoomId, {
            type: 'reaction-broadcast',
            senderName: participant ? participant.displayName : 'Participante',
            emoji: msg.emoji,
            timestamp: Date.now(),
          });
          break;
        }

        case 'present-verse': {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const participant = room.participants.get(currentParticipantId);

          room.activeVerse = {
            reference: msg.reference,
            text: msg.text,
            presenterName: participant ? participant.displayName : 'Hermano(a)',
          };

          broadcastToRoom(currentRoomId, {
            type: 'verse-presented',
            activeVerse: room.activeVerse,
          });
          break;
        }

        case 'clear-verse': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          room.activeVerse = null;

          broadcastToRoom(currentRoomId, {
            type: 'verse-cleared',
          });
          break;
        }

        case 'prayer-request': {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const participant = room.participants.get(currentParticipantId);

          const newPrayer = {
            id: `prayer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            requesterName: participant ? participant.displayName : 'Hermano(a)',
            text: msg.text,
            timestamp: Date.now(),
            amenCount: 1,
          };

          room.prayers.unshift(newPrayer);
          if (room.prayers.length > 50) room.prayers.pop();

          broadcastToRoom(currentRoomId, {
            type: 'prayer-added',
            prayer: newPrayer,
          });
          break;
        }

        case 'amen-prayer': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const prayer = room.prayers.find((p) => p.id === msg.prayerId);
          if (prayer) {
            prayer.amenCount += 1;
            broadcastToRoom(currentRoomId, {
              type: 'prayer-amen-updated',
              prayerId: prayer.id,
              amenCount: prayer.amenCount,
            });
          }
          break;
        }

        case 'mute-participant': {
          // Moderator/Pastor control
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const target = room.participants.get(msg.targetId);
          if (target) {
            target.isMicOn = false;
            send(target.ws, {
              type: 'force-mute',
            });
            broadcastToRoom(currentRoomId, {
              type: 'user-updated',
              peerId: target.id,
              update: { isMicOn: false },
            });
          }
          break;
        }

        case 'pong': {
          isAlive = true;
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (currentRoomId && currentParticipantId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const current = room.participants.get(currentParticipantId);
        // Solo eliminar y emitir peer-left si el socket cerrado es efectivamente el socket activo actual
        if (current && current.ws === ws) {
          room.participants.delete(currentParticipantId);
          broadcastToRoom(currentRoomId, {
            type: 'peer-left',
            peerId: currentParticipantId,
          });

          if (room.participants.size === 0) {
            setTimeout(() => {
              const r = rooms.get(currentRoomId!);
              if (r && r.participants.size === 0) {
                rooms.delete(currentRoomId!);
              }
            }, 300000);
          }
        }
      }
    }
  });
});

// Configure Vite middleware in development or serve static in production
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
