import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth, doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
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
  
  useEffect(() => {
    console.log('👤 Estado de autenticação:', { 
      uid: auth.currentUser?.uid, 
      email: auth.currentUser?.email,
      isAuthReady: !!auth.currentUser 
    });
  }, []);

  const [app, setApp] = useState<AppData | null>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log('👤 AppEditor Auth State Changed:', { uid: user?.uid });
      if (!user) return;

      if (appId && appId !== 'new') {
        const unsubscribeApp = onSnapshot(doc(db, 'apps', appId), (doc) => {
          if (doc.exists()) {
            setApp({ id: doc.id, ...doc.data() } as AppData);
          }
        });

        const qScreens = query(collection(db, `apps/${appId}/screens`));
        const unsubscribeScreens = onSnapshot(qScreens, (snapshot) => {
          const screensData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ScreenData[];
          setScreens(screensData.sort((a, b) => a.order - b.order));
          if (screensData.length > 0 && !activeScreenId) {
            setActiveScreenId(screensData[0].id);
          }
        });

        return () => {
          unsubscribeApp();
          unsubscribeScreens();
        };
      }
    });

    return () => unsubscribeAuth();
  }, [appId]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      if (appId && appId !== 'new' && activeScreenId) {
        const qHotspots = query(collection(db, `apps/${appId}/screens/${activeScreenId}/hotspots`));
        const unsubscribeHotspots = onSnapshot(qHotspots, (snapshot) => {
          const hotspotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HotspotData[];
          setHotspots(hotspotsData);
        });
        return () => unsubscribeHotspots();
      }
    });

    return () => unsubscribeAuth();
  }, [appId, activeScreenId]);

  const handleCreateApp = async () => {
    console.log('🚀 Iniciando criação de app...', { newAppName, user: auth.currentUser?.uid });
    if (!newAppName || !auth.currentUser) {
      console.warn('⚠️ Nome do app ou usuário ausente');
      return;
    }
    try {
      const appData = {
        name: newAppName,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        platform: newAppPlatform,
        status: 'Draft',
        version: 'v1.0.0'
      };
      console.log('📝 Dados do app:', appData);
      const appRef = await addDoc(collection(db, 'apps'), appData);
      console.log('✅ App criado com ID:', appRef.id);
      navigate(`/apps/${appRef.id}/edit`);
    } catch (error) {
      console.error('❌ Erro ao criar app:', error);
      handleFirestoreError(error, OperationType.CREATE, 'apps');
    }
  };

  const handleAddScreen = () => {
    setIsNewScreenModalOpen(true);
  };

  const handleSaveNewScreen = async (screenData: { name: string; deviceType: 'Mobile' | 'Desktop'; file: File }) => {
    if (!appId || appId === 'new') return;
    
    console.log('🚀 Iniciando upload...', { appId, fileName: screenData.file?.name, fileSize: screenData.file?.size });

    try {
      // 1. Upload para o Firebase Storage
      const filename = `${Date.now()}_${screenData.file.name}`;
      const storageRef = ref(storage, `apps/${appId}/screens/${filename}`);
      console.log('📦 StorageRef criado:', storageRef.fullPath);

      const uploadResult = await uploadBytes(storageRef, screenData.file);
      console.log('✅ Upload concluído:', uploadResult);

      const downloadUrl = await getDownloadURL(uploadResult.ref);
      console.log('🔗 URL obtida:', downloadUrl);

      // 2. Salvar metadados no Firestore com a URL real
      const docRef = await addDoc(collection(db, `apps/${appId}/screens`), {
        appId,
        imageUrl: downloadUrl,
        order: screens.length,
        name: screenData.name,
        deviceType: screenData.deviceType
      });

      // Optimistic update to ensure immediate display
      const newScreen: ScreenData = {
        id: docRef.id,
        appId,
        imageUrl: downloadUrl,
        order: screens.length,
        name: screenData.name,
        deviceType: screenData.deviceType
      };
      
      setScreens(prev => [...prev, newScreen].sort((a, b) => a.order - b.order));
      setActiveScreenId(docRef.id);
    } catch (error) {
      console.error('❌ Erro detalhado:', error);
      handleFirestoreError(error, OperationType.CREATE, `apps/${appId}/screens`);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
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

  const handleMouseUp = () => {
    if (!isDrawing || !currentHotspot || !appId || !activeScreenId) return;
    setIsDrawing(false);
    
    if (currentHotspot.width! < 1 || currentHotspot.height! < 1) {
      setCurrentHotspot(null);
      return;
    }

    // Set pending hotspot and show popover
    setPendingHotspot({
      ...currentHotspot,
      screenId: activeScreenId,
      targetScreenId: '',
      label: 'Novo Hotspot'
    });
    
    // Calculate popover position (near the bottom right of the hotspot)
    setPopoverPos({
      x: currentHotspot.x! + currentHotspot.width!,
      y: currentHotspot.y! + currentHotspot.height!
    });
    
    setShowHotspotPopover(true);
    setCurrentHotspot(null);
  };

  const handleSaveHotspot = async () => {
    if (!pendingHotspot || !appId || !activeScreenId) return;
    
    try {
      await addDoc(collection(db, `apps/${appId}/screens/${activeScreenId}/hotspots`), {
        ...pendingHotspot,
        createdAt: serverTimestamp()
      });
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

  const handleUpdateHotspotTarget = async (hotspotId: string, targetId: string) => {
    if (!appId || !activeScreenId) return;
    try {
      await updateDoc(doc(db, `apps/${appId}/screens/${activeScreenId}/hotspots`, hotspotId), {
        targetScreenId: targetId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hotspots');
    }
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
                {screen.deviceType && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                    {screen.deviceType === 'Mobile' ? <Smartphone className="w-2 h-2" /> : <Monitor className="w-2 h-2" />}
                    {screen.deviceType}
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
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <MousePointer2 className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/40">
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

        <div className="flex-1 flex items-center justify-center p-12 overflow-auto custom-scroll canvas-container">
          {activeScreen ? (
            <div 
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`canvas-view relative group max-h-full shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-blue-500/30 bg-slate-900 overflow-hidden cursor-crosshair transition-all duration-500 canvas-frame ${
                activeScreen.deviceType === 'Desktop' 
                  ? 'aspect-[16/10] w-full max-w-5xl rounded-2xl desktop-frame' 
                  : 'aspect-[9/19.5] rounded-[2rem] mobile-frame'
              }`}
            >
              <img 
                src={activeScreen.imageUrl} 
                alt={activeScreen.name} 
                className="w-full h-full object-contain select-none pointer-events-none" 
                referrerPolicy="no-referrer"
              />
              
              {/* Existing Hotspots */}
              {hotspots.map((hotspot) => (
                <div 
                  key={hotspot.id}
                  className="absolute border border-blue-500 bg-[#4f6ef74d] backdrop-blur-[1px] group/hotspot hover:bg-[#4f6ef7b3] transition-all cursor-pointer"
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    width: `${hotspot.width}%`,
                    height: `${hotspot.height}%`
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/hotspot:opacity-100 transition-opacity shadow-lg whitespace-nowrap z-10">
                    Leva para: {screens.find(s => s.id === hotspot.targetScreenId)?.name || 'Nenhuma'}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteHotspot(hotspot.id); }}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/hotspot:opacity-100 transition-opacity shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Drawing Hotspot */}
              {currentHotspot && (
                <div 
                  className="absolute border border-blue-400 bg-[#4f6ef74d]"
                  style={{
                    left: `${currentHotspot.x}%`,
                    top: `${currentHotspot.y}%`,
                    width: `${currentHotspot.width}%`,
                    height: `${currentHotspot.height}%`
                  }}
                />
              )}

              {/* Hotspot Popover */}
              <AnimatePresence>
                {showHotspotPopover && pendingHotspot && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute z-50 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl w-64"
                    style={{
                      left: `${Math.min(popoverPos.x, 70)}%`,
                      top: `${Math.min(popoverPos.y, 80)}%`
                    }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Novo Hotspot</span>
                        <button onClick={handleCancelHotspot} className="text-slate-500 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-500 uppercase">Navegar para:</label>
                        <select 
                          value={pendingHotspot.targetScreenId}
                          onChange={(e) => setPendingHotspot({ ...pendingHotspot, targetScreenId: e.target.value })}
                          className="w-full bg-slate-800 border-none rounded-lg text-xs text-slate-200 py-2 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecione uma tela</option>
                          {screens.filter(s => s.id !== activeScreenId).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={handleCancelHotspot}
                          className="flex-1 px-3 py-2 rounded-lg text-[10px] font-bold text-slate-400 hover:bg-slate-800 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveHotspot}
                          className="flex-1 px-3 py-2 rounded-lg text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
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
                {activeScreen.deviceType === 'Mobile' ? <Smartphone className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                {activeScreen.deviceType}
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
                    {activeScreen.deviceType === 'Mobile' ? '390 × 844' : '1440 × 900'}
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
            <button className="p-1.5 bg-blue-600/10 text-blue-400 rounded-lg hover:bg-blue-600/20 transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {hotspots.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-slate-800 rounded-2xl text-center space-y-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <MousePointer2 className="w-5 h-5" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Clique e arraste sobre a imagem para marcar uma área clicável
              </p>
            </div>
          ) : (
            <div className="space-y-2">
            {hotspots.map((hotspot) => (
              <div key={hotspot.id} className="p-3 bg-slate-800/50 border border-slate-800 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MousePointer2 className="w-3 h-3 text-blue-400" />
                    <span className="text-[11px] font-bold text-slate-200">{hotspot.label || 'Hotspot'}</span>
                  </div>
                  <button onClick={() => handleDeleteHotspot(hotspot.id)} className="text-slate-500 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-medium text-slate-500 uppercase">Destino</label>
                  <select 
                    value={hotspot.targetScreenId}
                    onChange={(e) => handleUpdateHotspotTarget(hotspot.id, e.target.value)}
                    className="w-full bg-slate-900 border-none rounded-lg text-[10px] text-slate-300 py-1 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Nenhuma</option>
                    {screens.filter(s => s.id !== activeScreenId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
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
