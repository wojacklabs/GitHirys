import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function useClientWallet() {
  const [mounted, setMounted] = useState(false);
  const wallet = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 서버 사이드에서는 안전한 기본값 반환
  if (!mounted) {
    return {
      connected: false,
      publicKey: null,
      connecting: false,
      disconnecting: false,
      wallet: null,
      connect: async () => {},
      disconnect: async () => {},
      select: () => {},
      signTransaction: undefined,
      signAllTransactions: undefined,
      signMessage: undefined,
    };
  }

  // 클라이언트 사이드에서는 실제 wallet 객체 반환
  return wallet;
}

export function useClientWalletModal() {
  const [mounted, setMounted] = useState(false);
  const walletModal = useWalletModal();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 서버 사이드에서는 안전한 기본값 반환
  if (!mounted) {
    return {
      setVisible: () => {},
      visible: false,
    };
  }

  // 클라이언트 사이드에서는 실제 walletModal 객체 반환
  return walletModal;
}
