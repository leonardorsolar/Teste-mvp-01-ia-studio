import React, { useState, useRef } from 'react';
import { X, ArrowLeft, Monitor, Smartphone, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase';

interface NewScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (screen: { name: string; deviceType: 'Mobile' | 'Desktop'; imageUrl: string }) => void;
}

export default function NewScreenModal({ isOpen, onClose, onAdd }: NewScreenModalProps) {
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<'Mobile' | 'Desktop'>('Mobile');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
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
    if (name && deviceType && selectedFile) {
      setIsUploading(true);
      try {
        // Use server-side proxy to bypass CORS
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        const downloadUrl = data.url;
        
        onAdd({ name, deviceType, imageUrl: downloadUrl });
        onClose();
        // Reset state
        setName('');
        setDeviceType('Mobile');
        setImageUrl(null);
        setSelectedFile(null);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Erro ao fazer upload da imagem via servidor. Tente novamente.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
