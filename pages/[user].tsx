import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import ConnectWallet from '../components/ConnectWallet';
import RepoList from '../components/RepoList';
import {
  createIrysUploader,
  getProfileByAddress,
  getProfileByNickname,
  UserProfile,
} from '../lib/irys';
import Link from 'next/link';
import styles from '../styles/UserPage.module.css';

const UserPage: NextPage = () => {
  const router = useRouter();
  const { user: queryUser } = router.query;
  const wallet = useWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('');
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
    if (typeof queryUser === 'string') {
      setTargetUser(queryUser);
      console.log('👤 대상 사용자 설정:', queryUser);
    }
  }, [queryUser]);

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
        console.log('Irys 업로더를 초기화하는 중...');
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
        console.log('Irys 업로더가 성공적으로 초기화되었습니다');
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

  if (!targetUser) {
    return (
      <div className="container">
        <div className={styles.backLinkContainer}>
          <h1 className={styles.title_page}>Set Profile</h1>
          <Link href="/" className={styles.link_back}>
            ← Back
          </Link>
        </div>
        <p>Fetching User Data...</p>
      </div>
    );
  }

  if (isLoadingProfile) {
    return (
      <div className="container">
        <div className={styles.backLinkContainer}>
          <Link href="/" className={styles.link_back}>
            ← Back
          </Link>
        </div>
        <p>Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className={styles.backLinkContainer}>
        <Link href="/" className={styles.link_back}>
          ← Back
        </Link>
      </div>
      {/* 사용자 프로필 헤더 */}
      <div className={styles.profileHeader}>
        <div className={styles.profileImageContainer}>
          {userProfile?.profileImageUrl && (
            <img
              src={userProfile.profileImageUrl}
              alt={`${userProfile.nickname}'s profile'`}
              className={styles.profileImage}
            />
          )}
          <div>
            <h1 className={styles.profileTitle}>
              {userProfile?.nickname ? (
                <>
                  {userProfile.nickname}
                  {isOwnProfile && (
                    <span className={styles.ownProfileBadge}>✅ ME</span>
                  )}
                </>
              ) : (
                `${actualWalletAddress.substring(0, 8)}...'s Repository`
              )}
            </h1>
            {userProfile?.twitterHandle && (
              <p className={styles.twitterLink}>
                <a
                  href={`https://twitter.com/${userProfile.twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.twitterLinkAnchor}
                >
                  @{userProfile.twitterHandle}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* 프로필 정보 카드 */}
        <div className={styles.profileInfoCard}>
          <div className={styles.profileInfoGrid}>
            {userProfile?.nickname && (
              <div className={styles.profileInfoRow}>
                <span className={styles.profileInfoLabel}>Nickname</span>
                <span>{userProfile.nickname}</span>
              </div>
            )}
            <div className={styles.profileInfoRow}>
              <span className={styles.profileInfoLabel}>Wallet Address</span>
              <code className={styles.walletAddress}>
                {actualWalletAddress}
              </code>
            </div>
            {userProfile?.nickname && (
              <div className={styles.profileInfoRow}>
                <span className={styles.profileInfoLabel}>Profile URL</span>
                <code className={styles.profileUrl}>
                  githirys.xyz/{userProfile.nickname}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>
      {!wallet.connected ? (
        <div>
          <RepoList
            uploader={null}
            owner={actualWalletAddress}
            currentWallet={publicKey}
          />
        </div>
      ) : (
        <div>
          <RepoList
            uploader={uploader}
            owner={actualWalletAddress}
            currentWallet={publicKey}
          />
        </div>
      )}
    </div>
  );
};

export default UserPage;
