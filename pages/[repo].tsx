import { useRouter } from "next/router";
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import RepoDetail from "../components/RepoDetail";
import ConnectWallet from "../components/ConnectWallet";
import Link from "next/link";

export default function RepoPage() {
    const { repo } = useRouter().query;
    const wallet = useWallet();
    const [publicKey, setPublicKey] = useState('');

    useEffect(() => {
        if (wallet.connected && wallet.publicKey) {
            setPublicKey(wallet.publicKey.toBase58());
        } else {
            setPublicKey('');
        }
    }, [wallet.connected, wallet.publicKey]);

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
                    <h2>{repo}</h2>
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
                <RepoDetail repoName={repo} owner={publicKey} />
            )}
        </div>
    );
} 