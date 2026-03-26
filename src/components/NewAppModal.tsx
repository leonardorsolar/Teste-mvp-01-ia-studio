import React, { useState, useEffect } from 'react';
import { X, Smartphone, Globe, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type NewAppPlatform = 'iOS' | 'Android' | 'Web';
export type NewAppDevice = 'mobile' | 'desktop';

export interface NewAppFormData {
  name: string;
  platform: NewAppPlatform;
  defaultDevice: NewAppDevice;
}

interface NewAppModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onCreate: (data: NewAppFormData) => Promise<void>;
}

export default function NewAppModal({ isOpen, onCancel, onCreate }: NewAppModalProps) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<NewAppPlatform>('Web');
  const [defaultDevice, setDefaultDevice] = useState<NewAppDevice>('desktop');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (platform === 'Web') {
      setDefaultDevice('desktop');
    } else {
      setDefaultDevice('mobile');
    }
  }, [platform]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreate({ name: trimmed, platform, defaultDevice });
      setName('');
      setPlatform('Web');
      setDefaultDevice('desktop');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-app-modal-title"
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 id="new-app-modal-title" className="text-xl font-bold text-white">
                Novo aplicativo
              </h2>
              <button
                type="button"
                onClick={onCancel}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              <div className="space-y-2">
                <label htmlFor="new-app-name" className="text-sm font-medium text-slate-400">
                  Nome do app
                </label>
                <input
                  id="new-app-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: EcoTrack Pro"
                  className="w-full bg-slate-800 border-none rounded-2xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-slate-400">Plataforma</span>
                <div className="grid grid-cols-3 gap-3">
                  {(['Web', 'iOS', 'Android'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        platform === p
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      {p === 'Web' ? <Globe className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                      <span className="text-xs font-bold">{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-slate-400">Tipo de dispositivo (telas)</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sugestão: Web em desktop; iOS e Android em mobile. Você pode alterar abaixo.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDefaultDevice('desktop')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      defaultDevice === 'desktop'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <Monitor className="w-7 h-7" />
                    <span className="text-xs font-bold">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultDevice('mobile')}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                      defaultDevice === 'mobile'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-7 h-7" />
                    <span className="text-xs font-bold">Mobile</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/80">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!name.trim() || isSubmitting}
                className="px-8 py-3 rounded-2xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/30"
              >
                {isSubmitting ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
