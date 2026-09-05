'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000, // 2 seconds
            refetchInterval: 3000, // 3 seconds live polling when app is in focus
            refetchIntervalInBackground: false,
            refetchOnWindowFocus: true,
            refetchOnMount: 'always',
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
