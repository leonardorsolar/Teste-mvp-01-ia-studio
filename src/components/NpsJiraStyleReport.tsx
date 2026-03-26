import React from 'react';
import type { NpsResponseData } from '../types';

function classificationStyle(c: NpsResponseData['classification']) {
  switch (c) {
    case 'detractor':
      return { label: 'DETRACTOR', pill: 'bg-rose-100 text-rose-800 ring-rose-200' };
    case 'neutral':
      return { label: 'NEUTRAL', pill: 'bg-slate-200 text-slate-700 ring-slate-300' };
    case 'promoter':
      return { label: 'PROMOTER', pill: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  }
}

interface NpsJiraStyleReportProps {
  responses: NpsResponseData[];
}

export default function NpsJiraStyleReport({ responses }: NpsJiraStyleReportProps) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden ring-1 ring-slate-200/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-100/90 border-b border-slate-200">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">
            Relatório NPS · MeetTrack
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'}
          </p>
        </div>
      </div>

      {responses.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-slate-500">Nenhuma avaliação NPS registrada ainda.</div>
      ) : (
        <ul className="divide-y divide-slate-200 bg-white">
          {responses.map((row, index) => {
            const meta = classificationStyle(row.classification);
            const key = `NPS-${String(index + 1).padStart(2, '0')}`;
            const dateStr =
              row.createdAt && typeof row.createdAt.toDate === 'function'
                ? row.createdAt.toDate().toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';
            const obsCount = row.issueIds?.length ?? 0;

            return (
              <li
                key={row.id}
                className="flex items-stretch gap-2 px-2 py-2 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex w-5 shrink-0 items-start justify-center pt-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded border border-slate-300 bg-white shadow-sm" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-semibold text-blue-700 shrink-0">{key}</span>
                    <span className="text-xs font-medium text-slate-800 truncate" title={row.userName}>
                      {row.userName}
                    </span>
                    {obsCount > 0 && (
                      <span className="text-[10px] text-slate-400 shrink-0">· {obsCount} obs.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ring-1 ${meta.pill}`}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-bold text-slate-700 tabular-nums ring-1 ring-slate-200"
                      title="Nota NPS (0–10)"
                    >
                      {row.score}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums hidden sm:inline">{dateStr}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 tabular-nums sm:hidden pr-0.5">{dateStr}</span>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
                    title={row.userName}
                  >
                    {row.userName?.charAt(0)?.toUpperCase() ?? '?'}
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
