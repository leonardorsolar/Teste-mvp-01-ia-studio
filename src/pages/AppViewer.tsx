import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth, doc, getDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp, OperationType, handleFirestoreError } from '../firebase';
import { AppData, ScreenData, HotspotData, IssueData } from '../types';
import { 
  ArrowLeft, 
  Eye, 
  Info, 
  X, 
  AlertCircle,
  Clock,
  MessageSquare,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jumpadLogoDark from '../assets/images/jumpad-logo-dark.svg';

export default function AppViewer() {
  const { appId } = useParams();
  const navigate = useNavigate();
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
  const viewerRef = useRef<HTMLDivElement>(null);

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

      const qIssues = query(collection(db, `apps/${appId}/issues`));
      const unsubscribeIssues = onSnapshot(qIssues, (snapshot) => {
        const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IssueData[];
        setIssues(issuesData);
      });

      return () => {
        unsubscribeApp();
        unsubscribeScreens();
        unsubscribeIssues();
      };
    }
  }, [appId]);

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFeedbackPos({ x, y });
    setIsFeedbackMode(true);
  };

  const handleSaveIssue = async () => {
    if (!appId || !currentScreenId || !feedbackPos || !feedbackText || !auth.currentUser) return;
    
    try {
      await addDoc(collection(db, `apps/${appId}/issues`), {
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
      setIsFeedbackMode(false);
      setFeedbackText('');
      setFeedbackPos(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'issues');
    }
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
            <span className="text-xs font-medium">Modo de Teste Ativo</span>
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair do Fullscreen' : 'Tela Cheia'}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="text-xs">{isFullscreen ? 'Sair' : 'Fullscreen'}</span>
          </button>
          <button 
            onClick={() => appId && navigate(`/apps/${appId}/edit`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Retornar para edição
          </button>
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

                {/* Issue Markers */}
                {screenIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white ${
                      issue.priority === 'High' ? 'bg-red-500' : issue.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-500'
                    }`}
                    style={{ left: `${issue.x}%`, top: `${issue.y}%` }}
                    title={issue.text}
                  >
                    !
                  </div>
                ))}

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
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 min-h-20 resize-none"
                        placeholder="Descreva o problema..."
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
                          onClick={handleSaveIssue}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm active:scale-95 transition-transform"
                        >
                          Salvar Issue
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

                  {/* Issue Markers */}
                  {screenIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white ${
                        issue.priority === 'High' ? 'bg-red-500' : issue.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-500'
                      }`}
                      style={{ left: `${issue.x}%`, top: `${issue.y}%` }}
                      title={issue.text}
                    >
                      !
                    </div>
                  ))}

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
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 min-h-20 resize-none"
                          placeholder="Descreva o problema..."
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
                            onClick={handleSaveIssue}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm active:scale-95 transition-transform"
                          >
                            Salvar Issue
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

        {/* Right Drawer: Issues */}
        <aside className="w-80 h-full bg-white flex flex-col border-l border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-slate-900">Issues desta tela</h2>
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {screenIssues.length.toString().padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-slate-500">Feedback registrado pelos stakeholders</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
            {screenIssues.length > 0 ? screenIssues.map((issue) => (
              <div 
                key={issue.id}
                className={`bg-white p-4 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer ${
                  issue.priority === 'High' ? 'border-red-500' : issue.priority === 'Medium' ? 'border-blue-500' : 'border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded ${
                    issue.priority === 'High' ? 'bg-red-50 text-red-600' : issue.priority === 'Medium' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                  }`}>
                    {issue.priority === 'High' ? 'Alta Prioridade' : issue.priority === 'Medium' ? 'Prioridade Média' : 'Sugestão'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    <Clock className="w-2 h-2 inline mr-1" />
                    {issue.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800 mb-2">{issue.text}</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                    {issue.authorName.charAt(0)}
                  </div>
                  <span className="text-[10px] text-slate-500">Relatado por {issue.authorName}</span>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-8">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Nenhum feedback registrado para esta tela.</p>
              </div>
            )}
          </div>
        </aside>
      </main>

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
              <p className="text-[11px] opacity-80 leading-relaxed">Dê um duplo clique em qualquer área do protótipo para abrir um marcador de feedback e registrar uma nova issue.</p>
            </div>
            <button onClick={() => setShowHint(false)} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
