import React from 'react';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useConfirmState } from '../hooks/useConfirm';

const ConfirmDialog = () => {
    const { isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, type } = useConfirmState();

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertCircle className="w-12 h-12 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
            case 'info':
                return <Info className="w-12 h-12 text-blue-500" />;
            default:
                return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
        }
    };

    const getButtonStyles = () => {
        switch (type) {
            case 'danger':
                return 'bg-red-600 hover:bg-red-700 text-white';
            case 'warning':
                return 'bg-yellow-600 hover:bg-yellow-700 text-white';
            case 'info':
                return 'bg-blue-600 hover:bg-blue-700 text-white';
            default:
                return 'bg-yellow-600 hover:bg-yellow-700 text-white';
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            {getIcon()}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${getButtonStyles()}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
