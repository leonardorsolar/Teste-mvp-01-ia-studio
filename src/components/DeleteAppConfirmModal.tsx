import React, { useEffect } from 'react';
import { X, Trash2, Layers, MousePointer2, MessageSquareWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AppData } from '../types';

interface DeleteAppConfirmModalProps {
  app: AppData | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function DeleteAppConfirmModal({
  app,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteAppConfirmModalProps) {
  const open = app !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isDeleting, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && app && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            disabled={isDeleting}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !isDeleting && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-app-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-red-500 to-orange-400" />

            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
                  <Trash2 className="h-6 w-6" strokeWidth={2} />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 id="delete-app-title" className="text-xl font-bold tracking-tight text-slate-900 mb-2">
                Excluir aplicativo?
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-5">
                Esta ação não pode ser desfeita. O app e todos os dados abaixo serão removidos permanentemente do Firestore.
              </p>

              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">App</p>
                <p className="text-sm font-semibold text-slate-900 line-clamp-2">{app.name}</p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex gap-3 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Layers className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800">Telas e imagens</span>
                    <span className="block text-slate-500 text-xs mt-0.5">Todos os fluxos e arquivos de tela vinculados</span>
                  </span>
                </li>
                <li className="flex gap-3 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <MousePointer2 className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800">Interações (hotspots)</span>
                    <span className="block text-slate-500 text-xs mt-0.5">Áreas clicáveis e navegação entre telas</span>
                  </span>
                </li>
                <li className="flex gap-3 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <MessageSquareWarning className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800">Issues</span>
                    <span className="block text-slate-500 text-xs mt-0.5">Feedback e anotações do projeto</span>
                  </span>
                </li>
              </ul>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void onConfirm()}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-600/25 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir permanentemente
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
