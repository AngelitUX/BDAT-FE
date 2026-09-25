import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToasts, useToast } from '../hooks/useToast';

const ToastContainer = () => {
    const toasts = useToasts();
    const toast = useToast();

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-600" />;
        }
    };

    const getStyles = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-50',
                    border: 'border-green-300',
                    title: 'text-green-900',
                    message: 'text-green-800',
                    progress: 'bg-green-500'
                };
            case 'error':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-300',
                    title: 'text-red-900',
                    message: 'text-red-800',
                    progress: 'bg-red-500'
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-50',
                    border: 'border-yellow-300',
                    title: 'text-yellow-900',
                    message: 'text-yellow-800',
                    progress: 'bg-yellow-500'
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-300',
                    title: 'text-blue-900',
                    message: 'text-blue-800',
                    progress: 'bg-blue-500'
                };
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] space-y-2 max-w-sm pointer-events-none">
            {toasts.map((toastItem) => {
                const styles = getStyles(toastItem.type);

                return (
                    <div
                        key={toastItem.id}
                        className={`${styles.bg} ${styles.border} border rounded-lg shadow-lg transition-all duration-300 transform animate-fade-in pointer-events-auto`}
                        style={{
                            animation: 'slideInRight 0.3s ease-out'
                        }}
                    >
                        <div className="p-3 flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getIcon(toastItem.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {toastItem.title && (
                                        <h4 className={`text-sm font-semibold ${styles.title} mb-0.5`}>
                                            {toastItem.title}
                                        </h4>
                                    )}
                                    <p className={`text-xs ${styles.message} break-words`}>
                                        {toastItem.message}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => toast.remove(toastItem.id)}
                                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                aria-label="Close notification"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Barra de progreso */}
                        {toastItem.duration > 0 && (
                            <div className="h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                                <div
                                    className={`h-full ${styles.progress}`}
                                    style={{
                                        animation: `shrink ${toastItem.duration}ms linear forwards`
                                    }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}

            <style jsx>{`
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes shrink {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }
            `}</style>
        </div>
    );
};

export default ToastContainer;
