import React, { useMemo } from 'react';
import { CheckSquare, Bug, UserRound, ChevronsUp, ChevronUp, Equal } from 'lucide-react';
import type { IssueData, GuestSuggestionData, ScreenData } from '../types';
import type { Timestamp } from '../firebase';

type UnifiedKind = 'issue' | 'guest';

interface UnifiedIssueRow {
  id: string;
  kind: UnifiedKind;
  displayKey: string;
  summary: string;
  status: 'Open' | 'Resolved';
  priority: 'Low' | 'Medium' | 'High';
  authorName: string;
  screenLabel: string;
  createdAt: Timestamp | undefined;
}

function toMillis(ts: Timestamp | undefined): number {
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

function priorityStoryPoints(p: 'Low' | 'Medium' | 'High'): number {
  switch (p) {
    case 'High':
      return 5;
    case 'Medium':
      return 3;
    default:
      return 1;
  }
}

function statusPill(status: 'Open' | 'Resolved') {
  if (status === 'Resolved') {
    return { label: 'RESOLVED', className: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  }
  return { label: 'OPEN', className: 'bg-blue-100 text-blue-800 ring-blue-200' };
}

function PriorityGlyph({ priority }: { priority: 'Low' | 'Medium' | 'High' }) {
  if (priority === 'High') {
    return <ChevronsUp className="h-4 w-4 text-red-600 shrink-0" aria-label="Alta prioridade" />;
  }
  if (priority === 'Medium') {
    return <ChevronUp className="h-4 w-4 text-red-500 shrink-0" aria-label="Média prioridade" />;
  }
  return <Equal className="h-4 w-4 text-amber-600 shrink-0" aria-label="Baixa prioridade" />;
}

interface IssuesJiraBacklogReportProps {
  issues: IssueData[];
  guestSuggestions: GuestSuggestionData[];
  screens: ScreenData[];
}

export default function IssuesJiraBacklogReport({
  issues,
  guestSuggestions,
  screens,
}: IssuesJiraBacklogReportProps) {
  const screenNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of screens) {
      m[s.id] = s.name || `Tela ${s.order + 1}`;
    }
    return m;
  }, [screens]);

  const rows = useMemo(() => {
    const list: Omit<UnifiedIssueRow, 'displayKey'>[] = [];

    for (const i of issues) {
      list.push({
        id: i.id,
        kind: 'issue',
        summary: i.text,
        status: i.status,
        priority: i.priority,
        authorName: i.authorName,
        screenLabel: screenNameById[i.screenId] ?? i.screenId.slice(0, 6),
        createdAt: i.createdAt,
      });
    }
    for (const g of guestSuggestions) {
      list.push({
        id: g.id,
        kind: 'guest',
        summary: g.text,
        status: g.status,
        priority: g.priority,
        authorName: g.guestName,
        screenLabel: screenNameById[g.screenId] ?? g.screenId.slice(0, 6),
        createdAt: g.createdAt,
      });
    }

    list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return list.map((r, index) => ({
      ...r,
      displayKey: `MT-${String(index + 1).padStart(3, '0')}`,
    })) as UnifiedIssueRow[];
  }, [issues, guestSuggestions, screenNameById]);

  const openCount = rows.filter((r) => r.status === 'Open').length;
  const resolvedCount = rows.filter((r) => r.status === 'Resolved').length;

  return (
    <div className="mt-10 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden ring-1 ring-slate-200/70">
      {/* Cabeçalho estilo sprint / Jira */}
      <div className="border-b border-slate-200 bg-slate-50/95 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Backlog de observações
              <span className="ml-2 font-normal text-slate-500">
                ({rows.length} {rows.length === 1 ? 'item' : 'itens'})
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-snug max-w-3xl">
              Issues da equipe e sugestões de convidados do protótipo, numeradas no formato MeetTrack (MT-xxx).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-700">
              {openCount} aberto{openCount !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-800">
              {resolvedCount} resolv.
            </span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          Nenhuma observação registrada neste app.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {rows.map((row) => {
            const st = statusPill(row.status);
            const points = priorityStoryPoints(row.priority);
            const isGuest = row.kind === 'guest';
            const isHigh = row.priority === 'High';

            return (
              <li
                key={`${row.kind}-${row.id}`}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 hover:bg-slate-50/90 transition-colors"
              >
                <div className="flex w-4 shrink-0 items-center justify-center pt-0.5" aria-hidden>
                  <span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
                </div>

                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                    isGuest
                      ? 'bg-amber-100 text-amber-700'
                      : isHigh
                        ? 'bg-red-50 text-red-600'
                        : 'bg-blue-600 text-white'
                  }`}
                  title={isGuest ? 'Sugestão de convidado' : 'Issue da equipe'}
                >
                  {isGuest ? (
                    <UserRound className="h-3.5 w-3.5" strokeWidth={2.2} />
                  ) : isHigh ? (
                    <Bug className="h-3.5 w-3.5" strokeWidth={2.2} />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" strokeWidth={2.2} />
                  )}
                </div>

                <span className="font-mono text-[11px] font-semibold text-[#0052CC] shrink-0 w-[4.25rem] sm:w-[4.5rem]">
                  {row.displayKey}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-2" title={row.summary}>
                    {row.summary}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Tela: {row.screenLabel} · {row.authorName}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex max-w-[7.5rem] truncate rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <span
                    className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded bg-slate-100 px-1.5 text-xs font-bold text-slate-700 tabular-nums ring-1 ring-slate-200/90"
                    title="Peso por prioridade (1 / 3 / 5)"
                  >
                    {points}
                  </span>
                  <PriorityGlyph priority={row.priority} />
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 ring-1 ring-slate-300/80"
                    title={row.authorName}
                  >
                    {row.authorName?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                </div>

                {/* Compacto em mobile: status + avatar */}
                <div className="flex sm:hidden flex-col items-end gap-1 shrink-0">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-600 tabular-nums">{points}</span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">
                      {row.authorName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
