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
  // Use RPC endpoint from environment variable
  const endpoint = useMemo(() => {
    // Use environment variable for RPC endpoint
    // This should be set in .env.local and Vercel environment variables
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      'https://api.mainnet-beta.solana.com'
    );
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
