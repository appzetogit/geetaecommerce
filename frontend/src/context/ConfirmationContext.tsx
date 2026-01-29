import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

interface ConfirmationContextType {
  openConfirmation: (options: ConfirmationOptions) => void;
  closeConfirmation: () => void;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const openConfirmation = useCallback((opts: ConfirmationOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeConfirmation = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const handleConfirm = async () => {
    if (options?.onConfirm) {
      setLoading(true);
      try {
        await options.onConfirm();
      } finally {
        setLoading(false);
        closeConfirmation();
      }
    } else {
      closeConfirmation();
    }
  };

  const handleCancel = () => {
    if (options?.onCancel) {
      options.onCancel();
    }
    closeConfirmation();
  };

  return (
    <ConfirmationContext.Provider value={{ openConfirmation, closeConfirmation }}>
      {children}
      {isOpen && options && (
        <ConfirmationModal
          isOpen={isOpen}
          title={options.title}
          message={options.message}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          confirmButtonClass={options.confirmButtonClass}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={loading}
        />
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (context === undefined) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
