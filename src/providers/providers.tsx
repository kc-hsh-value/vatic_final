"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { arbitrum, base, polygon } from "viem/chains";
// import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      // clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!}
      config={{
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users'
          },
          solana: {
            createOnLogin: 'all-users'
          }
        },
        appearance:{
            // logo:"",
            
        },
        defaultChain: polygon,
        supportedChains:[polygon, base, arbitrum],
        solanaClusters: [{name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com'}],
      }}
    >
      {/* <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          > */}

        {children}
      {/* </ThemeProvider> */}
    </PrivyProvider>
  );
}
