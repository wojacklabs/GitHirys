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

  // 사용자 정보 로드 (닉네임 또는 지갑 주소)
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!targetUser) return;

      // 이미 props에서 데이터를 받았으면 스킵
      if (initialUserProfile && initialWalletAddress) return;

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
  }, [targetUser, initialUserProfile, initialWalletAddress, router]);

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

  // 필수 정보 확인 중
  if (!targetUser || !targetRepo) {
    return (
      <>
        <Head>
          <title>GitHirys</title>
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
          owner={actualWalletAddress || targetUser}
          repo={parsedRepoData}
          uploader={uploader}
          currentWallet={publicKey}
        />
      </div>
    </>
  );
};

export async function getStaticPaths() {
  // 정적 사이트 생성에서는 fallback을 false로 설정
  // 모든 경로는 클라이언트 사이드에서 처리
  return {
    paths: [],
    fallback: false,
  };
}

export async function getStaticProps({
  params,
}: {
  params: { user: string; repo: string };
}) {
  // 정적 사이트에서는 빌드 시점에 모든 경로를 알 수 없으므로
  // 클라이언트 사이드에서 처리하도록 기본 props만 반환
  return {
    props: {},
  };
}

export default UserRepoPage;
