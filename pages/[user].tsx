import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
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
  const wallet = useClientWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<string>('');
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
    if (typeof queryUser === 'string') {
      setTargetUser(queryUser);
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
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet]);

  const isOwnProfile = publicKey && actualWalletAddress === publicKey;

  // 페이지 타이틀 생성
  const pageTitle =
    userProfile?.nickname ||
    (actualWalletAddress
      ? `${actualWalletAddress.substring(0, 8)}...${actualWalletAddress.slice(-4)}`
      : 'GitHirys');

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <div className="container">
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
    </>
  );
};

export default UserPage;
