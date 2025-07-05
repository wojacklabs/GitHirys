import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import RepoDetail from '../../components/RepoDetail';
import { 
  createIrysUploader, 
  getProfileByAddress, 
  getProfileByNickname, 
  UserProfile 
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
  const [isNickname, setIsNickname] = useState(false);
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
      console.log('🎯 대상 사용자/저장소 설정:', queryUser, queryRepo);
    }
  }, [queryUser, queryRepo]);

  // 사용자 정보 로드 (닉네임 또는 지갑 주소)
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!targetUser) return;

      setIsLoadingProfile(true);
      try {
        // 솔라나 지갑 주소 형식인지 확인
        const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(targetUser);
        
        if (isWalletAddress) {
          // 지갑 주소로 프로필 조회
          console.log('🔍 지갑 주소로 프로필 조회:', targetUser);
          setIsNickname(false);
          setActualWalletAddress(targetUser);
          
          const profile = await getProfileByAddress(targetUser);
          setUserProfile(profile);
        } else {
          // 닉네임으로 프로필 조회
          console.log('🔍 닉네임으로 프로필 조회:', targetUser);
          setIsNickname(true);
          
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

  const isOwnProfile = publicKey && actualWalletAddress === publicKey;

  // 프로필 정보 로딩 중
  if (isLoadingProfile) {
    return (
      <div className="container">
        <div className={styles.breadcrumbs}>
          <Link href="/" className={styles.backLink}>
            ← 홈으로 돌아가기
          </Link>
        </div>
        <p>사용자 프로필을 불러오는 중...</p>
      </div>
    );
  }

  // 필수 정보 로딩 중
  if (!targetUser || !targetRepo || !actualWalletAddress) {
    return (
      <div className="container">
        <div className={styles.breadcrumbs}>
          <Link href="/" className={styles.backLink}>
            ← 홈으로 돌아가기
          </Link>
        </div>
        <p>페이지 정보를 로딩하는 중...</p>
      </div>
    );
  }

  // 저장소 데이터 준비
  const repoData = sessionStorage.getItem('selectedRepo');
  const parsedRepoData = repoData ? JSON.parse(repoData) : null;

  return (
    <div className="container">
      <div className={styles.breadcrumbs}>
        <Link href="/" className={styles.backLink}>
          ← 홈으로 돌아가기
        </Link>
        <span className={styles.breadcrumbSeparator}>|</span>
        <Link href={`/${targetUser}`} className={styles.backLink}>
          {userProfile?.nickname ? `${userProfile.nickname}의 저장소` : `${targetUser}의 저장소`}
        </Link>
      </div>

      {/* 사용자 프로필 미니 헤더 */}
      {userProfile && (
        <div className={styles.profileMiniHeader}>
          {userProfile.profileImageUrl && (
            <img
              src={userProfile.profileImageUrl}
              alt={`${userProfile.nickname}의 프로필`}
              className={styles.profileImage}
            />
          )}
          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <span className={styles.profileName}>
                {userProfile.nickname}
              </span>
              {isOwnProfile && (
                <span className={styles.ownRepoLabel}>✅ 내 저장소</span>
              )}
            </div>
            {userProfile.twitterHandle && (
              <div className={styles.profileTwitter}>
                🐦 @{userProfile.twitterHandle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 지갑 연결 상태 표시 */}
      {wallet.connected && (
        <div className={styles.connectionStatus}>
          {isConnecting ? (
            <div className={styles.statusConnecting}>
              ⏳ Irys에 연결하는 중...
            </div>
          ) : uploader ? (
            <div className={styles.statusConnected}>
              ✅ 지갑이 연결되었습니다. 관리 모드가 활성화되었습니다.
            </div>
          ) : (
            <div className={styles.statusError}>
              ❌ Irys 연결에 실패했습니다. 읽기 전용으로 진행합니다.
            </div>
          )}
        </div>
      )}

      {/* 저장소 상세 정보 */}
      <RepoDetail
        repoName={targetRepo}
        owner={actualWalletAddress}
        repo={parsedRepoData}
        uploader={uploader}
        currentWallet={publicKey}
      />
    </div>
  );
};

export default UserRepoPage; 