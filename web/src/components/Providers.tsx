'use client';

import {useState} from 'react';
import type {ReactNode} from 'react';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

interface ProvidersProps {
  children: ReactNode;
}

const Providers = ({children}: ProvidersProps) => {
  // 요청마다 새 QueryClient가 생기지 않도록 컴포넌트 수명 동안 하나만 만든다.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export default Providers;
