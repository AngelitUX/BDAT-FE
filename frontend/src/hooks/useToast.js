import { create } from 'zustand';

// Store global para las notificaciones toast
const useToastStore = create((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = Date.now() + Math.random();
        const newToast = {
            id,
            type: toast.type || 'info', // success, error, warning, info
            title: toast.title || '',
            message: toast.message || '',
            duration: toast.duration || 4000,
            timestamp: new Date()
        };

        set((state) => ({
            toasts: [newToast, ...state.toasts.slice(0, 4)] // Máximo 5 toasts
        }));

        // Auto-remove después de la duración
        if (newToast.duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id)
                }));
            }, newToast.duration);
        }

        return id;
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    },
    clearAll: () => set({ toasts: [] })
}));

// Hook personalizado para usar toast en componentes
export const useToast = () => {
    const { addToast, removeToast, clearAll } = useToastStore();

    const toast = {
        success: (message, title = 'Success') => {
            return addToast({ type: 'success', title, message });
        },
        error: (message, title = 'Error') => {
            return addToast({ type: 'error', title, message, duration: 6000 });
        },
        warning: (message, title = 'Warning') => {
            return addToast({ type: 'warning', title, message, duration: 5000 });
        },
        info: (message, title = 'Info') => {
            return addToast({ type: 'info', title, message });
        },
        custom: (options) => {
            return addToast(options);
        },
        remove: removeToast,
        clearAll
    };

    return toast;
};

// Hook para obtener los toasts (usado por el componente ToastContainer)
export const useToasts = () => {
    return useToastStore((state) => state.toasts);
};

export default useToast;
