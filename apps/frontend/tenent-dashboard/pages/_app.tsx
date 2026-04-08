import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { setGlobalToast } from '@repo/shared-frontend';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster, toast } from '@/components/ui/Toaster';
import { TooltipProvider } from '@/components/ui/Tooltip';

function InnerApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    setGlobalToast(toast);
    return () => setGlobalToast(null);
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Toaster />
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
        <TooltipProvider>
          <InnerApp {...props} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
