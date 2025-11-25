"use client";

import { PropsWithChildren, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// optional: import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function ReactQueryProvider({ children }: PropsWithChildren) {
  // ensure a single client per browser session
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 2,
          },
          mutations: { retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}


// React Query: It's a library for managing "server state." Think of it as a supercharged data-fetching tool. It handles caching (so you don't re-fetch data constantly), background updates (refetchOnWindowFocus), and retries for you, making your app feel faster and more reliable. Your use of it for polling balances is a perfect use case.