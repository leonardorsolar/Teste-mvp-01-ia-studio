import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  db,
  auth,
  doc,
  collection,
  query,
  onSnapshot,
  onAuthStateChanged,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import type { User } from '../firebase';
import type { AppData, NpsResponseData, IssueData, GuestSuggestionData, ScreenData } from '../types';
import NpsJiraStyleReport from '../components/NpsJiraStyleReport';
import IssuesJiraBacklogReport from '../components/IssuesJiraBacklogReport';
import jumpadLogoDark from '../assets/images/jumpad-logo-dark.svg';

function sortNpsByDateDesc(rows: NpsResponseData[]): NpsResponseData[] {
  return [...rows].sort((a, b) => {
    const ta =
      a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
    const tb =
      b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
}

export default function AppNpsReport() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppData | null>(null);
  const [npsResponses, setNpsResponses] = useState<NpsResponseData[]>([]);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestionData[]>([]);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!appId || authUser === undefined) return;

    const unsubApp = onSnapshot(doc(db, 'apps', appId), (snap) => {
      if (snap.exists()) {
        setApp({ id: snap.id, ...snap.data() } as AppData);
      }
    });

    if (!authUser) {
      setLoadError('Faça login (use o menu no início do app) para carregar o relatório NPS.');
      setNpsResponses([]);
      setIssues([]);
      setGuestSuggestions([]);
      setScreens([]);
      return () => {
        unsubApp();
      };
    }

    setLoadError(null);

    const unsubNps = onSnapshot(
      collection(db, `apps/${appId}/npsResponses`),
      (snapshot) => {
        setLoadError(null);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as NpsResponseData[];
        setNpsResponses(sortNpsByDateDesc(data));
      },
      (err) => {
        setLoadError(
          'Não foi possível carregar o NPS. Se você está logado, publique as regras do Firestore (firebase deploy --only firestore:rules).'
        );
        handleFirestoreError(err, OperationType.LIST, `apps/${appId}/npsResponses`, { rethrow: false });
      }
    );

    const unsubIssues = onSnapshot(
      collection(db, `apps/${appId}/issues`),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as IssueData[];
        setIssues(data);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `apps/${appId}/issues`, { rethrow: false })
    );

    const unsubGuests = onSnapshot(
      collection(db, `apps/${appId}/guestSuggestions`),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as GuestSuggestionData[];
        setGuestSuggestions(data);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `apps/${appId}/guestSuggestions`, { rethrow: false })
    );

    const qScreens = query(collection(db, `apps/${appId}/screens`));
    const unsubScreens = onSnapshot(
      qScreens,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ScreenData[];
        setScreens(data.sort((a, b) => a.order - b.order));
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `apps/${appId}/screens`, { rethrow: false })
    );

    return () => {
      unsubApp();
      unsubNps();
      unsubIssues();
      unsubGuests();
      unsubScreens();
    };
  }, [appId, authUser]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Ir para o início"
          >
            <img src={jumpadLogoDark} alt="Jumpad" className="h-7 w-auto object-contain" />
          </button>
          <div className="h-6 w-px bg-slate-200 shrink-0" />
          <h1 className="text-sm font-semibold text-slate-800 truncate">
            Relatório{app?.name ? ` · ${app.name}` : ''}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => (appId ? navigate(`/apps/${appId}/view`) : navigate(-1))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao protótipo
        </button>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        {authUser === undefined && (
          <p className="mb-4 text-sm text-slate-500">Verificando sessão…</p>
        )}
        {loadError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2"
          >
            <p>{loadError}</p>
            {!authUser && authUser !== undefined && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-sm font-semibold text-amber-950 underline underline-offset-2"
              >
                Ir para o início e entrar
              </button>
            )}
          </div>
        )}
        <NpsJiraStyleReport responses={npsResponses} />
        <IssuesJiraBacklogReport
          issues={issues}
          guestSuggestions={guestSuggestions}
          screens={screens}
        />
      </main>
    </div>
  );
}
