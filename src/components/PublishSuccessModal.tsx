import React, { useEffect } from 'react';
import { X, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PublishSuccessModalProps {
  isOpen: boolean;
  appName?: string | null;
  onClose: () => void;
  /** Ação do botão principal: ir para a home */
  onGoHome: () => void;
}

export default function PublishSuccessModal({ isOpen, appName, onClose, onGoHome }: PublishSuccessModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-success-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <PartyPopper className="h-7 w-7" strokeWidth={2} />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 id="publish-success-title" className="text-xl font-bold tracking-tight text-slate-900 mb-2">
                App publicado com sucesso!
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {appName
                  ? `“${appName}” está disponível como publicado. Stakeholders podem acessar a visualização conforme as permissões do projeto.`
                  : 'Seu aplicativo foi marcado como publicado. Stakeholders podem acessar a visualização conforme as permissões do projeto.'}
              </p>

              <button
                type="button"
                onClick={onGoHome}
                className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-600/25 transition-all"
              >
                Ir para a home
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
