/** Tutorial de feedback na visualização (localStorage por app). */
const LEN = 3;

function storageKey(appId: string): string {
  return `jumpad:viewer-feedback-tutorial:${appId}`;
}

export function loadViewerFeedbackTutorialChecks(appId: string | undefined): boolean[] {
  if (!appId) return Array(LEN).fill(false);
  try {
    const raw = localStorage.getItem(storageKey(appId));
    if (!raw) return Array(LEN).fill(false);
    const o = JSON.parse(raw) as { checks?: unknown };
    if (!Array.isArray(o.checks) || o.checks.length !== LEN) {
      return Array(LEN).fill(false);
    }
    return o.checks.map((v) => Boolean(v));
  } catch {
    return Array(LEN).fill(false);
  }
}

export function saveViewerFeedbackTutorialChecks(appId: string | undefined, checks: boolean[]): void {
  if (!appId) return;
  if (checks.length !== LEN) return;
  try {
    localStorage.setItem(storageKey(appId), JSON.stringify({ checks }));
  } catch {
    /* ignore */
  }
}
