import { useRouter } from "next/router";
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import RepoDetail from "../components/RepoDetail";
import ConnectWallet from "../components/ConnectWallet";
import Link from "next/link";

// RepoDetail과 호환되는 확장된 레포 데이터 인터페이스
interface RepoData { 
  name: string; 
  cid: string; 
  tags?: any[];
  timestamp?: number;
  owner?: string;
  repository?: any;
  selectedBranch?: any;
}

export default function RepoPage() {
    const { repo } = useRouter().query;
    const wallet = useWallet();
    const [publicKey, setPublicKey] = useState('');
    const [selectedRepo, setSelectedRepo] = useState<RepoData | undefined>(undefined);

    useEffect(() => {
        if (wallet.connected && wallet.publicKey) {
            setPublicKey(wallet.publicKey.toBase58());
        } else {
            setPublicKey('');
        }
    }, [wallet.connected, wallet.publicKey]);

    useEffect(() => {
        // sessionStorage에서 선택된 repo 데이터 가져오기
        if (typeof window !== 'undefined') {
            const storedRepo = sessionStorage.getItem('selectedRepo');
            if (storedRepo) {
                try {
                    const parsedRepo = JSON.parse(storedRepo);
                    setSelectedRepo(parsedRepo);
                    // 사용 후 정리
                    sessionStorage.removeItem('selectedRepo');
                } catch (error) {
                    console.warn('저장된 repo 데이터 파싱 실패:', error);
                }
            }
        }
    }, []);

    if (typeof repo !== "string") return <p>잘못된 경로입니다.</p>;

    return (
        <div className="container">
            <Link href="/" style={{ 
                textDecoration: 'none', 
                color: '#2563eb',
                fontSize: '14px',
                marginBottom: '16px',
                display: 'inline-block'
            }}>
                ← 메인으로 돌아가기
            </Link>
            
            {!wallet.connected ? (
                <div>
                    <h2>{selectedRepo?.name || repo}</h2>
                    <div style={{
                        padding: '20px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        color: '#92400e'
                    }}>
                        <p style={{ margin: '0 0 12px 0', fontWeight: '500' }}>
                            ⚠️ 저장소를 보려면 지갑을 연결해야 합니다
                        </p>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
                            연결된 지갑으로 업로드된 저장소만 확인할 수 있습니다.
                        </p>
                        <ConnectWallet
                            onConnect={(w, pk) => {
                                setPublicKey(pk);
                            }}
                        />
                    </div>
                </div>
            ) : (
                <RepoDetail 
                    repoName={repo} 
                    owner={publicKey} 
                    repo={selectedRepo}
                />
            )}
        </div>
    );
} 