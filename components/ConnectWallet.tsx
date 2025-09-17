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
  const [showWarning, setShowWarning] = useState(false);

  // Connect wallet and pass to parent
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      // Pass the entire wallet object as per Irys documentation
      onConnect(wallet, wallet.publicKey.toBase58());
      setIsConnecting(false);
    }
  }, [wallet.connected, wallet.publicKey, onConnect, wallet]);

  const handleConnect = () => {
    setShowWarning(true);
  };

  const handleConfirmConnect = () => {
    setShowWarning(false);
    setIsConnecting(true);
    setVisible(true);
  };

  const handleCancelConnect = () => {
    setShowWarning(false);
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };

  return (
    <>
      {showWarning && (
        <div className={styles.warningModal}>
          <div className={styles.warningContent}>
            <h3 className={styles.warningTitle}>⚠️ 보안 경고</h3>
            <p className={styles.warningText}>
              GitHirys는 정상적인 분산형 Git 저장소 서비스입니다.
            </p>
            <p className={styles.warningText}>
              <strong>중요:</strong> GitHirys는 절대로 다음을 요구하지 않습니다:
            </p>
            <ul className={styles.warningList}>
              <li>시드 구문 (Seed Phrase)</li>
              <li>프라이빗 키 (Private Key)</li>
              <li>지갑 비밀번호</li>
            </ul>
            <p className={styles.warningText}>
              지갑 연결 시 공개 주소만 사용되며, 서명이 필요한 경우 지갑 앱에서
              직접 확인 후 승인하세요.
            </p>
            <div className={styles.warningButtons}>
              <button
                className={styles.confirmButton}
                onClick={handleConfirmConnect}
              >
                이해했습니다. 계속하기
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancelConnect}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {wallet.connected ? (
        <button
          type="button"
          className={styles.button}
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          className={styles.button}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Solana Wallet'}
        </button>
      )}
    </>
  );
}
