// components/ConnectWallet.tsx
import { useEffect, useState } from 'react';
import { useClientWallet, useClientWalletModal } from '../lib/useClientWallet';

import styles from './ConnectWallet.module.css';

export default function ConnectWallet({
  onConnect,
}: {
  onConnect: (wallet: any, publicKey: string) => void;
}) {
  const wallet = useClientWallet();
  const { setVisible } = useClientWalletModal();
  const [isConnecting, setIsConnecting] = useState(false);

  // Connect wallet and pass to parent
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      // Pass the entire wallet object as per Irys documentation
      onConnect(wallet, wallet.publicKey.toBase58());
      setIsConnecting(false);
    }
  }, [wallet.connected, wallet.publicKey, onConnect, wallet]);

  const handleConnect = () => {
    setIsConnecting(true);
    setVisible(true);
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };

  return wallet.connected ? (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={handleDisconnect}
      >
        Disconnect
      </button>
    </>
  ) : (
    <button
      type="button"
      className={styles.button}
      onClick={handleConnect}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : 'Connect Solana Wallet'}
    </button>
  );
}
