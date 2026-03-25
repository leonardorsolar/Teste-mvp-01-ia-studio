import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth, doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError } from '../firebase';
import { AppData, ScreenData, HotspotData } from '../types';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Smartphone, 
  Globe, 
  GripVertical, 
  MousePointer2, 
  Square, 
  Type, 
  Layers, 
  Settings as SettingsIcon,
  ChevronRight,
  Eye,
  X,
  Monitor
} from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import NewScreenModal from '../components/NewScreenModal';

export default function AppEditor() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppData | null>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isCreatingApp, setIsCreatingApp] = useState(appId === 'new');
  const [newAppName, setNewAppName] = useState('');
  const [newAppPlatform, setNewAppPlatform] = useState<'iOS' | 'Android' | 'Web'>('iOS');
  const [isNewScreenModalOpen, setIsNewScreenModalOpen] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentHotspot, setCurrentHotspot] = useState<Partial<HotspotData> | null>(null);
  const [showHotspotPopover, setShowHotspotPopover] = useState(false);
  const [pendingHotspot, setPendingHotspot] = useState<Partial<HotspotData> | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (appId && appId !== 'new') {
      const unsubscribeApp = onSnapshot(doc(db, 'apps', appId), (doc) => {
        if (doc.exists()) {
          setApp({ id: doc.id, ...doc.data() } as AppData);
        }
      });

      const qScreens = query(collection(db, `apps/${appId}/screens`));
      const unsubscribeScreens = onSnapshot(qScreens, (snapshot) => {
        const screensData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScreenData[];
        setScreens(screensData.sort((a, b) => (a.order || 0) - (b.order || 0)));
        if (screensData.length > 0 && !activeScreenId) {
          setActiveScreenId(screensData[0].id);
        }
      });

      return () => {
        unsubscribeApp();
        unsubscribeScreens();
      };
    }
  }, [appId]);

  useEffect(() => {
    if (appId && activeScreenId) {
      const qHotspots = query(collection(db, `apps/${appId}/screens/${activeScreenId}/hotspots`));
      const unsubscribeHotspots = onSnapshot(qHotspots, (snapshot) => {
        const hotspotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HotspotData[];
        setHotspots(hotspotsData);
      });
      return () => unsubscribeHotspots();
    }
  }, [appId, activeScreenId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawingMode(false);
        setIsDrawing(false);
        setCurrentHotspot(null);
        setShowHotspotPopover(false);
        setPendingHotspot(null);
        setSelectedHotspotId(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedHotspotId && !showHotspotPopover) {
          handleDeleteHotspot(selectedHotspotId);
          setSelectedHotspotId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHotspotId, showHotspotPopover]);

  const handleCreateApp = async () => {
    if (!newAppName || !auth.currentUser) return;
    try {
      const appRef = await addDoc(collection(db, 'apps'), {
        name: newAppName,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        platform: newAppPlatform,
        status: 'Draft',
        version: 'v1.0.0'
      });
      navigate(`/apps/${appRef.id}/edit`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'apps');
    }
  };

  const handleAddScreen = () => {
    setIsNewScreenModalOpen(true);
  };

  const handleSaveNewScreen = (screenData: { name: string; device: 'mobile' | 'desktop'; imageUrl: string }) => {
    // 1. Estrutura de dados — objeto com id, name, device e imageUrl (base64)
    const newScreen: ScreenData = {
      id: Date.now().toString(),
      appId: appId || 'local',
      name: screenData.name,
      device: screenData.device,
      imageUrl: screenData.imageUrl,
      order: screens.length
    };
    
    // 2. setState React — screens array no estado local
    setScreens(prev => [...prev, newScreen]);
    
    // 3. Seleção automática — activeScreenId = newScreen.id
    setActiveScreenId(newScreen.id);
    
    // Fechar modal
    setIsNewScreenModalOpen(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingMode || !canvasRef.current || showHotspotPopover) return;
    
    // If clicking outside a hotspot, deselect
    const target = e.target as HTMLElement;
    if (!target.closest('.hotspot-item')) {
      setSelectedHotspotId(null);
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Se já estiver desenhando (modo sticky), finaliza no segundo clique
    if (isDrawing && currentHotspot) {
      finishDrawing(currentHotspot);
      return;
    }

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentHotspot({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);
    const left = Math.min(x, startPos.x);
    const top = Math.min(y, startPos.y);
    
    setCurrentHotspot({ x: left, y: top, width, height });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !currentHotspot) return;
    
    // Se foi um arraste significativo (mais de 2%), finaliza imediatamente
    if (currentHotspot.width! > 2 || currentHotspot.height! > 2) {
      finishDrawing(currentHotspot);
    }
    // Caso contrário, foi apenas um clique inicial ou movimento curto, mantém isDrawing=true para o modo "sticky"
  };

  const finishDrawing = (hotspot: Partial<HotspotData>) => {
    if (!appId || !activeScreenId) return;
    
    setIsDrawing(false);
    const hotspotData: Partial<HotspotData> = {
      ...hotspot,
      screenId: activeScreenId,
      targetScreenId: '',
      label: ''
    };
    setPendingHotspot(hotspotData);
    
    setPopoverPos({
      x: hotspot.x! + hotspot.width!,
      y: hotspot.y! + hotspot.height!
    });
    
    setShowHotspotPopover(true);
    setCurrentHotspot(null);
    // Mantemos isDrawingMode como true para permitir criar vários sem re-clicar no ícone
  };

  const handleSaveHotspot = async () => {
    if (!pendingHotspot || !appId || !activeScreenId) return;
    
    try {
      if (pendingHotspot.id && !pendingHotspot.id.startsWith('temp-')) {
        // Update existing in Firebase
        const { id, ...data } = pendingHotspot;
        await updateDoc(doc(db, `apps/${appId}/screens/${activeScreenId}/hotspots`, id), data);
      } else {
        // Create new in Firebase
        await addDoc(collection(db, `apps/${appId}/screens/${activeScreenId}/hotspots`), {
          screenId: activeScreenId,
          targetScreenId: pendingHotspot.targetScreenId || '',
          x: pendingHotspot.x!,
          y: pendingHotspot.y!,
          width: pendingHotspot.width!,
          height: pendingHotspot.height!,
          label: pendingHotspot.label || '',
          createdAt: serverTimestamp()
        });
      }
      setShowHotspotPopover(false);
      setPendingHotspot(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hotspots');
    }
  };

  const handleCancelHotspot = () => {
    setShowHotspotPopover(false);
    setPendingHotspot(null);
  };

  const handleDeleteHotspot = async (hotspotId: string) => {
    if (!appId || !activeScreenId) return;
    try {
      await deleteDoc(doc(db, `apps/${appId}/screens/${activeScreenId}/hotspots`, hotspotId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hotspots');
    }
  };

  const handleEditHotspot = (hotspot: HotspotData) => {
    setPendingHotspot(hotspot);
    setSelectedHotspotId(hotspot.id);
    setPopoverPos({
      x: hotspot.x + hotspot.width,
      y: hotspot.y + hotspot.height
    });
    setShowHotspotPopover(true);
  };

  const handlePublish = async () => {
    if (!appId) return;
    try {
      await updateDoc(doc(db, 'apps', appId), { status: 'Published' });
      alert('App publicado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'apps');
    }
  };

  if (isCreatingApp) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-500 mb-8 hover:text-blue-600">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-3xl font-bold mb-6">Criar Novo Aplicativo</h1>
        <div className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nome do App</label>
            <input 
              type="text" 
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
              className="w-full border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="Ex: EcoTrack Pro"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Plataforma</label>
            <div className="grid grid-cols-3 gap-4">
              {(['iOS', 'Android', 'Web'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setNewAppPlatform(p)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    newAppPlatform === p ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-500 hover:border-slate-200"
                  }`}
                >
                  {p === 'iOS' && <Smartphone className="w-6 h-6" />}
                  {p === 'Android' && <Smartphone className="w-6 h-6" />}
                  {p === 'Web' && <Globe className="w-6 h-6" />}
                  <span className="text-xs font-bold">{p}</span>
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={handleCreateApp}
            disabled={!newAppName}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            Continuar para o Editor
          </button>
        </div>
      </div>
    );
  }

  const activeScreen = screens.find(s => s.id === activeScreenId);

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* Left Sidebar: Screens */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-semibold text-slate-200 text-sm">Telas ({screens.length})</h2>
          <button onClick={handleAddScreen} className="text-slate-500 hover:text-white">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {screens.map((screen) => (
            <div 
              key={screen.id}
              onClick={() => setActiveScreenId(screen.id)}
              className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
                activeScreenId === screen.id ? "border-blue-500 ring-2 ring-blue-500/20" : "border-transparent hover:border-slate-700"
              }`}
            >
              <div className={`aspect-[9/16] bg-slate-800 relative`}>
                <img src={screen.imageUrl} alt={screen.name} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                {screen.device && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                    {screen.device === 'mobile' ? <Smartphone className="w-2 h-2" /> : <Monitor className="w-2 h-2" />}
                    {screen.device}
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between bg-slate-800">
                <span className={`text-[10px] font-medium truncate ${activeScreenId === screen.id ? "text-blue-400" : "text-slate-400"}`}>
                  {screen.name}
                </span>
                <GripVertical className="w-3 h-3 text-slate-600" />
              </div>
            </div>
          ))}
          <button 
            onClick={handleAddScreen}
            className="w-full aspect-[9/16] border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/30 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
          >
            <Plus className="w-6 h-6 text-slate-500 group-hover:text-blue-400" />
            <span className="text-[10px] font-semibold text-slate-500">Nova Tela</span>
          </button>
        </div>
      </aside>

      <NewScreenModal 
        isOpen={isNewScreenModalOpen}
        onClose={() => setIsNewScreenModalOpen(false)}
        onAdd={handleSaveNewScreen}
      />

      {/* Center: Editor */}
      <section className="flex-1 flex flex-col relative overflow-hidden">
        {/* Editor Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl z-20">
          <button 
            onClick={() => setIsDrawingMode(false)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${!isDrawingMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <MousePointer2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsDrawingMode(true)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDrawingMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Square className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Type className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-800 mx-1"></div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Layers className="w-5 h-5" />
          </button>
          <button 
            onClick={() => navigate(`/apps/${appId}/view`)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-start justify-center p-12 overflow-auto custom-scroll canvas-container">
          {isDrawingMode && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce">
              <MousePointer2 className="w-3 h-3" />
              Clique e arraste para marcar uma área clicável — ESC para cancelar
            </div>
          )}
          {activeScreen ? (
            <div 
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`canvas-view relative group shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-blue-500/30 bg-slate-900 overflow-hidden transition-all duration-500 canvas-frame ${
                isDrawingMode ? 'cursor-crosshair' : 'cursor-default'
              } ${
                activeScreen.device === 'desktop' 
                  ? 'desktop-frame' 
                  : 'mobile-frame'
              }`}
              style={{
                width: activeScreen.device === 'desktop' ? 'min(900px, 90%)' : 'min(390px, 60%)',
                aspectRatio: activeScreen.device === 'desktop' ? '16/9' : '9/19.5',
                height: 'auto'
              }}
            >
              <img 
                src={activeScreen.imageUrl} 
                alt={activeScreen.name} 
                className="w-full h-full object-contain block select-none pointer-events-none" 
                referrerPolicy="no-referrer"
              />
              
              {/* Existing Hotspots */}
              {hotspots.map((hotspot) => (
                <div 
                  key={hotspot.id}
                  onClick={(e) => { e.stopPropagation(); handleEditHotspot(hotspot); }}
                  className={`absolute border rounded-[4px] hotspot-item group/hotspot transition-all cursor-pointer ${
                    selectedHotspotId === hotspot.id 
                      ? 'border-[#4f6ef7] border-[3px] bg-[#4f6ef74d] z-20' 
                      : 'border-[#4f6ef7] border-2 bg-[#4f6ef759] opacity-[0.35] hover:opacity-[0.65] z-10'
                  }`}
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    width: `${hotspot.width}%`,
                    height: `${hotspot.height}%`
                  }}
                >
                  {selectedHotspotId === hotspot.id && (
                    <>
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                    </>
                  )}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover/hotspot:opacity-100 transition-opacity shadow-xl whitespace-nowrap pointer-events-none border border-slate-800">
                    Ir para: <span className="text-blue-400 font-bold">{screens.find(s => s.id === hotspot.targetScreenId)?.name || 'Nenhuma'}</span>
                  </div>
                </div>
              ))}

              {/* Drawing Hotspot */}
              {currentHotspot && (
                <div 
                  className="absolute border-2 border-[#4f6ef7] bg-[#4f6ef740] rounded-[4px] z-30 pointer-events-none"
                  style={{
                    left: `${currentHotspot.x}%`,
                    top: `${currentHotspot.y}%`,
                    width: `${currentHotspot.width}%`,
                    height: `${currentHotspot.height}%`
                  }}
                />
              )}

              {/* Pending Hotspot (being configured) */}
              {showHotspotPopover && pendingHotspot && (
                <div 
                  className="absolute border-[3px] border-[#4f6ef7] bg-[#4f6ef74d] rounded-[4px] z-30 pointer-events-none"
                  style={{
                    left: `${pendingHotspot.x}%`,
                    top: `${pendingHotspot.y}%`,
                    width: `${pendingHotspot.width}%`,
                    height: `${pendingHotspot.height}%`
                  }}
                >
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full" />
                </div>
              )}

              {/* Hotspot Popover */}
              <AnimatePresence>
                {showHotspotPopover && pendingHotspot && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute z-50 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl w-72"
                    style={{
                      left: `${Math.min(popoverPos.x, 65)}%`,
                      top: `${Math.min(popoverPos.y, 75)}%`
                    }}
                  >
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ação de Navegação</span>
                        <h3 className="text-sm font-semibold text-white">Para qual tela este clique leva?</h3>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="relative">
                          <select 
                            value={pendingHotspot.targetScreenId}
                            onChange={(e) => setPendingHotspot({ ...pendingHotspot, targetScreenId: e.target.value })}
                            className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl text-xs text-slate-200 py-3 px-4 focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer pr-10"
                          >
                            <option value="">Selecionar tela...</option>
                            {screens.filter(s => s.id !== activeScreenId).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
 
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={handleCancelHotspot}
                          className="flex-1 px-4 py-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveHotspot}
                          className="flex-1 px-4 py-2.5 rounded-xl text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/40"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-slate-500 text-center canvas-empty">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Selecione ou adicione uma tela para começar</p>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 font-medium">Auto-save: Ativo</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePublish}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
            >
              Publicar App
            </button>
          </div>
        </div>
      </section>

      {/* Right Sidebar: Properties */}
      <aside className="w-72 bg-slate-900 border-l border-slate-800 p-5 flex flex-col gap-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Propriedades da Tela</h3>
            {activeScreen && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-400 uppercase">
                {activeScreen.device === 'mobile' ? <Smartphone className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                {activeScreen.device}
              </div>
            )}
          </div>
          
          {activeScreen ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400">Nome da Tela</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={activeScreen.name}
                    onChange={async (e) => {
                      const newName = e.target.value;
                      setScreens(prev => prev.map(s => s.id === activeScreen.id ? { ...s, name: newName } : s));
                      await updateDoc(doc(db, `apps/${appId}/screens`, activeScreen.id), { name: newName });
                    }}
                    className="flex-1 bg-slate-800 border-none rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-blue-500"
                  />
                  <button className="px-3 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">
                    <SettingsIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                  <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Dimensões</div>
                  <div className="text-xs font-medium text-slate-300">
                    {activeScreen.device === 'mobile' ? '390 × 844' : '1440 × 900'}
                  </div>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                  <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Formato</div>
                  <div className="text-xs font-medium text-slate-300">PNG / WebP</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic">Nenhuma tela selecionada</p>
          )}
        </section>

        <div className="h-px bg-slate-800"></div>

        <section className="flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interações ({hotspots.length})</h3>
            <button 
              onClick={() => setIsDrawingMode(true)}
              className={`p-1.5 rounded-lg transition-all ${isDrawingMode ? 'bg-blue-600 text-white' : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {hotspots.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-slate-800 rounded-2xl text-center space-y-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <MousePointer2 className="w-5 h-5" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Clique no botão + acima e arraste sobre a imagem para marcar uma área clicável
              </p>
            </div>
          ) : (
            <div className="space-y-2">
            {hotspots.map((hotspot) => (
              <div 
                key={hotspot.id} 
                onClick={() => setSelectedHotspotId(hotspot.id)}
                className={`p-3 border rounded-xl flex flex-col gap-2 transition-all cursor-pointer ${
                  selectedHotspotId === hotspot.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-800/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                    <span className="text-[11px] font-bold text-slate-200">
                      Área → {screens.find(s => s.id === hotspot.targetScreenId)?.name || 'Sem destino'}
                    </span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteHotspot(hotspot.id); }} className="text-slate-500 hover:text-red-500 p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </aside>
    </div>
  );
}
