export type UserRole = 'pastor' | 'leader' | 'member' | 'musician' | 'guest';

export interface Participant {
  id: string;
  displayName: string;
  role: UserRole;
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  stream?: MediaStream | null;
  audioLevel?: number; // 0 to 100 for speaking indicator
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: number;
  isAnnouncement?: boolean;
}

export interface ActiveVerse {
  reference: string;
  text: string;
  presenterName: string;
}

export interface PrayerRequest {
  id: string;
  requesterName: string;
  text: string;
  timestamp: number;
  amenCount: number;
}

export interface Hymn {
  id: string;
  title: string;
  category: string;
  stanzas: string[];
  chorus?: string;
}

export interface FloatingReaction {
  id: string;
  senderName: string;
  emoji: string;
  x: number; // percentage 10-90
  timestamp: number;
}

export interface DeviceSetting {
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;
}
