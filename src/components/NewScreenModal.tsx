import React, { useState, useRef } from 'react';
import { X, ArrowLeft, Monitor, Smartphone, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NewScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (screen: { name: string; device: 'mobile' | 'desktop'; imageUrl: string }) => void | Promise<void>;
}

const MAX_BASE64_CHARS = 900_000;

const estimateBase64Bytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível carregar a imagem selecionada.'));
    };
    img.src = url;
  });

async function compressToDataUrl(file: File, deviceType: 'Mobile' | 'Desktop'): Promise<string> {
  const image = await loadImageFromFile(file);
  const initialMaxWidth = deviceType === 'Mobile' ? 1080 : 1600;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível preparar a imagem para upload.');
  }

  const formats: Array<'image/webp' | 'image/jpeg'> = ['image/webp', 'image/jpeg'];
  const qualities = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.36];

  let downscaleFactor = 1;
  let bestCandidate = '';

  for (let attempt = 0; attempt < 7; attempt++) {
    const maxWidth = Math.max(320, Math.round(initialMaxWidth * downscaleFactor));
    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const format of formats) {
      for (const quality of qualities) {
        const candidate = canvas.toDataURL(format, quality);
        if (!bestCandidate || candidate.length < bestCandidate.length) {
          bestCandidate = candidate;
        }
        if (candidate.length <= MAX_BASE64_CHARS) {
          return candidate;
        }
      }
    }

    downscaleFactor *= 0.82;
  }

  throw new Error(
    `Imagem ainda muito grande para Firestore após compactação (tam=${bestCandidate.length}). Tente uma imagem menor.`,
  );
}

export default function NewScreenModal({ isOpen, onClose, onAdd }: NewScreenModalProps) {
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<'Mobile' | 'Desktop'>('Mobile');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp')) {
      setIsUploading(true);
      try {
        const compressedDataUrl = await compressToDataUrl(file, deviceType);
        setImageUrl(compressedDataUrl);

        console.log('[Screens][prepare-base64]', {
          fileName: file.name,
          fileType: file.type,
          originalBytes: file.size,
          compressedApproxBytes: estimateBase64Bytes(compressedDataUrl),
          base64Length: compressedDataUrl.length,
          exceedsRuleLimit: compressedDataUrl.length > MAX_BASE64_CHARS,
        });
      } catch (error) {
        console.error('Erro ao compactar imagem:', error);
        alert('Erro ao processar imagem. Tente outro arquivo.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (name && deviceType && imageUrl) {
      if (imageUrl.length > MAX_BASE64_CHARS) {
        alert('Imagem muito grande para salvar no Firestore. Tente outra imagem ou resolução menor.');
        return;
      }

      setIsUploading(true);
      try {
        const device = deviceType === 'Mobile' ? 'mobile' : 'desktop';

        console.log('[Screens][submit]', {
          name,
          device,
          imageBase64Length: imageUrl.length,
          imageApproxBytes: estimateBase64Bytes(imageUrl),
        });

        await onAdd({ name, device, imageUrl });
        console.log('[Screens][submit][onAdd-resolved]');
        onClose();
        // Reset state
        setName('');
        setDeviceType('Mobile');
        setImageUrl(null);
      } catch (error) {
        console.error('Erro ao salvar tela:', error);
        if (error instanceof Error) {
          console.error('[Screens][submit][error-message]', error.message);
        }
        alert(`Erro ao salvar tela no Firestore: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-white">Nova Tela</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Nome da Tela</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Tela de Login"
                  className="w-full bg-slate-800 border-none rounded-2xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Device Selector */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-400">Tipo de Dispositivo</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDeviceType('Desktop')}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                      deviceType === 'Desktop' 
                        ? "border-blue-500 bg-blue-500/10 text-blue-400" 
                        : "border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700"
                    }`}
                  >
                    <Monitor className="w-8 h-8" />
                    <div className="text-center">
                      <div className="font-bold text-sm">Desktop</div>
                      <div className="text-[10px] opacity-60">1440 × 900 px</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setDeviceType('Mobile')}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                      deviceType === 'Mobile' 
                        ? "border-blue-500 bg-blue-500/10 text-blue-400" 
                        : "border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700"
                    }`}
                  >
                    <Smartphone className="w-8 h-8" />
                    <div className="text-center">
                      <div className="font-bold text-sm">Mobile</div>
                      <div className="text-[10px] opacity-60">390 × 844 px</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Upload Area */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Imagem da Tela</label>
                {!imageUrl ? (
                  <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`aspect-video rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 cursor-pointer ${
                      isDragging 
                        ? "border-blue-500 bg-blue-500/10" 
                        : "border-slate-800 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-300">Arraste ou clique para enviar</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG ou WEBP</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video rounded-3xl overflow-hidden group border border-slate-800">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-200 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" /> Substituir imagem
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/50">
              <button 
                onClick={onClose}
                className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!imageUrl || !name || isUploading}
                className="px-8 py-3 rounded-2xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Adicionar Tela'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
