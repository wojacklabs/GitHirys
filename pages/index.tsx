// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import ConnectWallet from '../components/ConnectWallet';
import RepoList from '../components/RepoList';
import { createIrysUploader } from '../lib/irys';

const Home: NextPage = () => {
  const [wallet, setWallet] = useState<any>(null);
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Create uploader when wallet changes
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet) {
        setUploader(null);
        return;
      }

      try {
        setIsConnecting(true);
        console.log("Initializing Irys uploader...");
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
        console.log("Irys uploader initialized successfully");
      } catch (error) {
        console.error('Failed to create Irys uploader:', error);
        setUploader(null);
      } finally {
        setIsConnecting(false);
      }
    };

    initUploader();
  }, [wallet]);

  return (
    <div className="container">
      <h1>Irys Git-like Service (Solana)</h1>
      <ConnectWallet
        onConnect={(w, pk) => {
          setWallet(w);
          setPublicKey(pk);
        }}
      />
      {wallet && wallet.connected && (
        <div style={{ marginTop: '20px' }}>
          {isConnecting ? (
            <p>Connecting to Irys...</p>
          ) : uploader ? (
            <>
              <p>✅ Connected to Irys: {uploader.address}</p>
              <RepoList uploader={uploader} owner={publicKey} />
            </>
          ) : (
            <p>❌ Failed to connect to Irys</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
