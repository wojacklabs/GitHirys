// components/ConnectWallet.tsx
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWallet({
  onConnect,
}: {
  onConnect: (wallet: any, publicKey: string) => void;
}) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [isConnecting, setIsConnecting] = useState(false);

  // Connect wallet and pass to parent
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      console.log('Wallet connected successfully:', wallet.publicKey.toBase58());
      // Pass the entire wallet object as per Irys documentation
      onConnect(wallet, wallet.publicKey.toBase58());
      setIsConnecting(false);
    }
  }, [wallet.connected, wallet.publicKey, onConnect, wallet]);

  const handleConnect = () => {
    console.log('Attempting to connect wallet');
    setIsConnecting(true);
    setVisible(true);
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
      console.log('Wallet disconnected');
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };

  return wallet.connected ? (
    <div className="wallet-status">
      <div>✅ Wallet Connected: <code>{wallet.publicKey?.toBase58()}</code></div>
      <button 
        onClick={handleDisconnect}
        style={{ 
          marginTop: '8px', 
          backgroundColor: '#dc2626',
          fontSize: '12px',
          padding: '8px 16px'
        }}
      >
        Disconnect
      </button>
    </div>
  ) : (
    <button 
      onClick={handleConnect}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : 'Connect Solana Wallet'}
    </button>
  );
}
