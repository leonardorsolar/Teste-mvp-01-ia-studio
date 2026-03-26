/** Progresso do tutorial do editor (localStorage por app). */
const LEN = 5;

export function editorTutorialStorageKey(appId: string): string {
  return `jumpad:editor-tutorial:${appId}`;
}

export function loadEditorTutorialChecks(appId: string | undefined): boolean[] {
  if (!appId || appId === 'new') return Array(LEN).fill(false);
  try {
    const raw = localStorage.getItem(editorTutorialStorageKey(appId));
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

export function saveEditorTutorialChecks(appId: string | undefined, checks: boolean[]): void {
  if (!appId || appId === 'new') return;
  if (checks.length !== LEN) return;
  try {
    localStorage.setItem(editorTutorialStorageKey(appId), JSON.stringify({ checks }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Marca o passo "Visualização" como concluído (botão ou abertura do viewer). */
export function markEditorTutorialPreviewDone(appId: string | undefined): void {
  if (!appId || appId === 'new') return;
  const checks = loadEditorTutorialChecks(appId);
  if (checks[4]) return;
  const next = [...checks];
  next[4] = true;
  saveEditorTutorialChecks(appId, next);
}
