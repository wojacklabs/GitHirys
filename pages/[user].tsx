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
  clearExpiredCache,
  debugProfileImageUrls,
  debugMutableResolveStatus,
  testMutableResolve,
  URLUtils,
} from '../lib/irys';
import Link from 'next/link';
import styles from '../styles/UserPage.module.css';

interface UserPageProps {
  user?: string;
  userProfile?: UserProfile | null;
  actualWalletAddress?: string;
}

const UserPage: NextPage<UserPageProps> = ({
  user: propUser,
  userProfile: initialUserProfile,
  actualWalletAddress: initialWalletAddress,
}) => {
  const router = useRouter();
  const { user: queryUser } = router.query;
  const wallet = useClientWallet();
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<string>('');
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
    if (user) {
      setTargetUser(user);
    }
  }, [propUser, queryUser]);

  // 사용자 정보와 uploader를 병렬로 로드
  useEffect(() => {
    const loadData = async () => {
      if (!targetUser) return;

      // 이미 props에서 데이터를 받았으면 프로필 로딩은 스킵
      const shouldLoadProfile = !initialUserProfile || !initialWalletAddress;

      if (shouldLoadProfile) {
        setIsLoadingProfile(true);
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
      }
    };

    loadData();
  }, [targetUser, initialUserProfile, initialWalletAddress, wallet, router]);

  // Wallet 변경 시 uploader 업데이트
  useEffect(() => {
    if (!wallet || !wallet.connected) {
      setUploader(null);
      return;
    }

    // 이미 uploader가 있으면 스킵 (초기 로드에서 처리됨)
    if (uploader) return;

    const initUploader = async () => {
      try {
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet.connected]);

  // 컴포넌트 언마운트 시 캐시 정리
  useEffect(() => {
    return () => {
      clearExpiredCache();
    };
  }, []);

  const isOwnProfile = publicKey && actualWalletAddress === publicKey;

  // 페이지 타이틀 생성
  const pageTitle =
    userProfile?.nickname ||
    (actualWalletAddress
      ? `${actualWalletAddress.substring(0, 8)}...${actualWalletAddress.slice(-4)}`
      : 'GitHirys');

  // 프로필 정보 로딩 중
  if (isLoadingProfile) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
          <meta property="og:title" content={pageTitle} />
          <meta
            property="og:url"
            content={`https://githirys.xyz/${targetUser}`}
          />
          <meta name="twitter:title" content={pageTitle} />
          <meta
            name="description"
            content={`${targetUser}의 GitHirys 프로필 - 분산형 Git 저장소 목록을 확인하세요`}
          />
          <meta
            property="og:description"
            content={`${targetUser}의 GitHirys 프로필 - 분산형 Git 저장소 목록을 확인하세요`}
          />
        </Head>
        <div className="container">
          {/* Skeleton Profile Header */}
          <div className="skeleton-profile-header">
            <div className="skeleton skeleton-profile-image"></div>
            <div className="skeleton-profile-info">
              <div className="skeleton skeleton-profile-name"></div>
              <div className="skeleton skeleton-profile-handle"></div>
            </div>
          </div>

          {/* Skeleton Profile Info Card */}
          <div className={styles.profileInfoCard} style={{ marginBottom: 30 }}>
            <div className={styles.profileInfoGrid}>
              {[1, 2, 3].map(index => (
                <div key={index} className={styles.profileInfoRow}>
                  <span
                    className="skeleton"
                    style={{ width: 100, height: 16 }}
                  ></span>
                  <span
                    className="skeleton"
                    style={{ width: 200, height: 16 }}
                  ></span>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Repository List */}
          <h3>Repositories</h3>
          <div className={styles.repoGrid}>
            {[1, 2, 3].map(index => (
              <div key={index} className="skeleton-repo-card">
                <div className="skeleton skeleton-repo-title"></div>
                <div className="skeleton-repo-meta">
                  {[1, 2, 3].map(line => (
                    <div key={line} className="skeleton-repo-meta-line">
                      <div className="skeleton skeleton-repo-meta-label"></div>
                      <div className="skeleton skeleton-repo-meta-value"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // 필수 정보 확인 중
  if (!targetUser) {
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

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} />
        <meta
          property="og:url"
          content={`https://githirys.xyz/${targetUser}`}
        />
        <meta name="twitter:title" content={pageTitle} />
        <meta
          name="description"
          content={`${userProfile?.nickname || targetUser}의 GitHirys 프로필 - 분산형 Git 저장소 목록을 확인하세요`}
        />
        <meta
          property="og:description"
          content={`${userProfile?.nickname || targetUser}의 GitHirys 프로필 - 분산형 Git 저장소 목록을 확인하세요`}
        />
        {userProfile?.profileImageUrl && (
          <meta property="og:image" content={userProfile.profileImageUrl} />
        )}
      </Head>
      <div className="container">
        {/* 개발 환경 디버깅 패널 */}
        {typeof window !== 'undefined' &&
          window.location.hostname === 'localhost' && (
            <div
              style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.9)',
                color: 'white',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '12px',
                zIndex: 9999,
                maxWidth: '300px',
              }}
            >
              <strong>🔧 Mutable Debug Panel</strong>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={debugProfileImageUrls}
                  style={{
                    padding: '4px 8px',
                    margin: '2px',
                    fontSize: '11px',
                    background: '#007acc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Check Images
                </button>
                <button
                  onClick={debugMutableResolveStatus}
                  style={{
                    padding: '4px 8px',
                    margin: '2px',
                    fontSize: '11px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Resolve Status
                </button>
                {userProfile?.rootTxId && (
                  <button
                    onClick={() => {
                      if (userProfile?.rootTxId) {
                        testMutableResolve(userProfile.rootTxId);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      margin: '2px',
                      fontSize: '11px',
                      background: '#ffc107',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Test Profile
                  </button>
                )}
              </div>
              {userProfile && (
                <div
                  style={{ marginTop: '8px', fontSize: '10px', opacity: 0.8 }}
                >
                  Profile: {userProfile.nickname}
                  <br />
                  RootTx: {userProfile.rootTxId?.slice(0, 12)}...
                  <br />
                  Image: {userProfile.profileImageUrl ? '✅' : '❌'}
                  <br />
                  Valid TX:{' '}
                  {userProfile.rootTxId &&
                  URLUtils.isValidTransactionId(userProfile.rootTxId)
                    ? '✅'
                    : '❌'}
                </div>
              )}
            </div>
          )}

        {/* 사용자 프로필 헤더 */}
        <div className={styles.profileHeader}>
          <div className={styles.profileImageContainer}>
            {userProfile?.profileImageUrl && (
              <img
                src={userProfile.profileImageUrl}
                alt={`${userProfile.nickname}'s profile`}
                className={styles.profileImage}
                onError={e => {
                  // 404 에러 시 이미지 숨기기
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  console.warn(
                    `Profile image failed to load: ${userProfile.profileImageUrl}`
                  );
                }}
                onLoad={() => {
                  console.log(
                    `Profile image loaded: ${userProfile.profileImageUrl}`
                  );
                }}
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
                ) : actualWalletAddress ? (
                  `${actualWalletAddress.substring(0, 8)}...'s Repository`
                ) : (
                  `${targetUser}'s Repository`
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
                  {actualWalletAddress || targetUser}
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
              owner={actualWalletAddress || targetUser}
              currentWallet={publicKey}
            />
          </div>
        ) : (
          <div>
            <RepoList
              uploader={uploader}
              owner={actualWalletAddress || targetUser}
              currentWallet={publicKey}
            />
          </div>
        )}
      </div>
    </>
  );
};

// SPA 모드로 전환하여 모든 라우팅을 클라이언트 사이드에서 처리

export default UserPage;
