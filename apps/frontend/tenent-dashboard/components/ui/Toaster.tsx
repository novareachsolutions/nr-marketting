
import { useState, useCallback } from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import type { ToastInstance } from '@repo/shared-frontend';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex items-start gap-3 w-[380px] p-4 rounded-lg border shadow-lg bg-bg-card border-border text-text-primary',
          title: 'text-sm font-semibold',
          description: 'text-xs text-text-secondary mt-0.5',
          actionButton:
            'bg-accent-primary text-white text-xs font-semibold px-3 py-1.5 rounded-md',
          cancelButton:
            'bg-bg-tertiary text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-md',
          closeButton:
            'text-text-tertiary hover:text-text-primary',
        },
      }}
    />
  );
}

// ─── Toast helper that matches the old ToastInstance interface ───
export const toast: ToastInstance = {
  success: (title: string, message?: string) =>
    sonnerToast.success(title, { description: message }),
  error: (title: string, message?: string) =>
    sonnerToast.error(title, { description: message }),
  warning: (title: string, message?: string) =>
    sonnerToast.warning(title, { description: message }),
  info: (title: string, message?: string) =>
    sonnerToast.info(title, { description: message }),
};

// ─── Backward-compatible hook (delegates to sonner) ─────
export function useToast() {
  return { toast };
}
