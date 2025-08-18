import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  // Add other wallet adapters if needed
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaProviderProps {
  children: React.ReactNode;
}

export default function SolanaProvider({ children }: SolanaProviderProps) {
  // Use a browser-friendly RPC endpoint instead of the default one
  // The default api.mainnet-beta.solana.com returns 403 in browsers
  const endpoint = useMemo(() => {
    // Options for browser-friendly RPC endpoints:
    // 1. Helius (free tier available)
    // return 'https://mainnet.helius-rpc.com/?api-key=<your-key>';

    // 2. Use wallet's own RPC (Phantom, Solflare provide their own)
    // This is handled automatically when wallet connects

    // 3. For now, use a public RPC that allows browser access
    return 'https://solana-mainnet.rpc.extrnode.com';
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
