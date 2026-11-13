/**
 * Returns the shareable URL for a meeting room.
 * Always preserves the exact live server origin where the call is running,
 * ensuring all participants connect to the exact same signaling server and room.
 */
export function getPublicMeetingUrl(roomId: string): string {
  let origin = '';

  try {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.origin && window.location.origin !== 'null') {
        origin = window.location.origin;
      } else if (window.location.href) {
        origin = window.location.href.split('?')[0].split('#')[0];
      }
    }
  } catch {
    // Fallback if window access fails
  }

  origin = origin.replace(/\/+$/, '');
  return `${origin}/?room=${encodeURIComponent(roomId)}`;
}

/**
 * Detects whether the current window is on an AI Studio preview proxy URL (ais-dev-* or ais-pre-*),
 * which Google gates behind an English cookie-check and Google account authentication wall.
 */
export function isPrivateAiStudioPreview(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;
      return host.startsWith('ais-dev-') || host.startsWith('ais-pre-');
    }
  } catch {
    // Ignore
  }
  return false;
}
