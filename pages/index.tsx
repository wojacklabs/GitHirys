// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
import {
  createIrysUploader,
  searchRepositories,
  getProfileByNickname,
  ProfileUtils,
  getDashboardStats,
  DashboardStats,
} from '../lib/irys';
import styles from '../styles/HomePage.module.css';
import AnimatedNumber from '../components/AnimatedNumber';

const Home: NextPage = () => {
  const router = useRouter();
  const wallet = useClientWallet();
  const [uploader, setUploader] = useState<any>(null);

  // 대시보드 통계 상태
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<
    'repository' | 'wallet' | 'nickname'
  >('repository');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 대시보드 통계 로드
  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const stats = await getDashboardStats();
        setDashboardStats(stats);
      } catch (error) {
        console.error('대시보드 통계 로드 오류:', error);
      }
    };

    loadDashboardStats();
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
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet.connected, wallet]);

  // 솔라나 지갑 주소 형식 검증
  const isValidSolanaAddress = (address: string): boolean => {
    // 솔라나 주소는 32-44자의 Base58 문자열
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // 검색 함수
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
        // 지갑 주소 검색
        if (isValidSolanaAddress(searchQuery.trim())) {
          // 지갑 정보를 결과 리스트에 표시
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
        // 닉네임 검색 (정확한 일치만 지원)
        // 닉네임 형식 검증
        if (!ProfileUtils.isValidNickname(searchQuery.trim())) {
          setSearchError(
            'Not a valid nickname. (3-20 english letter, number, underbar)'
          );
          return;
        }

        try {
          // 정확한 닉네임 검색
          const profile = await getProfileByNickname(searchQuery.trim());
          if (profile) {
            // 프로필을 결과 리스트에 표시
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
        // 저장소 검색 - 연결된 지갑의 저장소에서 검색

        if (wallet.publicKey) {
          // 연결된 지갑의 저장소에서 검색
          const publicKeyString = wallet.publicKey.toBase58();
          const repos = await searchRepositories(
            publicKeyString,
            publicKeyString
          );
          const matchingRepos = repos.filter(repo =>
            repo.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (matchingRepos.length > 0) {
            setSearchResults(
              matchingRepos.map(repo => ({
                ...repo,
                type: 'repository',
              }))
            );
          } else {
            setSearchError(`Repository called '${searchQuery}' not found`);
          }
        } else {
          setSearchError('Connect your wallet to search repositories.');
        }
      }
    } catch (error) {
      setSearchError('Error occurred while searching');
    } finally {
      setIsSearching(false);
    }
  };

  // 엔터키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 검색 결과 클릭 처리
  const handleSearchResultClick = (result: any) => {
    if (result.type === 'profile') {
      // 프로필 결과인 경우 닉네임 페이지로 이동
      router.push(`/${result.nickname}`);
    } else if (result.type === 'wallet') {
      // 지갑 결과인 경우 지갑 페이지로 이동
      router.push(`/${result.address}`);
    } else if (result.type === 'repository') {
      // 저장소 결과인 경우 저장소 페이지로 이동
      router.push(`/${result.owner}/${result.name}`);
    }
  };

  return (
    <>
      <Head>
        <title>GitHirys (✧ᴗ✧)</title>
      </Head>
      <div className="container">
        {/* 검색 섹션 */}
        <div className={styles.area_search}>
          {/* 검색창 */}
          <div className={styles.area_input_search}>
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
              className={styles.input_search}
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className={`${styles.button_search} ${isSearching || !searchQuery.trim() ? styles.searchButtonDisabled : styles.searchButtonActive}`}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {/* 검색 타입 선택 */}
          <div className={styles.area_search_type}>
            <label className={styles.searchTypeLabel}>
              <input
                type="radio"
                value="repository"
                checked={searchType === 'repository'}
                onChange={e => setSearchType(e.target.value as 'repository')}
                className={styles.searchTypeInput}
              />
              Repository
            </label>
            <label className={styles.searchTypeLabel}>
              <input
                type="radio"
                value="nickname"
                checked={searchType === 'nickname'}
                onChange={e => setSearchType(e.target.value as 'nickname')}
                className={styles.searchTypeInput}
              />
              Nickname
            </label>
            <label className={styles.searchTypeLabel}>
              <input
                type="radio"
                value="wallet"
                checked={searchType === 'wallet'}
                onChange={e => setSearchType(e.target.value as 'wallet')}
                className={styles.searchTypeInput}
              />
              Wallet Address(sol)
            </label>
          </div>
          {/* 검색 오류 */}
          {searchError && (
            <div className={styles.searchError}>{searchError}</div>
          )}
          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className={styles.searchResults}>
              <h3 className={styles.searchResultsTitle}>
                Result ({searchResults.length})
              </h3>
              <div className={styles.searchResultsGrid}>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSearchResultClick(result)}
                    className={styles.searchResultItem}
                  >
                    {result.type === 'profile' ? (
                      // 프로필 결과 표시
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
                            <span className={styles.profileNicknameText}>
                              {result.nickname}
                            </span>
                            {result.twitterHandle && (
                              <span className={styles.profileTwitter}>
                                @{result.twitterHandle}
                              </span>
                            )}
                          </div>
                          <div className={styles.profileWallet}>
                            Wallet Address:{' '}
                            {result.accountAddress.substring(0, 8)}...
                            {result.accountAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
                    ) : result.type === 'wallet' ? (
                      // 지갑 결과 표시
                      <div className={styles.walletResult}>
                        <div>
                          <div className={styles.walletDisplayName}>
                            {result.displayName}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 저장소 결과 표시
                      <div className={styles.repoResult}>
                        <span>📁</span>
                        <span className={styles.repoName}>{result.name}</span>
                        <span className={styles.repoOwner}>
                          by {result.owner.substring(0, 8)}...
                        </span>
                        <span className={styles.repoBranches}>
                          ({result.branches.length} branches)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 대시보드 섹션 */}
        <div className={styles.area_dashboard}>
          <h2 className={styles.title_dashboard}>Statistics</h2>
          <ul className={styles.list_stats}>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.repositoryCount || 0} />
              </div>
              <p className={styles.stats_name}>Repo Number</p>
            </li>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.userCount || 0} />
              </div>
              <p className={styles.stats_name}>User Number</p>
            </li>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.commitCount || 0} />
              </div>
              <p className={styles.stats_name}>Commit Number</p>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Home;
