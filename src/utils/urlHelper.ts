/**
 * Returns the shareable URL for a meeting room.
 * Uses the live dynamic browser origin where the app is currently running.
 * Converts internal developer sandbox URLs (ais-dev-*) into public shared URLs (ais-pre-*)
 * so guests, phones, and external browsers do NOT get stopped by Google's developer sign-in screen.
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

  // If running inside the developer sandbox (ais-dev-), automatically switch to the public shared URL (ais-pre-)
  // so external devices or browsers without the developer's Google login don't get redirected to accounts.google.com
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  origin = origin.replace(/\/+$/, '');
  return `${origin}/?room=${encodeURIComponent(roomId)}`;
}


