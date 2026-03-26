import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, auth, doc, collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, OperationType, handleFirestoreError } from '../firebase';
import { AppData, ScreenData, HotspotData, IssueData, GuestSuggestionData, GuestSession } from '../types';
import { getGuestSession, createGuestSession } from '../utils/guestSession';
import { sanitizeText, sanitizeName } from '../utils/sanitize';
import { checkRateLimit, recordSubmission } from '../utils/rateLimiter';
import GuestNameModal from '../components/GuestNameModal';
import { 
  ArrowLeft, 
  ChevronLeft,
  ChevronRight,
  Eye, 
  Info, 
  X, 
  AlertCircle,
  Clock,
  MessageSquare,
  ClipboardList,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jumpadLogoDark from '../assets/images/jumpad-logo-dark.svg';
import PublishSuccessModal from '../components/PublishSuccessModal';
import FeedbackThankYouModal from '../components/FeedbackThankYouModal';
import { markEditorTutorialPreviewDone } from '../utils/editorTutorialProgress';
import {
  loadViewerFeedbackTutorialChecks,
  saveViewerFeedbackTutorialChecks,
} from '../utils/viewerFeedbackTutorialProgress';

const VIEWER_FEEDBACK_TUTORIAL_STEPS = [
  'Dê um duplo clique em qualquer área do protótipo',
  'Registre a observação',
  'Repita a operação quantas vezes necessário',
] as const;

export default function AppViewer() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPublicFeedback = pathname.endsWith('/feedback');
  const [app, setApp] = useState<AppData | null>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [issues, setIssues] = useState<IssueData[]>([]);
  
  const [isFeedbackMode, setIsFeedbackMode] = useState(false);
  const [feedbackPos, setFeedbackPos] = useState<{ x: number, y: number } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackPriority, setFeedbackPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [showHint, setShowHint] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [publishSuccessOpen, setPublishSuccessOpen] = useState(false);
  const [feedbackCompleteOpen, setFeedbackCompleteOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editIssueText, setEditIssueText] = useState('');
  const [editIssuePriority, setEditIssuePriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [issueActionLoadingId, setIssueActionLoadingId] = useState<string | null>(null);
  const [issueDragLive, setIssueDragLive] = useState<{ issueId: string; x: number; y: number } | null>(null);
  const [feedbackTutorialChecks, setFeedbackTutorialChecks] = useState<boolean[]>(() =>
    Array(VIEWER_FEEDBACK_TUTORIAL_STEPS.length).fill(false)
  );
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [showGuestNameModal, setShowGuestNameModal] = useState(false);
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestionData[]>([]);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  const [sessionIssueIds, setSessionIssueIds] = useState<string[]>([]);

  const draggingIssueIdRef = useRef<string | null>(null);
  const issueDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const issueDragLiveRef = useRef<{ issueId: string; x: number; y: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const canManageIssue = useCallback(
    (issue: IssueData) => {
      const u = auth.currentUser;
      if (!u) return false;
      return issue.authorId === u.uid || app?.ownerId === u.uid;
    },
    [app?.ownerId]
  );

  useEffect(() => {
    if (appId && !isPublicFeedback) {
      markEditorTutorialPreviewDone(appId);
    }
  }, [appId, isPublicFeedback]);

  useEffect(() => {
    if (!isPublicFeedback || !appId) return;
    const session = getGuestSession(appId);
    if (session) {
      setGuestSession(session);
    } else {
      setShowGuestNameModal(true);
    }
  }, [isPublicFeedback, appId]);

  useEffect(() => {
    if (!appId) {
      setFeedbackTutorialChecks(Array(VIEWER_FEEDBACK_TUTORIAL_STEPS.length).fill(false));
      return;
    }
    setFeedbackTutorialChecks(loadViewerFeedbackTutorialChecks(appId));
  }, [appId]);

  useEffect(() => {
    if (!appId) return;
    const stored = loadViewerFeedbackTutorialChecks(appId);
    const next = [...stored];
    const submissionCount = isPublicFeedback ? guestSuggestions.length : issues.length;
    next[0] = stored[0] || Boolean(isFeedbackMode && feedbackPos);
    next[1] = stored[1] || submissionCount >= 1;
    next[2] = stored[2] || submissionCount >= 2;
    const changed = next.some((v, i) => v !== stored[i]);
    if (changed) {
      saveViewerFeedbackTutorialChecks(appId, next);
    }
    setFeedbackTutorialChecks((prev) => (next.every((v, i) => v === prev[i]) ? prev : next));
  }, [appId, isFeedbackMode, feedbackPos, issues.length, guestSuggestions.length, isPublicFeedback]);

  useEffect(() => {
    if (appId) {
      const unsubscribeApp = onSnapshot(doc(db, 'apps', appId), (doc) => {
        if (doc.exists()) {
          setApp({ id: doc.id, ...doc.data() } as AppData);
        }
      });

      const qScreens = query(collection(db, `apps/${appId}/screens`));
      const unsubscribeScreens = onSnapshot(qScreens, (snapshot) => {
        const screensData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScreenData[];
        const sorted = screensData.sort((a, b) => a.order - b.order);
        setScreens(sorted);
        if (sorted.length > 0 && !currentScreenId) {
          setCurrentScreenId(sorted[0].id);
        }
      });

      let unsubscribeIssues = () => {};
      let unsubscribeGuestSuggestions = () => {};

      if (!isPublicFeedback) {
        // Modo admin: carrega issues autenticadas
        const qIssues = query(collection(db, `apps/${appId}/issues`));
        unsubscribeIssues = onSnapshot(qIssues, (snapshot) => {
          const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IssueData[];
          setIssues(issuesData);
        });

        // Modo admin: carrega também as sugestões de convidados
        const qGuest = query(collection(db, `apps/${appId}/guestSuggestions`));
        unsubscribeGuestSuggestions = onSnapshot(qGuest, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GuestSuggestionData[];
          setGuestSuggestions(data);
        });
      }
      // Modo guest: sem subscriptions (issues exigem auth; guestSuggestions ficam em estado local)

      return () => {
        unsubscribeApp();
        unsubscribeScreens();
        unsubscribeIssues();
        unsubscribeGuestSuggestions();
      };
    }
  }, [appId, isPublicFeedback]);

  useEffect(() => {
    if (!isPublicFeedback || !appId || !app) return;
    if (app.status !== 'Published') {
      navigate(`/apps/${appId}/edit`, { replace: true });
    }
  }, [isPublicFeedback, appId, app, navigate]);

  useEffect(() => {
    if (appId && currentScreenId) {
      const qHotspots = query(collection(db, `apps/${appId}/screens/${currentScreenId}/hotspots`));
      const unsubscribeHotspots = onSnapshot(qHotspots, (snapshot) => {
        const hotspotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HotspotData[];
        setHotspots(hotspotsData);
      });
      return () => unsubscribeHotspots();
    }
  }, [appId, currentScreenId]);

  const handleHotspotClick = (targetId: string) => {
    if (targetId) {
      setCurrentScreenId(targetId);
    }
  };

  const currentScreenIndex = screens.findIndex((s) => s.id === currentScreenId);
  const canGoToPrevScreen = currentScreenIndex > 0;
  const canGoToNextScreen =
    currentScreenIndex >= 0 && currentScreenIndex < screens.length - 1;

  const goToPrevScreen = () => {
    if (!canGoToPrevScreen) return;
    setCurrentScreenId(screens[currentScreenIndex - 1].id);
  };

  const goToNextScreen = () => {
    if (!canGoToNextScreen) return;
    setCurrentScreenId(screens[currentScreenIndex + 1].id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFeedbackPos({ x, y });
    setIsFeedbackMode(true);
  };

  const handlePublish = async () => {
    if (!appId || isPublishing) return;
    setIsPublishing(true);
    try {
      await updateDoc(doc(db, 'apps', appId), { status: 'Published' });
      setPublishSuccessOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'apps');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveIssue = async () => {
    if (!appId || !currentScreenId || !feedbackPos || !feedbackText || !auth.currentUser) return;
    
    try {
      const docRef = await addDoc(collection(db, `apps/${appId}/issues`), {
        appId,
        screenId: currentScreenId,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Usuário',
        text: feedbackText,
        x: feedbackPos.x,
        y: feedbackPos.y,
        createdAt: serverTimestamp(),
        priority: feedbackPriority,
        status: 'Open'
      });
      setSessionIssueIds((prev) => [...prev, docRef.id]);
      setIsFeedbackMode(false);
      setFeedbackText('');
      setFeedbackPos(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'issues');
    }
  };

  const handleSaveGuestSuggestion = async () => {
    if (!appId || !currentScreenId || !feedbackPos || !feedbackText || !guestSession) return;

    if (!checkRateLimit(appId)) {
      setRateLimitWarning(true);
      setTimeout(() => setRateLimitWarning(false), 5000);
      return;
    }

    const cleanText = sanitizeText(feedbackText);
    const cleanName = sanitizeName(guestSession.guestName);

    try {
      const docRef = await addDoc(collection(db, `apps/${appId}/guestSuggestions`), {
        appId,
        screenId: currentScreenId,
        guestId: guestSession.guestId,
        guestName: cleanName,
        text: cleanText,
        x: feedbackPos.x,
        y: feedbackPos.y,
        createdAt: serverTimestamp(),
        priority: feedbackPriority,
        status: 'Open',
        source: 'guest',
      });

      recordSubmission(appId);
      setSessionIssueIds((prev) => [...prev, docRef.id]);

      // Adiciona ao estado local (guest não pode ler de volta do Firestore)
      setGuestSuggestions((prev) => [
        ...prev,
        {
          id: docRef.id,
          appId,
          screenId: currentScreenId,
          guestId: guestSession.guestId,
          guestName: cleanName,
          text: cleanText,
          x: feedbackPos.x,
          y: feedbackPos.y,
          createdAt: Timestamp.now(),
          priority: feedbackPriority,
          status: 'Open',
          source: 'guest',
        },
      ]);

      setIsFeedbackMode(false);
      setFeedbackText('');
      setFeedbackPos(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'guestSuggestions');
    }
  };

  const handleDeleteGuestSuggestion = async (suggestionId: string) => {
    if (!appId) return;
    if (!window.confirm('Excluir esta sugestão de convidado permanentemente?')) return;
    setIssueActionLoadingId(suggestionId);
    try {
      await deleteDoc(doc(db, `apps/${appId}/guestSuggestions`, suggestionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'guestSuggestions');
    } finally {
      setIssueActionLoadingId(null);
    }
  };

  const handleToggleGuestSuggestionStatus = async (suggestion: GuestSuggestionData) => {
    if (!appId) return;
    setIssueActionLoadingId(suggestion.id);
    try {
      await updateDoc(doc(db, `apps/${appId}/guestSuggestions`, suggestion.id), {
        status: suggestion.status === 'Open' ? 'Resolved' : 'Open',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'guestSuggestions');
    } finally {
      setIssueActionLoadingId(null);
    }
  };

  const startEditIssue = (issue: IssueData) => {
    setEditingIssueId(issue.id);
    setEditIssueText(issue.text);
    setEditIssuePriority(issue.priority);
  };

  const cancelEditIssue = () => {
    setEditingIssueId(null);
    setEditIssueText('');
  };

  const handleUpdateIssue = async (issueId: string) => {
    if (!appId || !editIssueText.trim()) return;
    setIssueActionLoadingId(issueId);
    try {
      await updateDoc(doc(db, `apps/${appId}/issues`, issueId), {
        text: editIssueText.trim(),
        priority: editIssuePriority,
      });
      cancelEditIssue();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'issues');
    } finally {
      setIssueActionLoadingId(null);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!appId) return;
    if (!window.confirm('Excluir este feedback permanentemente?')) return;
    setIssueActionLoadingId(issueId);
    try {
      await deleteDoc(doc(db, `apps/${appId}/issues`, issueId));
      if (editingIssueId === issueId) cancelEditIssue();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'issues');
    } finally {
      setIssueActionLoadingId(null);
    }
  };

  const pointToPercent = (rect: DOMRect, clientX: number, clientY: number) => {
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleIssueMarkerPointerDown = (e: React.PointerEvent<HTMLDivElement>, issue: IssueData) => {
    if (!canManageIssue(issue) || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const viewport = el.closest('[data-prototype-viewport]');
    if (!viewport) return;
    el.setPointerCapture(e.pointerId);
    draggingIssueIdRef.current = issue.id;
    issueDragStartRef.current = { x: issue.x, y: issue.y };
    issueDragLiveRef.current = { issueId: issue.id, x: issue.x, y: issue.y };
  };

  const handleIssueMarkerPointerMove = (e: React.PointerEvent<HTMLDivElement>, issue: IssueData) => {
    if (draggingIssueIdRef.current !== issue.id) return;
    e.preventDefault();
    const viewport = e.currentTarget.closest('[data-prototype-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const p = pointToPercent(rect, e.clientX, e.clientY);
    issueDragLiveRef.current = { issueId: issue.id, ...p };
    setIssueDragLive({ issueId: issue.id, ...p });
  };

  const finishIssueMarkerDrag = (e: React.PointerEvent<HTMLDivElement>, issue: IssueData) => {
    if (draggingIssueIdRef.current !== issue.id) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
    draggingIssueIdRef.current = null;
    const start = issueDragStartRef.current;
    const final = issueDragLiveRef.current;
    issueDragStartRef.current = null;
    issueDragLiveRef.current = null;
    setIssueDragLive(null);

    if (!appId || !final || !start) return;
    const moved =
      Math.abs(final.x - start.x) > 0.25 || Math.abs(final.y - start.y) > 0.25;
    if (!moved) return;

    void (async () => {
      try {
        await updateDoc(doc(db, `apps/${appId}/issues`, issue.id), { x: final.x, y: final.y });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'issues');
      }
    })();
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const currentScreen = screens.find(s => s.id === currentScreenId);
  const screenIssues = issues.filter(i => i.screenId === currentScreenId);
  const screenGuestSuggestions = guestSuggestions.filter(
    (s) =>
      s.screenId === currentScreenId &&
      (isPublicFeedback ? s.guestId === guestSession?.guestId : true)
  );

  const renderScreenIssueMarkers = () =>
    screenIssues.map((issue) => {
      const live = issueDragLive?.issueId === issue.id ? issueDragLive : null;
      const lx = live ? live.x : issue.x;
      const ly = live ? live.y : issue.y;
      const draggable = canManageIssue(issue);
      const priorityLabel =
        issue.priority === 'High'
          ? 'Alta Prioridade'
          : issue.priority === 'Medium'
            ? 'Prioridade Média'
            : 'Sugestão';
      const badgeClass =
        issue.priority === 'High'
          ? 'bg-red-50 text-red-600'
          : issue.priority === 'Medium'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-slate-50 text-slate-500';
      return (
        <div
          key={issue.id}
          className={`group/issue-marker absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white z-10 touch-none select-none ${
            issue.priority === 'High' ? 'bg-red-500' : issue.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-500'
          } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} hover:z-[60]`}
          style={{ left: `${lx}%`, top: `${ly}%` }}
          aria-label={`${priorityLabel}: ${issue.text}. Relatado por ${issue.authorName}.${draggable ? ' Segure e arraste para mover o marcador.' : ''}`}
          onPointerDown={draggable ? (e) => handleIssueMarkerPointerDown(e, issue) : undefined}
          onPointerMove={draggable ? (e) => handleIssueMarkerPointerMove(e, issue) : undefined}
          onPointerUp={draggable ? (e) => finishIssueMarkerDrag(e, issue) : undefined}
          onPointerCancel={draggable ? (e) => finishIssueMarkerDrag(e, issue) : undefined}
        >
          !
          <div
            className="absolute left-1/2 bottom-[calc(100%+10px)] z-[100] w-max min-w-[200px] max-w-[min(280px,calc(100vw-3rem))] -translate-x-1/2 pointer-events-none opacity-0 translate-y-1 scale-[0.97] transition-all duration-200 ease-out group-hover/issue-marker:opacity-100 group-hover/issue-marker:translate-y-0 group-hover/issue-marker:scale-100"
            role="tooltip"
          >
            <div className="relative rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-3 text-left shadow-[0_14px_44px_-10px_rgba(15,23,42,0.28)] backdrop-blur-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${badgeClass}`}>
                  {priorityLabel}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-slate-400">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  {issue.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <p className="custom-scroll mb-2.5 max-h-28 overflow-y-auto pr-0.5 text-xs font-medium leading-snug text-slate-800">
                {issue.text}
              </p>
              <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                  {issue.authorName.charAt(0)}
                </div>
                <span className="text-[10px] leading-tight text-slate-500">Relatado por {issue.authorName}</span>
              </div>
              {draggable && (
                <p className="mt-2 border-t border-slate-50 pt-2 text-[9px] italic text-slate-400">Segure e arraste para mover</p>
              )}
              <div
                className="absolute left-1/2 top-full -mt-px h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-200/90 bg-white/95 shadow-[2px_2px_4px_-2px_rgba(15,23,42,0.08)] backdrop-blur-md"
                aria-hidden
              />
            </div>
          </div>
        </div>
      );
    });

  const renderGuestSuggestionMarkers = () =>
    screenGuestSuggestions.map((suggestion) => {
      const priorityLabel =
        suggestion.priority === 'High'
          ? 'Alta Prioridade'
          : suggestion.priority === 'Medium'
            ? 'Prioridade Média'
            : 'Sugestão';
      return (
        <div
          key={suggestion.id}
          className={`group/gs-marker absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white z-10 select-none hover:z-[60] ${
            suggestion.priority === 'High'
              ? 'bg-orange-500'
              : suggestion.priority === 'Medium'
                ? 'bg-amber-500'
                : 'bg-amber-400'
          }`}
          style={{ left: `${suggestion.x}%`, top: `${suggestion.y}%` }}
          aria-label={`Convidado · ${priorityLabel}: ${suggestion.text}. Por ${suggestion.guestName}.`}
        >
          ?
          <div
            className="absolute left-1/2 bottom-[calc(100%+10px)] z-[100] w-max min-w-[200px] max-w-[min(280px,calc(100vw-3rem))] -translate-x-1/2 pointer-events-none opacity-0 translate-y-1 scale-[0.97] transition-all duration-200 ease-out group-hover/gs-marker:opacity-100 group-hover/gs-marker:translate-y-0 group-hover/gs-marker:scale-100"
            role="tooltip"
          >
            <div className="relative rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-3 text-left shadow-[0_14px_44px_-10px_rgba(15,23,42,0.28)] backdrop-blur-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter bg-amber-50 text-amber-700">
                  Convidado · {priorityLabel}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-slate-400">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  {suggestion.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <p className="custom-scroll mb-2.5 max-h-28 overflow-y-auto pr-0.5 text-xs font-medium leading-snug text-slate-800">
                {suggestion.text}
              </p>
              <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                  {suggestion.guestName.charAt(0)}
                </div>
                <span className="text-[10px] leading-tight text-slate-500">
                  Por {suggestion.guestName}
                </span>
              </div>
              <div
                className="absolute left-1/2 top-full -mt-px h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-200/90 bg-white/95 shadow-[2px_2px_4px_-2px_rgba(15,23,42,0.08)] backdrop-blur-md"
                aria-hidden
              />
            </div>
          </div>
        </div>
      );
    });

  return (
    <div ref={viewerRef} className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Ir para o início"
          >
            <img src={jumpadLogoDark} alt="Jumpad" className="h-7 w-auto object-contain" />
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <span className="text-sm font-medium text-slate-500">{app?.name} — {app?.version}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 px-4 py-2 rounded-full gap-2 text-slate-500">
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">
              {isPublicFeedback ? 'Envie suas observações' : 'Modo de Teste Ativo'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goToPrevScreen}
              disabled={!canGoToPrevScreen}
              title="Tela anterior (ordem do fluxo)"
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="text-xs">Retornar</span>
            </button>
            <button
              type="button"
              onClick={goToNextScreen}
              disabled={!canGoToNextScreen}
              title="Próxima tela (ordem do fluxo)"
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="text-xs">Avançar</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair do Fullscreen' : 'Tela Cheia'}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="text-xs">{isFullscreen ? 'Sair' : 'Fullscreen'}</span>
          </button>
          {!isPublicFeedback && (
            <button 
              onClick={() => appId && navigate(`/apps/${appId}/edit`)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Retornar para edição
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex relative overflow-hidden">
        {/* Prototype Viewer */}
        <section className={`flex-1 bg-slate-950 relative overflow-hidden flex ${
          currentScreen?.device === 'desktop'
            ? 'flex-col p-3'
            : 'flex-col items-center justify-center p-8'
        }`}>
          {currentScreen?.device === 'desktop' ? (
            /* ── Desktop / Browser Frame ── */
            <div className="relative flex-1 bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700 min-h-0">
              {/* Browser chrome */}
              <div className="h-10 bg-slate-700 flex items-center px-4 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="flex-1 mx-4 bg-slate-600 rounded-md h-6 flex items-center px-3">
                  <span className="text-[11px] text-slate-300 truncate">{app?.name || 'Protótipo'}</span>
                </div>
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Sair do Fullscreen' : 'Tela Cheia'}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Screen Content */}
              <div
                data-prototype-viewport
                className="relative cursor-pointer flex-1 min-h-0"
                onDoubleClick={handleDoubleClick}
              >
                {currentScreen ? (
                  <img
                    src={currentScreen.imageUrl}
                    alt={currentScreen.name}
                    className="w-full h-full object-contain bg-white"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                    <p className="text-slate-400 text-sm">Carregando tela...</p>
                  </div>
                )}

                {/* Hotspots */}
                {hotspots.map((hotspot) => (
                  <div
                    key={hotspot.id}
                    onClick={() => handleHotspotClick(hotspot.targetScreenId)}
                    className="absolute cursor-pointer hover:bg-blue-500/10 transition-colors"
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`
                    }}
                  >
                    <div className="w-full h-full border-2 border-transparent hover:border-blue-500/40 rounded-lg"></div>
                  </div>
                ))}

                {/* Issue Markers (admin only) */}
                {!isPublicFeedback && renderScreenIssueMarkers()}

                {/* Guest Suggestion Markers */}
                {renderGuestSuggestionMarkers()}

                {/* Feedback Popover */}
                <AnimatePresence>
                  {isFeedbackMode && feedbackPos && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bg-white rounded-xl shadow-2xl p-4 border border-blue-100 z-50 w-64"
                      style={{
                        left: `${Math.min(feedbackPos.x, 80)}%`,
                        top: `${Math.min(feedbackPos.y, 80)}%`
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Novo Feedback</span>
                      </div>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
                        className="w-full bg-slate-50 border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 min-h-20 resize-none"
                        placeholder="Descreva sua observação..."
                        maxLength={500}
                      />
                      <div className="flex items-center gap-2 mt-3">
                        <select
                          value={feedbackPriority}
                          onChange={(e) => setFeedbackPriority(e.target.value as any)}
                          className="flex-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold py-1.5 focus:ring-1 focus:ring-blue-600"
                        >
                          <option value="Low">Baixa</option>
                          <option value="Medium">Média</option>
                          <option value="High">Alta</option>
                        </select>
                      </div>
                      <div className="flex justify-end mt-3 gap-2">
                        <button
                          onClick={() => setIsFeedbackMode(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={isPublicFeedback ? handleSaveGuestSuggestion : handleSaveIssue}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm active:scale-95 transition-transform"
                        >
                          Salvar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* ── Mobile Phone Frame ── */
            <div className="relative w-85 h-170 bg-slate-900 rounded-[3rem] p-3 border-8 border-slate-800 shadow-2xl flex flex-col overflow-hidden">
              <div className="relative flex-1 bg-white rounded-[2.2rem] overflow-hidden flex flex-col">
                {/* Status Bar */}
                <div className="h-8 w-full flex justify-between items-center px-6 pt-2">
                  <span className="text-[10px] font-bold">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                  </div>
                </div>

                {/* Screen Content */}
                <div
                  data-prototype-viewport
                  className="flex-1 relative cursor-pointer"
                  onDoubleClick={handleDoubleClick}
                >
                  {currentScreen ? (
                    <img
                      src={currentScreen.imageUrl}
                      alt={currentScreen.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                      <p className="text-slate-400 text-sm">Carregando tela...</p>
                    </div>
                  )}

                  {/* Hotspots */}
                  {hotspots.map((hotspot) => (
                    <div
                      key={hotspot.id}
                      onClick={() => handleHotspotClick(hotspot.targetScreenId)}
                      className="absolute cursor-pointer hover:bg-blue-500/10 transition-colors"
                      style={{
                        left: `${hotspot.x}%`,
                        top: `${hotspot.y}%`,
                        width: `${hotspot.width}%`,
                        height: `${hotspot.height}%`
                      }}
                    >
                      <div className="w-full h-full border-2 border-transparent hover:border-blue-500/40 rounded-lg"></div>
                    </div>
                  ))}

                  {/* Issue Markers (admin only) */}
                  {!isPublicFeedback && renderScreenIssueMarkers()}

                  {/* Guest Suggestion Markers */}
                  {renderGuestSuggestionMarkers()}

                  {/* Feedback Popover */}
                  <AnimatePresence>
                    {isFeedbackMode && feedbackPos && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bg-white rounded-xl shadow-2xl p-4 border border-blue-100 z-50 w-64"
                        style={{
                          left: `${Math.min(feedbackPos.x, 80)}%`,
                          top: `${Math.min(feedbackPos.y, 80)}%`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Novo Feedback</span>
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
                          className="w-full bg-slate-50 border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 min-h-20 resize-none"
                          placeholder="Descreva sua observação..."
                          maxLength={500}
                        />
                        <div className="flex items-center gap-2 mt-3">
                          <select
                            value={feedbackPriority}
                            onChange={(e) => setFeedbackPriority(e.target.value as any)}
                            className="flex-1 bg-slate-50 border-none rounded-lg text-[10px] font-bold py-1.5 focus:ring-1 focus:ring-blue-600"
                          >
                            <option value="Low">Baixa</option>
                            <option value="Medium">Média</option>
                            <option value="High">Alta</option>
                          </select>
                        </div>
                        <div className="flex justify-end mt-3 gap-2">
                          <button
                            onClick={() => setIsFeedbackMode(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={isPublicFeedback ? handleSaveGuestSuggestion : handleSaveIssue}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm active:scale-95 transition-transform"
                          >
                            Salvar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bottom Indicator */}
                <div className="h-6 w-full flex justify-center items-center">
                  <div className="w-28 h-1 bg-slate-200 rounded-full"></div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Drawer */}
        <aside className="w-80 min-h-0 h-full bg-white flex flex-col border-l border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-slate-900">
                {isPublicFeedback ? 'Suas Observações' : 'Observações'}
              </h2>
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {(isPublicFeedback
                  ? screenGuestSuggestions.length
                  : screenIssues.length + screenGuestSuggestions.length
                ).toString().padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isPublicFeedback
                ? `Olá, ${guestSession?.guestName ?? ''}! Dê duplo clique para registrar.`
                : 'Issues e sugestões de convidados desta tela'}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
            {/* Issues autenticadas (apenas admin) */}
            {!isPublicFeedback && screenIssues.map((issue) => {
              const isEditing = editingIssueId === issue.id;
              const loading = issueActionLoadingId === issue.id;
              const showActions = canManageIssue(issue);
              return (
                <div
                  key={issue.id}
                  className={`bg-white p-4 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow ${
                    issue.priority === 'High' ? 'border-red-500' : issue.priority === 'Medium' ? 'border-blue-500' : 'border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    {!isEditing ? (
                      <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded ${
                        issue.priority === 'High' ? 'bg-red-50 text-red-600' : issue.priority === 'Medium' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {issue.priority === 'High' ? 'Alta Prioridade' : issue.priority === 'Medium' ? 'Prioridade Média' : 'Sugestão'}
                      </span>
                    ) : (
                      <select
                        value={editIssuePriority}
                        onChange={(e) => setEditIssuePriority(e.target.value as 'Low' | 'Medium' | 'High')}
                        className="flex-1 max-w-[140px] bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold py-1.5 px-2 focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Low">Baixa</option>
                        <option value="Medium">Média</option>
                        <option value="High">Alta</option>
                      </select>
                    )}
                    <span className="text-[10px] text-slate-400 shrink-0">
                      <Clock className="w-2 h-2 inline mr-1" />
                      {issue.createdAt?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editIssueText}
                      onChange={(e) => setEditIssueText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm p-3 focus:ring-1 focus:ring-blue-600 min-h-20 resize-none mb-3"
                      placeholder="Descreva o problema..."
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-800 mb-2">{issue.text}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                        {issue.authorName.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">Por {issue.authorName}</span>
                    </div>
                    {showActions && !isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => startEditIssue(issue)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleDeleteIssue(issue.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Deletar
                        </button>
                      </div>
                    )}
                    {showActions && isEditing && (
                      <div className="flex items-center gap-2 w-full justify-end mt-1">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={cancelEditIssue}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={loading || !editIssueText.trim()}
                          onClick={() => void handleUpdateIssue(issue.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loading ? 'Salvando…' : 'Salvar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Sugestões de convidados */}
            {screenGuestSuggestions.map((suggestion) => {
              const loading = issueActionLoadingId === suggestion.id;
              return (
                <div
                  key={suggestion.id}
                  className={`bg-white p-4 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow ${
                    suggestion.priority === 'High'
                      ? 'border-orange-400'
                      : suggestion.priority === 'Medium'
                        ? 'border-amber-400'
                        : 'border-amber-300'
                  } ${suggestion.status === 'Resolved' ? 'opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                        Convidado
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded ${
                        suggestion.priority === 'High'
                          ? 'bg-red-50 text-red-600'
                          : suggestion.priority === 'Medium'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-50 text-slate-500'
                      }`}>
                        {suggestion.priority === 'High' ? 'Alta' : suggestion.priority === 'Medium' ? 'Média' : 'Baixa'}
                      </span>
                      {suggestion.status === 'Resolved' && (
                        <span className="text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          Resolvido
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      <Clock className="w-2 h-2 inline mr-1" />
                      {suggestion.createdAt?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mb-2">{suggestion.text}</p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                        {suggestion.guestName.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">{suggestion.guestName}</span>
                    </div>
                    {!isPublicFeedback && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleToggleGuestSuggestionStatus(suggestion)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {suggestion.status === 'Open' ? 'Resolver' : 'Reabrir'}
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleDeleteGuestSuggestion(suggestion.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Deletar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Estado vazio */}
            {(isPublicFeedback ? screenGuestSuggestions.length === 0 : screenIssues.length + screenGuestSuggestions.length === 0) && (
              <div className="flex flex-col items-center justify-center min-h-[120px] text-slate-400 text-center p-8">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">
                  {isPublicFeedback
                    ? 'Nenhuma observação ainda. Dê duplo clique no protótipo!'
                    : 'Nenhum feedback registrado para esta tela.'}
                </p>
              </div>
            )}

          </div>

          {/* Tutorial (apenas no modo guest) */}
          {isPublicFeedback && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Como usar
              </h3>
              <ul className="space-y-2">
                {VIEWER_FEEDBACK_TUTORIAL_STEPS.map((text, i) => {
                  const done = feedbackTutorialChecks[i];
                  return (
                    <li key={i} className="flex gap-2.5 items-start">
                      <span
                        className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          done ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {done && <Check className="w-2.5 h-2.5 text-white stroke-3" />}
                      </span>
                      <span
                        className={`text-[11px] leading-snug ${
                          done ? 'text-slate-500 line-through' : 'text-slate-700'
                        }`}
                      >
                        <span className="font-semibold text-slate-600 tabular-nums">{i + 1}.</span> {text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {isPublicFeedback ? (
            <div className="shrink-0 border-t border-slate-200 p-4 bg-white">
              <button
                type="button"
                onClick={() => setFeedbackCompleteOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all"
              >
                Finalizar
              </button>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-200 p-4 bg-white space-y-2">
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                {isPublishing ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    Publicando…
                  </>
                ) : (
                  'Publicar'
                )}
              </button>
              <button
                type="button"
                onClick={() => appId && navigate(`/apps/${appId}/report`)}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                <ClipboardList className="h-4 w-4 shrink-0 opacity-80" />
                Relatório
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Modal de nome do convidado (bloqueante) */}
      {showGuestNameModal && (
        <GuestNameModal
          appName={app?.name}
          onConfirm={(name) => {
            if (!appId) return;
            const session = createGuestSession(appId, name);
            setGuestSession(session);
            setShowGuestNameModal(false);
          }}
        />
      )}

      {/* Aviso de rate limit */}
      <AnimatePresence>
        {rateLimitWarning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium"
          >
            Limite de observações atingido. Tente novamente em 1 hora.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint Overlay */}
      <AnimatePresence>
        {showHint && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed bottom-6 left-6 z-50 max-w-xs bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex gap-3 items-start border border-white/10"
          >
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold mb-1">Dica de Navegação</p>
              <p className="text-[11px] opacity-80 leading-relaxed">Dê um duplo clique em qualquer área do protótipo para abrir um marcador de feedback e registrar uma nova observação (issue).</p>
            </div>
            <button onClick={() => setShowHint(false)} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <PublishSuccessModal
        isOpen={publishSuccessOpen}
        appName={app?.name}
        onClose={() => setPublishSuccessOpen(false)}
        onGoHome={() => {
          setPublishSuccessOpen(false);
          navigate('/');
        }}
      />

      <FeedbackThankYouModal
        isOpen={feedbackCompleteOpen}
        appName={app?.name}
        appId={appId}
        userName={guestSession?.guestName ?? auth.currentUser?.displayName ?? 'Anônimo'}
        sessionIssueIds={sessionIssueIds}
        onClose={() => setFeedbackCompleteOpen(false)}
      />
    </div>
  );
}
