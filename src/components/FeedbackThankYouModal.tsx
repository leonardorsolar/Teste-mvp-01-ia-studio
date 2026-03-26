import React, { useEffect } from 'react';
import { X, Heart, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const JUMPAD_URL = 'https://jumpad.ai/';

interface FeedbackThankYouModalProps {
  isOpen: boolean;
  appName?: string | null;
  onClose: () => void;
}

export default function FeedbackThankYouModal({ isOpen, appName, onClose }: FeedbackThankYouModalProps) {
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
            aria-labelledby="feedback-thank-you-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/80"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />

            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Heart className="h-7 w-7" strokeWidth={2} fill="currentColor" fillOpacity={0.15} />
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

              <h2 id="feedback-thank-you-title" className="text-xl font-bold tracking-tight text-slate-900 mb-2">
                Obrigado pelas suas observações
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Em nome da <span className="font-semibold text-slate-700">Jumpad</span>, agradecemos o tempo que você dedicou a registrar feedback
                {appName ? (
                  <> no projeto <span className="font-medium text-slate-700">“{appName}”</span></>
                ) : (
                  ' neste projeto'
                )}
                . Suas contribuições são muito valiosas.
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href={JUMPAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-blue-600"
                >
                  Conhecer a Jumpad
                  <ExternalLink className="h-4 w-4 shrink-0 opacity-90" />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
