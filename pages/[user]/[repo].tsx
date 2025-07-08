import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../../lib/useClientWallet';
import Head from 'next/head';
import RepoDetail from '../../components/RepoDetail';
import {
  createIrysUploader,
  getProfileByAddress,
  getProfileByNickname,
  UserProfile,
  searchRepositories,
} from '../../lib/irys';
import Link from 'next/link';
import styles from '../../styles/UserRepo.module.css';

const UserRepoPage: NextPage = () => {
  const router = useRouter();
  const { user: queryUser, repo: queryRepo } = router.query;
  const wallet = useClientWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('');
  const [targetRepo, setTargetRepo] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [actualWalletAddress, setActualWalletAddress] = useState<string>('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      setPublicKey(wallet.publicKey.toBase58());
    } else {
      setPublicKey('');
    }
  }, [wallet.connected, wallet.publicKey]);

  // 라우터에서 사용자 및 저장소 정보 추출
  useEffect(() => {
    if (
      router.isReady &&
      typeof queryUser === 'string' &&
      queryUser &&
      typeof queryRepo === 'string' &&
      queryRepo
    ) {
      setTargetUser(queryUser);
      setTargetRepo(queryRepo);
      setIsInitialized(true);
    }
  }, [router.isReady, queryUser, queryRepo]);

  // 사용자 정보 및 저장소 존재 여부 확인
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!targetUser || !targetRepo || !isInitialized) return;

      setIsLoadingProfile(true);
      setPageError(null);

      try {
        // 솔라나 지갑 주소 형식인지 확인
        const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
          targetUser
        );

        let resolvedWalletAddress = '';
        let profile: UserProfile | null = null;

        if (isWalletAddress) {
          // 지갑 주소로 프로필 조회
          resolvedWalletAddress = targetUser;
          profile = await getProfileByAddress(targetUser);
        } else {
          // 닉네임으로 프로필 조회
          profile = await getProfileByNickname(targetUser);
          if (profile) {
            resolvedWalletAddress = profile.accountAddress;
          } else {
            // 닉네임에 해당하는 프로필이 없는 경우
            setPageError('사용자를 찾을 수 없습니다.');
            return;
          }
        }

        setUserProfile(profile);
        setActualWalletAddress(resolvedWalletAddress);

        // 저장소 존재 여부 확인
        const repositories = await searchRepositories(resolvedWalletAddress);
        const targetRepository = repositories.find(r => r.name === targetRepo);

        if (!targetRepository) {
          setPageError('저장소를 찾을 수 없습니다.');
          return;
        }
      } catch (error) {
        console.error('사용자/저장소 정보 로딩 오류:', error);
        setPageError('정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserInfo();
  }, [targetUser, targetRepo, isInitialized]);

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

  // 라우터 준비 대기 중
  if (!router.isReady || !isInitialized) {
    return (
      <>
        <Head>
          <title>GitHirys</title>
        </Head>
        <div className="container">
          <p style={{ marginTop: 40 }}>페이지를 준비 중입니다...</p>
        </div>
      </>
    );
  }

  // 에러 발생 시
  if (pageError) {
    return (
      <>
        <Head>
          <title>GitHirys - 페이지를 찾을 수 없음</title>
        </Head>
        <div className="container">
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <h1>404 - 페이지를 찾을 수 없습니다</h1>
            <p>{pageError}</p>
            <Link href="/">홈으로 돌아가기</Link>
          </div>
        </div>
      </>
    );
  }

  // 프로필 정보 로딩 중
  if (isLoadingProfile) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
        </Head>
        <div className="container">
          <p style={{ marginTop: 40 }}>Fetching Repository Data...</p>
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
          owner={actualWalletAddress || targetUser}
          repo={parsedRepoData}
          uploader={uploader}
          currentWallet={publicKey}
        />
      </div>
    </>
  );
};

export default UserRepoPage;
