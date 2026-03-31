import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { setGlobalToast, ToastInstance } from '@repo/shared-frontend'

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  }))

  // Optional: Set up global toast (you can replace this with your toast library)
  // Example with a simple implementation:
  // useEffect(() => {
  //   setGlobalToast({
  //     success: (title, message) => console.log('Success:', title, message),
  //     error: (title, message) => console.error('Error:', title, message),
  //     warning: (title, message) => console.warn('Warning:', title, message),
  //     info: (title, message) => console.info('Info:', title, message),
  //   })
  // }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
    </QueryClientProvider>
  )
}
