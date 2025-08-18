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
  // Use Helius RPC with the provided API key
  const endpoint = useMemo(() => {
    // Helius RPC endpoint with API key
    const heliusRpc =
      'https://mainnet.helius-rpc.com/?api-key=33ec3a18-f17c-4987-bc8d-488e767a6985';

    // Use environment variable if provided, otherwise use Helius
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || heliusRpc;
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
