import { GuestSession } from '../types';

const SESSION_KEY_PREFIX = 'gs_';

export function getGuestSession(appId: string): GuestSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${appId}`);
    if (!raw) return null;
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

export function createGuestSession(appId: string, guestName: string): GuestSession {
  const session: GuestSession = {
    guestId: crypto.randomUUID(),
    guestName: guestName.trim(),
    appId,
    createdAt: Date.now(),
  };
  localStorage.setItem(`${SESSION_KEY_PREFIX}${appId}`, JSON.stringify(session));
  return session;
}

export function clearGuestSession(appId: string): void {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${appId}`);
}
