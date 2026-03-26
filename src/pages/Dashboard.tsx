import React, { useState, useEffect } from 'react';
import { db, auth, collection, query, where, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { deleteAppCascade } from '../deleteAppCascade';
import { AppData } from '../types';
import { Plus, ExternalLink, Smartphone, Globe, Clock, Server, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import DeleteAppConfirmModal from '../components/DeleteAppConfirmModal';
import AppCardCover from '../components/AppCardCover';

export default function Dashboard() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Todos' | 'iOS' | 'Android' | 'Web'>('Todos');
  const [backendMessage, setBackendMessage] = useState<string>('Conectando ao NestJS...');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [appPendingDelete, setAppPendingDelete] = useState<AppData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/hello')
      .then(res => res.text())
      .then(data => setBackendMessage(data))
      .catch(err => {
        console.error('Error fetching from backend:', err);
        setBackendMessage('Erro ao conectar ao backend');
      });
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'apps'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppData[];
      setApps(appsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'apps');
    });

    return () => unsubscribe();
  }, []);

  const filteredApps = apps.filter(app => filter === 'Todos' || app.platform === filter);

  const openDeleteModal = (app: AppData, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (app.ownerId !== auth.currentUser?.uid) return;
    setAppPendingDelete(app);
  };

  const closeDeleteModal = () => {
    if (deletingId) return;
    setAppPendingDelete(null);
  };

  const confirmDeleteApp = async () => {
    const app = appPendingDelete;
    if (!app || app.ownerId !== auth.currentUser?.uid) return;
    setDeletingId(app.id);
    try {
      await deleteAppCascade(db, app.id);
      setAppPendingDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `apps/${app.id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'iOS': return <Smartphone className="w-3 h-3" />;
      case 'Android': return <Smartphone className="w-3 h-3" />;
      case 'Web': return <Globe className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <DeleteAppConfirmModal
        app={appPendingDelete}
        isDeleting={appPendingDelete !== null && deletingId === appPendingDelete.id}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteApp}
      />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-2">Meus Aplicativos</h1>
          <p className="text-slate-500 max-w-lg">Gerencie o ciclo de vida e a arquitetura de seus produtos digitais em um único lugar.</p>
        </div>
        <button 
          onClick={() => navigate('/apps/new/edit')}
          className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo App
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex bg-slate-100 p-1 rounded-full">
          {['Todos', 'Web', 'iOS', 'Android' ].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-6 py-1.5 text-xs font-bold rounded-full transition-all ${
                filter === f 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-blue-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-500">
          <Server className="w-3 h-3 text-blue-500" />
          <span className="uppercase tracking-wider">Status Backend:</span>
          <span className="text-blue-600">{backendMessage}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
        {filteredApps.map((app) => (
          <motion.div 
            key={app.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all border border-transparent hover:border-blue-500/10 flex flex-col h-full min-h-0"
          >
            <div className="relative aspect-video shrink-0 overflow-hidden bg-slate-100">
              <AppCardCover
                appId={app.id}
                alt={app.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => openDeleteModal(app, e)}
                  disabled={deletingId === app.id}
                  className="p-2 rounded-full bg-white/90 text-slate-500 hover:text-red-600 hover:bg-red-50 shadow-sm transition-colors disabled:opacity-50"
                  title="Excluir app"
                  aria-label={`Excluir aplicativo ${app.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  app.status === 'Published' 
                    ? "bg-emerald-100 text-emerald-700" 
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {app.status === 'Published' ? 'Publicado' : 'Draft'}
                </span>
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1 min-h-0">
              <div className="flex justify-between items-start gap-2 mb-1">
                <h3 className="font-bold text-lg text-slate-900 min-w-0 flex-1">{app.name}</h3>
                {app.status === 'Published' && (
                  <Link
                    to={`/apps/${app.id}/feedback`}
                    className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Abrir área de feedback (visualização pública)"
                    aria-label={`Abrir visualização pública de ${app.name}`}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4">
                {getPlatformIcon(app.platform)}
                <span className="text-xs text-slate-500">{app.platform} • {app.version || 'v1.0.0'}</span>
              </div>
              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 uppercase tracking-tighter">
                  <Clock className="w-3 h-3" />
                  {app.createdAt.toDate().toLocaleDateString()}
                </div>
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[8px] font-bold">
                    {auth.currentUser?.displayName?.charAt(0) || 'U'}
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 flex gap-2">
                <button 
                  type="button"
                  onClick={() => navigate(`/apps/${app.id}/edit`)}
                  disabled={deletingId === app.id}
                  className="flex-1 py-2 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Editar Fluxo
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        <button 
          type="button"
          onClick={() => navigate('/apps/new/edit')}
          className="group border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 hover:border-blue-500 hover:bg-blue-50 transition-all h-full"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
            <Plus className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
          </div>
          <span className="text-sm font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Adicionar Novo Projeto</span>
          <span className="text-[10px] text-slate-400 mt-1">iOS, Android ou Web</span>
        </button>
      </div>
    </div>
  );
}
