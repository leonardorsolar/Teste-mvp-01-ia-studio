import React, { useEffect, useState } from 'react';
import { X, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, addDoc, collection, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';

const JUMPAD_URL = 'https://jumpad.ai/';

type NpsClassification = 'detractor' | 'neutral' | 'promoter';

function classifyScore(score: number): NpsClassification {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'neutral';
  return 'promoter';
}

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-500 hover:bg-red-600 ring-red-300',
  1: 'bg-red-500 hover:bg-red-600 ring-red-300',
  2: 'bg-red-400 hover:bg-red-500 ring-red-300',
  3: 'bg-orange-500 hover:bg-orange-600 ring-orange-300',
  4: 'bg-orange-400 hover:bg-orange-500 ring-orange-300',
  5: 'bg-orange-400 hover:bg-orange-500 ring-orange-300',
  6: 'bg-amber-400 hover:bg-amber-500 ring-amber-300',
  7: 'bg-yellow-400 hover:bg-yellow-500 ring-yellow-300',
  8: 'bg-lime-400 hover:bg-lime-500 ring-lime-300',
  9: 'bg-emerald-500 hover:bg-emerald-600 ring-emerald-300',
  10: 'bg-emerald-500 hover:bg-emerald-600 ring-emerald-300',
};


interface FeedbackThankYouModalProps {
  isOpen: boolean;
  appName?: string | null;
  appId?: string;
  userName?: string;
  sessionIssueIds?: string[];
  onClose: () => void;
}

export default function FeedbackThankYouModal({
  isOpen,
  appName,
  appId,
  userName = 'Anônimo',
  sessionIssueIds = [],
  onClose,
}: FeedbackThankYouModalProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedScore(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

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

  const handleSubmitNps = async () => {
    if (selectedScore === null || !appId) return;
    setIsSubmitting(true);
    try {
      const classification = classifyScore(selectedScore);
      await addDoc(collection(db, `apps/${appId}/npsResponses`), {
        appId,
        userName,
        score: selectedScore,
        classification,
        issueIds: sessionIssueIds,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, appId ? `apps/${appId}/npsResponses` : null);
    } finally {
      setIsSubmitting(false);
      onClose();
      window.open(JUMPAD_URL, '_blank', 'noopener,noreferrer');
    }
  };

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
                <div>
                  {/* Cabeçalho */}
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
                    Em nome da <span className="font-semibold text-slate-700">Jumpad</span>, agradecemos o tempo que você
                    dedicou a registrar feedback
                    {appName ? (
                      <> no projeto <span className="font-medium text-slate-700">"{appName}"</span></>
                    ) : (
                      ' neste projeto'
                    )}
                    . Suas contribuições são muito valiosas.
                  </p>

                  {/* Separador */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-100" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Avaliação rápida
                      </span>
                    </div>
                  </div>

                  {/* Pergunta NPS */}
                  <p className="text-sm font-semibold text-slate-700 mb-4 leading-snug">
                    De 0 a 10, o quanto você recomendaria o{' '}
                    <span className="text-blue-600">MeetTrack</span> para um amigo?
                  </p>

                  {/* Grade de notas */}
                  <div className="grid grid-cols-11 gap-1 mb-3">
                    {Array.from({ length: 11 }, (_, i) => {
                      const isSelected = selectedScore === i;
                      const colorClass = SCORE_COLORS[i];
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedScore(i)}
                          className={`
                            relative flex h-9 w-full items-center justify-center rounded-lg text-xs font-bold transition-all
                            ${isSelected
                              ? `${colorClass} text-white ring-2 ring-offset-1 scale-110 shadow-md`
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                            }
                          `}
                          aria-label={`Nota ${i}`}
                          aria-pressed={isSelected}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legenda de extremos */}
                  <div className="flex justify-between text-xs text-slate-400 mb-3 px-0.5">
                    <span>Nada provável</span>
                    <span>Muito provável</span>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleSubmitNps}
                      disabled={selectedScore === null || isSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {isSubmitting ? 'Enviando…' : 'Enviar avaliação'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
                    >
                      Fechar sem avaliar
                    </button>
                  </div>
                </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
