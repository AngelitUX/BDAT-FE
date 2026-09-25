import { create } from 'zustand';

const useConfirmStore = create((set) => ({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null,
    type: 'warning', // warning, danger, info
    
    openConfirm: ({ title, message, onConfirm, onCancel, confirmText, cancelText, type }) => {
        set({
            isOpen: true,
            title: title || 'Confirm Action',
            message: message || 'Are you sure?',
            confirmText: confirmText || 'Confirm',
            cancelText: cancelText || 'Cancel',
            onConfirm: onConfirm || (() => {}),
            onCancel: onCancel || (() => {}),
            type: type || 'warning'
        });
    },
    
    closeConfirm: () => {
        set({
            isOpen: false,
            onConfirm: null,
            onCancel: null
        });
    }
}));

export const useConfirm = () => {
    const { openConfirm, closeConfirm } = useConfirmStore();
    
    const confirm = ({ title, message, onConfirm, onCancel, confirmText, cancelText, type }) => {
        return new Promise((resolve) => {
            openConfirm({
                title,
                message,
                confirmText,
                cancelText,
                type,
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    resolve(true);
                    closeConfirm();
                },
                onCancel: () => {
                    if (onCancel) onCancel();
                    resolve(false);
                    closeConfirm();
                }
            });
        });
    };
    
    return { confirm };
};

export const useConfirmState = () => useConfirmStore();
