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
        console.log("Irys 업로더를 초기화하는 중...");
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
        console.log("Irys 업로더가 성공적으로 초기화되었습니다");
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      } finally {
        setIsConnecting(false);
      }
    };

    initUploader();
  }, [wallet]);

  return (
    <div className="container">
      <h1>Irys Git 저장소 관리 (Solana)</h1>
      <p style={{ 
        fontSize: '16px', 
        color: '#4b5563', 
        marginBottom: '24px',
        lineHeight: '1.6'
      }}>
        솔라나 지갑을 연결하여 Irys에 업로드된 Git 저장소를 관리하세요.
      </p>
      
      <ConnectWallet
        onConnect={(w, pk) => {
          setWallet(w);
          setPublicKey(pk);
        }}
      />
      
      {wallet && wallet.connected && (
        <div style={{ marginTop: '20px' }}>
          {isConnecting ? (
            <div style={{ 
              padding: '16px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              color: '#92400e'
            }}>
              <p style={{ margin: 0 }}>⏳ Irys에 연결하는 중...</p>
            </div>
          ) : uploader ? (
            <div style={{ 
              padding: '16px',
              backgroundColor: '#dcfce7',
              border: '1px solid #16a34a',
              borderRadius: '6px',
              color: '#166534',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0 }}>
                ✅ Irys에 성공적으로 연결되었습니다: <code>{uploader.address}</code>
              </p>
            </div>
          ) : (
            <div style={{ 
              padding: '16px',
              backgroundColor: '#fee2e2',
              border: '1px solid #dc2626',
              borderRadius: '6px',
              color: '#991b1b'
            }}>
              <p style={{ margin: 0 }}>❌ Irys 연결에 실패했습니다</p>
            </div>
          )}
          
          {uploader && <RepoList uploader={uploader} owner={publicKey} />}
        </div>
      )}
      
      {!wallet?.connected && (
        <div style={{ 
          marginTop: '32px',
          padding: '20px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0, color: '#374151' }}>이 서비스에 대해</h3>
          <ul style={{ 
            color: '#6b7280', 
            lineHeight: '1.6',
            paddingLeft: '20px'
          }}>
            <li>솔라나 지갑을 연결하여 Irys에 업로드된 Git 저장소를 확인할 수 있습니다</li>
            <li>저장소의 파일 트리를 탐색하고 코드를 직접 확인할 수 있습니다</li>
            <li>Git clone 명령어를 제공하여 로컬에서 저장소를 다운로드할 수 있습니다</li>
            <li>저장소 업로드 시 "Application" 태그를 "irys-git"으로 설정해야 합니다</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Home;
