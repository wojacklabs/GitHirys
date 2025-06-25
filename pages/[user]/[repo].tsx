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
  clearExpiredCache,
} from '../../lib/irys';
import Link from 'next/link';
import styles from '../../styles/UserRepo.module.css';

interface UserRepoPageProps {
  user?: string;
  repo?: string;
  userProfile?: UserProfile | null;
  actualWalletAddress?: string;
}

const UserRepoPage: NextPage<UserRepoPageProps> = ({
  user: propUser,
  repo: propRepo,
  userProfile: initialUserProfile,
  actualWalletAddress: initialWalletAddress,
}) => {
  const router = useRouter();
  const { user: queryUser, repo: queryRepo } = router.query;
  const wallet = useClientWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('');
  const [targetRepo, setTargetRepo] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    initialUserProfile || null
  );
  const [actualWalletAddress, setActualWalletAddress] = useState<string>(
    initialWalletAddress || ''
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      setPublicKey(wallet.publicKey.toBase58());
    } else {
      setPublicKey('');
    }
  }, [wallet.connected, wallet.publicKey]);

  useEffect(() => {
    const user = propUser || (typeof queryUser === 'string' ? queryUser : '');
    const repo = propRepo || (typeof queryRepo === 'string' ? queryRepo : '');
    if (user && repo) {
      setTargetUser(user);
      setTargetRepo(repo);
    }
  }, [propUser, propRepo, queryUser, queryRepo]);

  // 사용자 정보와 uploader를 병렬로 로드
  useEffect(() => {
    const loadData = async () => {
      if (!targetUser) return;

      // 이미 props에서 데이터를 받았으면 프로필 로딩은 스킵
      const shouldLoadProfile = !initialUserProfile || !initialWalletAddress;

      if (shouldLoadProfile) {
        setIsLoadingProfile(true);
      }

      if (wallet && wallet.connected) {
        setIsConnecting(true);
      }

      try {
        const promises: Promise<any>[] = [];

        // 프로필 로딩 Promise 추가
        if (shouldLoadProfile) {
          const profilePromise = (async () => {
            // 솔라나 지갑 주소 형식인지 확인
            const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
              targetUser
            );

            if (isWalletAddress) {
              // 지갑 주소로 프로필 조회
              setActualWalletAddress(targetUser);
              const profile = await getProfileByAddress(targetUser);
              return { profile, actualWalletAddress: targetUser };
            } else {
              // 닉네임으로 프로필 조회
              const profile = await getProfileByNickname(targetUser);
              if (profile) {
                return { profile, actualWalletAddress: profile.accountAddress };
              } else {
                throw new Error('Profile not found');
              }
            }
          })();
          promises.push(profilePromise);
        }

        // Uploader 생성 Promise 추가 (지갑이 연결된 경우)
        if (wallet && wallet.connected) {
          const uploaderPromise = createIrysUploader(wallet).catch(error => {
            console.error('Irys 업로더 생성 실패:', error);
            return null;
          });
          promises.push(uploaderPromise);
        }

        // 모든 Promise를 병렬로 실행
        const results = await Promise.allSettled(promises);

        // 프로필 결과 처리
        if (shouldLoadProfile && results[0].status === 'fulfilled') {
          const { profile, actualWalletAddress } = results[0].value;
          setUserProfile(profile);
          setActualWalletAddress(actualWalletAddress);
        } else if (shouldLoadProfile && results[0].status === 'rejected') {
          router.push('/404');
          return;
        }

        // Uploader 결과 처리
        if (wallet && wallet.connected && results.length > 1) {
          if (results[1].status === 'fulfilled') {
            setUploader(results[1].value);
          } else {
            setUploader(null);
          }
        }
      } catch (error) {
        console.error('데이터 로딩 오류:', error);
        router.push('/404');
      } finally {
        setIsLoadingProfile(false);
        setIsConnecting(false);
      }
    };

    loadData();
  }, [targetUser, initialUserProfile, initialWalletAddress, wallet, router]);

  // 컴포넌트 언마운트 시 캐시 정리
  useEffect(() => {
    return () => {
      clearExpiredCache();
    };
  }, []);

  const isOwnProfile = publicKey && actualWalletAddress === publicKey;

  // 페이지 타이틀 생성
  const pageTitle = targetRepo || 'GitHirys';

  // 프로필 정보 로딩 중
  if (isLoadingProfile) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
          <meta property="og:title" content={pageTitle} />
          <meta
            name="description"
            content="GitHirys - 프로필 정보를 불러오는 중입니다"
          />
        </Head>
        <div className="container">
          <p style={{ marginTop: 40 }}>Fetching User Data...</p>
        </div>
      </>
    );
  }

  // 필수 정보 확인 중
  if (!targetUser || !targetRepo) {
    return (
      <>
        <Head>
          <title>GitHirys - 로딩 중</title>
          <meta property="og:title" content="GitHirys - 로딩 중" />
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
        <meta property="og:title" content={pageTitle} />
        <meta
          property="og:url"
          content={`https://githirys.xyz/${targetUser}/${targetRepo}`}
        />
        <meta name="twitter:title" content={pageTitle} />
        <meta
          name="description"
          content={`${targetRepo} - ${userProfile?.nickname || targetUser}의 GitHirys 저장소. 분산형 Git에서 코드를 확인하세요`}
        />
        <meta
          property="og:description"
          content={`${targetRepo} - ${userProfile?.nickname || targetUser}의 GitHirys 저장소. 분산형 Git에서 코드를 확인하세요`}
        />
        {userProfile?.profileImageUrl && (
          <meta property="og:image" content={userProfile.profileImageUrl} />
        )}
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

// SPA 모드로 전환하여 모든 라우팅을 클라이언트 사이드에서 처리

export default UserRepoPage;
