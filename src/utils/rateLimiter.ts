const RL_KEY_PREFIX = 'rl_';
const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function getTimestamps(appId: string, windowMs: number): number[] {
  try {
    const raw = localStorage.getItem(`${RL_KEY_PREFIX}${appId}`);
    if (!raw) return [];
    const all = JSON.parse(raw) as number[];
    const now = Date.now();
    return all.filter((t) => now - t < windowMs);
  } catch {
    return [];
  }
}

export function checkRateLimit(
  appId: string,
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS
): boolean {
  return getTimestamps(appId, windowMs).length < max;
}

export function recordSubmission(
  appId: string,
  windowMs = DEFAULT_WINDOW_MS
): void {
  const timestamps = getTimestamps(appId, windowMs);
  timestamps.push(Date.now());
  localStorage.setItem(`${RL_KEY_PREFIX}${appId}`, JSON.stringify(timestamps));
}
