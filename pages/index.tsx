// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
import Marquee from 'react-fast-marquee';
import {
  createIrysUploader,
  searchRepositories,
  searchAllRepositories,
  getProfileByNickname,
  ProfileUtils,
  getDashboardStats,
  DashboardStats,
  getRecentUsers,
  getRecentRepositories,
  RecentUser,
  RecentRepository,
} from '../lib/irys';
import styles from '../styles/HomePage.module.css';
import AnimatedNumber from '../components/AnimatedNumber';
import UniverseScene from '../components/UniverseScene';

const Home: NextPage = () => {
  const router = useRouter();
  const wallet = useClientWallet();
  const [uploader, setUploader] = useState<any>(null);

  // Dashboard statistics state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );

  // Recent users and repositories state
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRepositories, setRecentRepositories] = useState<
    RecentRepository[]
  >([]);

  // Search related state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<
    'repository' | 'wallet' | 'nickname'
  >('repository');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load dashboard statistics
  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const stats = await getDashboardStats();
        setDashboardStats(stats);
      } catch (error) {
        console.error('Dashboard statistics load error:', error);
      }
    };

    loadDashboardStats();
  }, []);

  // Load recent users and repositories
  useEffect(() => {
    const loadRecentData = async () => {
      try {
        const [users, repositories] = await Promise.all([
          getRecentUsers(),
          getRecentRepositories(),
        ]);
        setRecentUsers(users);
        setRecentRepositories(repositories);
      } catch (error) {
        console.error('Recent data load error:', error);
      }
    };

    loadRecentData();
  }, []);

  // Create uploader when wallet changes
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet.connected) {
        setUploader(null);
        return;
      }

      try {
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys uploader creation failed:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet.connected, wallet]);

  // Solana wallet address format validation
  const isValidSolanaAddress = (address: string): boolean => {
    // Solana address is 32-44 character Base58 string
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Type something to search');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      if (searchType === 'wallet') {
        // Wallet address search
        if (isValidSolanaAddress(searchQuery.trim())) {
          // Display wallet information in result list
          const walletAddress = searchQuery.trim();
          setSearchResults([
            {
              type: 'wallet',
              address: walletAddress,
              displayName: `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`,
              fullAddress: walletAddress,
            },
          ]);
        } else {
          setSearchError('Not a valid Solana address.');
        }
      } else if (searchType === 'nickname') {
        // Nickname search (exact match only)
        // Nickname format validation
        if (!ProfileUtils.isValidNickname(searchQuery.trim())) {
          setSearchError(
            'Not a valid nickname. (3-20 english letter, number, underbar)'
          );
          return;
        }

        try {
          // Exact nickname search
          const profile = await getProfileByNickname(searchQuery.trim());
          if (profile) {
            // Display profile in result list
            setSearchResults([
              {
                ...profile,
                type: 'profile',
              },
            ]);
          } else {
            setSearchError(`Nickname called '${searchQuery}' not found`);
          }
        } catch (error) {
          setSearchError('Error occurred while searching');
        }
      } else {
        // Repository search - search all repositories

        try {
          const currentWallet = wallet.publicKey?.toBase58() || undefined;
          const repos = await searchAllRepositories(searchQuery, currentWallet);

          if (repos.length > 0) {
            setSearchResults(
              repos.map(repo => ({
                ...repo,
                type: 'repository',
              }))
            );
          } else {
            setSearchError(`Repository called '${searchQuery}' not found`);
          }
        } catch (error) {
          setSearchError('Error occurred while searching repositories');
        }
      }
    } catch (error) {
      setSearchError('Error occurred while searching');
    } finally {
      setIsSearching(false);
    }
  };

  // Enter key handling
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Search result click handling
  const handleSearchResultClick = (result: any) => {
    if (result.type === 'profile') {
      // Navigate to nickname page for profile result
      router.push(`/${result.nickname}`);
    } else if (result.type === 'wallet') {
      // Navigate to wallet page for wallet result
      router.push(`/${result.address}`);
    } else if (result.type === 'repository') {
      // Navigate to repository page for repository result
      router.push(`/${result.owner}/${result.name}`);
    }
  };

  // 3D 우주 환경을 위한 사용자 데이터 준비 - 사용자별로 저장소 그룹화
  const universeUsers = useMemo(() => {
    const userMap = new Map();

    // recentUsers를 먼저 추가 (비어있는 repositories 배열로 초기화)
    recentUsers.forEach(user => {
      userMap.set(user.accountAddress, {
        accountAddress: user.accountAddress,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        repositories: [],
      });
    });

    // recentRepositories를 사용자별로 그룹화해서 추가
    recentRepositories.forEach(repo => {
      if (userMap.has(repo.owner)) {
        // 기존 사용자의 저장소에 추가
        userMap.get(repo.owner).repositories.push(repo);
      } else {
        // 새로운 사용자 생성
        userMap.set(repo.owner, {
          accountAddress: repo.owner,
          nickname: repo.owner,
          repositories: [repo],
        });
      }
    });

    return Array.from(userMap.values());
  }, [recentUsers, recentRepositories]);

  // 실제 사용자 데이터만 사용 (더미 데이터 제거)
  const finalUniverseUsers = universeUsers;

  const handlePlanetClick = (user: string, repo: string) => {
    router.push(`/${user}/${repo}`);
  };

  return (
    <>
      <Head>
        <title>GitHirys (✧ᴗ✧) - 3D Universe</title>
      </Head>

      {/* 3D 우주 환경 */}
      <UniverseScene
        users={finalUniverseUsers}
        onPlanetClick={handlePlanetClick}
      />

      {/* 오버레이 UI */}
      <div className={styles.universeOverlay}>
        {/* 검색 섹션 */}
        <div className={styles.searchOverlay}>
          <div className={styles.searchContainer}>
            <h2>GitHirys Universe</h2>
            <p>3D 우주에서 사용자와 저장소를 탐험해보세요</p>

            <div className={styles.searchInputGroup}>
              <select
                value={searchType}
                onChange={e =>
                  setSearchType(
                    e.target.value as 'repository' | 'nickname' | 'wallet'
                  )
                }
                className={styles.searchTypeSelect}
                disabled={isSearching}
              >
                <option value="repository">Repository</option>
                <option value="nickname">Nickname</option>
                <option value="wallet">Wallet Address(sol)</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  searchType === 'wallet'
                    ? 'Solana Address'
                    : searchType === 'nickname'
                      ? 'User Name... ex) alice, bob123'
                      : 'Repository Name... ex) my-project'
                }
                className={styles.searchInput}
                disabled={isSearching}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className={styles.searchButton}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError && (
              <div className={styles.searchError}>{searchError}</div>
            )}

            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                <h3>검색 결과 ({searchResults.length})</h3>
                <div className={styles.searchResultsGrid}>
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => handleSearchResultClick(result)}
                      className={styles.searchResultItem}
                    >
                      {result.type === 'profile' ? (
                        <div className={styles.profileResult}>
                          {result.profileImageUrl && (
                            <img
                              src={result.profileImageUrl}
                              alt={`${result.nickname}'s profile`}
                              className={styles.profileImage}
                            />
                          )}
                          <div className={styles.profileInfo}>
                            <div className={styles.profileNickname}>
                              {result.nickname}
                            </div>
                            {result.twitterHandle && (
                              <div className={styles.profileTwitter}>
                                @{result.twitterHandle}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : result.type === 'wallet' ? (
                        <div className={styles.walletResult}>
                          <div className={styles.walletDisplayName}>
                            {result.displayName}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.repoResult}>
                          <span>📁</span>
                          <span className={styles.repoName}>{result.name}</span>
                          <span className={styles.repoOwner}>
                            by {result.owner.substring(0, 8)}...
                          </span>
                          <span className={styles.repoBranches}>
                            ({result.branches?.length || 0} branches)
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 통계 섹션 */}
        <div className={styles.statsOverlay}>
          <h3>Universe Stats</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>
                <AnimatedNumber
                  value={
                    dashboardStats?.repositoryCount ||
                    finalUniverseUsers.reduce(
                      (acc, user) => acc + (user.repositories?.length || 0),
                      0
                    )
                  }
                />
              </div>
              <div className={styles.statLabel}>Repositories</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>
                <AnimatedNumber
                  value={dashboardStats?.userCount || finalUniverseUsers.length}
                />
              </div>
              <div className={styles.statLabel}>Users</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNumber}>
                <AnimatedNumber
                  value={
                    dashboardStats?.commitCount ||
                    finalUniverseUsers.reduce(
                      (acc, user) =>
                        acc +
                        (user.repositories?.reduce(
                          (racc, repo) => racc + (repo.branches?.length || 0),
                          0
                        ) || 0),
                      0
                    )
                  }
                />
              </div>
              <div className={styles.statLabel}>Branches</div>
            </div>
          </div>
        </div>

        {/* 조작 가이드 */}
        <div className={styles.controlsGuide}>
          <h4>Universe Controls</h4>

          <div className={styles.controlsSection}>
            <h5>🚀 Movement</h5>
            <div>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> - 이동
            </div>
            <div>
              <kbd>Space</kbd> - 위로
            </div>
            <div>
              <kbd>Shift</kbd> - 아래로
            </div>
          </div>

          <div className={styles.controlsSection}>
            <h5>🖱️ Camera</h5>
            <div>
              <kbd>드래그</kbd> - 회전
            </div>
            <div>
              <kbd>휠</kbd> - 줌
            </div>
          </div>

          <div className={styles.controlsSection}>
            <h5>🎯 Interaction</h5>
            <div>
              <kbd>⭐</kbd> - 사용자 프로필
            </div>
            <div>
              <kbd>🪐</kbd> - 저장소 상세
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
