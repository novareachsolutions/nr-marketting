import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { setGlobalToast } from '@repo/shared-frontend';
import { AuthProvider } from '@/context/AuthContext';
import { ToastContainer, useToast } from '@/components/ui/Toast';

function InnerApp({ Component, pageProps }: AppProps) {
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    setGlobalToast(toast);
    return () => setGlobalToast(null);
  }, [toast]);

  return (
    <>
      <Component {...pageProps} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

export default function App(props: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp {...props} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
