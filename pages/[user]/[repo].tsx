import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import Head from 'next/head';
import RepoDetail from '../../components/RepoDetail';
import {
  createIrysUploader,
  getProfileByAddress,
  getProfileByNickname,
  UserProfile,
} from '../../lib/irys';
import Link from 'next/link';
import styles from '../../styles/UserRepo.module.css';

const UserRepoPage: NextPage = () => {
  const router = useRouter();
  const { user: queryUser, repo: queryRepo } = router.query;
  const wallet = useWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('');
  const [targetRepo, setTargetRepo] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [actualWalletAddress, setActualWalletAddress] = useState<string>('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      setPublicKey(wallet.publicKey.toBase58());
    } else {
      setPublicKey('');
    }
  }, [wallet.connected, wallet.publicKey]);

  useEffect(() => {
    if (typeof queryUser === 'string' && typeof queryRepo === 'string') {
      setTargetUser(queryUser);
      setTargetRepo(queryRepo);
    }
  }, [queryUser, queryRepo]);

  // 사용자 정보 로드 (닉네임 또는 지갑 주소)
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!targetUser) return;

      setIsLoadingProfile(true);
      try {
        // 솔라나 지갑 주소 형식인지 확인
        const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
          targetUser
        );

        if (isWalletAddress) {
          // 지갑 주소로 프로필 조회
          setActualWalletAddress(targetUser);

          const profile = await getProfileByAddress(targetUser);
          setUserProfile(profile);
        } else {
          // 닉네임으로 프로필 조회
          const profile = await getProfileByNickname(targetUser);
          if (profile) {
            setUserProfile(profile);
            setActualWalletAddress(profile.accountAddress);
          } else {
            // 닉네임에 해당하는 프로필이 없는 경우 404로 리다이렉트
            router.push('/404');
            return;
          }
        }
      } catch (error) {
        console.error('사용자 정보 로딩 오류:', error);
        router.push('/404');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserInfo();
  }, [targetUser, router]);

  // Create uploader when wallet changes
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet || !wallet.connected) {
        setUploader(null);
        return;
      }

      try {
        setIsConnecting(true);
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      } finally {
        setIsConnecting(false);
      }
    };

    initUploader();
  }, [wallet]);

  const isOwnProfile = publicKey && actualWalletAddress === publicKey;

  // 페이지 타이틀 생성
  const pageTitle = targetRepo || 'GitHirys';

  // 프로필 정보 로딩 중
  if (isLoadingProfile) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
        </Head>
        <div className="container">
          <p style={{ marginTop: 40 }}>Fetching User Data...</p>
        </div>
      </>
    );
  }

  // 필수 정보 로딩 중
  if (!targetUser || !targetRepo || !actualWalletAddress) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
        </Head>
        <div className="container">
          <p style={{ marginTop: 40 }}>Fetching Page Data...</p>
        </div>
      </>
    );
  }

  // 저장소 데이터 준비
  const repoData = sessionStorage.getItem('selectedRepo');
  const parsedRepoData = repoData ? JSON.parse(repoData) : null;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <div className="container">
        {/* 저장소 상세 정보 */}
        <RepoDetail
          repoName={targetRepo}
          owner={actualWalletAddress}
          repo={parsedRepoData}
          uploader={uploader}
          currentWallet={publicKey}
        />
      </div>
    </>
  );
};

export default UserRepoPage;
