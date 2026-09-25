import React, { useState } from 'react';
import { X, FileBox, Image as ImageIcon, Archive } from 'lucide-react';

const DownloadTypeModal = ({ isOpen, onClose, onConfirm, isBatch = false }) => {
    const [selectedType, setSelectedType] = useState('all');

    if (!isOpen) return null;

    const options = [
        {
            id: 'mat',
            label: 'Solo archivo .mat',
            description: 'Descargar únicamente los datos numéricos de la simulación.',
            icon: FileBox,
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            id: 'graphics',
            label: 'Solo gráficos',
            description: 'Descargar únicamente las imágenes generadas por la simulación.',
            icon: ImageIcon,
            color: 'text-purple-500',
            bg: 'bg-purple-50'
        },
        {
            id: 'all',
            label: 'Todo (ZIP)',
            description: 'Descargar datos e imágenes empaquetados en un archivo comprimido.',
            icon: Archive,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50'
        }
    ];

    const handleConfirm = () => {
        onConfirm(selectedType);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-100">
                <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Archive className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 leading-tight">
                                {isBatch ? 'Descarga Múltiple' : 'Descargar Simulación'}
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">Selecciona el tipo de contenido a descargar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {options.map(option => {
                        const Icon = option.icon;
                        const isSelected = selectedType === option.id;
                        return (
                            <div
                                key={option.id}
                                onClick={() => setSelectedType(option.id)}
                                className={`flex items-start gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50/50'}`}
                            >
                                <div className={`p-2 rounded-lg ${option.bg} ${option.color}`}>
                                    <Icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{option.label}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{option.description}</p>
                                </div>
                                <div className="flex items-center justify-center pt-1">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-gray-900' : 'border-gray-300'}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                        <Archive size={14} /> Descargar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DownloadTypeModal;
