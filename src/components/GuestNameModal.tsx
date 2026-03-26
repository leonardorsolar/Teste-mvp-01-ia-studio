import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

interface GuestNameModalProps {
  appName?: string;
  onConfirm: (name: string) => void;
}

export default function GuestNameModal({ appName, onConfirm }: GuestNameModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-linear-to-br from-blue-600 to-blue-700 px-8 py-7 text-white">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 mb-4">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold leading-tight">
            Deixe seu feedback
          </h1>
          {appName && (
            <p className="text-sm text-blue-100 mt-1 font-medium">{appName}</p>
          )}
          <p className="text-sm text-blue-200 mt-2 leading-relaxed">
            Dê um duplo clique em qualquer ponto do protótipo para registrar uma observação.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-7">
          <label
            htmlFor="guest-name"
            className="block text-sm font-semibold text-slate-700 mb-2"
          >
            Como você se chama?
          </label>
          <input
            ref={inputRef}
            id="guest-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            placeholder="Seu nome"
            maxLength={50}
            autoComplete="off"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Seu nome aparecerá junto às suas observações.
          </p>

          <button
            type="submit"
            disabled={!name.trim()}
            className="mt-5 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-sm py-3 rounded-xl transition-all active:scale-[0.98]"
          >
            Começar a revisar
          </button>
        </form>
      </div>
    </div>
  );
}
